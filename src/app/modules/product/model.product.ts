import { Schema, model } from 'mongoose';
import { TProductDocument, TVariant } from './interface.product';
import { computeSizeLabel, computeVariantStatus } from './utils.product';

const variantSchema = new Schema<TVariant>(
    {
        sku: {
            type: String,
            required: [true, 'SKU is required'],
            trim: true,
            uppercase: true,
        },
        thickness: {
            type: Number,
            required: [true, 'Thickness (mm) is required'],
            min: [0, 'Thickness cannot be negative'],
        },
        width: {
            type: Number,
            required: [true, 'Width (mm) is required'],
            min: [0, 'Width cannot be negative'],
        },
        length: {
            type: Number,
            required: [true, 'Length (mm) is required'],
            min: [0, 'Length cannot be negative'],
        },
        sizeLabel: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative'],
        },
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
        status: {
            type: String,
            enum: ['active', 'out_of_stock', 'low_stock'],
            default: 'active',
        },
        restockIgnored: {
            type: Boolean,
            default: false,
        },
    },
    { _id: true },
);

const productSchema = new Schema<TProductDocument>(
    {
        modelNo: {
            type: String,
            required: [true, 'Model number is required'],
            trim: true,
            uppercase: true,
        },
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

        // ── Open-ended commercial fields — plain strings, not enums, because
        // the supplier/origin/packaging list keeps growing (see client's
        // combobox-with-add-new pattern for these three). ─────────────────────
        brand: { type: String, trim: true },
        moq: { type: String, trim: true },
        samplesAvailable: { type: Boolean, default: false },
        transportPackage: { type: String, trim: true },
        origin: { type: String, trim: true },
        hsCode: { type: String, trim: true },
        note: { type: String, trim: true },

        variants: {
            type: [variantSchema],
            required: true,
            validate: {
                validator: (v: TVariant[]) => Array.isArray(v) && v.length > 0,
                message: 'At least one size (variant) is required',
            },
        },
    },
    { timestamps: true },
);

// ── Pre-validate (not pre-save — validation runs before 'save' hooks, and
// sizeLabel is a required field, so it must exist before that point): derive
// each variant's sizeLabel/status/restockIgnored from its own stock levels.
// This replaced the old per-product version of this hook, since price/stock
// now live on each variant, not the product. ──────────────────────────────
productSchema.pre('validate', function (next) {
    for (const variant of this.variants) {
        variant.sizeLabel = computeSizeLabel(variant.thickness, variant.width);

        const qty = variant.stockQuantity ?? 0;
        const threshold = variant.minStockThreshold ?? 5;
        const newStatus = computeVariantStatus(qty, threshold);

        if (newStatus === 'out_of_stock' || newStatus === 'low_stock') {
            variant.restockIgnored = false; // always show in queue once it drops
        } else if (variant.status === 'low_stock' || variant.status === 'out_of_stock') {
            variant.restockIgnored = false; // stock restored — clear the ignored flag
        }
        variant.status = newStatus;
    }
    next();
});

// ── Indexes for fast search / filter ──────────────────────────────────────────
productSchema.index({ name: 'text', description: 'text', modelNo: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });
productSchema.index({ 'variants.status': 1, 'variants.restockIgnored': 1, 'variants.stockQuantity': 1 });

export const Product = model<TProductDocument>('Product', productSchema);
