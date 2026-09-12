import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import { response } from '../../utils/sendResponse';
import { userServices } from './service.user';

// ── Create Staff/Admin Account ──────────────────────────────────────────────────
const createStaff = catchAsync(async (req, res) => {
    const result = await userServices.createStaff(req.body, req.user._id as string, req.user.role);
    response.createSendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Account created successfully',
        data: result,
    });
});

// ── Get All Users ────────────────────────────────────────────────────────────────
const getAllUsers = catchAsync(async (req, res) => {
    const result = await userServices.getAllUsers(req.query);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Users retrieved successfully',
        data: result,
    });
});

// ── Get Single User ───────────────────────────────────────────────────────────────
const getUserById = catchAsync(async (req, res) => {
    const result = await userServices.getUserById(req.params.userId);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'User retrieved successfully',
        data: result,
    });
});

// ── Update User ───────────────────────────────────────────────────────────────────
const updateUser = catchAsync(async (req, res) => {
    const result = await userServices.updateUser(req.params.userId, req.body, req.user.role);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'User updated successfully',
        data: result,
    });
});

// ── Deactivate User ────────────────────────────────────────────────────────────────
const deactivateUser = catchAsync(async (req, res) => {
    const result = await userServices.deactivateUser(req.params.userId);
    response.createSendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'User deactivated successfully',
        data: result,
    });
});

export const userControllers = {
    createStaff,
    getAllUsers,
    getUserById,
    updateUser,
    deactivateUser,
};
