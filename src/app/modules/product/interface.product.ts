import { Document, Model, Types } from 'mongoose';


export type TProductStatus = 'active' | 'out_of_stock' | 'low_stock';

export interface TProduct {
    name: string;
    slug: string;
    description: string;
    thumbnail: string;
    category: Types.ObjectId;
    price: number;
    status?: TProductStatus;
    stockQuantity?: number;
    minStockThreshold?: number;
    /** When true, admin has manually dismissed this product from the restock queue */
    restockIgnored?: boolean;
}

export interface TProductDocument extends TProduct, Document { }

export interface TProductModel extends Model<TProductDocument> { }