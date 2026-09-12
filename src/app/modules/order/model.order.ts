import { Schema, model } from 'mongoose';
import { TOrderDocument } from './interface.order';

// ── Order Schema (offline sale record) ─────────────────────────────────────────
const orderSchema = new Schema<TOrderDocument>(
    {
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        productName: { type: String, required: true, trim: true },

        quantity: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be at least 1'],
        },

        // ── Pricing (snapshots taken at time of sale) ────────────────────────────
        unitPrice: {
            type: Number,
            required: true,
            min: [0, 'Unit price cannot be negative'],
        },
        discount: {
            type: Number,
            default: 0,
            min: [0, 'Discount cannot be negative'],
        },
        totalAmount: {
            type: Number,
            required: true,
            min: [0, 'Total amount cannot be negative'],
        },

        // ── Walk-in customer info (free text, optional — not a shipping profile) ─
        customerName: { type: String, trim: true },
        customerContact: { type: String, trim: true },
        note: { type: String, trim: true },

        // ── Lifecycle ─────────────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ['completed', 'cancelled'],
            default: 'completed',
        },
        cancelledAt: { type: Date },
        cancelReason: { type: String },

        performedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ productId: 1 });
orderSchema.index({ performedBy: 1 });

export const Order = model<TOrderDocument>('Order', orderSchema);
