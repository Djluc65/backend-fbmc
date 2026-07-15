import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INews extends Document {
  title: string;
  content: string;
  excerpt: string;
  image: string;
  author: Types.ObjectId;
  category: string;
  isFeatured: boolean;
  status: 'draft' | 'published';
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const NewsSchema: Schema<INews> = new Schema({
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true,
    maxlength: 200,
  },
  content: {
    type: String,
    required: [true, 'Le contenu est requis'],
  },
  excerpt: {
    type: String,
    required: [true, 'Un résumé est requis'],
    maxlength: 300,
  },
  image: {
    type: String,
    required: [true, 'Une image est requise'],
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'auteur est requis'],
  },
  category: {
    type: String,
    enum: ['news', 'event', 'success', 'report'],
    default: 'news',
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
  },
  views: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

const News = mongoose.model<INews>('News', NewsSchema);
export default News;
