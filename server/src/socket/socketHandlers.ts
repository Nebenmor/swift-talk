import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { UserService } from '../services/userService';
import { ChatService } from '../services/chatService';
import { SocketUser } from '../types';

class SocketManager {
  private readonly io: Server;
  private readonly connectedUsers: Map<string, SocketUser> = new Map();
  private readonly userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(io: Server) {
    this.io = io;
    this.setupConnectionHandler();
  }

  private setupConnectionHandler(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Handle authentication
      socket.on('authenticate', async (token: string) => {
        try {
          await this.handleAuthentication(socket, token);
        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('auth_error', { message: 'Authentication failed' });
          socket.disconnect();
        }
      });

      // Handle user joining chat rooms
      socket.on('join_chat', (data: { userId: string }) => {
        this.handleJoinChat(socket, data);
      });

      // Handle leaving chat rooms
      socket.on('leave_chat', (data: { userId: string }) => {
        this.handleLeaveChat(socket, data);
      });

      // Handle sending messages
      socket.on('send_message', async (data: any) => {
        try {
          await this.handleSendMessage(socket, data);
        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('message_error', { 
            message: error instanceof Error ? error.message : 'Failed to send message' 
          });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data: { recipientId: string }) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data: { recipientId: string }) => {
        this.handleTypingStop(socket, data);
      });

      // Handle message read status
      socket.on('mark_messages_read', async (data: { senderId: string }) => {
        try {
          await this.handleMarkMessagesRead(socket, data);
        } catch (error) {
          console.error('Mark messages read error:', error);
        }
      });

      // Handle user going online/offline
      socket.on('update_online_status', async (data: { isOnline: boolean }) => {
        try {
          await this.handleUpdateOnlineStatus(socket, data);
        } catch (error) {
          console.error('Update online status error:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        this.handleDisconnection(socket, reason);
      });

      // Handle connection errors
      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    });
  }

  private async handleAuthentication(socket: Socket, token: string): Promise<void> {
    const decoded = verifyToken(token);
    const user = await UserService.getUserById(decoded.userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Store user connection
    const socketUser: SocketUser = {
      userId: user._id,
      socketId: socket.id,
      username: user.username,
    };

    this.connectedUsers.set(socket.id, socketUser);
    this.userSockets.set(user._id, socket.id);

    // Update user online status
    await UserService.updateOnlineStatus(user._id, true);

    // Join user to their personal room
    socket.join(`user_${user._id}`);

    // Notify friends about online status
    await this.notifyFriendsOnlineStatus(user._id, true);

    // Send authentication success
    socket.emit('authenticated', {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isOnline: true,
      },
    });

    console.log(`User authenticated: ${user.username} (${socket.id})`);
  }

  private handleJoinChat(socket: Socket, data: { userId: string }): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    const chatRoom = this.getChatRoomId(user.userId, data.userId);
    socket.join(chatRoom);
    
    console.log(`User ${user.username} joined chat with ${data.userId}`);
  }

  private handleLeaveChat(socket: Socket, data: { userId: string }): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    const chatRoom = this.getChatRoomId(user.userId, data.userId);
    socket.leave(chatRoom);
    
    console.log(`User ${user.username} left chat with ${data.userId}`);
  }

  private async handleSendMessage(socket: Socket, data: {
    recipientId: string;
    content: string;
    messageType?: 'text' | 'file';
    fileData?: {
      fileUrl: string;
      fileName: string;
      fileSize: number;
    };
  }): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Send message via service
    const message = await ChatService.sendMessage(
      user.userId,
      data.recipientId,
      data.content,
      data.messageType || 'text',
      data.fileData
    );

    // Get chat room
    const chatRoom = this.getChatRoomId(user.userId, data.recipientId);

    // Emit message to chat room
    this.io.to(chatRoom).emit('new_message', message);

    // Notify recipient if they're online but not in the chat room
    const recipientSocketId = this.userSockets.get(data.recipientId);
    if (recipientSocketId) {
      const recipientSocket = this.io.sockets.sockets.get(recipientSocketId);
      if (recipientSocket && !recipientSocket.rooms.has(chatRoom)) {
        recipientSocket.emit('message_notification', {
          from: {
            _id: user.userId,
            username: user.username,
          },
          message: {
            content: data.messageType === 'file' ? 'Sent a file' : data.content,
            createdAt: message.createdAt,
          },
        });
      }
    }
  }

  private handleTypingStart(socket: Socket, data: { recipientId: string }): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    const recipientSocketId = this.userSockets.get(data.recipientId);
    if (recipientSocketId) {
      this.io.to(recipientSocketId).emit('user_typing', {
        userId: user.userId,
        username: user.username,
        isTyping: true,
      });
    }
  }

  private handleTypingStop(socket: Socket, data: { recipientId: string }): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    const recipientSocketId = this.userSockets.get(data.recipientId);
    if (recipientSocketId) {
      this.io.to(recipientSocketId).emit('user_typing', {
        userId: user.userId,
        username: user.username,
        isTyping: false,
      });
    }
  }

  private async handleMarkMessagesRead(
    socket: Socket,
    data: { senderId: string }
  ): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    await ChatService.markMessagesAsRead(data.senderId, user.userId);

    // Notify sender that messages were read
    const senderSocketId = this.userSockets.get(data.senderId);
    if (senderSocketId) {
      this.io.to(senderSocketId).emit('messages_read', {
        readBy: user.userId,
        readAt: new Date(),
      });
    }
  }

  private async handleUpdateOnlineStatus(
    socket: Socket,
    data: { isOnline: boolean }
  ): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    await UserService.updateOnlineStatus(user.userId, data.isOnline);
    
    // Notify friends about status change
    await this.notifyFriendsOnlineStatus(user.userId, data.isOnline);
  }

  private async handleDisconnection(socket: Socket, reason: string): Promise<void> {
    console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);

    const user = this.connectedUsers.get(socket.id);
    if (user) {
      // Update user offline status
      await UserService.updateOnlineStatus(user.userId, false);
      
      // Notify friends about offline status
      await this.notifyFriendsOnlineStatus(user.userId, false);

      // Clean up connections
      this.connectedUsers.delete(socket.id);
      this.userSockets.delete(user.userId);

      console.log(`User disconnected: ${user.username}`);
    }
  }

  private async notifyFriendsOnlineStatus(
    userId: string,
    isOnline: boolean
  ): Promise<void> {
    try {
      const friends = await UserService.getFriends(userId);
      
      friends.forEach((friend) => {
        const friendSocketId = this.userSockets.get(friend._id);
        if (friendSocketId) {
          this.io.to(friendSocketId).emit('friend_status_update', {
            userId,
            isOnline,
            lastSeen: isOnline ? null : new Date(),
          });
        }
      });
    } catch (error) {
      console.error('Error notifying friends of status change:', error);
    }
  }

  private getChatRoomId(userId1: string, userId2: string): string {
    // Create consistent room ID regardless of user order
    const sortedIds = [userId1, userId2].sort((a, b) => a.localeCompare(b));
    return `chat_${sortedIds[0]}_${sortedIds[1]}`;
  }

  // Public methods for external use
  public getConnectedUsers(): SocketUser[] {
    return Array.from(this.connectedUsers.values());
  }

  public getUserSocketId(userId: string): string | undefined {
    return this.userSockets.get(userId);
  }

  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  public emitToUser(userId: string, event: string, data: any): boolean {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  public emitToRoom(roomId: string, event: string, data: any): void {
    this.io.to(roomId).emit(event, data);
  }

  public broadcastToAllUsers(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // Method to forcibly disconnect a user (for admin purposes)
  public disconnectUser(userId: string): boolean {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect();
        return true;
      }
    }
    return false;
  }

  // Get statistics about connected users
  public getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    usersList: string[];
  } {
    const connectedUsers = Array.from(this.connectedUsers.values());
    return {
      totalConnections: this.connectedUsers.size,
      uniqueUsers: this.userSockets.size,
      usersList: connectedUsers.map(user => user.username),
    };
  }
}

export default SocketManager;