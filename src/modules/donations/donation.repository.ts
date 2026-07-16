import type { ClientSession, FilterQuery } from 'mongoose';
import Campaign from '../../models/Campaign.model.js';
import Donation, { IDonation } from './donation.model.js';

type DonationListFilters = {
  donorId?: string;
  q?: string;
  status?: string;
  paymentMethod?: string;
  proofStatus?: string;
  currency?: string;
  frequency?: string;
  country?: string;
  anonymous?: boolean;
  sortBy: 'createdAt' | 'amount' | 'status';
  sortOrder: 'asc' | 'desc';
  page: number;
  limit: number;
};

type DonationExportFilters = Omit<DonationListFilters, 'page' | 'limit'>;

const buildEscapedRegex = (value: string) => {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
};

export class DonationRepository {
  async create(payload: Partial<IDonation>, session?: ClientSession | null) {
    const donation = await Donation.create([payload], { session: session ?? undefined });
    return donation[0];
  }

  async findById(id: string) {
    return Donation.findById(id)
      .populate('campaign')
      .populate('donor', 'firstName lastName email role');
  }

  async findByReference(reference: string) {
    return Donation.findOne({ reference })
      .populate('campaign')
      .populate('donor', 'firstName lastName email role');
  }

  async findByPaymentMethodAndTransactionReference(
    paymentMethod: string,
    transactionReference: string,
    excludeDonationId?: string
  ) {
    const query: FilterQuery<IDonation> = {
      paymentMethod,
      transactionReference,
    };

    if (excludeDonationId) {
      query._id = { $ne: excludeDonationId };
    }

    return Donation.findOne(query)
      .populate('campaign')
      .populate('donor', 'firstName lastName email role');
  }

  private async buildQuery(filters: DonationExportFilters | DonationListFilters) {
    const query: FilterQuery<IDonation> = {};

    if (filters.donorId) {
      query.donor = filters.donorId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.paymentMethod) {
      query.paymentMethod = filters.paymentMethod;
    }

    if (filters.proofStatus) {
      query.proofStatus = filters.proofStatus;
    }

    if (filters.currency) {
      query.currency = filters.currency;
    }

    if (filters.frequency) {
      query.frequency = filters.frequency;
    }

    if (filters.country) {
      query.donorCountry = new RegExp(filters.country, 'i');
    }

    if (typeof filters.anonymous === 'boolean') {
      query.anonymous = filters.anonymous;
    }

    if (filters.q) {
      const searchRegex = buildEscapedRegex(filters.q);
      const matchingCampaigns = await Campaign.find({ title: searchRegex }).select('_id').lean();

      query.$or = [
        { reference: searchRegex },
        { donorFirstName: searchRegex },
        { donorLastName: searchRegex },
        { donorEmail: searchRegex },
        { transactionReference: searchRegex },
        { program: searchRegex },
      ];

      if (matchingCampaigns.length > 0) {
        query.$or.push({
          campaign: {
            $in: matchingCampaigns.map((campaign) => campaign._id),
          },
        });
      }
    }

    return query;
  }

  async findMany(filters: DonationListFilters) {
    const query = await this.buildQuery(filters);

    const skip = (filters.page - 1) * filters.limit;
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      Donation.find(query)
        .populate('campaign')
        .populate('donor', 'firstName lastName email role')
        .sort({ [filters.sortBy]: sortDirection })
        .skip(skip)
        .limit(filters.limit),
      Donation.countDocuments(query),
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

  async findAllForExport(filters: DonationExportFilters) {
    const query = await this.buildQuery(filters);
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

    return Donation.find(query)
      .populate('campaign')
      .populate('donor', 'firstName lastName email role')
      .sort({ [filters.sortBy]: sortDirection });
  }

  async updateById(id: string, payload: Partial<IDonation>, session?: ClientSession | null) {
    return Donation.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
      session: session ?? undefined,
    })
      .populate('campaign')
      .populate('donor', 'firstName lastName email role');
  }

  async deleteById(id: string) {
    return Donation.findByIdAndDelete(id);
  }
}

export const donationRepository = new DonationRepository();
