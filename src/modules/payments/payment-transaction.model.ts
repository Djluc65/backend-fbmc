import mongoose, { Document, Schema, Types } from 'mongoose';
import { CURRENCY_VALUES, DONATION_STATUS_VALUES, type CurrencyCode, type DonationStatus } from '../donations/donation.types.js';

export interface IPaymentTransaction extends Document {
  donation: Types.ObjectId;
  provider: string;
  providerTransactionId?: string;
  internalReference: string;
  amount: number;
  currency: CurrencyCode;
  status: DonationStatus;
  providerStatus?: string;
  rawResponse?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    donation: {
      type: Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    providerTransactionId: {
      type: String,
      trim: true,
      index: true,
    },
    internalReference: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
    },
    status: {
      type: String,
      enum: DONATION_STATUS_VALUES,
      required: true,
    },
    providerStatus: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    rawResponse: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    errorCode: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const PaymentTransaction =
  (mongoose.models.PaymentTransaction as mongoose.Model<IPaymentTransaction>) ||
  mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);

export default PaymentTransaction;
