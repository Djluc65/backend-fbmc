import mongoose, { Document, Schema, Types } from 'mongoose';

export const DONATION_TYPES = ['general', 'program', 'campaign'] as const;
export const DONATION_FREQUENCIES = ['one_time', 'monthly', 'weekly', 'yearly'] as const;
export const DONATION_PAYMENT_METHODS = [
  'paypal',
  'card',
  'bank_transfer',
  'zelle',
  'cash_app',
  'other',
] as const;
export const DONATION_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
  'under_review',
] as const;
export const DONATION_CURRENCIES = ['USD', 'HTG'] as const;

export type DonationType = (typeof DONATION_TYPES)[number];
export type DonationFrequency = (typeof DONATION_FREQUENCIES)[number];
export type DonationPaymentMethod = (typeof DONATION_PAYMENT_METHODS)[number];
export type DonationStatus = (typeof DONATION_STATUSES)[number];
export type DonationCurrency = (typeof DONATION_CURRENCIES)[number];

export interface IDonationDonorSnapshot {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
  isGuest: boolean;
}

export interface IDonationManualPayment {
  reference?: string;
  proofImageUrl?: string;
  notes?: string;
}

export interface IDonation extends Document {
  donor: Types.ObjectId | null;
  donorSnapshot: IDonationDonorSnapshot;
  donationType: DonationType;
  campaign: Types.ObjectId | null;
  program: string | null;
  amount: number;
  currency: DonationCurrency;
  paymentMethod: DonationPaymentMethod;
  frequency: DonationFrequency;
  anonymous: boolean;
  message?: string;
  status: DonationStatus;
  receiptNumber?: string;
  manualPayment?: IDonationManualPayment;
  createdAt: Date;
  updatedAt: Date;
}

const DonationDonorSnapshotSchema = new Schema<IDonationDonorSnapshot>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const DonationManualPaymentSchema = new Schema<IDonationManualPayment>(
  {
    reference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    proofImageUrl: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

const DonationSchema: Schema<IDonation> = new Schema(
  {
    donor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    donorSnapshot: {
      type: DonationDonorSnapshotSchema,
      required: true,
    },
    donationType: {
      type: String,
      enum: DONATION_TYPES,
      default: 'general',
    },
    campaign: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
    },
    program: {
      type: String,
      trim: true,
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Le montant est requis'],
      min: 1,
    },
    currency: {
      type: String,
      enum: DONATION_CURRENCIES,
      default: 'USD',
    },
    paymentMethod: {
      type: String,
      enum: DONATION_PAYMENT_METHODS,
      required: true,
    },
    frequency: {
      type: String,
      enum: DONATION_FREQUENCIES,
      default: 'one_time',
    },
    anonymous: {
      type: Boolean,
      default: false,
    },
    message: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
    status: {
      type: String,
      enum: DONATION_STATUSES,
      default: 'pending',
    },
    receiptNumber: {
      type: String,
      trim: true,
      index: true,
    },
    manualPayment: {
      type: DonationManualPaymentSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

const Donation = mongoose.model<IDonation>('Donation', DonationSchema);
export default Donation;
