import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import config from '../config';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { User } from '../modules/auth/model.auth';

// Decodes a token if present so a public route can return a richer response
// to a logged-in staff/admin session — but never rejects the request just
// because the token is missing or invalid. Used on public catalog routes.
const optionalAuth = () => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers.authorization;

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt_access_secret as string) as JwtPayload;
      const { email, iat } = decoded;

      const user = await User.isUserExists(email);
      if (!user) return next();

      if (
        user.passwordChangedAt &&
        User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat as number)
      ) {
        return next();
      }

      req.user = decoded as JwtPayload;
    } catch {
      // Invalid/expired token on a public route — treat as anonymous, don't block.
    }

    next();
  });
};

export default optionalAuth;
