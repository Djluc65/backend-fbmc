import type { Request } from 'express';
import { Types } from 'mongoose';
import Campaign from '../../models/Campaign.model.js';
import type { IUser } from '../../models/User.model.js';
import { buildDonationExcelXml } from './donation.export.js';
import PaymentAuditLog from '../payments/payment-audit.model.js';
import PaymentProof from '../payments/payment-proof.model.js';
import PaymentTransaction from '../payments/payment-transaction.model.js';
import { paymentRepository } from '../payments/payment.repository.js';
import { paymentService } from '../payments/payment.service.js';
import {
  buildDashboardStats,
  buildDonationStatistics,
  type DonationAnalyticsRangeInput,
} from './donation.analytics.js';
import { donationRepository } from './donation.repository.js';
import type { IDonation } from './donation.model.js';
import type { DonationInstructionsPayload } from './donation.types.js';
import { buildDonationReference, getInitialDonationStatus, getInitialProofStatus } from './donation.utils.js';
import type {
  CreateDonationInput,
  DonationListQueryInput,
  UpdateDonationInput,
} from './donation.validation.js';

const createHttpError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const normalizeOptionalString = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const sanitizeDonationForReferenceLookup = (donation: IDonation) => ({
  _id: donation._id,
  reference: donation.reference,
  amount: donation.amount,
  currency: donation.currency,
  paymentMethod: donation.paymentMethod,
  status: donation.status,
  proofStatus: donation.proofStatus,
  designation: donation.designation,
  campaign: donation.campaign,
  program: donation.program,
  anonymous: donation.anonymous,
  createdAt: donation.createdAt,
  updatedAt: donation.updatedAt,
});

const isDonationOwnedByUser = (donation: IDonation, user?: IUser | null) => {
  if (!user || !donation.donor) {
    return false;
  }

  const donationOwnerId =
    typeof donation.donor === 'object' && donation.donor && '_id' in donation.donor
      ? String(donation.donor._id)
      : String(donation.donor);

  return donationOwnerId === String(user._id);
};

export class DonationService {
  async generateUniqueReference() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = buildDonationReference();
      const existingDonation = await donationRepository.findByReference(reference);

      if (!existingDonation) {
        return reference;
      }
    }

    throw createHttpError('Impossible de générer une référence de don unique.', 500);
  }

  async createDonation(input: CreateDonationInput, req: Request, user?: IUser | null) {
    if (!user && process.env.DONATIONS_ALLOW_GUESTS === 'false') {
      throw createHttpError("Les dons invités sont désactivés pour le moment.", 401);
    }

    await paymentService.getPaymentMethodByCodeOrThrow(input.paymentMethod, true);

    if (input.paymentMethod === 'CARD') {
      throw createHttpError('Le paiement par carte bancaire est désactivé pour le moment.', 400);
    }

    if (input.designation === 'CAMPAIGN') {
      const campaign = await Campaign.findById(input.campaignId);

      if (!campaign) {
        throw createHttpError('La campagne sélectionnée est introuvable.', 404);
      }
    }

    const reference = await this.generateUniqueReference();
    const donation = await donationRepository.create({
      reference,
      donor: user?._id ?? null,
      donorFirstName: user?.firstName ?? input.donorFirstName,
      donorLastName: user?.lastName ?? input.donorLastName,
      donorEmail: user?.email ?? input.donorEmail,
      donorPhone: normalizeOptionalString(input.donorPhone),
      donorCountry: normalizeOptionalString(input.donorCountry),
      campaign: input.campaignId ? new Types.ObjectId(input.campaignId) : null,
      program: normalizeOptionalString(input.program),
      designation: input.designation,
      amount: input.amount,
      currency: input.currency,
      frequency: input.frequency,
      paymentMethod: input.paymentMethod,
      status: getInitialDonationStatus(input.paymentMethod),
      proofStatus: getInitialProofStatus(input.paymentMethod),
      anonymous: input.anonymous,
      message: normalizeOptionalString(input.message),
      transactionReference: normalizeOptionalString(input.transactionReference),
      donorIp: normalizeOptionalString(req.ip),
      userAgent: normalizeOptionalString(req.get('user-agent')),
    });

    await paymentRepository.createTransaction({
      donation: donation._id,
      provider: input.paymentMethod,
      internalReference: reference,
      amount: input.amount,
      currency: input.currency,
      status: donation.status,
      providerStatus: 'INITIATED',
      rawResponse: {
        source: 'donation_creation',
      },
    });

    const paymentMethodSetting = await paymentService.getPaymentMethodByCodeOrThrow(input.paymentMethod);

    return {
      donation: await donationRepository.findById(String(donation._id)),
      paymentInstructions: {
        code: paymentMethodSetting.code,
        name: paymentMethodSetting.name,
        description: paymentMethodSetting.description,
        instructions: paymentMethodSetting.instructions,
        publicConfiguration: paymentMethodSetting.publicConfiguration ?? {},
      } satisfies DonationInstructionsPayload,
    };
  }

  async listAdminDonations(filters: DonationListQueryInput) {
    return donationRepository.findMany(filters);
  }

  async exportAdminDonations(filters: DonationListQueryInput) {
    const donations = await donationRepository.findAllForExport({
      donorId: undefined,
      q: filters.q,
      status: filters.status,
      paymentMethod: filters.paymentMethod,
      proofStatus: filters.proofStatus,
      currency: filters.currency,
      frequency: filters.frequency,
      country: filters.country,
      anonymous: filters.anonymous,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });

    const fileContent = buildDonationExcelXml(donations);
    const dateLabel = new Date().toISOString().slice(0, 10);

    return {
      fileName: `dons-${dateLabel}.xls`,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      fileContent,
      count: donations.length,
    };
  }

  async getDashboardStats(filters: DonationAnalyticsRangeInput) {
    return buildDashboardStats(filters);
  }

  async getDonationStatistics(filters: DonationAnalyticsRangeInput) {
    return buildDonationStatistics(filters);
  }

  async listUserDonations(filters: DonationListQueryInput, user: IUser) {
    return donationRepository.findMany({
      ...filters,
      donorId: String(user._id),
    });
  }

  private async getDonationDocumentById(id: string) {
    const donation = await donationRepository.findById(id);

    if (!donation) {
      throw createHttpError('Don introuvable.', 404);
    }

    return donation;
  }

  async getDonationByIdForAdmin(id: string) {
    const donation = await this.getDonationDocumentById(id);

    const [paymentProof, transactions, history, donorSummaryResult] = await Promise.all([
      PaymentProof.findOne({ donation: donation._id }).populate('reviewedBy', 'firstName lastName email role'),
      PaymentTransaction.find({ donation: donation._id }).sort({ createdAt: -1 }),
      PaymentAuditLog.find({ donation: donation._id })
        .sort({ createdAt: -1 })
        .populate('actorUser', 'firstName lastName email role'),
      donation.donorEmail
        ? PaymentTransaction.db
            .collection('donations')
            .aggregate<{
              totalDonations: number;
              totalAmount: number;
              firstDonationAt: Date;
              lastDonationAt: Date;
            }>([
              {
                $match: {
                  donorEmail: donation.donorEmail.toLowerCase(),
                },
              },
              {
                $group: {
                  _id: null,
                  totalDonations: { $sum: 1 },
                  totalAmount: { $sum: '$amount' },
                  firstDonationAt: { $min: '$createdAt' },
                  lastDonationAt: { $max: '$createdAt' },
                },
              },
            ])
            .toArray()
        : Promise.resolve([]),
    ]);

    return {
      donation,
      paymentProof,
      transactions,
      history,
      donorSummary: donorSummaryResult[0]
        ? {
            totalDonations: donorSummaryResult[0].totalDonations,
            totalAmount: Number(donorSummaryResult[0].totalAmount.toFixed(2)),
            firstDonationAt: donorSummaryResult[0].firstDonationAt,
            lastDonationAt: donorSummaryResult[0].lastDonationAt,
          }
        : {
            totalDonations: 1,
            totalAmount: donation.amount,
            firstDonationAt: donation.createdAt,
            lastDonationAt: donation.createdAt,
          },
    };
  }

  async getDonationByIdForUser(id: string, user: IUser) {
    const donation = await this.getDonationDocumentById(id);

    if (!isDonationOwnedByUser(donation, user)) {
      throw createHttpError("Vous n'êtes pas autorisé à consulter ce don.", 403);
    }

    return donation;
  }

  async getDonationByReference(reference: string, user?: IUser | null) {
    const donation = await donationRepository.findByReference(reference);

    if (!donation) {
      throw createHttpError('Don introuvable.', 404);
    }

    const privilegedRoles = new Set([
      'admin',
      'super_admin',
      'finance_manager',
      'manager',
      'donations_manager',
    ]);

    if (user && (privilegedRoles.has(user.role) || isDonationOwnedByUser(donation, user))) {
      return donation;
    }

    return sanitizeDonationForReferenceLookup(donation);
  }

  async updateDonation(id: string, payload: UpdateDonationInput, user: IUser) {
    const donation = await this.getDonationDocumentById(id);

    if (!isDonationOwnedByUser(donation, user)) {
      throw createHttpError("Vous n'êtes pas autorisé à modifier ce don.", 403);
    }

    const updatedDonation = await donationRepository.updateById(id, {
      anonymous: payload.anonymous ?? donation.anonymous,
      message: normalizeOptionalString(payload.message) ?? donation.message,
    });

    if (!updatedDonation) {
      throw createHttpError('Impossible de mettre à jour ce don.', 400);
    }

    return updatedDonation;
  }

  async listAdminTransactions(filters: {
    q?: string;
    status?: string;
    paymentMethod?: string;
    page: number;
    limit: number;
  }) {
    const query: Record<string, unknown> = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.paymentMethod) {
      query.provider = filters.paymentMethod;
    }

    if (filters.q) {
      const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      query.$or = [
        { internalReference: searchRegex },
        { providerTransactionId: searchRegex },
        { providerStatus: searchRegex },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
      PaymentTransaction.find(query)
        .populate('donation', 'reference donorFirstName donorLastName donorEmail amount currency status paymentMethod')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit),
      PaymentTransaction.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  }

  async listAdminAuditLogs(filters: {
    q?: string;
    action?: string;
    paymentMethod?: string;
    page: number;
    limit: number;
  }) {
    const query: Record<string, unknown> = {};

    if (filters.action) {
      query.action = filters.action;
    }

    if (filters.paymentMethod) {
      query.paymentMethod = filters.paymentMethod;
    }

    if (filters.q) {
      const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      query.$or = [{ donationReference: searchRegex }, { transactionReference: searchRegex }, { actorEmail: searchRegex }];
    }

    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
      PaymentAuditLog.find(query)
        .populate('donation', 'reference donorFirstName donorLastName donorEmail amount currency status')
        .populate('actorUser', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit),
      PaymentAuditLog.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  }
}

export const donationService = new DonationService();
