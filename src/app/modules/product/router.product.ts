import express from 'express';
import auth from '../../middlewares/auth';
import optionalAuth from '../../middlewares/optionalAuth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../auth/const.auth';
import { productControllers } from './controller.product';
import { productValidations } from './validation.product';

const router = express.Router();

// POST /api/products — create a new product (admin / superAdmin)
router.post(
    '/',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin, USER_ROLE.staff),
    validateRequest(productValidations.createProductValidationSchema),
    productControllers.createProduct,
);

// GET /api/products — list all products (public; shaped down for anonymous
// callers, full document for a logged-in staff/admin session)
router.get('/', optionalAuth(), productControllers.getAllProducts);

// ── Static paths — must be registered before /:productId ───────────────────

// GET /api/products/restock-queue — sizes needing restock, sorted by urgency
router.get(
    '/restock-queue',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    productControllers.getRestockQueue,
);

// GET /api/products/meta — distinct brand/transportPackage/origin values, for
// the client's combobox-with-add-new fields. Public, same as /categories.
router.get('/meta', productControllers.getProductMeta);

// GET /api/products/:productId — single product by ObjectId or slug (public)
router.get('/:productId', optionalAuth(), productControllers.getSingleProduct);

// PATCH /api/products/:productId — update product fields, optionally the
// whole variants array (admin / superAdmin)
router.patch(
    '/:productId',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin, USER_ROLE.staff),
    validateRequest(productValidations.updateProductValidationSchema),
    productControllers.updateProduct,
);

// PATCH /api/products/:productId/variants/:variantId — edit one size's
// price/stock without touching the rest of the product (admin / superAdmin)
router.patch(
    '/:productId/variants/:variantId',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin, USER_ROLE.staff),
    validateRequest(productValidations.updateVariantValidationSchema),
    productControllers.updateVariant,
);

// DELETE /api/products/:productId (admin / superAdmin)
router.delete(
    '/:productId',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    productControllers.deleteProduct,
);

export const productRoutes = router;
