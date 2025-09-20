import { io, Socket } from 'socket.io-client';
import { getToken } from './auth';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  private static instance: SocketService | null = null;
  private socket: Socket | null = null;
  private isConnecting = false;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3; // Reduced from 5
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<void> | null = null;
  private isManualDisconnect = false;

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  private constructor() {}

  connect(): Promise<void> {
    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If already connected and authenticated, return resolved promise
    if (this.socket && this.socket.connected && this.isAuthenticated) {
      return Promise.resolve();
    }

    // Create new connection promise
    this.connectionPromise = this.createConnection();
    return this.connectionPromise;
  }

  private async createConnection(): Promise<void> {
    const token = getToken();
    if (!token) {
      console.warn('No token available for socket connection');
      this.connectionPromise = null;
      throw new Error('No authentication token available');
    }

    // Prevent multiple concurrent connections
    if (this.isConnecting) {
      console.log('Socket connection already in progress');
      return;
    }

    // Don't reconnect if we've hit the limit
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached, not attempting to connect');
      this.connectionPromise = null;
      throw new Error('Max reconnection attempts reached');
    }

    // Disconnect existing socket if present
    if (this.socket) {
      console.log('Closing existing socket connection');
      this.isManualDisconnect = true;
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isManualDisconnect = false;
    }

    this.isConnecting = true;
    this.isAuthenticated = false;
    console.log('Initiating new socket connection...');

    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        reconnection: false, // We handle reconnection manually
        autoConnect: true,
      });

      // Set up one-time connection handlers
      const onConnect = () => {
        console.log('Socket connected, authenticating...');
        if (this.socket) {
          this.socket.emit('authenticate', token);
        }
      };

      const onAuthenticated = (data: any) => {
        console.log('Socket authenticated successfully:', data.user?.username);
        this.isAuthenticated = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.connectionPromise = null;

        // Clean up one-time listeners
        if (this.socket) {
          this.socket.off('connect', onConnect);
          this.socket.off('authenticated', onAuthenticated);
          this.socket.off('auth_error', onAuthError);
          this.socket.off('connect_error', onConnectError);
        }

        resolve();
      };

      const onAuthError = (error: any) => {
        console.error('Socket authentication error:', error);
        this.cleanup();
        reject(new Error('Authentication failed'));
      };

      const onConnectError = (error: any) => {
        console.error('Socket connection error:', error);
        this.cleanup();
        reject(error);
      };

      const cleanup = () => {
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.connectionPromise = null;
        
        if (this.socket) {
          this.socket.off('connect', onConnect);
          this.socket.off('authenticated', onAuthenticated);
          this.socket.off('auth_error', onAuthError);
          this.socket.off('connect_error', onConnectError);
        }
      };

      // Set up one-time event listeners
      if (this.socket) {
        this.socket.once('connect', onConnect);
        this.socket.once('authenticated', onAuthenticated);
        this.socket.once('auth_error', onAuthError);
        this.socket.once('connect_error', onConnectError);
      }

      // Set up persistent event listeners
      this.setupPersistentEventListeners();

      // Cleanup function for this promise
      this.cleanup = cleanup;
    });
  }

  private setupPersistentEventListeners() {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.isConnecting = false;
      this.isAuthenticated = false;
      this.connectionPromise = null;
      
      // Only attempt reconnection if it wasn't a manual disconnect and we haven't hit the limit
      if (!this.isManualDisconnect && reason !== 'io client disconnect' && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.handleReconnection();
      }
    });
  }

  private handleReconnection() {
    if (this.isConnecting || this.connectionPromise) {
      console.log('Reconnection already in progress');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * this.reconnectAttempts, 10000); // Max 10 second delay
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
        // Don't retry immediately, let the disconnect handler decide
      });
    }, delay);
  }

  disconnect() {
    console.log('Manually disconnecting socket');
    this.isManualDisconnect = true;
    
    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Reset connection state
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.connectionPromise = null;
    this.reconnectAttempts = 0;
    
    // Disconnect socket
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.isManualDisconnect = false;
  }

  emit(event: string, data: any) {
    if (this.socket && this.socket.connected && this.isAuthenticated) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: Socket not ready (connected: ${this.socket?.connected}, authenticated: ${this.isAuthenticated})`);
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    } else {
      console.warn(`Cannot listen to ${event}: Socket not initialized yet`);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  isConnected(): boolean {
    return this.socket ? this.socket.connected && this.isAuthenticated : false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Method to reset reconnection attempts (useful after successful operations)
  resetReconnectionAttempts() {
    this.reconnectAttempts = 0;
  }

  // Get connection status details
  getConnectionStatus() {
    return {
      connected: this.socket?.connected || false,
      authenticated: this.isAuthenticated,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }
}

// Export singleton instance
export const socketService = SocketService.getInstance();