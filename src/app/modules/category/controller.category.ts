import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import { response } from '../../utils/sendResponse';
import { categoryServices } from './service.category';

// Create category
const createCategory = catchAsync(async (req, res) => {
    const result = await categoryServices.createCategory(req.body);

    response.createSendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Category created successfully',
        data: result,
    });
});

// Get all categories
const getAllCategories = catchAsync(async (req, res) => {
    const result = await categoryServices.getAllCategories(req.query);

    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Categories retrieved successfully',
        data: result,
    });
});

// Get single category by id or slug
const getSingleCategory = catchAsync(async (req, res) => {
    const { categoryId } = req.params;
    const result = await categoryServices.getSingleCategory(categoryId);

    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Category retrieved successfully',
        data: result,
    });
});

// Update category
const updateCategory = catchAsync(async (req, res) => {
    const { categoryId } = req.params;
    const result = await categoryServices.updateCategory(categoryId, req.body);

    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Category updated successfully',
        data: result,
    });
});

// Delete category
const deleteCategory = catchAsync(async (req, res) => {
    const { categoryId } = req.params;
    const result = await categoryServices.deleteCategory(categoryId);

    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Category deleted successfully',
        data: result,
    });
});

// Toggle active status
const toggleCategoryStatus = catchAsync(async (req, res) => {
    const { categoryId } = req.params;
    const result = await categoryServices.toggleCategoryStatus(categoryId);

    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: `Category is now ${result.isActive ? 'active' : 'inactive'}`,
        data: result,
    });
});

export const categoryControllers = {
    createCategory,
    getAllCategories,
    getSingleCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
};