import { Document, Model, Types } from 'mongoose';

// ── Enums ─────────────────────────────────────────────────────────────────────
export type TOrderStatus = 'completed' | 'cancelled';

// ── Main Order Interface ───────────────────────────────────────────────────────
// An order here is an offline sale record: staff/admin type it in after the
// customer has already paid in person. There is no shipping, no online
// payment, and no multi-step lifecycle — a sale either happened or was voided.
export interface TOrder {
    productId: Types.ObjectId;
    variantId: Types.ObjectId;  // which size was sold (Product.variants[]._id)
    productName: string;       // snapshot of Product.name at time of sale
    sizeLabel: string;         // snapshot of the variant's sizeLabel at time of sale
    quantity: number;
    unitPrice: number;         // snapshot of the variant's price at time of sale
    discount?: number;
    totalAmount: number;       // (unitPrice * quantity) - discount
    customerName?: string;     // optional, free text — walk-in customer's name
    customerContact?: string;  // optional, free text — phone number
    note?: string;
    status: TOrderStatus;
    cancelledAt?: Date;
    cancelReason?: string;
    performedBy: Types.ObjectId; // ref User — which staff/admin recorded this sale
}

export interface TOrderDocument extends TOrder, Document { }
export interface TOrderModel extends Model<TOrderDocument> { }
