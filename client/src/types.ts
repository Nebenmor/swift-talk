export interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
}

export interface Message {
  _id: string;
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
  isRead: boolean;
  createdAt: Date;
}

export interface Friend {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  lastMessage?: Message;
  unreadCount?: number;
}

export interface FriendRequest {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  requestId: string;
  requestedAt: Date;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface SignupData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
