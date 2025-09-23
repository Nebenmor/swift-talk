import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import { ResponseUtil, handleAsyncError } from '../utils/response';
import { AuthRequest } from '../types';

export class UserController {
  static readonly searchUsers = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const { q: query, limit } = req.query;
    
    if (!query || typeof query !== 'string') {
      return ResponseUtil.error(res, 'Search query is required', 400);
    }
    
    const users = await UserService.searchUsers(
      query,
      userId,
      limit ? parseInt(limit as string) : 10
    );
    
    ResponseUtil.success(res, users, 'Users retrieved successfully');
  });

  static readonly getUserById = handleAsyncError(async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    const user = await UserService.getUserById(userId);
    
    if (!user) {
      return ResponseUtil.notFound(res, 'User not found');
    }
    
    ResponseUtil.success(res, user, 'User retrieved successfully');
  });

  static readonly getUserByUsername = handleAsyncError(async (req: Request, res: Response) => {
    const { username } = req.params;
    
    const user = await UserService.getUserByUsername(username);
    
    if (!user) {
      return ResponseUtil.notFound(res, 'User not found');
    }
    
    ResponseUtil.success(res, user, 'User retrieved successfully');
  });

  static readonly getFriends = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    
    const friends = await UserService.getFriends(userId);
    
    ResponseUtil.success(res, friends, 'Friends retrieved successfully');
  });

  static readonly getFriendsWithMessages = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    
    const friends = await UserService.getFriendsWithLastMessage(userId);
    
    ResponseUtil.success(res, friends, 'Friends with messages retrieved successfully');
  });

  static readonly sendFriendRequest = handleAsyncError(async (req: AuthRequest, res: Response) => {
    console.log('=== FRIEND REQUEST DEBUG ===');
    console.log('Requester ID:', req.user!._id);
    console.log('Request body:', req.body);
    
    const userId = req.user!._id;
    const { username } = req.body;
    
    try {
      await UserService.sendFriendRequest(userId, username);
      console.log('Friend request sent successfully');
      
      ResponseUtil.success(
        res,
        null,
        'Friend request sent successfully',
        201
      );
    } catch (error: unknown) {
      console.error('Friend request error:', error);
      
      // Proper error handling with unknown type
      const errorMessage = error instanceof Error ? error.message : 'Failed to send friend request';
      
      // Fixed: Remove redundant assignment - determine status code based on error message
      let statusCode: number;
      if (errorMessage.includes('User not found')) {
        statusCode = 404;
      } else if (errorMessage.includes('already sent') || errorMessage.includes('already friends') || errorMessage.includes('already sent you')) {
        statusCode = 409; // Conflict
      } else if (errorMessage.includes('Cannot send friend request to this user') || errorMessage.includes('blocked')) {
        statusCode = 403; // Forbidden
      } else if (errorMessage.includes('Cannot send friend request to yourself')) {
        statusCode = 400; // Bad request
      } else {
        statusCode = 400; // Default
      }
      
      return ResponseUtil.error(res, errorMessage, statusCode);
    }
  });

  static readonly getPendingRequests = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    
    const requests = await UserService.getPendingFriendRequests(userId);
    
    ResponseUtil.success(res, requests, 'Pending requests retrieved successfully');
  });

  static readonly getSentRequests = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    
    const requests = await UserService.getSentFriendRequests(userId);
    
    ResponseUtil.success(res, requests, 'Sent requests retrieved successfully');
  });

  static readonly acceptFriendRequest = handleAsyncError(async (req: AuthRequest, res: Response) => {
    console.log('=== ACCEPT REQUEST CONTROLLER DEBUG ===');
    console.log('User ID from req.user:', req.user!._id);
    console.log('Request ID from params:', req.params.requestId);
    
    const userId = req.user!._id;
    const { requestId } = req.params;
    
    try {
      await UserService.acceptFriendRequest(userId, requestId);
      ResponseUtil.success(res, null, 'Friend request accepted');
    } catch (error: unknown) {
      console.error('Accept request error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept friend request';
      
      // Fixed: Remove redundant assignment - determine status code based on error message
      let statusCode: number;
      if (errorMessage.includes('not found')) {
        statusCode = 404;
      } else if (errorMessage.includes('not authorized')) {
        statusCode = 403;
      } else if (errorMessage.includes('already processed')) {
        statusCode = 409;
      } else {
        statusCode = 400;
      }
      
      return ResponseUtil.error(res, errorMessage, statusCode);
    }
  });

  static readonly declineFriendRequest = handleAsyncError(async (req: AuthRequest, res: Response) => {
    console.log('=== DECLINE REQUEST CONTROLLER DEBUG ===');
    console.log('User ID from req.user:', req.user!._id);
    console.log('Request ID from params:', req.params.requestId);
    
    const userId = req.user!._id;
    const { requestId } = req.params;
    
    try {
      const result = await UserService.declineFriendRequest(userId, requestId);
      ResponseUtil.success(res, null, result.message || 'Friend request declined');
    } catch (error: unknown) {
      console.error('Decline request error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to decline friend request';
      
      // Fixed: Remove redundant assignment - determine status code based on error message  
      let statusCode: number;
      if (errorMessage.includes('not found')) {
        statusCode = 404;
      } else if (errorMessage.includes('not authorized')) {
        statusCode = 403;
      } else if (errorMessage.includes('already processed')) {
        statusCode = 409;
      } else {
        statusCode = 400;
      }
      
      return ResponseUtil.error(res, errorMessage, statusCode);
    }
  });

  static readonly removeFriend = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const { friendId } = req.params;
    
    try {
      await UserService.removeFriend(userId, friendId);
      ResponseUtil.success(res, null, 'Friend removed successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove friend';
      const statusCode = errorMessage.includes('not found') ? 404 : 400;
      return ResponseUtil.error(res, errorMessage, statusCode);
    }
  });

  static readonly blockUser = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const { userId: blockedId } = req.params;
    
    try {
      await UserService.blockUser(userId, blockedId);
      ResponseUtil.success(res, null, 'User blocked successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to block user';
      
      let statusCode: number;
      if (errorMessage.includes('Cannot block yourself')) {
        statusCode = 400;
      } else if (errorMessage.includes('already blocked')) {
        statusCode = 409;
      } else {
        statusCode = 400;
      }
      
      return ResponseUtil.error(res, errorMessage, statusCode);
    }
  });

  static readonly getOnlineFriends = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    
    const onlineFriends = await UserService.getOnlineFriends(userId);
    
    ResponseUtil.success(res, onlineFriends, 'Online friends retrieved successfully');
  });

  static readonly getFriendshipStatus = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const { userId: otherUserId } = req.params;
    
    const status = await UserService.getFriendshipStatus(userId, otherUserId);
    
    ResponseUtil.success(res, { status }, 'Friendship status retrieved successfully');
  });

  static readonly getUserStats = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    
    const stats = await UserService.getUserStats(userId);
    
    ResponseUtil.success(res, stats, 'User stats retrieved successfully');
  });

  static readonly updateOnlineStatus = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const { isOnline } = req.body;
    
    if (typeof isOnline !== 'boolean') {
      return ResponseUtil.error(res, 'isOnline must be a boolean', 400);
    }
    
    await UserService.updateOnlineStatus(userId, isOnline);
    
    ResponseUtil.success(res, null, 'Online status updated successfully');
  });
}