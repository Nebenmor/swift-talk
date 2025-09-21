import { io, Socket } from 'socket.io-client';
import { getToken } from './auth';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  private static instance: SocketService | null = null;
  private socket: Socket | null = null;
  private connected = false;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  private constructor() {}

  async connect(): Promise<void> {
    // If already connected and authenticated, return
    if (this.socket && this.connected && this.isAuthenticated) {
      console.log('Socket already connected and authenticated');
      return;
    }

    const token = getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    // Clean up existing socket
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    return new Promise((resolve, reject) => {
      console.log('Creating new socket connection...');
      
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 15000,
        reconnection: false, // Disable automatic reconnection
        autoConnect: true,
      });

      // Set up one-time connection handlers
      const onConnect = () => {
        console.log('Socket connected, authenticating...');
        this.connected = true;
        if (this.socket) {
          this.socket.emit('authenticate', token);
        }
      };

      const onAuthenticated = (data: { user?: { username: string } }) => {
        console.log('Socket authenticated successfully:', data.user?.username);
        this.isAuthenticated = true;
        this.reconnectAttempts = 0;
        
        // Clean up one-time listeners
        cleanup();
        resolve();
      };

      const onAuthError = (error: { message: string }) => {
        console.error('Socket authentication error:', error);
        cleanup();
        reject(new Error('Authentication failed'));
      };

      const onConnectError = (error: Error) => {
        console.error('Socket connection error:', error);
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        if (this.socket) {
          this.socket.off('connect', onConnect);
          this.socket.off('authenticated', onAuthenticated);
          this.socket.off('auth_error', onAuthError);
          this.socket.off('connect_error', onConnectError);
        }
      };

      // Set up one-time event listeners
      this.socket.once('connect', onConnect);
      this.socket.once('authenticated', onAuthenticated);
      this.socket.once('auth_error', onAuthError);
      this.socket.once('connect_error', onConnectError);

      // Set up persistent disconnect handler
      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.connected = false;
        this.isAuthenticated = false;
        
        // Only attempt reconnection for certain disconnect reasons
        if (reason === 'io server disconnect' || reason === 'transport close') {
          this.attemptReconnection();
        }
      });
    });
  }

  private async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * this.reconnectAttempts, 10000);
    
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  disconnect() {
    console.log('Manually disconnecting socket');
    
    this.connected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: unknown) {
    if (this.socket && this.connected && this.isAuthenticated) {
      console.log(`Emitting ${event}:`, data);
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: Socket not ready (connected: ${this.connected}, authenticated: ${this.isAuthenticated})`);
    }
  }

  on(event: string, callback: (data: unknown) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    } else {
      console.warn(`Cannot listen to ${event}: Socket not initialized`);
    }
  }

  off(event: string, callback?: (...args: unknown[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  isConnected(): boolean {
    return this.connected && this.isAuthenticated;
  }

  resetReconnectionAttempts() {
    this.reconnectAttempts = 0;
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      authenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export const socketService = SocketService.getInstance();