import { TProductStatus } from './interface.product';

// ── Derived-field helpers shared by model.product.ts's pre-save hook (the
// create path) and service.product.ts's updateVariant (the targeted-update
// path) — kept in one place so both compute status/sizeLabel identically. ──

export const computeSizeLabel = (thickness: number, width: number): string =>
    `${thickness}mm x ${width}mm`;

export const computeVariantStatus = (
    stockQuantity: number,
    minStockThreshold: number,
): TProductStatus => {
    if (stockQuantity === 0) return 'out_of_stock';
    if (stockQuantity < minStockThreshold) return 'low_stock';
    return 'active';
};

export const generateSku = (modelNo: string, thickness: number, width: number): string =>
    `${modelNo.toUpperCase()}-${thickness}x${width}`;
