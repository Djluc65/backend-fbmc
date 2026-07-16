import mongoose, { Document, Schema } from 'mongoose';
import { PAYMENT_METHOD_VALUES, type PaymentMethodCode } from '../donations/donation.types.js';

export interface IPaymentMethodSetting extends Document {
  code: PaymentMethodCode;
  name: string;
  description: string;
  enabled: boolean;
  displayOrder: number;
  iconUrl?: string;
  instructions?: string;
  publicConfiguration?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSettingSchema = new Schema<IPaymentMethodSetting>(
  {
    code: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    iconUrl: {
      type: String,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    publicConfiguration: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const PaymentMethodSetting =
  (mongoose.models.PaymentMethodSetting as mongoose.Model<IPaymentMethodSetting>) ||
  mongoose.model<IPaymentMethodSetting>('PaymentMethodSetting', PaymentMethodSettingSchema);

export default PaymentMethodSetting;
