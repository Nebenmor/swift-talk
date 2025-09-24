// Updated chatService.ts with proper file URL handling
import { Message } from '../models/Message';
import { Friendship } from '../models/Friendship';
import { User } from '../models/User';
import { ChatMessage, PaginatedResponse, FileUploadResult } from '../types';
import { config } from '../config/config';

export class ChatService {
  // Helper method to create absolute file URLs
  private static getAbsoluteFileUrl(fileUrl: string): string {
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    
    // Ensure fileUrl starts with /
    const normalizedFileUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
    
    // Return full URL with server base
    const serverUrl = `http://localhost:${config.app.port}`;
    return `${serverUrl}${normalizedFileUrl}`;
  }

  static async sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
    messageType: 'text' | 'file' = 'text',
    fileData?: {
      fileUrl: string;
      fileName: string;
      fileSize: number;
    }
  ): Promise<ChatMessage> {
    // Check if users are friends - using direct query
    const friendship = await Friendship.findOne({
      $or: [
        { requester: senderId, recipient: recipientId, status: 'accepted' },
        { requester: recipientId, recipient: senderId, status: 'accepted' }
      ]
    });
    
    if (!friendship) {
      throw new Error('Can only send messages to friends');
    }

    // Create message data
    const messageData: any = {
      sender: senderId,
      recipient: recipientId,
      content,
      messageType,
    };

    // Add file data if it's a file message
    if (messageType === 'file' && fileData) {
      // CRITICAL FIX: Convert relative URLs to absolute URLs immediately
      messageData.fileUrl = this.getAbsoluteFileUrl(fileData.fileUrl);
      messageData.fileName = fileData.fileName;
      messageData.fileSize = fileData.fileSize;
    }

    // Create and save message
    const message = new Message(messageData);
    await message.save();

    // Populate sender information
    await message.populate('sender', 'username avatar isOnline');
    
    return {
      _id: message._id?.toString(),
      sender: {
        _id: message.sender._id.toString(),
        username: (message.sender as any).username,
        avatar: (message.sender as any).avatar,
      },
      recipient: message.recipient.toString(),
      content: message.content,
      messageType: message.messageType,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt || new Date(),
    };
  }

  static async getChatHistory(
    userId: string,
    otherUserId: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<ChatMessage>> {
    // Check if users are friends - using direct query
    const friendship = await Friendship.findOne({
      $or: [
        { requester: userId, recipient: otherUserId, status: 'accepted' },
        { requester: otherUserId, recipient: userId, status: 'accepted' }
      ]
    });
    
    if (!friendship) {
      throw new Error('Can only view chat history with friends');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({
        $or: [
          { sender: userId, recipient: otherUserId },
          { sender: otherUserId, recipient: userId }
        ]
      })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
      Message.countDocuments({
        $or: [
          { sender: userId, recipient: otherUserId },
          { sender: otherUserId, recipient: userId }
        ]
      })
    ]);

    const formattedMessages: ChatMessage[] = messages.map((message: any) => ({
      _id: message._id.toString(),
      sender: {
        _id: message.sender._id.toString(),
        username: message.sender.username,
        avatar: message.sender.avatar,
      },
      recipient: message.recipient.toString(),
      content: message.content,
      messageType: message.messageType,
      // Convert relative URLs to absolute URLs
      fileUrl: message.fileUrl ? this.getAbsoluteFileUrl(message.fileUrl) : undefined,
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt || new Date(),
    }));

    return {
      data: formattedMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
    };
  }

  static async uploadFile(
    file: Express.Multer.File,
    uploaderId: string
  ): Promise<FileUploadResult> {
    // Return relative path for storage, but we'll convert to absolute when serving
    const fileUrl = `/uploads/${file.filename}`;
    
    return {
      url: fileUrl, // Store as relative path
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  static async getMessageById(messageId: string): Promise<ChatMessage | null> {
    const message = await Message.findById(messageId)
      .populate('sender', 'username avatar')
      .lean();

    if (!message) {
      return null;
    }

    return {
      _id: message._id.toString(),
      sender: {
        _id: (message.sender as any)._id.toString(),
        username: (message.sender as any).username,
        avatar: (message.sender as any).avatar,
      },
      recipient: message.recipient.toString(),
      content: message.content,
      messageType: message.messageType,
      // Convert relative URLs to absolute URLs
      fileUrl: message.fileUrl ? this.getAbsoluteFileUrl(message.fileUrl) : undefined,
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt || new Date(),
    };
  }

  // ENHANCED: Mark messages as read with better error handling
  static async markMessagesAsRead(
    senderId: string,
    recipientId: string
  ): Promise<void> {
    console.log('=== MARKING MESSAGES AS READ ===');
    console.log(`Sender: ${senderId}, Recipient: ${recipientId}`);
    
    try {
      const result = await Message.updateMany(
        {
          sender: senderId,
          recipient: recipientId,
          isRead: false
        },
        { 
          isRead: true,
          updatedAt: new Date()
        }
      );
      
      console.log(`Marked ${result.modifiedCount} messages as read`);
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  static async getUnreadMessagesCount(
    userId: string,
    senderId?: string
  ): Promise<number> {
    const query: any = { recipient: userId, isRead: false };
    if (senderId) {
      query.sender = senderId;
    }
    
    return await Message.countDocuments(query);
  }

  static async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<void> {
    const message = await Message.findById(messageId);
    
    if (!message) {
      throw new Error('Message not found');
    }

    // Only sender can delete message
    if (message.sender.toString() !== userId) {
      throw new Error('Can only delete your own messages');
    }

    // Check if message is less than 10 minutes old
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (message.createdAt && message.createdAt < tenMinutesAgo) {
      throw new Error('Can only delete messages within 10 minutes of sending');
    }

    await Message.findByIdAndDelete(messageId);
  }

  static async isUserOnline(userId: string): Promise<boolean> {
    const user = await User.findById(userId).select('isOnline');
    return user?.isOnline || false;
  }

  static async searchMessages(
    userId: string,
    query: string,
    otherUserId?: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<ChatMessage>> {
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(query, 'i');

    // Build search criteria
    const searchCriteria: any = {
      $or: [
        { sender: userId },
        { recipient: userId },
      ],
      content: searchRegex,
      messageType: 'text', // Only search text messages
    };

    // If searching in specific chat
    if (otherUserId) {
      searchCriteria.$or = [
        { sender: userId, recipient: otherUserId },
        { sender: otherUserId, recipient: userId },
      ];
    }

    const [messages, total] = await Promise.all([
      Message.find(searchCriteria)
        .populate('sender', 'username avatar')
        .populate('recipient', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments(searchCriteria),
    ]);

    const formattedMessages: ChatMessage[] = messages.map((message: any) => ({
      _id: message._id.toString(),
      sender: {
        _id: message.sender._id.toString(),
        username: message.sender.username,
        avatar: message.sender.avatar,
      },
      recipient: message.recipient._id ? message.recipient._id.toString() : message.recipient,
      content: message.content,
      messageType: message.messageType,
      fileUrl: message.fileUrl ? this.getAbsoluteFileUrl(message.fileUrl) : undefined,
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt || new Date(),
    }));

    return {
      data: formattedMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async getChatRooms(userId: string): Promise<any[]> {
    // Get all friends using direct query
    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: 'accepted' },
        { recipient: userId, status: 'accepted' }
      ]
    })
    .populate('requester', 'username avatar isOnline lastSeen')
    .populate('recipient', 'username avatar isOnline lastSeen')
    .lean();

    const friends = friendships.map(friendship => {
      return (friendship.requester as any)._id.toString() === userId 
        ? friendship.recipient as any
        : friendship.requester as any;
    });
    
    // Get chat rooms with last message and unread count
    const chatRooms = await Promise.all(
      friends.map(async (friend) => {
        // Get latest message
        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, recipient: friend._id },
            { sender: friend._id, recipient: userId }
          ]
        })
        .sort({ createdAt: -1 })
        .populate('sender', 'username')
        .lean();

        // Get unread count
        const unreadCount = await Message.countDocuments({
          sender: friend._id,
          recipient: userId,
          isRead: false
        });
        
        return {
          participant: {
            _id: friend._id,
            username: friend.username,
            avatar: friend.avatar,
            isOnline: friend.isOnline,
            lastSeen: friend.lastSeen,
          },
          lastMessage: lastMessage ? {
            ...lastMessage,
            fileUrl: lastMessage.fileUrl ? this.getAbsoluteFileUrl(lastMessage.fileUrl) : undefined
          } : null,
          unreadCount,
          updatedAt: lastMessage ? lastMessage.createdAt : new Date(),
        };
      })
    );

    // Sort by last message time
    return chatRooms.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }
}