import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { ResponseUtil, handleAsyncError } from '../utils/response';
import { AuthRequest, LoginCredentials, RegisterCredentials } from '../types';

export class AuthController {
  static readonly register = handleAsyncError(async (req: Request, res: Response) => {
    const credentials: RegisterCredentials = req.body;
    
    const result = await AuthService.register(credentials);
    
    ResponseUtil.success(
      res,
      result,
      'User registered successfully',
      201
    );
  });

  static readonly login = handleAsyncError(async (req: Request, res: Response) => {
    const credentials: LoginCredentials = req.body;
    
    const result = await AuthService.login(credentials);
    
    ResponseUtil.success(
      res,
      result,
      'Login successful'
    );
  });

  static readonly logout = handleAsyncError(async (req: AuthRequest, res: Response) => {
    // Fixed: Remove unnecessary assertion
    const userId = req.user!._id;
    
    await AuthService.logout(userId);
    
    ResponseUtil.success(
      res,
      null,
      'Logout successful'
    );
  });

  static readonly getCurrentUser = handleAsyncError(async (req: AuthRequest, res: Response) => {
    // Fixed: Remove unnecessary assertion
    const userId = req.user!._id;
    
    const user = await AuthService.getCurrentUser(userId);
    
    ResponseUtil.success(
      res,
      user,
      'User retrieved successfully'
    );
  });

  static readonly updateProfile = handleAsyncError(async (req: AuthRequest, res: Response) => {
    // Fixed: Remove unnecessary assertion
    const userId = req.user!._id;
    const updateData = req.body;
    
    // Only allow specific fields to be updated
    const allowedFields = ['email', 'avatar'];
    const filteredData: Record<string, unknown> = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });
    
    const updatedUser = await AuthService.updateProfile(userId, filteredData);
    
    ResponseUtil.success(
      res,
      updatedUser,
      'Profile updated successfully'
    );
  });

  static readonly changePassword = handleAsyncError(async (req: AuthRequest, res: Response) => {
    // Fixed: Remove unnecessary assertion
    const userId = req.user!._id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return ResponseUtil.error(
        res,
        'Current password and new password are required',
        400
      );
    }
    
    await AuthService.changePassword(userId, currentPassword, newPassword);
    
    ResponseUtil.success(
      res,
      null,
      'Password changed successfully'
    );
  });

  static readonly refreshToken = handleAsyncError(async (req: AuthRequest, res: Response) => {
    // Fixed: Remove unnecessary assertion
    const userId = req.user!._id;
    
    const token = await AuthService.refreshToken(userId);
    
    ResponseUtil.success(
      res,
      { token },
      'Token refreshed successfully'
    );
  });

  static readonly verifyToken = handleAsyncError(async (req: AuthRequest, res: Response) => {
    // If we reach here, the token is valid (middleware already verified it)
    ResponseUtil.success(
      res,
      { valid: true, user: req.user },
      'Token is valid'
    );
  });
}