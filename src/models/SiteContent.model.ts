import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteContent extends Document {
  key: string;
  content: Record<string, unknown>;
  updatedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SiteContentSchema: Schema<ISiteContent> = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'main',
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const SiteContent = mongoose.model<ISiteContent>('SiteContent', SiteContentSchema);
export default SiteContent;
