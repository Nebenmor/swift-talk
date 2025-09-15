import { Document } from 'mongoose';

// User Types
export interface IUser {
  _id?: string;
  username: string;
  email: string;
  password: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Message Types
export interface IMessage {
  _id?: string;
  sender: string;
  recipient: string;
  content: string;
  messageType: 'text' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageDocument extends IMessage, Document {}

// Friendship Types
export interface IFriendship {
  _id?: string;
  requester: string;
  recipient: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
}

export interface IFriendshipDocument extends IFriendship, Document {}

// Auth Types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<IUser, 'password'>;
  token: string;
}

// Socket Types
export interface SocketUser {
  userId: string;
  socketId: string;
  username: string;
}

export interface ChatMessage {
  _id?: string;
  sender: {
    _id: string;
    username: string;
    avatar?: string;
  };
  recipient: string;
  content: string;
  messageType: 'text' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRead: boolean;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Request Types
export interface AuthRequest extends Express.Request {
  user?: IUser;
}

// Friend Request Types
export interface FriendRequest {
  username: string;
}

export interface FriendResponse {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  friendshipStatus: 'pending' | 'accepted' | 'declined' | 'blocked';
}

// Chat Types
export interface ChatRoom {
  participants: string[];
  lastMessage?: IMessage;
  unreadCount: number;
}

// File Upload Types
export interface FileUploadResult {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}