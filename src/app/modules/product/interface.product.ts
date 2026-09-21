import { Document, Model, Types } from 'mongoose';


export type TProductStatus = 'active' | 'out_of_stock' | 'low_stock';

// A variant is one sellable size of a product — the unit that actually
// carries price and stock. sku and sizeLabel are always server-derived,
// never accepted from the client (see service.product.ts).
export interface TVariant {
    _id?: Types.ObjectId;
    sku: string;                    // "<MODEL>-<thickness>x<width>", server-generated
    thickness: number;              // mm
    width: number;                  // mm
    length: number;                 // mm
    sizeLabel: string;              // e.g. "0.4mm x 6000mm", server-derived
    price: number;
    stockQuantity: number;
    minStockThreshold: number;
    status: TProductStatus;
    /** When true, admin has manually dismissed this variant from the restock queue */
    restockIgnored: boolean;
}

export interface TProduct {
    modelNo: string;                // uppercase, search key
    name: string;
    slug?: string;
    description: string;
    thumbnail: string;
    category: Types.ObjectId;
    brand?: string;                 // open-ended, not an enum — see validation.product.ts
    moq?: string;                   // e.g. "1 PC"
    samplesAvailable?: boolean;
    transportPackage?: string;      // open-ended, not an enum
    origin?: string;                // open-ended, not an enum
    hsCode?: string;
    note?: string;
    variants: TVariant[];
}

export interface TProductDocument extends TProduct, Document { }

export interface TProductModel extends Model<TProductDocument> { }
