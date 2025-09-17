// User Types
export interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
  user: User;
  token: string;
}

// Message Types
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
  fileSize?: number;
  isRead: boolean;
  createdAt: Date;
}

// Friend Types
export interface Friend {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  friendshipStatus: 'pending' | 'accepted' | 'declined' | 'blocked';
  lastMessage?: Message;
  unreadCount?: number;
}

export interface FriendRequest {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  requestId: string;
  requestedAt: Date;
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

// Socket Types
export interface SocketMessage {
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

export interface TypingIndicator {
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface OnlineStatusUpdate {
  userId: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface MessageNotification {
  from: {
    _id: string;
    username: string;
  };
  message: {
    content: string;
    createdAt: Date;
  };
}

// Chat Room Types
export interface ChatRoom {
  participant: {
    _id: string;
    username: string;
    avatar?: string;
    isOnline: boolean;
    lastSeen: Date;
  };
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: Date;
}

// Form Types
export interface LoginFormData {
  username: string;
  password: string;
}

export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ProfileFormData {
  email: string;
  avatar?: string;
}

export interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AddFriendFormData {
  username: string;
}

// UI Component Types
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export interface InputProps {
  id?: string;
  name?: string;
  type?: 'text' | 'email' | 'password' | 'search';
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Store Types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (data: ChangePasswordFormData) => Promise<void>;
}

export interface ChatState {
  messages: Record<string, Message[]>; // userId -> messages[]
  currentChatUser: User | null;
  isLoading: boolean;
  typingUsers: Record<string, boolean>; // userId -> isTyping
  sendMessage: (recipientId: string, content: string) => Promise<void>;
  sendFileMessage: (recipientId: string, file: File) => Promise<void>;
  loadChatHistory: (userId: string, page?: number) => Promise<void>;
  markMessagesAsRead: (senderId: string) => Promise<void>;
  setCurrentChatUser: (user: User | null) => void;
  addMessage: (message: Message) => void;
  setTyping: (userId: string, isTyping: boolean) => void;
}

export interface FriendsState {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  onlineFriends: Friend[];
  isLoading: boolean;
  loadFriends: () => Promise<void>;
  loadFriendRequests: () => Promise<void>;
  sendFriendRequest: (username: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  updateFriendStatus: (friendId: string, isOnline: boolean) => void;
}

// Error Types
export interface FormError {
  field: string;
  message: string;
}

export interface NetworkError extends Error {
  status?: number;
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
  };
}