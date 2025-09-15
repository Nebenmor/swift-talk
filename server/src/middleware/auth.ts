import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';
import { ResponseUtil } from '../utils/response';
import { AuthRequest } from '../types';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      ResponseUtil.unauthorized(res, 'No authorization token provided');
      return;
    }

    const token = extractTokenFromHeader(authHeader);
    const decoded = verifyToken(token);

    // Fetch user from database to ensure they still exist
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      ResponseUtil.unauthorized(res, 'User not found');
      return;
    }

    // Attach user to request object
    req.user = user.toObject();
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    ResponseUtil.unauthorized(res, errorMessage);
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = extractTokenFromHeader(authHeader);
      const decoded = verifyToken(token);
      
      const user = await User.findById(decoded.userId).select('-password');
      if (user) {
        req.user = user.toObject();
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we continue even if token is invalid
    next();
  }
};