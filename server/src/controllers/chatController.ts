import { Request, Response } from 'express';
import { ChatService } from '../services/chatService';
import { ResponseUtil, handleAsyncError } from '../utils/response';
import { AuthRequest } from '../types';

export class ChatController {
  static readonly sendMessage = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const senderId = req.user!._id;
    const { recipient, content, messageType = 'text' } = req.body;
    
    const message = await ChatService.sendMessage(
      senderId,
      recipient,
      content,
      messageType
    );
    
    ResponseUtil.success(
      res,
      message,
      'Message sent successfully',
      201
    );
  });

  static readonly sendFileMessage = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const senderId = req.user!._id;
    const { recipient } = req.body;
    const file = req.file;
    
    if (!file) {
      return ResponseUtil.error(res, 'No file provided', 400);
    }
    
    // Upload file and get URL
    const fileData = await ChatService.uploadFile(file, senderId);
    
    // Send file message
    const message = await ChatService.sendMessage(
      senderId,
      recipient,
      `Sent a file: ${fileData.originalName}`,
      'file',
      {
        fileUrl: fileData.url,
        fileName: fileData.originalName,
        fileSize: fileData.size,
      }
    );
    
    ResponseUtil.success(
      res,
      message,
      'File message sent successfully',
      201
    );
  });

  static readonly getChatHistory = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const { userId: otherUserId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const chatHistory = await ChatService.getChatHistory(
      userId,
      otherUserId,
      page,
      limit
    );
    
    ResponseUtil.paginated(
      res,
      chatHistory.data,
      chatHistory.pagination,
      'Chat history retrieved successfully'
    );
  });

  static readonly markMessagesAsRead = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const recipientId = req.user!._id;
    const { userId: senderId } = req.params;
    
    await ChatService.markMessagesAsRead(senderId, recipientId);
    
    ResponseUtil.success(res, null, 'Messages marked as read');
  });

  static readonly getUnreadCount = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const senderId = req.query.senderId as string;
    
    const count = await ChatService.getUnreadMessagesCount(userId, senderId);
    
    ResponseUtil.success(res, { count }, 'Unread count retrieved successfully');
  });

  static readonly deleteMessage = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const { messageId } = req.params;
    
    await ChatService.deleteMessage(messageId, userId);
    
    ResponseUtil.success(res, null, 'Message deleted successfully');
  });

  static readonly searchMessages = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const { q: query, userId: otherUserId } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!query || typeof query !== 'string') {
      return ResponseUtil.error(res, 'Search query is required', 400);
    }
    
    const results = await ChatService.searchMessages(
      userId,
      query,
      otherUserId as string,
      page,
      limit
    );
    
    ResponseUtil.paginated(
      res,
      results.data,
      results.pagination,
      'Messages search completed'
    );
  });

  static readonly getChatRooms = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    
    const chatRooms = await ChatService.getChatRooms(userId);
    
    ResponseUtil.success(res, chatRooms, 'Chat rooms retrieved successfully');
  });

  static readonly getMessageById = handleAsyncError(async (req: Request, res: Response) => {
    const { messageId } = req.params;
    
    const message = await ChatService.getMessageById(messageId);
    
    if (!message) {
      return ResponseUtil.notFound(res, 'Message not found');
    }
    
    ResponseUtil.success(res, message, 'Message retrieved successfully');
  });

  static readonly uploadFile = handleAsyncError(async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const file = req.file;
    
    if (!file) {
      return ResponseUtil.error(res, 'No file provided', 400);
    }
    
    const fileData = await ChatService.uploadFile(file, userId);
    
    ResponseUtil.success(
      res,
      fileData,
      'File uploaded successfully',
      201
    );
  });

  static readonly getUserOnlineStatus = handleAsyncError(async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    const isOnline = await ChatService.isUserOnline(userId);
    
    ResponseUtil.success(
      res,
      { isOnline },
      'User online status retrieved successfully'
    );
  });
}