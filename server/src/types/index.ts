import { Document } from 'mongoose';
import { Request } from 'express';

// User Types
export interface IUser {
  _id?: string;
  username: string;
  email: string;
  password?: string; // Make password optional for responses
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

// User type for responses (without password)
export interface IUserResponse extends Omit<IUser, 'password'> {
  _id: string;
}

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
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

export interface IMessageDocument extends Omit<IMessage, '_id'>, Document {}

// Friendship Types
export interface IFriendship {
  _id?: string;
  requester: string;
  recipient: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
}

export interface IFriendshipDocument extends Omit<IFriendship, '_id'>, Document {}

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
  user: IUserResponse;
  token: string;
}

// Request Types - FIX: Properly extend Express Request
export interface AuthRequest extends Request {
  user?: IUserResponse;
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