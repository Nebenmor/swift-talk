// socket.ts - FIXED configuration for Vercel deployment
import { io, Socket } from "socket.io-client";
import { getToken } from "./auth";

// CRITICAL FIX: Use correct Socket.IO endpoint for Render
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

console.log("Socket.IO Configuration:", {
  url: SOCKET_URL,
  env: import.meta.env.NODE_ENV,
  isDev: import.meta.env.DEV
});

type SocketEventCallback = (data: unknown) => void;

interface MessageSentData {
  success: boolean;
  messageId?: string;
  tempId?: string;
}

interface MessageErrorData {
  message: string;
}

interface AuthenticatedData {
  user?: { username: string };
}

interface AuthErrorData {
  message: string;
}

class SocketService {
  private static instance: SocketService | null = null;
  private socket: Socket | null = null;
  private connected = false;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3; // Reduced for production
  private connectionTimeout: NodeJS.Timeout | null = null;

  public static getInstance(): SocketService {
    SocketService.instance ??= new SocketService();
    return SocketService.instance;
  }

  private constructor() {}

  async connect(): Promise<void> {
    console.log("=== SOCKET CONNECTION ATTEMPT (VERCEL FIX) ===");
    console.log("Socket URL:", SOCKET_URL);

    const token = getToken();
    console.log("Token check:", {
      hasToken: !!token,
      tokenLength: token?.length || 0
    });
    
    if (!token) {
      throw new Error("No authentication token available");
    }

    if (this.socket && this.connected && this.isAuthenticated) {
      console.log("Socket already connected and authenticated");
      return;
    }

    // Clean up existing socket
    if (this.socket) {
      console.log("Cleaning up previous socket instance");
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    return new Promise((resolve, reject) => {
      console.log("Creating Socket.IO connection...");
      
      try {
        // CRITICAL FIX: Optimized configuration for Vercel + Render
        this.socket = io(SOCKET_URL, {
          // FIXED: Start with polling, allow upgrade to websockets
          transports: ["polling", "websocket"],
          
          // FIXED: Production-optimized timeouts for Vercel/Render
          timeout: 10000, // 10 seconds (matches your intended timeout)
          
          // FIXED: Force new connection to avoid stale state
          forceNew: true,
          
          // FIXED: Reconnection settings for cloud deployment
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 5000,
          
          // FIXED: Upgrade settings for cloud deployment
          upgrade: true,
          
          // FIXED: Additional headers for cloud deployment
          extraHeaders: {
            'Origin': window.location.origin
          }
        });
        
        console.log("Socket.IO instance created successfully");
      } catch (error) {
        console.error("Failed to create Socket.IO instance:", error);
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      console.log("Setting up event listeners...");

      // CRITICAL FIX: Set connection timeout to match your configuration
      const connectionTimeout = setTimeout(() => {
        console.error("Socket connection timeout after 10 seconds");
        console.log("Debug info:", {
          socketExists: !!this.socket,
          socketState: this.socket?.connected,
          transport: this.socket?.io?.engine?.transport?.name,
          readyState: this.socket?.io?.engine?.readyState,
          url: SOCKET_URL,
          socketId: this.socket?.id
        });
        
        cleanup();
        reject(new Error("Connection timeout - Unable to connect to SwiftTalk servers"));
      }, 10000); // Fixed to 10 seconds

      const cleanup = () => {
        clearTimeout(connectionTimeout);
        if (this.socket) {
          this.socket.off("connect", onConnect);
          this.socket.off("authenticated", onAuthenticated);
          this.socket.off("auth_error", onAuthError);
          this.socket.off("connect_error", onConnectError);
        }
      };

      const onConnect = () => {
        console.log("Socket connected successfully, authenticating...");
        console.log("Socket ID:", this.socket?.id);
        console.log("Transport used:", this.socket?.io.engine?.transport?.name);
        this.connected = true;
        if (this.socket) {
          console.log("Sending authentication token...");
          this.socket.emit("authenticate", token);
        }
      };

      const onAuthenticated = (data: AuthenticatedData) => {
        console.log("Socket authenticated successfully!");
        console.log("User data:", data.user?.username);
        this.isAuthenticated = true;
        this.reconnectAttempts = 0;
        cleanup();
        resolve();
      };

      const onAuthError = (error: AuthErrorData) => {
        console.error("Authentication error:", error);
        cleanup();
        const errorMessage = error.message || "Authentication failed";
        reject(new Error(`Authentication failed: ${errorMessage}`));
      };

      const onConnectError = (error: Error) => {
        console.error("Connection error:", error.message);
        console.log("Reconnect attempts:", this.reconnectAttempts);
        
        cleanup();
        reject(new Error(`Connection failed: ${error.message}`));
      };

      // Event listeners
      this.socket.once("connect", onConnect);
      this.socket.once("authenticated", onAuthenticated);
      this.socket.once("auth_error", onAuthError);
      this.socket.on("connect_error", onConnectError);

      // Enhanced debugging for cloud deployment
      this.socket.on("connecting", () => {
        console.log("Socket attempting to connect...");
      });

      this.socket.on("disconnect", (reason, description) => {
        console.warn("Socket disconnected!");
        console.log("Disconnect reason:", reason);
        console.log("Disconnect description:", description);
        
        this.connected = false;
        this.isAuthenticated = false;

        // Smart reconnection for cloud deployment
        if (reason === "io server disconnect" || reason === "transport close" || reason === "ping timeout") {
          console.log("Server/network issue detected, attempting reconnection...");
          this.attemptReconnection();
        }
      });

      console.log("Event listeners configured, initiating connection...");
    });
  }

  private async attemptReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * this.reconnectAttempts, 10000);

    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
  }

  disconnect(): void {
    console.log("Disconnecting socket");
    this.connected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: unknown): void {
    if (this.socket && this.connected && this.isAuthenticated) {
      console.log(`Emitting ${event}:`, data);
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: Socket not ready`, {
        socketExists: !!this.socket,
        connected: this.connected,
        authenticated: this.isAuthenticated
      });
    }
  }

  on(event: string, callback: SocketEventCallback): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: SocketEventCallback): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  onMessageSent(callback: (data: MessageSentData) => void): void {
    this.on('message_sent', callback as SocketEventCallback);
  }

  onMessageError(callback: (data: MessageErrorData) => void): void {
    this.on('message_error', callback as SocketEventCallback);
  }

  isConnected(): boolean {
    return this.connected && this.isAuthenticated;
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      authenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
      transport: this.socket?.io.engine?.transport?.name || 'none'
    };
  }
}

export const socketService = SocketService.getInstance();