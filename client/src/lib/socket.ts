import { io, Socket } from "socket.io-client";
import { getToken } from "./auth";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// Proper function type instead of interface
type SocketEventCallback = (data: unknown) => void;

// Specific event types for better type safety
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
  private readonly maxReconnectAttempts = 3;

  public static getInstance(): SocketService {
    // Fix: Use nullish coalescing operator
    SocketService.instance ??= new SocketService();
    return SocketService.instance;
  }

  private constructor() {}

  async connect(): Promise<void> {
    console.log("=== SOCKET CONNECTION ATTEMPT ===");
    console.log("Socket URL:", SOCKET_URL);

    const token = getToken();
    console.log("Token available:", !!token);

    if (this.socket && this.connected && this.isAuthenticated) {
      console.log("Socket already connected and authenticated");
      return;
    }

    if (!token) {
      throw new Error("No authentication token available");
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    return new Promise((resolve, reject) => {
      console.log("Creating new socket connection...");

      this.socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        timeout: 15000,
        reconnection: false,
        autoConnect: true,
      });

      const onConnect = () => {
        console.log("Socket connected, authenticating...");
        this.connected = true;
        if (this.socket) {
          this.socket.emit("authenticate", token);
        }
      };

      const onAuthenticated = (data: AuthenticatedData) => {
        console.log("Socket authenticated successfully:", data.user?.username);
        this.isAuthenticated = true;
        this.reconnectAttempts = 0;
        cleanup();
        resolve();
      };

      const onAuthError = (error: AuthErrorData) => {
        console.error("Socket authentication error:", error);
        cleanup();
        reject(new Error("Authentication failed"));
      };

      const onConnectError = (error: Error) => {
        console.error("Socket connection error:", error);
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        if (this.socket) {
          this.socket.off("connect", onConnect);
          this.socket.off("authenticated", onAuthenticated);
          this.socket.off("auth_error", onAuthError);
          this.socket.off("connect_error", onConnectError);
        }
      };

      this.socket.once("connect", onConnect);
      this.socket.once("authenticated", onAuthenticated);
      this.socket.once("auth_error", onAuthError);
      this.socket.once("connect_error", onConnectError);

      this.socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        this.connected = false;
        this.isAuthenticated = false;

        if (reason === "io server disconnect" || reason === "transport close") {
          this.attemptReconnection();
        }
      });
    });
  }

  private async attemptReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * this.reconnectAttempts, 10000);

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
  }

  disconnect(): void {
    console.log("Manually disconnecting socket");
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
    console.log("=== EMITTING EVENT ===");
    console.log("Event:", event);
    console.log("Data:", data);
    console.log("Socket connected:", this.connected);
    console.log("Socket authenticated:", this.isAuthenticated);

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
    } else {
      console.warn(`Cannot listen to ${event}: Socket not initialized`);
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

  // Typed event handler methods
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
    };
  }
}

export const socketService = SocketService.getInstance();