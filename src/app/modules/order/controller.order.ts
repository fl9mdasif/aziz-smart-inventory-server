import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import { response } from '../../utils/sendResponse';
import { orderServices } from './service.order';

// ── Create Order (record a sale) ────────────────────────────────────────────────
const createOrder = catchAsync(async (req, res) => {
    const result = await orderServices.createOrder(req.body, req.user._id as string);
    response.createSendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Order recorded successfully',
        data: result,
    });
});

// ── Get All Orders ─────────────────────────────────────────────────────────────
// query: ?status  ?search  ?page  ?limit
const getAllOrders = catchAsync(async (req, res) => {
    const result = await orderServices.getAllOrders(req.query);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Orders retrieved successfully',
        data: result,
    });
});

// ── Get Single Order ───────────────────────────────────────────────────────────
const getOrderById = catchAsync(async (req, res) => {
    const result = await orderServices.getOrderById(req.params.orderId);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Order retrieved successfully',
        data: result,
    });
});

// ── Cancel Order ────────────────────────────────────────────────────────────────
// body: { cancelReason? }
const cancelOrder = catchAsync(async (req, res) => {
    const { cancelReason } = req.body;
    const result = await orderServices.cancelOrder(req.params.orderId, cancelReason);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Order cancelled successfully',
        data: result,
    });
});

// ── Delete Order ───────────────────────────────────────────────────────────────
const deleteOrder = catchAsync(async (req, res) => {
    const result = await orderServices.deleteOrder(req.params.orderId);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Order deleted successfully',
        data: result,
    });
});

// ── Sales Analytics ────────────────────────────────────────────────────────────
// query: ?period=daily|weekly|monthly|yearly  ?from  ?to
const getSalesAnalytics = catchAsync(async (req, res) => {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'yearly') ?? 'monthly';
    const { from, to } = req.query;
    const result = await orderServices.getSalesAnalytics(period, from as string, to as string);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Sales analytics retrieved successfully',
        data: result,
    });
});

// ── Top Products ────────────────────────────────────────────────────────────────
// query: ?limit
const getTopProducts = catchAsync(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const result = await orderServices.getTopProducts(limit);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Top products retrieved successfully',
        data: result,
    });
});

// ── Sales By Category ────────────────────────────────────────────────────────────
const getSalesByCategory = catchAsync(async (req, res) => {
    const result = await orderServices.getSalesByCategory();
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Sales by category retrieved successfully',
        data: result,
    });
});

export const orderControllers = {
    createOrder,
    getAllOrders,
    getOrderById,
    cancelOrder,
    deleteOrder,
    getSalesAnalytics,
    getTopProducts,
    getSalesByCategory,
};
