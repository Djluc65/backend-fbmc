import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDonationTransaction extends Document {
  donation: Types.ObjectId;
  provider: string;
  providerTransactionId?: string;
  status: string;
  rawResponse?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const DonationTransactionSchema = new Schema<IDonationTransaction>(
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
    },
    providerTransactionId: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      trim: true,
    },
    rawResponse: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

const DonationTransaction = mongoose.model<IDonationTransaction>(
  'DonationTransaction',
  DonationTransactionSchema
);

export default DonationTransaction;
