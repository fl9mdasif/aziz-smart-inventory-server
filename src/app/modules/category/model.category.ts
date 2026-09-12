import { Schema, model } from 'mongoose';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },        // "Cooking Oil"
    slug: { type: String },      // "cooking-oil"
    description: { type: String },
    isActive: { type: Boolean, default: true },
    thumbnail: { type: String },                                   // category banner/icon
    // order: { type: Number, default: 0 },  // for manual sorting in UI
    // Self-referencing for nested categories
    // parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    // null = top-level category
  },
  { timestamps: true }
);

// categorySchema.index({ parent: 1 });

export const Category = model('Category', categorySchema);
