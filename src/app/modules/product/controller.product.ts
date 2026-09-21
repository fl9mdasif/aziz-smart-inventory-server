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

// ── Update (product-level fields, optionally the whole variants array) ────────
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

// ── Update a single variant (price/stock edit) ─────────────────────────────────
const updateVariant = catchAsync(async (req, res) => {
    const { productId, variantId } = req.params;
    const result = await productServices.updateVariant(productId, variantId, req.body);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Variant updated successfully',
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
        message: `Restock queue retrieved (${result.length} size${result.length !== 1 ? 's' : ''} need restocking)`,
        data: result,
    });
});

// ── Meta (distinct brand/transportPackage/origin values) ──────────────────────
// GET /api/products/meta
const getProductMeta = catchAsync(async (req, res) => {
    const result = await productServices.getProductMeta();
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Product meta retrieved successfully',
        data: result,
    });
});


export const productControllers = {
    createProduct,
    getAllProducts,
    getSingleProduct,
    updateProduct,
    updateVariant,
    deleteProduct,
    getRestockQueue,
    getProductMeta,
};
