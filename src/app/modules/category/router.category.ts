import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../auth/const.auth';
import { categoryControllers } from './controller.category';
import { categoryValidations } from './validation.category';

const router = express.Router();

// POST /api/categories  — admin / superAdmin only
router.post(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(categoryValidations.createCategoryValidationSchema),
  categoryControllers.createCategory,
);

// GET /api/categories  — public
router.get('/', categoryControllers.getAllCategories);

// GET /api/categories/:categoryId  — public (accepts ObjectId or slug)
router.get('/:categoryId', categoryControllers.getSingleCategory);

// PATCH /api/categories/:categoryId  — admin / superAdmin only
router.patch(
  '/:categoryId',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(categoryValidations.updateCategoryValidationSchema),
  categoryControllers.updateCategory,
);

// PATCH /api/categories/:categoryId/toggle-status  — admin / superAdmin only
router.patch(
  '/:categoryId/toggle-status',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  categoryControllers.toggleCategoryStatus,
);

// DELETE /api/categories/:categoryId  — superAdmin only
router.delete(
  '/:categoryId',
  auth(USER_ROLE.superAdmin, USER_ROLE.admin),
  categoryControllers.deleteCategory,
);

export const categoryRoutes = router;
