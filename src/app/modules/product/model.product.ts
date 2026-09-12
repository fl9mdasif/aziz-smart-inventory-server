import { Schema, model } from 'mongoose';
import { TProductDocument } from './interface.product';

const productSchema = new Schema<TProductDocument>(
    {
        name: {
            type: String,
            required: [true, 'Product name is required'],
            trim: true,
        },
        slug: {
            type: String,
            required: [true, 'Slug is required'],
            unique: true,
            trim: true,
            lowercase: true,
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
        },

        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: [true, 'Category is required'],
        },

        thumbnail: {
            type: String,
            required: [true, 'Thumbnail URL is required'],
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative'],
        },

        // ── Inventory ──────────────────────────────────────────────────────────
        stockQuantity: {
            type: Number,
            default: 0,
            min: [0, 'Stock quantity cannot be negative'],
        },
        minStockThreshold: {
            type: Number,
            default: 5,
            min: [0, 'Minimum stock threshold cannot be negative'],
        },

        // ── Status ─────────────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ['active', 'draft', 'archived', 'out_of_stock', 'low_stock'],
            default: 'draft',
        },
        // ── Restock Queue ───────────────────────────────────────────────────────
        /** Admin can dismiss a product from the restock queue without restocking yet */
        restockIgnored: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
);

// ── Pre-save: auto-manage status based on stock levels ─────────────────────────
productSchema.pre('save', function (next) {
    const qty = this.stockQuantity ?? 0;
    const threshold = this.minStockThreshold ?? 5;

    if (qty === 0) {
        this.status = 'out_of_stock';
        this.restockIgnored = false; // Always show in queue when it hits 0
    } else if (qty < threshold) {
        this.status = 'low_stock';
        this.restockIgnored = false; // Always show in queue when it hits low stock
    } else {
        // Stock restored above threshold — clear ignored flag & set active
        if (this.status === 'low_stock' || this.status === 'out_of_stock') {
            this.status = 'active';
        }
        this.restockIgnored = false;
    }
    next();
});

productSchema.pre('findOneAndUpdate', function (next) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update = this.getUpdate() as Record<string, any>;
    if (!update) return next();

    const qty = update?.stockQuantity ?? update?.$set?.stockQuantity;
    const threshold = update?.minStockThreshold ?? update?.$set?.minStockThreshold;

    if (qty !== undefined) {
        const resolvedThreshold = threshold ?? 5;
        if (qty === 0) {
            update.$set = { ...update.$set, status: 'out_of_stock', restockIgnored: false };
        } else if (qty < resolvedThreshold) {
            update.$set = { ...update.$set, status: 'low_stock', restockIgnored: false };
        } else {
            update.$set = { ...update.$set, status: 'active', restockIgnored: false };
        }
    }
    next();
});

// ── Indexes for fast search / filter ──────────────────────────────────────────
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ stockQuantity: 1 });
// Compound index to make restock queue queries fast
productSchema.index({ status: 1, restockIgnored: 1, stockQuantity: 1 });

export const Product = model<TProductDocument>('Product', productSchema);