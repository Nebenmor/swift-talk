import jwt from 'jsonwebtoken';
import { config } from '../config/config';

export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number; // issued at
  exp?: number; // expiration
  iss?: string; // issuer
  aud?: string; // audience
}

export const generateToken = (payload: JwtPayload): string => {
  const secret = config.jwt.secret;
  if (!secret) {
    throw new Error('JWT secret is not configured');
  }

  return jwt.sign(payload, secret, {
    expiresIn: config.jwt.expiresIn as any,
    issuer: 'ChatApp',
    audience: config.app.clientUrl,
  });
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'ChatApp',
      audience: config.app.clientUrl,
    }) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
};

export const extractTokenFromHeader = (authHeader: string): string => {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header format');
  }

  const token = authHeader.substring(7);
  if (!token) {
    throw new Error('No token provided');
  }

  return token;
};

export const refreshToken = (oldToken: string): string => {
  try {
    const decoded = jwt.verify(oldToken, config.jwt.secret, {
      ignoreExpiration: true,
      issuer: 'ChatApp',
      audience: config.app.clientUrl,
    }) as JwtPayload;

    // Generate new token with fresh expiration
    return generateToken({
      userId: decoded.userId,
      username: decoded.username,
    });
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new Error('Token refresh failed');
  }
};
