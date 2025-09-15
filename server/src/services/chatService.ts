import { Message } from '../models/Message';
import { Friendship } from '../models/Friendship';
import { User } from '../models/User';
import { ChatMessage, PaginatedResponse, FileUploadResult } from '../types';

export class ChatService {
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
    // Check if users are friends
    const friendshipStatus = await Friendship.getFriendshipStatus(senderId, recipientId);
    
    if (friendshipStatus !== 'accepted') {
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
      messageData.fileUrl = fileData.fileUrl;
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
        username: message.sender.username,
        avatar: message.sender.avatar,
      },
      recipient: message.recipient.toString(),
      content: message.content,
      messageType: message.messageType,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };
  }

  static async getChatHistory(
    userId: string,
    otherUserId: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<ChatMessage>> {
    // Check if users are friends
    const friendshipStatus = await Friendship.getFriendshipStatus(userId, otherUserId);
    
    if (friendshipStatus !== 'accepted') {
      throw new Error('Can only view chat history with friends');
    }

    const result = await Message.getChatHistory(userId, otherUserId, page, limit) as any;

    const formattedMessages: ChatMessage[] = result.messages.map((message: any) => ({
      _id: message._id.toString(),
      sender: {
        _id: message.sender._id.toString(),
        username: message.sender.username,
        avatar: message.sender.avatar,
      },
      recipient: message.recipient._id ? message.recipient._id.toString() : message.recipient,
      content: message.content,
      messageType: message.messageType,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt,
    }));

    return {
      data: formattedMessages,
      pagination: result.pagination,
    };
  }

  static async markMessagesAsRead(
    senderId: string,
    recipientId: string
  ): Promise<void> {
    await Message.markAsRead(senderId, recipientId);
  }

  static async getUnreadMessagesCount(
    userId: string,
    senderId?: string
  ): Promise<number> {
    return await Message.getUnreadCount(userId, senderId);
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
    if (message.createdAt < tenMinutesAgo) {
      throw new Error('Can only delete messages within 10 minutes of sending');
    }

    await Message.findByIdAndDelete(messageId);
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
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt,
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
    // Get all friends
    const friends = await Friendship.getFriends(userId) as any[];
    
    // Get chat rooms with last message and unread count
    const chatRooms = await Promise.all(
      friends.map(async (friend) => {
        const lastMessage = await Message.getLatestMessage(userId, friend._id);
        const unreadCount = await Message.getUnreadCount(userId, friend._id);
        
        return {
          participant: {
            _id: friend._id,
            username: friend.username,
            avatar: friend.avatar,
            isOnline: friend.isOnline,
            lastSeen: friend.lastSeen,
          },
          lastMessage,
          unreadCount,
          updatedAt: lastMessage ? lastMessage.createdAt : friend.friendsSince,
        };
      })
    );

    // Sort by last message time
    return chatRooms.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
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

    if (!message) {
      return null;
    }

    return {
      _id: message._id.toString(),
      sender: {
        _id: message.sender._id.toString(),
        username: message.sender.username,
        avatar: message.sender.avatar,
      },
      recipient: message.recipient.toString(),
      content: message.content,
      messageType: message.messageType,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };
  }

  static async isUserOnline(userId: string): Promise<boolean> {
    const user = await User.findById(userId).select('isOnline');
    return user?.isOnline || false;
  }
}