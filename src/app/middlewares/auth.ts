import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import config from '../config';
import jwt, { JwtPayload } from 'jsonwebtoken';
import AppError from '../errors/AppErrors';
import { User } from '../modules/auth/model.auth';
import { TUserRole } from '../modules/auth/interface.auth';

const auth = (...requiredRoles: TUserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;

    // checking if the token is missing
    if (!token) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'You do not have the necessary permissions to access this resource.', // details
        'Unauthorized Access', // message
      );
    }

    // checking if the given token is valid
    const decoded = jwt.verify(
      token,
      config.jwt_access_secret as string,
    ) as JwtPayload;
    // console.log('auth middleware', decoded);
    const { role, username, email, iat } = decoded;

    // checking if the user is exist
    const user = await User.isUserExists(email);

    if (!user) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'This User is not found -auth middleware !',
        'No user found with the id',
      );
    }

    // check if password update time
    if (
      user.passwordChangedAt &&
      User.isJWTIssuedBeforePasswordChanged(
        user.passwordChangedAt,
        iat as number,
      )
    ) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'You do not have the necessary permissions to access this resource.',
        'Unauthorized Access',
      );
    }

    if (requiredRoles && !requiredRoles.includes(role)) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        `'${role}' is are not authorized`,
        'You do not have the necessary permissions to access this resource.',
      );
    }

    req.user = decoded as JwtPayload;
    next();
  });
};

export default auth;
