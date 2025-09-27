// socket.ts - Frontend configuration for Render deployment
import { io, Socket } from "socket.io-client";
import { getToken } from "./auth";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

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
  private readonly maxReconnectAttempts = 5; // Increased for production

  public static getInstance(): SocketService {
    SocketService.instance ??= new SocketService();
    return SocketService.instance;
  }

  private constructor() {}

  async connect(): Promise<void> {
    console.log("=== SOCKET CONNECTION ATTEMPT ===");
    console.log("Socket URL:", SOCKET_URL);

    const token = getToken();
    console.log("🔑 Token check:", {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenPrefix: token ? token.substring(0, 10) + "..." : "N/A"
    });
    
    if (!token) {
      throw new Error("No authentication token available");
    }

    if (this.socket && this.connected && this.isAuthenticated) {
      console.log("Socket already connected and authenticated");
      return;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    return new Promise((resolve, reject) => {
      console.log("Creating socket connection with simplified settings...");
      console.log("Socket URL being used:", SOCKET_URL);
      
      // Test if Socket.IO library is available
      if (typeof io === 'undefined') {
        console.error("Socket.IO library is not available!");
        reject(new Error("Socket.IO library not loaded"));
        return;
      }

      // SIMPLIFIED: Basic Socket.IO configuration with explicit CORS handling
      try {
        this.socket = io(SOCKET_URL, {
          // Start with polling only, no WebSocket upgrade
          transports: ["polling"],
          
          // Disable upgrade to avoid complications
          upgrade: false,
          
          // Explicit autoConnect
          autoConnect: true,
          
          // Basic timeouts
          timeout: 20000, // 20 seconds
          
          // Simplified reconnection
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
          
          // Force new connection
          forceNew: true,
          
          // Explicit CORS handling
          withCredentials: true,
          
          // Simple query params
          query: {
            timestamp: Date.now()
          }
        });
        
        console.log("Socket.IO instance created successfully:", !!this.socket);
      } catch (error) {
        console.error("Failed to create Socket.IO instance:", error);
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      console.log("Socket.IO instance created, setting up event listeners...");

      // Connection timeout handler
      const connectionTimeout = setTimeout(() => {
        console.error("Socket connection timeout after 20 seconds");
        console.log("Debug info:", {
          socketExists: !!this.socket,
          socketState: this.socket?.connected,
          transport: this.socket?.io?.engine?.transport?.name,
          readyState: this.socket?.io?.engine?.readyState,
          url: SOCKET_URL,
          socketId: this.socket?.id,
          connecting: !this.socket?.connected && !this.socket?.disconnected
        });
        
        cleanup();
        reject(new Error("Connection timeout"));
      }, 20000);

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
        console.log("✅ Socket connected successfully, authenticating...");
        console.log("Socket ID:", this.socket?.id);
        console.log("Transport used:", this.socket?.io.engine?.transport?.name);
        this.connected = true;
        if (this.socket) {
          console.log("🔐 Sending authentication token...");
          this.socket.emit("authenticate", token);
        }
      };

      const onAuthenticated = (data: AuthenticatedData) => {
        console.log("✅ Socket authenticated successfully!");
        console.log("User data:", data.user?.username);
        console.log("Socket ID:", this.socket?.id);
        this.isAuthenticated = true;
        this.reconnectAttempts = 0;
        cleanup();
        resolve();
      };

      const onAuthError = (error: AuthErrorData) => {
        console.error("❌ Authentication error:", error);
        console.log("Token being used:", token ? "Present" : "Missing");
        console.log("Socket ID:", this.socket?.id);
        cleanup();
        const errorMessage = error.message || "Authentication failed";
        reject(new Error(`Authentication failed: ${errorMessage}`));
      };

      const onConnectError = (error: Error) => {
        console.error("❌ Connection error:", error.message);
        console.log("Error details:", error);
        console.log("Socket transport:", this.socket?.io.engine?.transport?.name);
        console.log("Socket connected:", this.socket?.connected);
        console.log("Reconnect attempts:", this.reconnectAttempts);
        
        // Reject immediately for debugging
        cleanup();
        reject(error);
      };

      // Event listeners
      this.socket.once("connect", onConnect);
      this.socket.once("authenticated", onAuthenticated);
      this.socket.once("auth_error", onAuthError);
      this.socket.on("connect_error", onConnectError);

      // Add comprehensive event debugging
      this.socket.on("connecting", () => {
        console.log("🔄 Socket attempting to connect...");
      });

      this.socket.on("connect", () => {
        console.log("🔗 Socket connected event fired");
        console.log("Connected with transport:", this.socket?.io.engine?.transport?.name);
      });

      this.socket.on("disconnect", (reason, description) => {
        console.warn("🔌 Socket disconnected!");
        console.log("Disconnect reason:", reason);
        console.log("Disconnect description:", description);
        console.log("Was authenticated:", this.isAuthenticated);
        console.log("Socket ID:", this.socket?.id);
        
        this.connected = false;
        this.isAuthenticated = false;

        // Auto-reconnect for certain disconnect reasons
        if (reason === "io server disconnect" || reason === "transport close") {
          console.log("🔄 Server initiated disconnect, attempting reconnection...");
          this.attemptReconnection();
        } else if (reason === "ping timeout" || reason === "transport error") {
          console.log("🔄 Connection issue detected, attempting reconnection...");
          this.attemptReconnection();
        } else {
          console.log(`ℹ️  Disconnect reason '${reason}' - no automatic reconnection`);
        }
      });

      // Add more debugging events
      this.socket.on("connect_error", (error) => {
        console.error("🔴 connect_error event:", error);
      });

      this.socket.on("error", (error) => {
        console.error("🔴 error event:", error);
      });

      console.log("Event listeners set up, connection should start automatically...");
      
      // Force connection attempt if not already connecting
      setTimeout(() => {
        if (this.socket && !this.socket.connected) {
          console.log("⚠️ Socket not connecting automatically, forcing connection...");
          this.socket.connect();
        }
      }, 1000);
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
      console.warn(`Cannot emit ${event}: Socket not ready`);
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