import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../errors/AppErrors';
import { Product } from '../product/model.product';
import { Order } from './model.order';
import { TOrder } from './interface.order';
import { ActivityService } from '../activity/service.activity';

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Recompute a product's status from a new stock quantity and persist both. */
const applyStockChange = async (productId: Types.ObjectId | string, newQty: number, minStockThreshold: number) => {
    const status =
        newQty === 0 ? 'out_of_stock' :
            newQty < minStockThreshold ? 'low_stock' :
                'active';

    await Product.findByIdAndUpdate(productId, { stockQuantity: newQty, status });
};

// ── Create Order (staff/admin/superAdmin records a completed sale) ─────────────
const createOrder = async (
    payload: Pick<TOrder, 'productId' | 'quantity' | 'discount' | 'customerName' | 'customerContact' | 'note'>,
    performedBy: string,
) => {
    const { productId, quantity, discount = 0, customerName, customerContact, note } = payload;

    // ── 1. Fetch product ───────────────────────────────────────────────────────
    const product = await Product.findById(productId);
    if (!product) {
        throw new AppError(httpStatus.NOT_FOUND, 'Product not found', 'Product not found');
    }

    // ── 2. Inactive product guard ──────────────────────────────────────────────
    const orderableStatuses = ['active', 'low_stock'];
    if (!orderableStatuses.includes(product.status as string)) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This product is currently unavailable.',
            'Product unavailable',
        );
    }

    // ── 3. Stock validation ────────────────────────────────────────────────────
    const available = product.stockQuantity ?? 0;

    if (available === 0) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `"${product.name}" is currently out of stock`,
            'Out of stock',
        );
    }

    if (quantity > available) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Only ${available} item${available !== 1 ? 's' : ''} available in stock for "${product.name}"`,
            'Insufficient stock',
        );
    }

    // ── 4. Snapshot price & compute total ──────────────────────────────────────
    const unitPrice = product.price;
    const totalAmount = Math.max(0, unitPrice * quantity - discount);

    // ── 5. Save order ──────────────────────────────────────────────────────────
    const order = await Order.create({
        productId: product._id,
        productName: product.name,
        quantity,
        unitPrice,
        discount,
        totalAmount,
        customerName,
        customerContact,
        note,
        status: 'completed',
        performedBy,
    });

    // ── 6. Deduct stock & auto-update product status (single write) ────────────
    await applyStockChange(productId, available - quantity, product.minStockThreshold ?? 5);

    // ── 7. Log Activity ────────────────────────────────────────────────────────
    await ActivityService.createLog({
        type: 'order',
        message: `Sale #${order._id.toString().slice(-6).toUpperCase()} recorded for ${quantity} × "${product.name}"`,
        metadata: { orderId: order._id.toString(), productId: product._id.toString() },
    });

    return order.populate('productId', 'name slug thumbnail status stockQuantity');
};

// ── Get All Orders ─────────────────────────────────────────────────────────────
const getAllOrders = async (query: Record<string, unknown>) => {
    const { status, search, page = 1, limit = 20 } = query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (status) filter.status = status;

    if (search) {
        const term = search as string;
        filter.$or = [
            { productName: { $regex: term, $options: 'i' } },
            { customerName: { $regex: term, $options: 'i' } },
            { customerContact: { $regex: term, $options: 'i' } },
        ];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .populate('productId', 'name slug thumbnail status stockQuantity')
            .populate('performedBy', 'username email role')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
        Order.countDocuments(filter),
    ]);

    return {
        meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        data: orders,
    };
};

// ── Get Single Order ───────────────────────────────────────────────────────────
const getOrderById = async (orderId: string) => {
    const order = await Order.findById(orderId)
        .populate('productId', 'name slug thumbnail status stockQuantity')
        .populate('performedBy', 'username email role');

    if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, 'Order not found', 'Order not found');
    }
    return order;
};

// ── Cancel Order (admin/superAdmin only — voids a sale, restores stock) ────────
const cancelOrder = async (orderId: string, cancelReason?: string) => {
    const order = await Order.findById(orderId);
    if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, 'Order not found', 'Order not found');
    }

    if (order.status === 'cancelled') {
        throw new AppError(httpStatus.CONFLICT, 'This order is already cancelled', 'Order already cancelled');
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = cancelReason;
    await order.save();

    // ── Restore stock (single write) ───────────────────────────────────────────
    const product = await Product.findById(order.productId);
    if (product) {
        const restoredQty = (product.stockQuantity ?? 0) + order.quantity;
        await applyStockChange(order.productId, restoredQty, product.minStockThreshold ?? 5);
    }

    // ── Log Activity ──────────────────────────────────────────────────────────
    await ActivityService.createLog({
        type: 'order',
        message: `Sale #${order._id.toString().slice(-6).toUpperCase()} cancelled`,
        metadata: { orderId: order._id.toString() },
    });

    return order;
};

// ── Delete Order ───────────────────────────────────────────────────────────────
const deleteOrder = async (orderId: string) => {
    const order = await Order.findById(orderId);
    if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, 'Order not found', 'Order not found');
    }

    // Restore stock only if the sale was still completed (a cancelled order's
    // stock was already restored by cancelOrder).
    if (order.status === 'completed') {
        const product = await Product.findById(order.productId);
        if (product) {
            const restoredQty = (product.stockQuantity ?? 0) + order.quantity;
            await applyStockChange(order.productId, restoredQty, product.minStockThreshold ?? 5);
        }
    }

    await Order.findByIdAndDelete(orderId);
    return order;
};

// ── Sales Analytics ────────────────────────────────────────────────────────────
const getSalesAnalytics = async (
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    from?: string,
    to?: string,
) => {
    const format =
        period === 'weekly' ? '%G-W%V' :
            period === 'monthly' ? '%Y-%m' :
                period === 'yearly' ? '%Y' :
                    '%Y-%m-%d';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match: Record<string, any> = { status: 'completed' };
    if (from || to) {
        match.createdAt = {};
        if (from) match.createdAt.$gte = new Date(from);
        if (to) match.createdAt.$lte = new Date(to);
    }

    const result = await Order.aggregate([
        { $match: match },
        {
            $group: {
                _id: { $dateToString: { format, date: '$createdAt' } },
                revenue: { $sum: '$totalAmount' },
                orders: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return result.map((item) => ({
        date: item._id,
        revenue: item.revenue,
        orders: item.orders,
    }));
};

// ── Top Products (by revenue, within completed sales) ──────────────────────────
const getTopProducts = async (limit = 10) => {
    const result = await Order.aggregate([
        { $match: { status: 'completed' } },
        {
            $group: {
                _id: '$productId',
                productName: { $first: '$productName' },
                quantitySold: { $sum: '$quantity' },
                revenue: { $sum: '$totalAmount' },
            },
        },
        { $sort: { revenue: -1 } },
        { $limit: limit },
    ]);

    return result.map((item) => ({
        productId: item._id,
        productName: item.productName,
        quantitySold: item.quantitySold,
        revenue: item.revenue,
    }));
};

// ── Sales By Category ───────────────────────────────────────────────────────────
const getSalesByCategory = async () => {
    const result = await Order.aggregate([
        { $match: { status: 'completed' } },
        {
            $lookup: {
                from: 'products',
                localField: 'productId',
                foreignField: '_id',
                as: 'product',
            },
        },
        { $unwind: '$product' },
        {
            $lookup: {
                from: 'categories',
                localField: 'product.category',
                foreignField: '_id',
                as: 'category',
            },
        },
        { $unwind: '$category' },
        {
            $group: {
                _id: '$category._id',
                categoryName: { $first: '$category.name' },
                revenue: { $sum: '$totalAmount' },
                orders: { $sum: 1 },
            },
        },
        { $sort: { revenue: -1 } },
    ]);

    return result.map((item) => ({
        categoryId: item._id,
        categoryName: item.categoryName,
        revenue: item.revenue,
        orders: item.orders,
    }));
};

export const orderServices = {
    createOrder,
    getAllOrders,
    getOrderById,
    cancelOrder,
    deleteOrder,
    getSalesAnalytics,
    getTopProducts,
    getSalesByCategory,
};
