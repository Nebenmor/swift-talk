import { create } from 'zustand';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';
import { socketService } from '../services/socketService';
import { API_ENDPOINTS, SUCCESS_MESSAGES } from '../utils/constants';
import {
  ChatState,
  Message,
  User,
  SocketMessage,
  TypingIndicator,
  MessageNotification,
  PaginatedResponse,
} from '../types';

interface ChatStore extends ChatState {
  initializeSocket: () => void;
  cleanupSocket: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  currentChatUser: null,
  isLoading: false,
  typingUsers: {},

  initializeSocket: () => {
    // Listen for new messages
    socketService.on('new_message', (message: SocketMessage) => {
      get().addMessage(message as Message);
    });

    // Listen for message notifications
    socketService.on('message_notification', (notification: MessageNotification) => {
      // Show notification toast is handled in socketService
      // Here we could add to unread counts or update UI
    });

    // Listen for typing indicators
    socketService.on('user_typing', (data: TypingIndicator) => {
      get().setTyping(data.userId, data.isTyping);
    });

    // Listen for messages read confirmations
    socketService.on('messages_read', (data: { readBy: string; readAt: Date }) => {
      const { messages, currentChatUser } = get();
      if (currentChatUser && currentChatUser._id === data.readBy) {
        const userMessages = messages[currentChatUser._id] || [];
        const updatedMessages = userMessages.map(msg => ({
          ...msg,
          isRead: true,
        }));
        
        set({
          messages: {
            ...messages,
            [currentChatUser._id]: updatedMessages,
          },
        });
      }
    });
  },

  cleanupSocket: () => {
    // Remove all socket listeners
    socketService.off('new_message', () => {});
    socketService.off('message_notification', () => {});
    socketService.off('user_typing', () => {});
    socketService.off('messages_read', () => {});
  },

  sendMessage: async (recipientId: string, content: string) => {
    try {
      // Send via API first
      const response = await apiService.post<Message>(API_ENDPOINTS.SEND_MESSAGE, {
        recipient: recipientId,
        content: content.trim(),
        messageType: 'text',
      });

      if (response.success && response.data) {
        // Add to local state
        get().addMessage(response.data);

        // Send via socket for real-time delivery
        socketService.sendMessage({
          recipientId,
          content: content.trim(),
          messageType: 'text',
        });

        toast.success(SUCCESS_MESSAGES.MESSAGE_SENT);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },

  sendFileMessage: async (recipientId: string, file: File) => {
    try {
      set({ isLoading: true });

      // Upload file first
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recipient', recipientId);

      const response = await apiService.uploadFile<Message>(
        API_ENDPOINTS.SEND_FILE,
        formData
      );

      if (response.success && response.data) {
        // Add to local state
        get().addMessage(response.data);

        // Send via socket for real-time delivery
        socketService.sendMessage({
          recipientId,
          content: `Sent a file: ${file.name}`,
          messageType: 'file',
          fileData: {
            fileUrl: response.data.fileUrl!,
            fileName: response.data.fileName!,
            fileSize: response.data.fileSize!,
          },
        });

        toast.success('File sent successfully');
      }
    } catch (error) {
      console.error('Failed to send file:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadChatHistory: async (userId: string, page = 1) => {
    try {
      set({ isLoading: true });

      const response = await apiService.get<PaginatedResponse<Message>>(
        API_ENDPOINTS.GET_CHAT_HISTORY(userId),
        { page, limit: 50 }
      );

      if (response.success && response.data) {
        const { messages } = get();
        const existingMessages = messages[userId] || [];
        
        // If it's page 1, replace messages, otherwise append
        const updatedMessages = page === 1 
          ? response.data.data
          : [...response.data.data, ...existingMessages];

        set({
          messages: {
            ...messages,
            [userId]: updatedMessages,
          },
        });
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  markMessagesAsRead: async (senderId: string) => {
    try {
      // Mark as read via API
      await apiService.put(API_ENDPOINTS.MARK_MESSAGES_READ(senderId));

      // Mark as read via socket
      socketService.markMessagesAsRead(senderId);

      // Update local state
      const { messages } = get();
      const senderMessages = messages[senderId] || [];
      const updatedMessages = senderMessages.map(msg => ({
        ...msg,
        isRead: true,
      }));

      set({
        messages: {
          ...messages,
          [senderId]: updatedMessages,
        },
      });
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  },

  setCurrentChatUser: (user: User | null) => {
    const { currentChatUser } = get();

    // Leave previous chat room
    if (currentChatUser) {
      socketService.leaveChat(currentChatUser._id);
    }

    // Join new chat room
    if (user) {
      socketService.joinChat(user._id);
      // Load chat history if not loaded
      if (!get().messages[user._id]) {
        get().loadChatHistory(user._id);
      }
      // Mark messages as read
      get().markMessagesAsRead(user._id);
    }

    set({ currentChatUser: user });
  },

  addMessage: (message: Message) => {
    const { messages } = get();
    const otherUserId = message.sender._id === message.recipient 
      ? message.recipient 
      : message.sender._id;

    const existingMessages = messages[otherUserId] || [];
    
    // Check if message already exists to prevent duplicates
    const messageExists = existingMessages.some(msg => msg._id === message._id);
    if (messageExists) return;

    const updatedMessages = [...existingMessages, message].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    set({
      messages: {
        ...messages,
        [otherUserId]: updatedMessages,
      },
    });
  },

  setTyping: (userId: string, isTyping: boolean) => {
    const { typingUsers } = get();
    
    if (isTyping) {
      set({
        typingUsers: {
          ...typingUsers,
          [userId]: true,
        },
      });

      // Clear typing indicator after 3 seconds
      setTimeout(() => {
        const currentTypingUsers = get().typingUsers;
        const { [userId]: _, ...rest } = currentTypingUsers;
        set({ typingUsers: rest });
      }, 3000);
    } else {
      const { [userId]: _, ...rest } = typingUsers;
      set({ typingUsers: rest });
    }
  },
}));