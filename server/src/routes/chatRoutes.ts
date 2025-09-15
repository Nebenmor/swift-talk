import { Router } from 'express';
import { ChatController } from '../controllers/chatController';
import { authenticate } from '../middleware/auth';
import { uploadSingle, handleUploadError } from '../middleware/upload';
import {
  validateSendMessage,
  validateChatParams,
  validateObjectId,
  validatePagination,
  validateFileUpload,
} from '../middleware/validation';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/chat/messages
 * @desc    Send a text message
 * @access  Private
 */
router.post('/messages', validateSendMessage, ChatController.sendMessage);

/**
 * @route   POST /api/chat/messages/file
 * @desc    Send a file message
 * @access  Private
 */
router.post(
  '/messages/file',
  uploadSingle,
  handleUploadError,
  validateFileUpload,
  ChatController.sendFileMessage
);

/**
 * @route   GET /api/chat/history/:userId
 * @desc    Get chat history with a user
 * @access  Private
 */
router.get('/history/:userId', validateChatParams, ChatController.getChatHistory);

/**
 * @route   PUT /api/chat/messages/:userId/read
 * @desc    Mark messages from a user as read
 * @access  Private
 */
router.put(
  '/messages/:userId/read',
  validateObjectId('userId'),
  ChatController.markMessagesAsRead
);

/**
 * @route   GET /api/chat/unread-count
 * @desc    Get unread messages count
 * @access  Private
 */
router.get('/unread-count', ChatController.getUnreadCount);

/**
 * @route   DELETE /api/chat/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete(
  '/messages/:messageId',
  validateObjectId('messageId'),
  ChatController.deleteMessage
);

/**
 * @route   GET /api/chat/messages/search
 * @desc    Search messages
 * @access  Private
 */
router.get('/messages/search', validatePagination, ChatController.searchMessages);

/**
 * @route   GET /api/chat/rooms
 * @desc    Get chat rooms (friends with last messages)
 * @access  Private
 */
router.get('/rooms', ChatController.getChatRooms);

/**
 * @route   GET /api/chat/messages/:messageId
 * @desc    Get message by ID
 * @access  Private
 */
router.get(
  '/messages/:messageId',
  validateObjectId('messageId'),
  ChatController.getMessageById
);

/**
 * @route   POST /api/chat/upload
 * @desc    Upload a file (without sending message)
 * @access  Private
 */
router.post(
  '/upload',
  uploadSingle,
  handleUploadError,
  validateFileUpload,
  ChatController.uploadFile
);

/**
 * @route   GET /api/chat/users/:userId/online
 * @desc    Get user online status
 * @access  Private
 */
router.get(
  '/users/:userId/online',
  validateObjectId('userId'),
  ChatController.getUserOnlineStatus
);

export default router;