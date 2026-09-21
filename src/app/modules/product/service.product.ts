import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../errors/AppErrors';
import { TProduct, TVariant } from './interface.product';
import { Product } from './model.product';
import { ActivityService } from '../activity/service.activity';
import { computeSizeLabel, computeVariantStatus, generateSku } from './utils.product';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isObjectId = (val: string) => /^[a-f\d]{24}$/i.test(val);

/** Availability wording derived from a product's variants, for anonymous callers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const availabilityFromVariants = (variants: any[]) => {
    if (variants.length > 0 && variants.every((v) => v.status === 'out_of_stock')) {
        return 'out of stock';
    }
    if (variants.some((v) => v.status === 'active')) {
        return 'in stock';
    }
    return 'low stock';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toPublicShape = (product: any) => {
    const variants = product.variants ?? [];
    const prices = variants.map((v: TVariant) => v.price);

    return {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        thumbnail: product.thumbnail,
        category: product.category,
        // Lowest variant price — a "starting from" figure for a product that
        // can have several sizes at different prices. Matches the client's
        // TPublicProduct.price (single number), not a {priceFrom, priceTo} range.
        price: prices.length ? Math.min(...prices) : 0,
        availability: availabilityFromVariants(variants),
    };
};

/** Throws a 409 if `sku` is already used by another variant anywhere in the collection. */
const assertSkuAvailable = async (sku: string, excludeProductId?: string, excludeVariantId?: string) => {
    const clash = await Product.findOne(
        excludeProductId
            ? {
                $or: [
                    { _id: { $ne: excludeProductId }, 'variants.sku': sku },
                    {
                        _id: excludeProductId,
                        variants: { $elemMatch: { sku, _id: { $ne: excludeVariantId } } },
                    },
                ],
            }
            : { 'variants.sku': sku },
    );
    if (clash) {
        throw new AppError(
            httpStatus.CONFLICT,
            `A variant with SKU "${sku}" already exists.`,
            'Duplicate SKU',
        );
    }
};

type TVariantInput = Pick<TVariant, 'thickness' | 'width' | 'length' | 'price'> &
    Partial<Pick<TVariant, 'stockQuantity' | 'minStockThreshold'>>;

/** Builds the variants array for create/replace, generating sku + checking collisions. */
const buildVariants = async (modelNo: string, inputs: TVariantInput[], excludeProductId?: string) => {
    const seenSkus = new Set<string>();
    const variants = inputs.map((v) => {
        const sku = generateSku(modelNo, v.thickness, v.width);
        if (seenSkus.has(sku)) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Duplicate size ${v.thickness}mm x ${v.width}mm in the same submission.`,
                'Duplicate variant',
            );
        }
        seenSkus.add(sku);
        return {
            sku,
            thickness: v.thickness,
            width: v.width,
            length: v.length,
            price: v.price,
            stockQuantity: v.stockQuantity ?? 0,
            minStockThreshold: v.minStockThreshold ?? 5,
        };
    });

    for (const v of variants) {
        await assertSkuAvailable(v.sku, excludeProductId);
    }

    return variants;
};

// ── Create ────────────────────────────────────────────────────────────────────
const createProduct = async (payload: TProduct) => {
    const existingName = await Product.findOne({
        name: { $regex: `^${payload.name.trim()}$`, $options: 'i' },
    });
    if (existingName) {
        throw new AppError(
            httpStatus.CONFLICT,
            `A product named "${existingName.name}" already exists.`,
            'Duplicate name',
        );
    }

    const existingSlug = await Product.findOne({ slug: payload.slug });
    if (existingSlug) {
        throw new AppError(
            httpStatus.CONFLICT,
            `A product with slug "${payload.slug}" already exists.`,
            'Duplicate slug',
        );
    }

    const existingModelNo = await Product.findOne({
        modelNo: { $regex: `^${payload.modelNo.trim()}$`, $options: 'i' },
    });
    if (existingModelNo) {
        throw new AppError(
            httpStatus.CONFLICT,
            `A product with model number "${existingModelNo.modelNo}" already exists.`,
            'Duplicate model number',
        );
    }

    const variants = await buildVariants(payload.modelNo, payload.variants);

    const product = await Product.create({ ...payload, variants });

    await ActivityService.createLog({
        type: 'product',
        message: `Product "${payload.name}" (${payload.modelNo}) added to catalog with ${variants.length} size${variants.length !== 1 ? 's' : ''}`,
        metadata: { productId: (product._id as Types.ObjectId).toString() },
    });

    return product.populate('category', 'name slug');
};

// ── Get All (search + filter + sort + paginate) ───────────────────────────────
const getAllProducts = async (query: Record<string, unknown>, isAuthenticated = false) => {
    const {
        search,
        category,
        status,
        minStock,
        maxStock,
        lowStockOnly,
        sort = '-createdAt',
        page = 1,
        limit = 12,
    } = query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (search) {
        const term = search as string;
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { description: { $regex: term, $options: 'i' } },
            { modelNo: { $regex: term, $options: 'i' } },
        ];
    }

    if (category) filter.category = category;

    // status now lives per-variant — matches products that have at least one
    // variant in that status.
    if (status) filter['variants.status'] = status;
    else if (lowStockOnly === 'true' || lowStockOnly === true) {
        filter['variants.status'] = { $in: ['low_stock', 'out_of_stock'] };
    }

    if (minStock !== undefined || maxStock !== undefined) {
        filter['variants.stockQuantity'] = {};
        if (minStock !== undefined) filter['variants.stockQuantity'].$gte = Number(minStock);
        if (maxStock !== undefined) filter['variants.stockQuantity'].$lte = Number(maxStock);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
        Product.find(filter)
            .populate('category', 'name slug')
            .sort(sort as string)
            .skip(skip)
            .limit(limitNum),
        Product.countDocuments(filter),
    ]);

    return {
        meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        },
        data: isAuthenticated ? products : products.map(toPublicShape),
    };
};

// ── Get Single (by ObjectId or slug) ─────────────────────────────────────────
const getSingleProduct = async (idOrSlug: string, isAuthenticated = false) => {
    const product = isObjectId(idOrSlug)
        ? await Product.findById(idOrSlug).populate('category', 'name slug')
        : await Product.findOne({ slug: idOrSlug }).populate('category', 'name slug');

    if (!product) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'Product not found',
            'No product matches the given id or slug',
        );
    }
    return isAuthenticated ? product : toPublicShape(product);
};

// ── Update (product-level fields, optionally replacing the whole variants
// array — see PATCH /:productId/variants/:variantId for a single-size edit) ──
const updateProduct = async (id: string, payload: Partial<TProduct>) => {
    const product = await Product.findById(id);
    if (!product) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'Product not found',
            'No product found with the given id',
        );
    }

    if (payload.name) {
        const existing = await Product.findOne({
            name: { $regex: `^${payload.name.trim()}$`, $options: 'i' },
            _id: { $ne: id },
        });
        if (existing) {
            throw new AppError(
                httpStatus.CONFLICT,
                `A product named "${existing.name}" already exists.`,
                'Duplicate name',
            );
        }
    }

    if (payload.slug) {
        const existing = await Product.findOne({ slug: payload.slug, _id: { $ne: id } });
        if (existing) {
            throw new AppError(
                httpStatus.CONFLICT,
                `A product with slug "${payload.slug}" already exists.`,
                'Duplicate slug',
            );
        }
    }

    if (payload.modelNo) {
        const existing = await Product.findOne({
            modelNo: { $regex: `^${payload.modelNo.trim()}$`, $options: 'i' },
            _id: { $ne: id },
        });
        if (existing) {
            throw new AppError(
                httpStatus.CONFLICT,
                `A product with model number "${existing.modelNo}" already exists.`,
                'Duplicate model number',
            );
        }
    }

    const { variants: incomingVariants, ...rest } = payload;
    Object.assign(product, rest);

    if (incomingVariants) {
        const modelNo = payload.modelNo ?? product.modelNo;
        const built = await buildVariants(modelNo, incomingVariants as TVariantInput[], id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        product.variants = built as any;
    }

    // save() (not findByIdAndUpdate) so the pre-save hook recomputes each
    // variant's sizeLabel/status.
    await product.save();
    await product.populate('category', 'name slug');

    if (incomingVariants) {
        await ActivityService.createLog({
            type: 'product',
            message: `Sizes/stock updated for "${product.name}"`,
            metadata: { productId: (product._id as Types.ObjectId).toString() },
        });
    } else {
        await ActivityService.createLog({
            type: 'product',
            message: `Product "${product.name}" details updated`,
            metadata: { productId: (product._id as Types.ObjectId).toString() },
        });
    }

    return product;
};

// ── Update a single variant (price/stock edit from the inventory table) ──────
const updateVariant = async (
    productId: string,
    variantId: string,
    payload: Partial<Pick<TVariant, 'thickness' | 'width' | 'length' | 'price' | 'stockQuantity' | 'minStockThreshold' | 'restockIgnored'>>,
) => {
    const product = await Product.findById(productId);
    if (!product) {
        throw new AppError(httpStatus.NOT_FOUND, 'Product not found', 'No product found with the given id');
    }

    const variant = product.variants.find((v) => v._id?.toString() === variantId);
    if (!variant) {
        throw new AppError(httpStatus.NOT_FOUND, 'Variant not found', 'No size found with the given id');
    }

    const thickness = payload.thickness ?? variant.thickness;
    const width = payload.width ?? variant.width;
    const length = payload.length ?? variant.length;
    const price = payload.price ?? variant.price;
    const stockQuantity = payload.stockQuantity ?? variant.stockQuantity;
    const minStockThreshold = payload.minStockThreshold ?? variant.minStockThreshold;

    const sizeChanged = payload.thickness !== undefined || payload.width !== undefined;
    const sku = sizeChanged ? generateSku(product.modelNo, thickness, width) : variant.sku;
    if (sizeChanged) {
        await assertSkuAvailable(sku, productId, variantId);
    }

    const sizeLabel = computeSizeLabel(thickness, width);
    const status = computeVariantStatus(stockQuantity, minStockThreshold);
    const restockIgnored =
        payload.restockIgnored ?? (status === 'active' ? false : variant.restockIgnored);

    const updated = await Product.findOneAndUpdate(
        { _id: productId, 'variants._id': variantId },
        {
            $set: {
                'variants.$[v].sku': sku,
                'variants.$[v].thickness': thickness,
                'variants.$[v].width': width,
                'variants.$[v].length': length,
                'variants.$[v].price': price,
                'variants.$[v].stockQuantity': stockQuantity,
                'variants.$[v].minStockThreshold': minStockThreshold,
                'variants.$[v].sizeLabel': sizeLabel,
                'variants.$[v].status': status,
                'variants.$[v].restockIgnored': restockIgnored,
            },
        },
        { arrayFilters: [{ 'v._id': variantId }], new: true, runValidators: true },
    ).populate('category', 'name slug');

    if (payload.stockQuantity !== undefined) {
        await ActivityService.createLog({
            type: 'product',
            message: `Stock updated for "${product.name}" (${sizeLabel}): ${stockQuantity} units`,
            metadata: { productId },
        });
    }

    return updated;
};

// ── Delete ────────────────────────────────────────────────────────────────────
const deleteProduct = async (id: string) => {
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'Product not found',
            'No product found with the given id',
        );
    }
    return deleted;
};

// ── Restock Queue ─────────────────────────────────────────────────────────────
/**
 * One row per variant (size) that's at or below its minStockThreshold and
 * not manually dismissed, ordered by stockQuantity ASC. Carries the parent
 * product's name/modelNo/category so the client can show which size of
 * which product needs restocking.
 */
const getRestockQueue = async () => {
    const rows = await Product.aggregate([
        { $unwind: '$variants' },
        {
            $match: {
                'variants.restockIgnored': { $ne: true },
                $expr: { $lt: ['$variants.stockQuantity', '$variants.minStockThreshold'] },
            },
        },
        {
            $lookup: {
                from: 'categories',
                localField: 'category',
                foreignField: '_id',
                as: 'category',
            },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        { $sort: { 'variants.stockQuantity': 1 } },
        {
            $project: {
                productId: '$_id',
                modelNo: 1,
                name: 1,
                thumbnail: 1,
                category: { _id: 1, name: 1, slug: 1 },
                variantId: '$variants._id',
                sku: '$variants.sku',
                sizeLabel: '$variants.sizeLabel',
                thickness: '$variants.thickness',
                width: '$variants.width',
                stockQuantity: '$variants.stockQuantity',
                minStockThreshold: '$variants.minStockThreshold',
                status: '$variants.status',
            },
        },
    ]);

    return rows.map((row) => {
        const qty = row.stockQuantity ?? 0;
        const threshold = row.minStockThreshold ?? 5;

        let priority: 'High' | 'Medium' | 'Low';
        if (qty === 0) {
            priority = 'High';
        } else if (qty <= Math.ceil(threshold * 0.5)) {
            priority = 'Medium';
        } else {
            priority = 'Low';
        }

        return { ...row, priority };
    });
};

// ── Distinct values for the client's brand/transportPackage/origin
// combobox-with-add-new fields (see PRD's "select on client" note). ─────────
const getProductMeta = async () => {
    const [brand, transportPackage, origin] = await Promise.all([
        Product.distinct('brand', { brand: { $nin: [null, ''] } }),
        Product.distinct('transportPackage', { transportPackage: { $nin: [null, ''] } }),
        Product.distinct('origin', { origin: { $nin: [null, ''] } }),
    ]);
    return { brand, transportPackage, origin };
};

export const productServices = {
    createProduct,
    getAllProducts,
    getSingleProduct,
    updateProduct,
    updateVariant,
    deleteProduct,
    getRestockQueue,
    getProductMeta,
};
