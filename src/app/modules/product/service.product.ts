import httpStatus from 'http-status';
import AppError from '../../errors/AppErrors';
import { TProduct } from './interface.product';
import { Product } from './model.product';
import { ActivityService } from '../activity/service.activity';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isObjectId = (val: string) => /^[a-f\d]{24}$/i.test(val);

/** Availability wording derived from a product's internal status, for anonymous callers. */
const availabilityFromStatus = (status?: string) => {
    if (status === 'low_stock') return 'low stock';
    if (status === 'out_of_stock') return 'out of stock';
    return 'in stock';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toPublicShape = (product: any) => ({
    _id: product._id,
    name: product.name,
    slug: product.slug,
    thumbnail: product.thumbnail,
    category: product.category,
    price: product.price,
    availability: availabilityFromStatus(product.status),
});

// ── Create ────────────────────────────────────────────────────────────────────
const createProduct = async (payload: TProduct) => {
    // Case-insensitive duplicate name check
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

    // Duplicate slug check
    const existingSlug = await Product.findOne({ slug: payload.slug });
    if (existingSlug) {
        throw new AppError(
            httpStatus.CONFLICT,
            `A product with slug "${payload.slug}" already exists.`,
            'Duplicate slug',
        );
    }

    const product = await Product.create(payload);

    // ── Log Activity ──────────────────────────────────────────────────────────
    await ActivityService.createLog({
        type: 'product',
        message: `Product "${payload.name}" added to catalog`,
        metadata: { productId: product._id as string }
    });

    return product.populate('category', 'name slug');
};

// ── Get All (search + filter + sort + paginate) ───────────────────────────────
const getAllProducts = async (query: Record<string, unknown>, isAuthenticated = false) => {
    const {
        //  search
        search,
        //  filters
        category,
        status,
        minStock,
        maxStock,
        lowStockOnly,
        //  sort & paginate
        sort = '-createdAt',
        page = 1,
        limit = 12,
    } = query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    // Full-text / substring search on name & description
    if (search) {
        const term = search as string;
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { description: { $regex: term, $options: 'i' } },
        ];
    }

    // Filter by category (ObjectId string)
    if (category) filter.category = category;

    // Filter by status (active | draft | archived | out_of_stock | low_stock)
    if (status) filter.status = status;

    // Filter by stock range
    if (minStock !== undefined || maxStock !== undefined) {
        filter.stockQuantity = {};
        if (minStock !== undefined) filter.stockQuantity.$gte = Number(minStock);
        if (maxStock !== undefined) filter.stockQuantity.$lte = Number(maxStock);
    }

    // Shortcut: only products at or below their minStockThreshold
    if (lowStockOnly === 'true' || lowStockOnly === true) {
        filter.$expr = { $lte: ['$stockQuantity', '$minStockThreshold'] };
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

// ── Update ────────────────────────────────────────────────────────────────────
const updateProduct = async (id: string, payload: Partial<TProduct>) => {
    // Duplicate name check (exclude self)
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

    // Duplicate slug check (exclude self)
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

    const updated = await Product.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    }).populate('category', 'name slug');

    if (!updated) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'Product not found',
            'No product found with the given id',
        );
    }

    // ── Log Activity ──────────────────────────────────────────────────────────
    if (payload.stockQuantity !== undefined) {
        await ActivityService.createLog({
            type: 'product',
            message: `Stock updated for "${updated.name}" (${payload.stockQuantity} units)`,
            metadata: { productId: updated._id as string }
        });
    } else {
        await ActivityService.createLog({
            type: 'product',
            message: `Product "${updated.name}" details updated`,
            metadata: { productId: updated._id as string }
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
 * Returns products whose stock is at or below their minStockThreshold,
 * ordered by stockQuantity ASC (lowest stock = highest urgency).
 * Excludes products the admin has manually dismissed.
 * Adds a derived `priority` field: High / Medium / Low.
 */
const getRestockQueue = async () => {
    const products = await Product.find({
        $expr: { $lt: ['$stockQuantity', '$minStockThreshold'] },
        restockIgnored: { $ne: true },
    })
        .populate('category', 'name slug')
        .sort({ stockQuantity: 1 })          // lowest stock first
        .lean();                             // plain JS objects so we can add fields

    return products.map((p) => {
        const qty = p.stockQuantity ?? 0;
        const threshold = p.minStockThreshold ?? 5;

        let priority: 'High' | 'Medium' | 'Low';
        if (qty === 0) {
            priority = 'High';
        } else if (qty <= Math.ceil(threshold * 0.5)) {
            priority = 'Medium';
        } else {
            priority = 'Low';
        }

        return { ...p, priority };
    });
};



export const productServices = {
    createProduct,
    getAllProducts,
    getSingleProduct,
    updateProduct,
    deleteProduct,
    getRestockQueue,

};