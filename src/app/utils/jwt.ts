/* eslint-disable no-undef */
// boiler plate of jwt
import jwt, { JwtPayload } from 'jsonwebtoken';

// create a token
export const createToken = (
  jwtPayload: { username: string; role: 'user' | 'admin'; email: string },
  secret: string,
  expiresIn: string,
) => {
  return jwt.sign(jwtPayload, secret, {
    expiresIn,
    
  } as jwt.SignOptions);
};

// verify the token
export const verifyToken = (token: string, secret: string) => {
  return jwt.verify(token, secret as string) as JwtPayload;
};
