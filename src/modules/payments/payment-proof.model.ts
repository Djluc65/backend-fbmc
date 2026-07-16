import mongoose, { Document, Schema, Types } from 'mongoose';
import { PAYMENT_METHOD_VALUES, PROOF_STATUS_VALUES, type PaymentMethodCode, type ProofStatus } from '../donations/donation.types.js';

export interface IPaymentProof extends Document {
  donation: Types.ObjectId;
  paymentMethod: PaymentMethodCode;
  referenceProvided?: string;
  fileUrl: string;
  filePublicId?: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  status: ProofStatus;
  reviewNote?: string;
  uploadedBy: Types.ObjectId | null;
  reviewedBy: Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentProofSchema = new Schema<IPaymentProof>(
  {
    donation: {
      type: Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      unique: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      required: true,
    },
    referenceProvided: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    filePublicId: {
      type: String,
      trim: true,
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: PROOF_STATUS_VALUES,
      required: true,
      default: 'PENDING_REVIEW',
      index: true,
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const PaymentProof =
  (mongoose.models.PaymentProof as mongoose.Model<IPaymentProof>) ||
  mongoose.model<IPaymentProof>('PaymentProof', PaymentProofSchema);

export default PaymentProof;
