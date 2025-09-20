import { Response, NextFunction } from 'express';
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

    console.log('=== AUTH MIDDLEWARE DEBUG ===');
    console.log('Decoded token payload:', decoded);
    console.log('User ID from token:', decoded.userId);
    console.log('User ID type:', typeof decoded.userId);

    // Fetch user from database to ensure they still exist
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      ResponseUtil.unauthorized(res, 'User not found');
      return;
    }

    console.log('Found user:', user._id);
    console.log('User _id type:', typeof user._id);
    console.log('User _id toString:', user._id.toString());

    // Attach user to request object - ENSURE _id is a string
    const userObj = user.toObject();
    req.user = {
      ...userObj,
      _id: user._id.toString(), // Force convert to string
    };

    console.log('Set req.user._id to:', req.user._id);
    console.log('req.user._id type:', typeof req.user._id);
    
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    console.error('Auth middleware error:', errorMessage);
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
        const userObj = user.toObject();
        req.user = {
          ...userObj,
          _id: user._id.toString(), // Force convert to string
        };
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we continue even if token is invalid
    console.warn('Optional auth failed:', error);
    next();
  }
};