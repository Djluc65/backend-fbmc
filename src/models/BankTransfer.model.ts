import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBankTransfer extends Document {
  donation: Types.ObjectId;
  reference: string;
  proofImage?: string;
  validatedBy: Types.ObjectId | null;
  validatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BankTransferSchema = new Schema<IBankTransfer>(
  {
    donation: {
      type: Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      unique: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    proofImage: {
      type: String,
      trim: true,
    },
    validatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    validatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const BankTransfer = mongoose.model<IBankTransfer>('BankTransfer', BankTransferSchema);
export default BankTransfer;
