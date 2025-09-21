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

    try {
      // Send message via service (this will save to database)
      const message = await ChatService.sendMessage(
        user.userId,
        data.recipientId,
        data.content,
        data.messageType || 'text',
        data.fileData
      );

      console.log(`Message sent from ${user.username} to ${data.recipientId}:`, message.content);

      // Broadcast the message to both sender and recipient
      const recipientSocketId = this.userSockets.get(data.recipientId);
      
      // Send to recipient if they're online
      if (recipientSocketId) {
        console.log(`Broadcasting message to recipient socket: ${recipientSocketId}`);
        this.io.to(recipientSocketId).emit('new_message', message);
      } else {
        console.log(`Recipient ${data.recipientId} is not online`);
      }

      // Also send back to sender for confirmation (optional)
      socket.emit('message_sent', { success: true, message });

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message_error', { 
        message: error instanceof Error ? error.message : 'Failed to send message' 
      });
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

  public broadcastMessage(message: any): void {
    // Broadcast message to both sender and recipient
    const senderSocketId = this.userSockets.get(message.sender._id);
    const recipientSocketId = this.userSockets.get(message.recipient);

    if (recipientSocketId) {
      console.log(`Broadcasting message to recipient: ${message.recipient}`);
      this.io.to(recipientSocketId).emit('new_message', message);
    }

    // Optional: Also send to sender for confirmation
    if (senderSocketId) {
      this.io.to(senderSocketId).emit('message_sent', { success: true, message });
    }
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
}

export default SocketManager;