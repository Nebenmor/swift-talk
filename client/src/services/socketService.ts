import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { SOCKET_URL, SOCKET_EVENTS, STORAGE_KEYS, ERROR_MESSAGES } from '../utils/constants';
import {
  SocketMessage,
  TypingIndicator,
  OnlineStatusUpdate,
  MessageNotification,
  User,
} from '../types';

type SocketEventCallback = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Event callbacks storage
  private eventCallbacks: Map<string, Set<SocketEventCallback>> = new Map();

  constructor() {
    this.setupEventCallbacks();
  }

  private setupEventCallbacks(): void {
    // Initialize callback sets for common events
    const events = [
      SOCKET_EVENTS.NEW_MESSAGE,
      SOCKET_EVENTS.USER_TYPING,
      SOCKET_EVENTS.FRIEND_STATUS_UPDATE,
      SOCKET_EVENTS.MESSAGE_NOTIFICATION,
      SOCKET_EVENTS.MESSAGES_READ,
    ];

    events.forEach(event => {
      this.eventCallbacks.set(event, new Set());
    });
  }

  public connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          autoConnect: false,
        });

        this.setupSocketEventListeners();
        this.socket.connect();

        // Authenticate after connection
        this.socket.once(SOCKET_EVENTS.CONNECT, () => {
          this.socket!.emit(SOCKET_EVENTS.AUTHENTICATE, token);
        });

        this.socket.once(SOCKET_EVENTS.AUTHENTICATED, (data: { user: User }) => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log('Socket authenticated:', data.user.username);
          resolve();
        });

        this.socket.once(SOCKET_EVENTS.AUTH_ERROR, (error: { message: string }) => {
          console.error('Socket authentication failed:', error.message);
          this.disconnect();
          reject(new Error(error.message));
        });

      } catch (error) {
        console.error('Socket connection failed:', error);
        reject(error);
      }
    });
  }

  private setupSocketEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on(SOCKET_EVENTS.CONNECT, () => {
      console.log('Socket connected');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      toast.dismiss();
      if (this.reconnectAttempts > 0) {
        toast.success('Connection restored');
      }
    });

    this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason: string) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
      
      if (reason !== 'io client disconnect') {
        this.attemptReconnect();
      }
    });

    // Message events
    this.socket.on(SOCKET_EVENTS.NEW_MESSAGE, (message: SocketMessage) => {
      this.emitToCallbacks(SOCKET_EVENTS.NEW_MESSAGE, message);
    });

    this.socket.on(SOCKET_EVENTS.MESSAGE_NOTIFICATION, (notification: MessageNotification) => {
      toast.success(`New message from ${notification.from.username}`);
      this.emitToCallbacks(SOCKET_EVENTS.MESSAGE_NOTIFICATION, notification);
    });

    this.socket.on(SOCKET_EVENTS.MESSAGES_READ, (data: { readBy: string; readAt: Date }) => {
      this.emitToCallbacks(SOCKET_EVENTS.MESSAGES_READ, data);
    });

    // Typing events
    this.socket.on(SOCKET_EVENTS.USER_TYPING, (data: TypingIndicator) => {
      this.emitToCallbacks(SOCKET_EVENTS.USER_TYPING, data);
    });

    // Status events
    this.socket.on(SOCKET_EVENTS.FRIEND_STATUS_UPDATE, (data: OnlineStatusUpdate) => {
      this.emitToCallbacks(SOCKET_EVENTS.FRIEND_STATUS_UPDATE, data);
    });

    // Error events
    this.socket.on(SOCKET_EVENTS.MESSAGE_ERROR, (error: { message: string }) => {
      toast.error(error.message);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.attemptReconnect();
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      toast.error('Unable to connect to server. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    toast.loading(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (token) {
          this.connect(token).catch((error) => {
            console.error('Reconnection failed:', error);
          });
        }
      }
    }, 2000 * this.reconnectAttempts); // Exponential backoff
  }

  private emitToCallbacks(event: string, ...args: any[]): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in socket event callback for ${event}:`, error);
        }
      });
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  public isConnectedToServer(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // Event subscription methods
  public on(event: string, callback: SocketEventCallback): () => void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    
    const callbacks = this.eventCallbacks.get(event)!;
    callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback);
    };
  }

  public off(event: string, callback: SocketEventCallback): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  // Message methods
  public sendMessage(data: {
    recipientId: string;
    content: string;
    messageType?: 'text' | 'file';
    fileData?: {
      fileUrl: string;
      fileName: string;
      fileSize: number;
    };
  }): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(SOCKET_EVENTS.SEND_MESSAGE, data);
    } else {
      toast.error(ERROR_MESSAGES.CONNECTION_LOST);
    }
  }

  // Chat room methods
  public joinChat(userId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(SOCKET_EVENTS.JOIN_CHAT, { userId });
    }
  }

  public leaveChat(userId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(SOCKET_EVENTS.LEAVE_CHAT, { userId });
    }
  }

  // Typing methods
  public startTyping(recipientId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(SOCKET_EVENTS.TYPING_START, { recipientId });
    }
  }

  public stopTyping(recipientId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(SOCKET_EVENTS.TYPING_STOP, { recipientId });
    }
  }

  // Message read status
  public markMessagesAsRead(senderId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(SOCKET_EVENTS.MARK_MESSAGES_READ, { senderId });
    }
  }

  // Online status
  public updateOnlineStatus(isOnline: boolean): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(SOCKET_EVENTS.UPDATE_ONLINE_STATUS, { isOnline });
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;