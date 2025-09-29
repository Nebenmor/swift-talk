// chatService.ts - Complete version with environment variables
import { Message } from '../models/Message';
import { Friendship } from '../models/Friendship';
import { User } from '../models/User';
import { ChatMessage, PaginatedResponse, FileUploadResult } from '../types';
import { config } from '../config/config';

export class ChatService {
  // Get the server base URL from environment
  private static getServerBaseUrl(): string {
    // Use environment variable if available, otherwise construct from config
    return process.env.SERVER_BASE_URL || 
           (config.app.env === 'production' 
             ? 'https://swift-talk-i1ov.onrender.com'
             : `http://localhost:${config.app.port}`);
  }

  // Fix legacy URLs and convert relative paths to absolute
  private static fixLegacyFileUrl(fileUrl: string | undefined): string | undefined {
    if (!fileUrl) return undefined;
    
    const serverUrl = this.getServerBaseUrl();
    
    // Already correct absolute URL
    if (fileUrl.startsWith(serverUrl)) {
      return fileUrl;
    }
    
    // Fix localhost URLs (legacy data from development)
    if (fileUrl.includes('localhost:10000') || 
        fileUrl.includes('localhost:5000') || 
        fileUrl.includes('localhost:3000')) {
      const filenameParts = fileUrl.split('/uploads/');
      if (filenameParts[1]) {
        return `${serverUrl}/uploads/${filenameParts[1]}`;
      }
    }
    
    // Fix relative URLs
    if (fileUrl.startsWith('/uploads/')) {
      return `${serverUrl}${fileUrl}`;
    }
    
    // Fix bare filenames
    if (!fileUrl.startsWith('http') && !fileUrl.startsWith('/')) {
      return `${serverUrl}/uploads/${fileUrl}`;
    }
    
    return fileUrl;
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
    const friendship = await Friendship.findOne({
      $or: [
        { requester: senderId, recipient: recipientId, status: 'accepted' },
        { requester: recipientId, recipient: senderId, status: 'accepted' }
      ]
    });
    
    if (!friendship) {
      throw new Error('Can only send messages to friends');
    }

    const messageData: any = {
      sender: senderId,
      recipient: recipientId,
      content,
      messageType,
    };

    if (messageType === 'file' && fileData) {
      messageData.fileUrl = this.fixLegacyFileUrl(fileData.fileUrl);
      messageData.fileName = fileData.fileName;
      messageData.fileSize = fileData.fileSize;
    }

    const message = new Message(messageData);
    await message.save();
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
      fileUrl: this.fixLegacyFileUrl(message.fileUrl),
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt || new Date(),
    }));

    return {
      data: formattedMessages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  static async uploadFile(
    file: Express.Multer.File,
    uploaderId: string
  ): Promise<FileUploadResult> {
    const fileUrl = `/uploads/${file.filename}`;
    
    return {
      url: fileUrl,
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

    if (!message) return null;

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
      fileUrl: this.fixLegacyFileUrl(message.fileUrl),
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt || new Date(),
    };
  }

  static async markMessagesAsRead(senderId: string, recipientId: string): Promise<void> {
    const result = await Message.updateMany(
      { sender: senderId, recipient: recipientId, isRead: false },
      { isRead: true, updatedAt: new Date() }
    );
    console.log(`Marked ${result.modifiedCount} messages as read`);
  }

  static async getUnreadMessagesCount(userId: string, senderId?: string): Promise<number> {
    const query: any = { recipient: userId, isRead: false };
    if (senderId) query.sender = senderId;
    return await Message.countDocuments(query);
  }

  static async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found');
    if (message.sender.toString() !== userId) throw new Error('Can only delete your own messages');
    
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

    const searchCriteria: any = {
      $or: [{ sender: userId }, { recipient: userId }],
      content: searchRegex,
      messageType: 'text',
    };

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
      fileUrl: this.fixLegacyFileUrl(message.fileUrl),
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt || new Date(),
    }));

    return {
      data: formattedMessages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  static async getChatRooms(userId: string): Promise<any[]> {
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
    
    const chatRooms = await Promise.all(
      friends.map(async (friend) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, recipient: friend._id },
            { sender: friend._id, recipient: userId }
          ]
        })
        .sort({ createdAt: -1 })
        .populate('sender', 'username')
        .lean();

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
            fileUrl: this.fixLegacyFileUrl(lastMessage.fileUrl)
          } : null,
          unreadCount,
          updatedAt: lastMessage ? lastMessage.createdAt : new Date(),
        };
      })
    );

    return chatRooms.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }
}