import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import { response } from '../../utils/sendResponse';
import { productServices } from './service.product';

// ── Create ─────────────────────────────────────────────────────────────────────
const createProduct = catchAsync(async (req, res) => {
    const result = await productServices.createProduct(req.body);
    response.createSendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Product created successfully',
        data: result,
    });
});

// ── Get All (search + filter + paginate) ───────────────────────────────────────
const getAllProducts = catchAsync(async (req, res) => {
    const result = await productServices.getAllProducts(req.query, Boolean(req.user));
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Products retrieved successfully',
        data: result,
    });
});

// ── Get Single ─────────────────────────────────────────────────────────────────
const getSingleProduct = catchAsync(async (req, res) => {
    const { productId } = req.params;
    const result = await productServices.getSingleProduct(productId, Boolean(req.user));
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Product retrieved successfully',
        data: result,
    });
});

// ── Update ─────────────────────────────────────────────────────────────────────
const updateProduct = catchAsync(async (req, res) => {
    const { productId } = req.params;
    const result = await productServices.updateProduct(productId, req.body);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Product updated successfully',
        data: result,
    });
});

// ── Delete ─────────────────────────────────────────────────────────────────────
const deleteProduct = catchAsync(async (req, res) => {
    const { productId } = req.params;
    const result = await productServices.deleteProduct(productId);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Product deleted successfully',
        data: result,
    });
});


// ── Restock Queue ──────────────────────────────────────────────────────────────
// GET /api/products/restock-queue
const getRestockQueue = catchAsync(async (req, res) => {
    const result = await productServices.getRestockQueue();
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: `Restock queue retrieved (${result.length} product${result.length !== 1 ? 's' : ''} need restocking)`,
        data: result,
    });
});


export const productControllers = {
    createProduct,
    getAllProducts,
    getSingleProduct,
    updateProduct,
    deleteProduct,
    getRestockQueue,
};
