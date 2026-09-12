import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

// create token
export const createToken = (
  jwtPayload: {
    username: string;
    role: 'staff' | 'admin' | 'superAdmin';
    email?: string
  },
  secret: string,
  expiresIn: string,
) => {
  return jwt.sign(jwtPayload, secret, {
    expiresIn,
  } as SignOptions);
};

// verify the token
export const verifyToken = (token: string, secret: string) => {
  return jwt.verify(token, secret as string) as JwtPayload;
};
