import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  CURRENCY_VALUES,
  DONATION_DESIGNATION_VALUES,
  DONATION_FREQUENCY_VALUES,
  DONATION_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PROOF_STATUS_VALUES,
  type CurrencyCode,
  type DonationDesignation,
  type DonationFrequency,
  type DonationStatus,
  type PaymentMethodCode,
  type ProofStatus,
} from './donation.types.js';

export interface IDonation extends Document {
  reference: string;
  donor: Types.ObjectId | null;
  donorFirstName: string;
  donorLastName: string;
  donorEmail: string;
  donorPhone?: string;
  donorCountry?: string;
  campaign: Types.ObjectId | null;
  program?: string;
  designation: DonationDesignation;
  amount: number;
  currency: CurrencyCode;
  frequency: DonationFrequency;
  paymentMethod: PaymentMethodCode;
  status: DonationStatus;
  proofStatus: ProofStatus;
  anonymous: boolean;
  message?: string;
  transactionReference?: string;
  donorIp?: string;
  userAgent?: string;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  countedInCampaignTotals: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DonationSchema = new Schema<IDonation>(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    donor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    donorFirstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    donorLastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    donorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    donorPhone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    donorCountry: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    campaign: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
      index: true,
    },
    program: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    designation: {
      type: String,
      enum: DONATION_DESIGNATION_VALUES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      enum: CURRENCY_VALUES,
      required: true,
      default: 'USD',
    },
    frequency: {
      type: String,
      enum: DONATION_FREQUENCY_VALUES,
      required: true,
      default: 'ONE_TIME',
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: DONATION_STATUS_VALUES,
      required: true,
      default: 'PENDING',
      index: true,
    },
    proofStatus: {
      type: String,
      enum: PROOF_STATUS_VALUES,
      required: true,
      default: 'NOT_REQUIRED',
      index: true,
    },
    anonymous: {
      type: Boolean,
      default: false,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    transactionReference: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    donorIp: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    countedInCampaignTotals: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

DonationSchema.index(
  { paymentMethod: 1, transactionReference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      paymentMethod: { $in: ['BANK_TRANSFER', 'ZELLE', 'CASH_APP'] },
      transactionReference: { $exists: true, $type: 'string', $ne: '' },
    },
  }
);

const Donation =
  (mongoose.models.Donation as mongoose.Model<IDonation>) ||
  mongoose.model<IDonation>('Donation', DonationSchema);

export default Donation;
