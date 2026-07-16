export const PAYMENT_METHOD_VALUES = [
  'PAYPAL',
  'BANK_TRANSFER',
  'ZELLE',
  'CASH_APP',
  'ON_SITE',
  'CARD',
] as const;

export const DONATION_STATUS_VALUES = [
  'DRAFT',
  'PENDING',
  'PROCESSING',
  'UNDER_REVIEW',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'REJECTED',
] as const;

export const PROOF_STATUS_VALUES = [
  'NOT_REQUIRED',
  'NOT_UPLOADED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
] as const;

export const DONATION_FREQUENCY_VALUES = ['ONE_TIME', 'MONTHLY'] as const;
export const CURRENCY_VALUES = ['USD', 'HTG', 'CAD', 'EUR'] as const;
export const DONATION_DESIGNATION_VALUES = ['GENERAL', 'CAMPAIGN', 'PROGRAM'] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHOD_VALUES)[number];
export type DonationStatus = (typeof DONATION_STATUS_VALUES)[number];
export type ProofStatus = (typeof PROOF_STATUS_VALUES)[number];
export type DonationFrequency = (typeof DONATION_FREQUENCY_VALUES)[number];
export type CurrencyCode = (typeof CURRENCY_VALUES)[number];
export type DonationDesignation = (typeof DONATION_DESIGNATION_VALUES)[number];

export interface DonationInstructionsPayload {
  code: PaymentMethodCode;
  name: string;
  description: string;
  instructions?: string;
  publicConfiguration?: Record<string, unknown>;
}
