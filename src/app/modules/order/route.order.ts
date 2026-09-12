import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../auth/const.auth';
import { orderControllers } from './controller.order';
import { orderValidations } from './validation.order';

const router = express.Router();

// POST /api/v1/orders — record a new sale (staff/admin/superAdmin)
// body: { productId, quantity, discount?, customerName?, customerContact?, note? }
router.post(
    '/',
    auth(USER_ROLE.staff, USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(orderValidations.placeOrderValidationSchema),
    orderControllers.createOrder,
);

// GET /api/v1/orders — list all orders with search + filter + pagination
// query: ?status=completed|cancelled  ?search=<customer/product name>  ?page  ?limit
router.get(
    '/',
    auth(USER_ROLE.staff, USER_ROLE.admin, USER_ROLE.superAdmin),
    orderControllers.getAllOrders,
);

// ── Analytics (static paths, must be registered before /:orderId) ──────────────
// GET /api/v1/orders/analytics/sales — sales chart data
// query: ?period=daily|weekly|monthly|yearly  ?from  ?to
router.get(
    '/analytics/sales',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    orderControllers.getSalesAnalytics,
);

// GET /api/v1/orders/analytics/top-products
// query: ?limit
router.get(
    '/analytics/top-products',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    orderControllers.getTopProducts,
);

// GET /api/v1/orders/analytics/by-category
router.get(
    '/analytics/by-category',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    orderControllers.getSalesByCategory,
);

// GET /api/v1/orders/:orderId — single order detail
router.get(
    '/:orderId',
    auth(USER_ROLE.staff, USER_ROLE.admin, USER_ROLE.superAdmin),
    orderControllers.getOrderById,
);

// PATCH /api/v1/orders/:orderId/cancel — void a sale (admin/superAdmin only)
// body: { cancelReason? }
router.patch(
    '/:orderId/cancel',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(orderValidations.cancelOrderValidationSchema),
    orderControllers.cancelOrder,
);

// DELETE /api/v1/orders/:orderId (admin/superAdmin)
router.delete(
    '/:orderId',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    orderControllers.deleteOrder,
);

export const orderRoutes = router;
