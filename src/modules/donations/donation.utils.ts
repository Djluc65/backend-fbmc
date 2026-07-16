import crypto from 'node:crypto';
import type {
  DonationDesignation,
  DonationStatus,
  PaymentMethodCode,
  ProofStatus,
} from './donation.types.js';

const proofRequiredMethods = new Set<PaymentMethodCode>(['BANK_TRANSFER', 'ZELLE', 'CASH_APP']);

export const buildDonationReference = (year = new Date().getFullYear()) => {
  const randomBlock = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `FBAC-DON-${year}-${randomBlock}`;
};

export const getInitialDonationStatus = (_paymentMethod: PaymentMethodCode): DonationStatus => 'PENDING';

export const getInitialProofStatus = (paymentMethod: PaymentMethodCode): ProofStatus =>
  proofRequiredMethods.has(paymentMethod) ? 'NOT_UPLOADED' : 'NOT_REQUIRED';

export const requiresPaymentProof = (paymentMethod: PaymentMethodCode) =>
  proofRequiredMethods.has(paymentMethod);

export const normalizeDesignation = (designation: string): DonationDesignation => {
  const normalized = designation.toUpperCase();

  if (normalized === 'GENERAL' || normalized === 'CAMPAIGN' || normalized === 'PROGRAM') {
    return normalized;
  }

  if (designation === 'general') {
    return 'GENERAL';
  }

  if (designation === 'campaign') {
    return 'CAMPAIGN';
  }

  return 'PROGRAM';
};

export const normalizePaymentMethod = (paymentMethod: string): PaymentMethodCode => {
  const normalized = paymentMethod.toUpperCase();

  if (normalized === 'BANK_TRANSFER' || normalized === 'ZELLE' || normalized === 'CASH_APP') {
    return normalized;
  }

  if (normalized === 'PAYPAL' || normalized === 'ON_SITE' || normalized === 'CARD') {
    return normalized;
  }

  if (paymentMethod === 'paypal') {
    return 'PAYPAL';
  }

  if (paymentMethod === 'bank_transfer') {
    return 'BANK_TRANSFER';
  }

  if (paymentMethod === 'cash_app') {
    return 'CASH_APP';
  }

  if (paymentMethod === 'zelle') {
    return 'ZELLE';
  }

  if (paymentMethod === 'card') {
    return 'CARD';
  }

  return 'ON_SITE';
};

export const normalizeFrequency = (frequency: string) => {
  if (frequency.toUpperCase() === 'MONTHLY' || frequency.toLowerCase() === 'monthly') {
    return 'MONTHLY' as const;
  }

  return 'ONE_TIME' as const;
};

export const canTransitionDonationStatus = (
  currentStatus: DonationStatus,
  nextStatus: DonationStatus
) => {
  if (currentStatus === nextStatus) {
    return true;
  }

  const allowedTransitions: Record<DonationStatus, DonationStatus[]> = {
    DRAFT: ['PENDING', 'CANCELLED'],
    PENDING: ['PROCESSING', 'UNDER_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED'],
    PROCESSING: ['UNDER_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED'],
    UNDER_REVIEW: ['COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED'],
    COMPLETED: ['REFUNDED'],
    FAILED: [],
    CANCELLED: [],
    REFUNDED: [],
    REJECTED: ['PENDING', 'UNDER_REVIEW'],
  };

  return allowedTransitions[currentStatus].includes(nextStatus);
};
