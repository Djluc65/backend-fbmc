import mongoose, { Schema, Document } from 'mongoose';

export interface IBeneficiary extends Document {
  firstName: string;
  lastName: string;
  age: number;
  gender?: 'male' | 'female' | 'other';
  school?: string;
  city: string;
  country: string;
  bio: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const BeneficiarySchema: Schema<IBeneficiary> = new Schema({
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
  },
  age: {
    type: Number,
    required: [true, 'L\'âge est requis'],
    min: 0,
    max: 100,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  school: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    required: [true, 'La ville est requise'],
    trim: true,
  },
  country: {
    type: String,
    required: [true, 'Le pays est requis'],
    default: 'Haïti',
    trim: true,
  },
  bio: {
    type: String,
    required: [true, 'Une description est requise'],
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, {
  timestamps: true,
});

const Beneficiary = mongoose.model<IBeneficiary>('Beneficiary', BeneficiarySchema);
export default Beneficiary;
