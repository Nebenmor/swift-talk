import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import { ResponseUtil, handleAsyncError } from '../utils/response';
import { AuthRequest } from '../types';

export class UserController {
  static searchUsers = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
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

  static getUserById = handleAsyncError(async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    const user = await UserService.getUserById(userId);
    
    if (!user) {
      return ResponseUtil.notFound(res, 'User not found');
    }
    
    ResponseUtil.success(res, user, 'User retrieved successfully');
  });

  static getUserByUsername = handleAsyncError(async (req: Request, res: Response) => {
    const { username } = req.params;
    
    const user = await UserService.getUserByUsername(username);
    
    if (!user) {
      return ResponseUtil.notFound(res, 'User not found');
    }
    
    ResponseUtil.success(res, user, 'User retrieved successfully');
  });

  static getFriends = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    
    const friends = await UserService.getFriends(userId);
    
    ResponseUtil.success(res, friends, 'Friends retrieved successfully');
  });

  static getFriendsWithMessages = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    
    const friends = await UserService.getFriendsWithLastMessage(userId);
    
    ResponseUtil.success(res, friends, 'Friends with messages retrieved successfully');
  });

  static sendFriendRequest = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    const { username } = req.body;
    
    await UserService.sendFriendRequest(userId, username);
    
    ResponseUtil.success(
      res,
      null,
      'Friend request sent successfully',
      201
    );
  });

  static getPendingRequests = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    
    const requests = await UserService.getPendingFriendRequests(userId);
    
    ResponseUtil.success(res, requests, 'Pending requests retrieved successfully');
  });

  static getSentRequests = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    
    const requests = await UserService.getSentFriendRequests(userId);
    
    ResponseUtil.success(res, requests, 'Sent requests retrieved successfully');
  });

  static acceptFriendRequest = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    const { requestId } = req.params;
    
    await UserService.acceptFriendRequest(userId, requestId);
    
    ResponseUtil.success(res, null, 'Friend request accepted');
  });

  static declineFriendRequest = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    const { requestId } = req.params;
    
    await UserService.declineFriendRequest(userId, requestId);
    
    ResponseUtil.success(res, null, 'Friend request declined');
  });

  static removeFriend = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    const { friendId } = req.params;
    
    await UserService.removeFriend(userId, friendId);
    
    ResponseUtil.success(res, null, 'Friend removed successfully');
  });

  static blockUser = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    const { userId: blockedId } = req.params;
    
    await UserService.blockUser(userId, blockedId);
    
    ResponseUtil.success(res, null, 'User blocked successfully');
  });

  static getOnlineFriends = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    
    const onlineFriends = await UserService.getOnlineFriends(userId);
    
    ResponseUtil.success(res, onlineFriends, 'Online friends retrieved successfully');
  });

  static getFriendshipStatus = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    const { userId: otherUserId } = req.params;
    
    const status = await UserService.getFriendshipStatus(userId, otherUserId);
    
    ResponseUtil.success(res, { status }, 'Friendship status retrieved successfully');
  });

  static getUserStats = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    
    const stats = await UserService.getUserStats(userId);
    
    ResponseUtil.success(res, stats, 'User stats retrieved successfully');
  });

  static updateOnlineStatus = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id!;
    const { isOnline } = req.body;
    
    if (typeof isOnline !== 'boolean') {
      return ResponseUtil.error(res, 'isOnline must be a boolean', 400);
    }
    
    await UserService.updateOnlineStatus(userId, isOnline);
    
    ResponseUtil.success(res, null, 'Online status updated successfully');
  });
}