import mongoose, { Schema, Document } from 'mongoose';

export interface ICampaign extends Document {
  title: string;
  description: string;
  goalAmount: number;
  raisedAmount: number;
  image: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed' | 'paused';
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema: Schema<ICampaign> = new Schema({
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    required: [true, 'La description est requise'],
  },
  goalAmount: {
    type: Number,
    required: [true, 'L\'objectif financier est requis'],
    min: 0,
  },
  raisedAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  image: {
    type: String,
    required: [true, 'Une image est requise'],
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: [true, 'La date de fin est requise'],
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused'],
    default: 'active',
  },
  category: {
    type: String,
    enum: ['education', 'food', 'clothing', 'health', 'community', 'other'],
    default: 'education',
  },
}, {
  timestamps: true,
});

const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);
export default Campaign;
