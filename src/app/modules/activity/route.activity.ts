import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../auth/const.auth';
import { ActivityController } from './controller.activity';

const router = Router();

// GET /api/v1/activity — recent inventory/order/staff-account events
router.get(
  '/',
  auth(USER_ROLE.staff, USER_ROLE.admin, USER_ROLE.superAdmin),
  ActivityController.getRecentActivities,
);

export const ActivityRoutes = router;
