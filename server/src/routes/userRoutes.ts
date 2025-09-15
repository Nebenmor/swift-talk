import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import {
  validateFriendRequest,
  validateObjectId,
  validatePagination,
} from '../middleware/validation';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/users/search
 * @desc    Search users by username or email
 * @access  Private
 */
router.get('/search', validatePagination, UserController.searchUsers);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:userId', validateObjectId('userId'), UserController.getUserById);

/**
 * @route   GET /api/users/username/:username
 * @desc    Get user by username
 * @access  Private
 */
router.get('/username/:username', UserController.getUserByUsername);

/**
 * @route   GET /api/users/friends/list
 * @desc    Get user's friends list
 * @access  Private
 */
router.get('/friends/list', UserController.getFriends);

/**
 * @route   GET /api/users/friends/with-messages
 * @desc    Get friends list with last messages
 * @access  Private
 */
router.get('/friends/with-messages', UserController.getFriendsWithMessages);

/**
 * @route   GET /api/users/friends/online
 * @desc    Get online friends
 * @access  Private
 */
router.get('/friends/online', UserController.getOnlineFriends);

/**
 * @route   POST /api/users/friends/request
 * @desc    Send friend request
 * @access  Private
 */
router.post(
  '/friends/request',
  validateFriendRequest,
  UserController.sendFriendRequest
);

/**
 * @route   GET /api/users/friends/requests/pending
 * @desc    Get pending friend requests
 * @access  Private
 */
router.get('/friends/requests/pending', UserController.getPendingRequests);

/**
 * @route   GET /api/users/friends/requests/sent
 * @desc    Get sent friend requests
 * @access  Private
 */
router.get('/friends/requests/sent', UserController.getSentRequests);

/**
 * @route   PUT /api/users/friends/requests/:requestId/accept
 * @desc    Accept friend request
 * @access  Private
 */
router.put(
  '/friends/requests/:requestId/accept',
  validateObjectId('requestId'),
  UserController.acceptFriendRequest
);

/**
 * @route   PUT /api/users/friends/requests/:requestId/decline
 * @desc    Decline friend request
 * @access  Private
 */
router.put(
  '/friends/requests/:requestId/decline',
  validateObjectId('requestId'),
  UserController.declineFriendRequest
);

/**
 * @route   DELETE /api/users/friends/:friendId
 * @desc    Remove friend
 * @access  Private
 */
router.delete(
  '/friends/:friendId',
  validateObjectId('friendId'),
  UserController.removeFriend
);

/**
 * @route   POST /api/users/:userId/block
 * @desc    Block user
 * @access  Private
 */
router.post(
  '/:userId/block',
  validateObjectId('userId'),
  UserController.blockUser
);

/**
 * @route   GET /api/users/:userId/friendship-status
 * @desc    Get friendship status with another user
 * @access  Private
 */
router.get(
  '/:userId/friendship-status',
  validateObjectId('userId'),
  UserController.getFriendshipStatus
);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', UserController.getUserStats);

/**
 * @route   PUT /api/users/online-status
 * @desc    Update online status
 * @access  Private
 */
router.put('/online-status', UserController.updateOnlineStatus);

export default router;