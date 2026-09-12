import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { authValidations } from './validation.auth';
import { authControllers } from './controller.auth';
import auth from '../../middlewares/auth';
import { USER_ROLE } from './const.auth';

const router = express.Router();

// register a user
router.post(
  '/register',
  validateRequest(authValidations.userRegistrationValidation),
  authControllers.registerUser,
);

// login a user
router.post(
  '/login',
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
router.post('/refresh-token', authControllers.refreshToken);


export const authRoute = router;
