import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { authValidations } from './validation.auth';
import { authControllers } from './controller.auth';
import auth from '../../middlewares/auth';
import { authRateLimiter } from '../../middlewares/rateLimiters';
import { USER_ROLE } from './const.auth';

const router = express.Router();

// Deliberately no public self-registration route — accounts are created
// internally via POST /users (admin/superAdmin only, see user module). A
// public /register endpoint here previously accepted an arbitrary `role`
// straight from the request body, letting anyone create a superAdmin
// account; do not reintroduce it without forcing role to a safe default
// server-side.

// login a user
router.post(
  '/login',
  authRateLimiter,
  validateRequest(authValidations.loginValidationSchema),
  authControllers.loginUser,
);

// get own profile
router.get(
  '/me',
  auth(USER_ROLE.staff, USER_ROLE.admin, USER_ROLE.superAdmin),
  authControllers.getMe,
);

// update own profile
router.patch(
  '/update-profile',
  auth(USER_ROLE.staff, USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(authValidations.updateProfileValidationSchema),
  authControllers.updateProfile,
);

// change password
router.post(
  '/change-password',
  auth(USER_ROLE.staff, USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(authValidations.changePasswordValidationSchema),
  authControllers.changePassword,
);

// logout a user
router.post('/logout', authControllers.logoutUser);

// refresh token
router.post('/refresh-token', authRateLimiter, authControllers.refreshToken);


export const authRoute = router;
