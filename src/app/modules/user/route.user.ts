import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../auth/const.auth';
import { userControllers } from './controller.user';
import { userValidations } from './validation.user';

const router = express.Router();

// POST /api/v1/users — create a staff account (admin/superAdmin);
// promoting straight to 'admin' is enforced superAdmin-only inside the service.
router.post(
    '/',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(userValidations.createUserValidationSchema),
    userControllers.createStaff,
);

// GET /api/v1/users — list all users
router.get(
    '/',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    userControllers.getAllUsers,
);

// GET /api/v1/users/:userId — single user
router.get(
    '/:userId',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    userControllers.getUserById,
);

// PATCH /api/v1/users/:userId — update a user; role changes superAdmin-only
router.patch(
    '/:userId',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(userValidations.updateUserValidationSchema),
    userControllers.updateUser,
);

// PATCH /api/v1/users/:userId/deactivate
router.patch(
    '/:userId/deactivate',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    userControllers.deactivateUser,
);

export const userRoutes = router;
