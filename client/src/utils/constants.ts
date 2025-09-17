// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Storage Keys
export const STORAGE_KEYS = {
  TOKEN: 'chat_app_token',
  USER: 'chat_app_user',
  THEME: 'chat_app_theme',
  CHAT_DRAFT: 'chat_app_draft_',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
  REFRESH_TOKEN: '/auth/refresh-token',
  CHANGE_PASSWORD: '/auth/change-password',
  UPDATE_PROFILE: '/auth/profile',

  // Users
  SEARCH_USERS: '/users/search',
  GET_USER: (id: string) => `/users/${id}`,
  GET_USER_BY_USERNAME: (username: string) => `/users/username/${username}`,
  GET_FRIENDS: '/users/friends/list',
  GET_FRIENDS_WITH_MESSAGES: '/users/friends/with-messages',
  GET_ONLINE_FRIENDS: '/users/friends/online',
  SEND_FRIEND_REQUEST: '/users/friends/request',
  GET_PENDING_REQUESTS: '/users/friends/requests/pending',
  GET_SENT_REQUESTS: '/users/friends/requests/sent',
  ACCEPT_FRIEND_REQUEST: (id: string) => `/users/friends/requests/${id}/accept`,
  DECLINE_FRIEND_REQUEST: (id: string) => `/users/friends/requests/${id}/decline`,
  REMOVE_FRIEND: (id: string) => `/users/friends/${id}`,
  BLOCK_USER: (id: string) => `/users/${id}/block`,
  GET_FRIENDSHIP_STATUS: (id: string) => `/users/${id}/friendship-status`,
  UPDATE_ONLINE_STATUS: '/users/online-status',

  // Chat
  SEND_MESSAGE: '/chat/messages',
  SEND_FILE: '/chat/messages/file',
  GET_CHAT_HISTORY: (userId: string) => `/chat/history/${userId}`,
  MARK_MESSAGES_READ: (userId: string) => `/chat/messages/${userId}/read`,
  GET_UNREAD_COUNT: '/chat/unread-count',
  DELETE_MESSAGE: (id: string) => `/chat/messages/${id}`,
  SEARCH_MESSAGES: '/chat/messages/search',
  GET_CHAT_ROOMS: '/chat/rooms',
  UPLOAD_FILE: '/chat/upload',
  GET_USER_ONLINE: (userId: string) => `/chat/users/${userId}/online`,
} as const;

// Socket Events
export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  AUTH_ERROR: 'auth_error',

  // Chat
  JOIN_CHAT: 'join_chat',
  LEAVE_CHAT: 'leave_chat',
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  MESSAGE_ERROR: 'message_error',
  MESSAGE_NOTIFICATION: 'message_notification',

  // Typing
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  USER_TYPING: 'user_typing',

  // Status
  UPDATE_ONLINE_STATUS: 'update_online_status',
  FRIEND_STATUS_UPDATE: 'friend_status_update',
  MARK_MESSAGES_READ: 'mark_messages_read',
  MESSAGES_READ: 'messages_read',
} as const;

// UI Constants
export const UI_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MESSAGE_PAGE_SIZE: 50,
  SEARCH_DEBOUNCE_MS: 300,

  // File Upload
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
  ],

  // Timeouts
  TYPING_TIMEOUT: 3000, // 3 seconds
  RECONNECT_TIMEOUT: 5000, // 5 seconds
  TOAST_DURATION: 4000, // 4 seconds

  // Animation Durations
  FADE_DURATION: 200,
  SLIDE_DURATION: 300,
  BOUNCE_DURATION: 500,
} as const;

// Validation Constants
export const VALIDATION = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 20,
    PATTERN: /^[a-zA-Z0-9_]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
  },
  EMAIL: {
    PATTERN: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
  },
  MESSAGE: {
    MAX_LENGTH: 1000,
  },
} as const;

// Theme Constants
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

// Status Constants
export const STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  BUSY: 'busy',
} as const;

// Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  FILE: 'file',
  IMAGE: 'image',
  SYSTEM: 'system',
} as const;

// Friendship Status
export const FRIENDSHIP_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  BLOCKED: 'blocked',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized. Please login again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  FILE_TOO_LARGE: `File too large. Maximum size is ${UI_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}MB.`,
  FILE_TYPE_NOT_SUPPORTED: 'File type not supported.',
  CONNECTION_LOST: 'Connection lost. Attempting to reconnect...',
  CONNECTION_RESTORED: 'Connection restored.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  REGISTER_SUCCESS: 'Account created successfully!',
  MESSAGE_SENT: 'Message sent',
  FILE_UPLOADED: 'File uploaded successfully',
  FRIEND_REQUEST_SENT: 'Friend request sent',
  FRIEND_REQUEST_ACCEPTED: 'Friend request accepted',
  PROFILE_UPDATED: 'Profile updated successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
} as const;