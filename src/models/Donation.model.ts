import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDonation extends Document {
  amount: number;
  donor: Types.ObjectId | null;
  campaign: Types.ObjectId | null;
  isAnonymous: boolean;
  status: 'pending' | 'completed' | 'failed';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DonationSchema: Schema<IDonation> = new Schema({
  amount: {
    type: Number,
    required: [true, 'Le montant est requis'],
    min: 1,
  },
  donor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  campaign: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign',
    default: null,
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  message: {
    type: String,
    maxlength: 500,
  },
}, {
  timestamps: true,
});

const Donation = mongoose.model<IDonation>('Donation', DonationSchema);
export default Donation;
