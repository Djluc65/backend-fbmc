import type { Request } from 'express';
import { Types } from 'mongoose';
import Campaign from '../../models/Campaign.model.js';
import type { IUser } from '../../models/User.model.js';
import { deleteStoredAsset, storeUploadedProof } from '../../utils/upload.js';
import { donationRepository } from '../donations/donation.repository.js';
import type { DonationStatus, PaymentMethodCode, ProofStatus } from '../donations/donation.types.js';
import { canTransitionDonationStatus, requiresPaymentProof } from '../donations/donation.utils.js';
import { paymentRepository } from './payment.repository.js';
import type {
  ApprovePaymentProofInput,
  ManualPaymentSubmissionInput,
  PaymentMethodQueryInput,
  PaymentProofListQueryInput,
  PaymentStatusQueryInput,
  RejectPaymentProofInput,
  ReviewPaymentProofInput,
  UpdateDonationStatusInput,
  UpdatePaymentMethodInput,
} from './payment.validation.js';

const createHttpError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const DEFAULT_PAYMENT_METHOD_SETTINGS = [
  {
    code: 'PAYPAL',
    name: 'PayPal',
    description: 'Paiement sécurisé avec votre compte PayPal ou votre carte bancaire.',
    enabled: true,
    displayOrder: 1,
    instructions: 'Après validation, le parcours PayPal réel sera branché dans la phase suivante.',
    publicConfiguration: {},
  },
  {
    code: 'BANK_TRANSFER',
    name: 'Virement bancaire',
    description: 'Effectuez un virement sur le compte officiel de la fondation.',
    enabled: true,
    displayOrder: 2,
    instructions: 'Utilisez impérativement la référence fournie pour rapprocher votre paiement.',
    publicConfiguration: {
      bankName: 'Banque officielle de la fondation',
      accountHolder: 'Fondation Bien Aimé Cassis',
      accountNumberMasked: 'XXXX-XXXX-0000',
      iban: 'HT00 0000 0000 0000 0000 0000',
      swift: 'FBACHTPP',
      currency: 'USD',
      instructions: 'Ajoutez la référence du don dans le libellé du virement.',
    },
  },
  {
    code: 'ZELLE',
    name: 'Zelle',
    description: 'Paiement rapide via Zelle.',
    enabled: true,
    displayOrder: 3,
    instructions: 'Ajoutez la référence du don dans le message Zelle.',
    publicConfiguration: {
      recipientName: 'Fondation Bien Aimé Cassis',
      zelleEmail: 'donations@fondation.ht',
      zellePhone: '+15090000000',
      instructions: 'Ajoutez la référence avant de soumettre votre preuve.',
    },
  },
  {
    code: 'CASH_APP',
    name: 'Cash App',
    description: 'Faire un don avec Cash App.',
    enabled: true,
    displayOrder: 4,
    instructions: 'Conservez une capture de confirmation pour vérification.',
    publicConfiguration: {
      cashtag: '$FondationCassis',
      recipientName: 'Fondation Bien Aimé Cassis',
      qrCodeUrl: '',
      instructions: 'Ajoutez la référence dans la note de paiement.',
    },
  },
  {
    code: 'ON_SITE',
    name: 'Paiement sur place',
    description: 'Je souhaite remettre mon don directement à la fondation.',
    enabled: true,
    displayOrder: 5,
    instructions: 'Présentez-vous avec votre référence de don pour accélérer la validation.',
    publicConfiguration: {
      address:
        "#57, Route de Dégand, Ruelle Titus Prolongée, Carrefour, Département de l'Ouest, Haïti.",
      phone: '+509 31833164',
      hours: 'Du lundi au vendredi, 9h00 à 16h00',
    },
  },
  {
    code: 'CARD',
    name: 'Carte bancaire',
    description: 'Paiement sécurisé par carte bancaire.',
    enabled: false,
    displayOrder: 6,
    instructions: 'Cette méthode sera activée lors de la prochaine phase.',
    publicConfiguration: {},
  },
] as const;

type ProofReviewDecision = 'APPROVED' | 'REJECTED';
const MANUAL_PAYMENT_METHODS = new Set<PaymentMethodCode>(['BANK_TRANSFER', 'ZELLE', 'CASH_APP']);

const normalizeOptionalString = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof error.code === 'number' &&
  error.code === 11000;

const privilegedRoles = new Set([
  'admin',
  'super_admin',
  'finance_manager',
  'manager',
  'donations_manager',
]);

const canAccessDonation = (donation: Awaited<ReturnType<typeof donationRepository.findById>>, user?: IUser | null) => {
  if (!donation) {
    return false;
  }

  if (user && privilegedRoles.has(user.role)) {
    return true;
  }

  if (!user || !donation.donor) {
    return false;
  }

  const donorId =
    typeof donation.donor === 'object' && donation.donor && '_id' in donation.donor
      ? String(donation.donor._id)
      : String(donation.donor);

  return donorId === String(user._id);
};

const getEntityId = (value: unknown) => {
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }

  return value ? String(value) : null;
};

const getObjectIdValue = (value: unknown) => {
  const entityId = getEntityId(value);
  return entityId ? new Types.ObjectId(entityId) : null;
};

const buildPaymentStatusPayload = (options: {
  donation: Awaited<ReturnType<typeof donationRepository.findById>>;
  proof: Awaited<ReturnType<typeof paymentRepository.findProofByDonation>> | null;
  auditTrail: Awaited<ReturnType<typeof paymentRepository.listAuditLogsByDonation>>;
}) => ({
  donationId: String(options.donation!._id),
  reference: options.donation!.reference,
  paymentMethod: options.donation!.paymentMethod,
  donationStatus: options.donation!.status,
  proofStatus: options.donation!.proofStatus,
  transactionReference: options.donation!.transactionReference ?? null,
  amount: options.donation!.amount,
  currency: options.donation!.currency,
  createdAt: options.donation!.createdAt,
  updatedAt: options.donation!.updatedAt,
  proof: options.proof
    ? {
        _id: String(options.proof._id),
        referenceProvided: options.proof.referenceProvided ?? null,
        fileUrl: options.proof.fileUrl,
        originalFileName: options.proof.originalFileName,
        mimeType: options.proof.mimeType,
        fileSize: options.proof.fileSize,
        status: options.proof.status,
        reviewNote: options.proof.reviewNote ?? null,
        reviewedAt: options.proof.reviewedAt ?? null,
      }
    : null,
  history: options.auditTrail.map((entry) => ({
    _id: String(entry._id),
    action: entry.action,
    paymentMethod: entry.paymentMethod,
    donationReference: entry.donationReference,
    transactionReference: entry.transactionReference ?? null,
    actorIp: entry.actorIp ?? null,
    actorEmail: entry.actorEmail ?? null,
    actorRole: entry.actorRole ?? null,
    administrator:
      entry.actorUser && typeof entry.actorUser === 'object' && 'email' in entry.actorUser
        ? {
            _id: String(entry.actorUser._id),
            firstName: 'firstName' in entry.actorUser ? entry.actorUser.firstName : undefined,
            lastName: 'lastName' in entry.actorUser ? entry.actorUser.lastName : undefined,
            email: 'email' in entry.actorUser ? entry.actorUser.email : undefined,
            role: 'role' in entry.actorUser ? entry.actorUser.role : undefined,
          }
        : null,
    previousDonationStatus: entry.previousDonationStatus,
    newDonationStatus: entry.newDonationStatus,
    previousProofStatus: entry.previousProofStatus,
    newProofStatus: entry.newProofStatus,
    note: entry.note ?? null,
    createdAt: entry.createdAt,
  })),
});

const updateCampaignTotalsIfNeeded = async ({
  donationId,
  nextStatus,
}: {
  donationId: string;
  nextStatus: DonationStatus;
}) => {
  const donation = await donationRepository.findById(donationId);

  if (!donation) {
    throw createHttpError('Don introuvable.', 404);
  }

  const rawCampaign = donation.campaign;
  const campaignId =
    rawCampaign && typeof rawCampaign === 'object' && '_id' in rawCampaign
      ? String(rawCampaign._id)
      : rawCampaign
        ? String(rawCampaign)
        : null;

  if (!campaignId) {
    return donation;
  }

  if (nextStatus === 'COMPLETED' && !donation.countedInCampaignTotals) {
    await Campaign.findByIdAndUpdate(campaignId, {
      $inc: { raisedAmount: donation.amount },
    });
    return donationRepository.updateById(donationId, {
      countedInCampaignTotals: true,
      completedAt: new Date(),
    });
  }

  if (
    ['FAILED', 'CANCELLED', 'REFUNDED', 'REJECTED'].includes(nextStatus) &&
    donation.countedInCampaignTotals
  ) {
    await Campaign.findByIdAndUpdate(campaignId, {
      $inc: { raisedAmount: -donation.amount },
    });
    return donationRepository.updateById(donationId, {
      countedInCampaignTotals: false,
      cancelledAt: new Date(),
    });
  }

  return donation;
};

export class PaymentService {
  async ensurePaymentMethodsSeeded() {
    await paymentRepository.upsertDefaultPaymentMethods([...DEFAULT_PAYMENT_METHOD_SETTINGS]);
  }

  async getPublicPaymentMethods(filters?: PaymentMethodQueryInput) {
    await this.ensurePaymentMethodsSeeded();
    const methods = await paymentRepository.findPaymentMethods({
      enabled: filters?.enabled ?? true,
    });

    return methods.map((method) => ({
      id: method.code,
      code: method.code,
      name: method.name,
      description: method.description,
      enabled: method.enabled,
      displayOrder: method.displayOrder,
      iconUrl: method.iconUrl,
      instructions: method.instructions,
      publicConfiguration: method.publicConfiguration ?? {},
    }));
  }

  async getAdminPaymentMethods() {
    await this.ensurePaymentMethodsSeeded();
    return paymentRepository.findPaymentMethods();
  }

  async getPaymentMethodByCodeOrThrow(code: PaymentMethodCode, requireEnabled = false) {
    await this.ensurePaymentMethodsSeeded();
    const method = await paymentRepository.findPaymentMethodByCode(code);

    if (!method) {
      throw createHttpError('Moyen de paiement introuvable.', 404);
    }

    if (requireEnabled && !method.enabled) {
      throw createHttpError('Ce moyen de paiement est actuellement désactivé.', 400);
    }

    return method;
  }

  async updatePaymentMethod(id: string, payload: UpdatePaymentMethodInput) {
    const method = await paymentRepository.updatePaymentMethod(id, {
      ...payload,
      iconUrl: normalizeOptionalString(payload.iconUrl),
      instructions: normalizeOptionalString(payload.instructions),
    });

    if (!method) {
      throw createHttpError('Méthode de paiement introuvable.', 404);
    }

    return method;
  }

  private async recordAuditLog(options: {
    donationId: string;
    paymentMethod: PaymentMethodCode;
    donationReference: string;
    transactionReference?: string;
    actor?: IUser | null;
    actorIp?: string;
    action: 'MANUAL_PAYMENT_SUBMITTED' | 'PAYMENT_PROOF_APPROVED' | 'PAYMENT_PROOF_REJECTED';
    previousDonationStatus: DonationStatus;
    newDonationStatus: DonationStatus;
    previousProofStatus: ProofStatus;
    newProofStatus: ProofStatus;
    note?: string;
  }) {
    await paymentRepository.createAuditLog({
      donation: new Types.ObjectId(options.donationId),
      paymentMethod: options.paymentMethod,
      donationReference: options.donationReference,
      transactionReference: normalizeOptionalString(options.transactionReference),
      actorUser: options.actor?._id ?? null,
      actorRole: options.actor?.role,
      actorIp: normalizeOptionalString(options.actorIp),
      actorEmail: options.actor?.email,
      action: options.action,
      previousDonationStatus: options.previousDonationStatus,
      newDonationStatus: options.newDonationStatus,
      previousProofStatus: options.previousProofStatus,
      newProofStatus: options.newProofStatus,
      note: normalizeOptionalString(options.note),
    });
  }

  private async notifyFinanceManagers(_context: { donationId: string; reference: string; paymentMethod: PaymentMethodCode }) {
    return;
  }

  private async notifyDonor(_context: { donationId: string; reference: string; outcome: 'APPROVED' | 'REJECTED' }) {
    return;
  }

  private async generateReceiptPdf(_context: { donationId: string; reference: string }) {
    return null;
  }

  private async assertManualPaymentSubmissionAllowed(
    donationId: string,
    user: IUser | null | undefined,
    referenceProvided?: string
  ) {
    const donation = await donationRepository.findById(donationId);

    if (!donation) {
      throw createHttpError('Don introuvable.', 404);
    }

    if (!MANUAL_PAYMENT_METHODS.has(donation.paymentMethod)) {
      throw createHttpError("Ce don n'accepte pas de paiement manuel avec preuve.", 400);
    }

    if (donation.donor) {
      if (!canAccessDonation(donation, user)) {
        throw createHttpError("Vous n'êtes pas autorisé à téléverser cette preuve.", 403);
      }
    } else if (normalizeOptionalString(referenceProvided) !== donation.reference) {
      throw createHttpError('La référence du don est requise pour ce téléversement.', 403);
    }

    if (!['PENDING', 'REJECTED'].includes(donation.status)) {
      throw createHttpError('Ce paiement manuel ne peut plus être modifié.', 409);
    }

    const existingProof = await paymentRepository.findProofByDonation(donationId);

    if (existingProof?.status === 'APPROVED') {
      throw createHttpError('Ce paiement a déjà été approuvé.', 409);
    }

    if (existingProof?.status === 'PENDING_REVIEW') {
      throw createHttpError('Une preuve est déjà en cours de validation.', 409);
    }

    return {
      donation,
      existingProof,
    };
  }

  async submitManualPayment(options: {
    donationId: string;
    payload: ManualPaymentSubmissionInput;
    file: Express.Multer.File;
    request: Request;
    user?: IUser | null;
  }) {
    const normalizedReference = normalizeOptionalString(options.payload.reference);

    if (!normalizedReference) {
      throw createHttpError('La référence de transaction est obligatoire.', 400);
    }

    const { donation, existingProof } = await this.assertManualPaymentSubmissionAllowed(
      options.donationId,
      options.user,
      options.payload.reference
    );

    const duplicateReference = await donationRepository.findByPaymentMethodAndTransactionReference(
      donation.paymentMethod,
      normalizedReference,
      options.donationId
    );

    if (duplicateReference) {
      throw createHttpError('Cette référence de transaction est déjà utilisée.', 409);
    }

    const duplicateProofReference = await paymentRepository.findProofByMethodAndReference(
      donation.paymentMethod,
      normalizedReference,
      options.donationId
    );

    if (duplicateProofReference) {
      throw createHttpError('Cette référence de transaction est déjà utilisée.', 409);
    }

    const storedProof = await storeUploadedProof(options.request, options.file);
    const previousDonationStatus = donation.status;
    const previousProofStatus = donation.proofStatus;

    try {
      const paymentProof = await paymentRepository.upsertPaymentProof(options.donationId, {
        paymentMethod: donation.paymentMethod,
        referenceProvided: normalizedReference,
        fileUrl: storedProof.url,
        filePublicId: storedProof.publicId,
        originalFileName: options.file.originalname,
        mimeType: options.file.mimetype,
        fileSize: options.file.size,
        status: 'PENDING_REVIEW',
        reviewNote: undefined,
        uploadedBy: options.user?._id ?? null,
        reviewedBy: null,
        reviewedAt: null,
      });

      const updatedDonation = await donationRepository.updateById(options.donationId, {
        transactionReference: normalizedReference,
        proofStatus: 'PENDING_REVIEW',
        status: 'UNDER_REVIEW',
        cancelledAt: null,
      });

      if (!updatedDonation) {
        throw createHttpError("Impossible de mettre à jour l'état du don.", 400);
      }

      if (existingProof) {
        await deleteStoredAsset({
          publicId: existingProof.filePublicId,
          fileUrl: existingProof.fileUrl,
          mimeType: existingProof.mimeType,
        });
      }

      await paymentRepository.createTransaction({
        donation: donation._id,
        provider: donation.paymentMethod,
        internalReference: donation.reference,
        providerTransactionId: normalizedReference,
        amount: donation.amount,
        currency: donation.currency,
        status: 'UNDER_REVIEW',
        providerStatus: 'PROOF_SUBMITTED',
        processedAt: new Date(),
        rawResponse: {
          source: 'manual_payment_submission',
        },
      });

      await this.recordAuditLog({
        donationId: String(donation._id),
        paymentMethod: donation.paymentMethod,
        donationReference: donation.reference,
        transactionReference: normalizedReference,
        actor: options.user,
        actorIp: options.request.ip,
        action: 'MANUAL_PAYMENT_SUBMITTED',
        previousDonationStatus,
        newDonationStatus: 'UNDER_REVIEW',
        previousProofStatus,
        newProofStatus: 'PENDING_REVIEW',
        note: 'Soumission d’une preuve de paiement manuel.',
      });

      await this.notifyFinanceManagers({
        donationId: String(donation._id),
        reference: donation.reference,
        paymentMethod: donation.paymentMethod,
      });

      return {
        donation: updatedDonation,
        proof: paymentProof,
      };
    } catch (error) {
      await deleteStoredAsset({
        publicId: storedProof.publicId,
        fileUrl: storedProof.url,
        mimeType: options.file.mimetype,
      });

      if (isDuplicateKeyError(error)) {
        throw createHttpError('Cette référence de transaction est déjà utilisée.', 409);
      }

      throw error;
    }
  }

  async uploadPaymentProof(options: {
    donationId: string;
    file: Express.Multer.File;
    request: Request;
    user?: IUser | null;
    referenceProvided?: string;
  }) {
    const result = await this.submitManualPayment({
      donationId: options.donationId,
      payload: {
        id: options.donationId,
        reference: options.referenceProvided ?? '',
      },
      file: options.file,
      request: options.request,
      user: options.user,
    });

    return result.proof;
  }

  async deletePaymentProof(options: {
    donationId: string;
    user?: IUser | null;
    referenceProvided?: string;
  }) {
    const donation = await donationRepository.findById(options.donationId);

    if (!donation) {
      throw createHttpError('Don introuvable.', 404);
    }

    if (donation.donor) {
      if (!canAccessDonation(donation, options.user)) {
        throw createHttpError("Vous n'êtes pas autorisé à supprimer cette preuve.", 403);
      }
    } else if (normalizeOptionalString(options.referenceProvided) !== donation.reference) {
      throw createHttpError('La référence du don est requise pour supprimer cette preuve.', 403);
    }

    const existingProof = await paymentRepository.findProofByDonation(options.donationId);

    if (!existingProof) {
      throw createHttpError('Aucune preuve à supprimer.', 404);
    }

    if (existingProof.status === 'APPROVED') {
      throw createHttpError('Une preuve approuvée ne peut pas être supprimée.', 409);
    }

    await paymentRepository.deletePaymentProofByDonation(options.donationId);
    await deleteStoredAsset({
      publicId: existingProof.filePublicId,
      fileUrl: existingProof.fileUrl,
      mimeType: existingProof.mimeType,
    });

    const updatedDonation = await donationRepository.updateById(options.donationId, {
      proofStatus: 'NOT_UPLOADED',
      status: 'PENDING',
      transactionReference: undefined,
    });

    return updatedDonation;
  }

  async getDonationPaymentStatus(options: {
    donationId: string;
    user?: IUser | null;
    referenceProvided?: string;
  }) {
    const donation = await donationRepository.findById(options.donationId);

    if (!donation) {
      throw createHttpError('Don introuvable.', 404);
    }

    if (donation.donor) {
      if (!canAccessDonation(donation, options.user)) {
        throw createHttpError("Vous n'êtes pas autorisé à consulter ce paiement.", 403);
      }
    } else if (normalizeOptionalString(options.referenceProvided) !== donation.reference) {
      throw createHttpError('La référence du don est requise pour consulter ce paiement.', 403);
    }

    const [proof, auditTrail] = await Promise.all([
      paymentRepository.findProofByDonation(options.donationId),
      paymentRepository.listAuditLogsByDonation(options.donationId),
    ]);

    return buildPaymentStatusPayload({
      donation,
      proof,
      auditTrail,
    });
  }

  async listPaymentProofs(query: PaymentProofListQueryInput) {
    return paymentRepository.listPaymentProofs(query);
  }

  async approvePaymentProof(proofId: string, payload: ApprovePaymentProofInput, reviewer: IUser, request?: Request) {
    const proof = await paymentRepository.findPaymentProofById(proofId);

    if (!proof) {
      throw createHttpError('Preuve de paiement introuvable.', 404);
    }

    if (proof.status === 'APPROVED' || proof.status === 'REJECTED') {
      throw createHttpError('Cette preuve a déjà été traitée.', 409);
    }

    const donationId = getEntityId(proof.donation);

    if (!donationId) {
      throw createHttpError('Don introuvable.', 404);
    }

    const donation = await donationRepository.findById(donationId);

    if (!donation) {
      throw createHttpError('Don introuvable.', 404);
    }

    if (!canTransitionDonationStatus(donation.status, 'COMPLETED')) {
      throw createHttpError('Transition de statut non autorisée.', 409);
    }

    const previousDonationStatus = donation.status;
    const previousProofStatus = donation.proofStatus;
    const updatedProof = await paymentRepository.upsertPaymentProof(String(donation._id), {
      paymentMethod: proof.paymentMethod,
      referenceProvided: proof.referenceProvided,
      fileUrl: proof.fileUrl,
      filePublicId: proof.filePublicId,
      originalFileName: proof.originalFileName,
      mimeType: proof.mimeType,
      fileSize: proof.fileSize,
      status: 'APPROVED',
      reviewNote: normalizeOptionalString(payload.reviewNote),
      uploadedBy: getObjectIdValue(proof.uploadedBy),
      reviewedBy: reviewer._id,
      reviewedAt: new Date(),
    });

    await donationRepository.updateById(donationId, {
      proofStatus: 'APPROVED',
      status: 'COMPLETED',
      completedAt: new Date(),
      cancelledAt: null,
    });

    await updateCampaignTotalsIfNeeded({
      donationId,
      nextStatus: 'COMPLETED',
    });

    await paymentRepository.createTransaction({
      donation: donation._id,
      provider: donation.paymentMethod,
      internalReference: donation.reference,
      providerTransactionId: proof.referenceProvided,
      amount: donation.amount,
      currency: donation.currency,
      status: 'COMPLETED',
      providerStatus: 'MANUALLY_APPROVED',
      processedAt: new Date(),
      rawResponse: {
        reviewedBy: reviewer.email,
        source: 'admin_payment_proof_approve',
      },
    });

    await this.recordAuditLog({
      donationId,
      paymentMethod: donation.paymentMethod,
      donationReference: donation.reference,
      transactionReference: proof.referenceProvided,
      actor: reviewer,
      actorIp: request?.ip,
      action: 'PAYMENT_PROOF_APPROVED',
      previousDonationStatus,
      newDonationStatus: 'COMPLETED',
      previousProofStatus,
      newProofStatus: 'APPROVED',
      note: payload.reviewNote,
    });

    await this.notifyDonor({
      donationId,
      reference: donation.reference,
      outcome: 'APPROVED',
    });

    await this.generateReceiptPdf({
      donationId,
      reference: donation.reference,
    });

    return updatedProof;
  }

  async rejectPaymentProof(proofId: string, payload: RejectPaymentProofInput, reviewer: IUser, request?: Request) {
    const proof = await paymentRepository.findPaymentProofById(proofId);

    if (!proof) {
      throw createHttpError('Preuve de paiement introuvable.', 404);
    }

    if (proof.status === 'APPROVED' || proof.status === 'REJECTED') {
      throw createHttpError('Cette preuve a déjà été traitée.', 409);
    }

    const donationId = getEntityId(proof.donation);

    if (!donationId) {
      throw createHttpError('Don introuvable.', 404);
    }

    const donation = await donationRepository.findById(donationId);

    if (!donation) {
      throw createHttpError('Don introuvable.', 404);
    }

    if (!canTransitionDonationStatus(donation.status, 'REJECTED')) {
      throw createHttpError('Transition de statut non autorisée.', 409);
    }

    const previousDonationStatus = donation.status;
    const previousProofStatus = donation.proofStatus;
    const updatedProof = await paymentRepository.upsertPaymentProof(donationId, {
      paymentMethod: proof.paymentMethod,
      referenceProvided: proof.referenceProvided,
      fileUrl: proof.fileUrl,
      filePublicId: proof.filePublicId,
      originalFileName: proof.originalFileName,
      mimeType: proof.mimeType,
      fileSize: proof.fileSize,
      status: 'REJECTED',
      reviewNote: payload.reason,
      uploadedBy: getObjectIdValue(proof.uploadedBy),
      reviewedBy: reviewer._id,
      reviewedAt: new Date(),
    });

    await donationRepository.updateById(donationId, {
      proofStatus: 'REJECTED',
      status: 'REJECTED',
      completedAt: null,
      cancelledAt: new Date(),
    });

    await this.recordAuditLog({
      donationId,
      paymentMethod: donation.paymentMethod,
      donationReference: donation.reference,
      transactionReference: proof.referenceProvided,
      actor: reviewer,
      actorIp: request?.ip,
      action: 'PAYMENT_PROOF_REJECTED',
      previousDonationStatus,
      newDonationStatus: 'REJECTED',
      previousProofStatus,
      newProofStatus: 'REJECTED',
      note: payload.reason,
    });

    await this.notifyDonor({
      donationId,
      reference: donation.reference,
      outcome: 'REJECTED',
    });

    return updatedProof;
  }

  async reviewPaymentProof(proofId: string, payload: ReviewPaymentProofInput, reviewer: IUser, request?: Request) {
    if (payload.status === 'APPROVED') {
      return this.approvePaymentProof(proofId, { reviewNote: payload.reviewNote }, reviewer, request);
    }

    return this.rejectPaymentProof(
      proofId,
      { reason: payload.reviewNote || 'Paiement manuel rejeté par un administrateur.' },
      reviewer,
      request
    );
  }

  async updateDonationStatus(donationId: string, payload: UpdateDonationStatusInput) {
    const donation = await donationRepository.findById(donationId);

    if (!donation) {
      throw createHttpError('Don introuvable.', 404);
    }

    if (!canTransitionDonationStatus(donation.status, payload.status)) {
      throw createHttpError('Transition de statut non autorisée.', 409);
    }

    if (
      payload.status === 'COMPLETED' &&
      MANUAL_PAYMENT_METHODS.has(donation.paymentMethod) &&
      donation.proofStatus !== 'APPROVED'
    ) {
      throw createHttpError(
        "Un paiement manuel ne peut pas être marqué comme complété sans preuve approuvée.",
        409
      );
    }

    const updatedDonation = await donationRepository.updateById(donationId, {
      status: payload.status,
      completedAt: payload.status === 'COMPLETED' ? new Date() : donation.completedAt,
      cancelledAt:
        payload.status === 'CANCELLED' || payload.status === 'REJECTED'
          ? new Date()
          : donation.cancelledAt,
    });

    if (!updatedDonation) {
      throw createHttpError('Impossible de mettre à jour ce don.', 400);
    }

    await updateCampaignTotalsIfNeeded({
      donationId,
      nextStatus: payload.status,
    });

    return donationRepository.findById(donationId);
  }
}

export const paymentService = new PaymentService();
