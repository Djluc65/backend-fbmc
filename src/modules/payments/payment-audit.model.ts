import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  DONATION_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PROOF_STATUS_VALUES,
  type DonationStatus,
  type PaymentMethodCode,
  type ProofStatus,
} from '../donations/donation.types.js';

export interface IPaymentAuditLog extends Document {
  donation: Types.ObjectId;
  paymentMethod: PaymentMethodCode;
  donationReference: string;
  transactionReference?: string;
  actorUser: Types.ObjectId | null;
  actorRole?: string;
  actorIp?: string;
  actorEmail?: string;
  action: 'MANUAL_PAYMENT_SUBMITTED' | 'PAYMENT_PROOF_APPROVED' | 'PAYMENT_PROOF_REJECTED';
  previousDonationStatus: DonationStatus;
  newDonationStatus: DonationStatus;
  previousProofStatus: ProofStatus;
  newProofStatus: ProofStatus;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAuditLogSchema = new Schema<IPaymentAuditLog>(
  {
    donation: {
      type: Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      required: true,
      index: true,
    },
    donationReference: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    transactionReference: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    actorUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorRole: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    actorIp: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    actorEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    action: {
      type: String,
      enum: ['MANUAL_PAYMENT_SUBMITTED', 'PAYMENT_PROOF_APPROVED', 'PAYMENT_PROOF_REJECTED'],
      required: true,
      index: true,
    },
    previousDonationStatus: {
      type: String,
      enum: DONATION_STATUS_VALUES,
      required: true,
    },
    newDonationStatus: {
      type: String,
      enum: DONATION_STATUS_VALUES,
      required: true,
    },
    previousProofStatus: {
      type: String,
      enum: PROOF_STATUS_VALUES,
      required: true,
    },
    newProofStatus: {
      type: String,
      enum: PROOF_STATUS_VALUES,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

const PaymentAuditLog =
  (mongoose.models.PaymentAuditLog as mongoose.Model<IPaymentAuditLog>) ||
  mongoose.model<IPaymentAuditLog>('PaymentAuditLog', PaymentAuditLogSchema);

export default PaymentAuditLog;
