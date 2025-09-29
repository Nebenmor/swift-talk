import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import FriendsList from "./FriendsList";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import AddFriend from "./AddFriend";
import FriendRequests from "./FriendRequests";
import { getUser, removeToken, removeUser } from "../lib/auth";
import { socketService } from "../lib/socket";
import { NotificationService } from "../lib/NotificationService";
import api from "../lib/api";
import type { User, Friend, Message } from "../types";

interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
}

interface MessageSentData {
  success: boolean;
  tempId?: string;
  messageId?: string;
}

interface MessageErrorData {
  message: string;
}

interface MessageReadData {
  readBy: string;
  readAt: Date;
}

const getServerUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
};

export default function Chat() {
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const navigate = useNavigate();

  // Use refs to prevent stale closures
  const initRef = useRef(false);
  const loadingFriendsRef = useRef(false);
  const currentUserRef = useRef<User | null>(null);
  const selectedFriendRef = useRef<Friend | null>(null);
  const sentMessagesRef = useRef<Set<string>>(new Set());

  // Update refs when state changes
  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  useEffect(() => {
    selectedFriendRef.current = selectedFriend;
  }, [selectedFriend]);

  // Pure utility functions (no dependencies needed)
  const sortMessagesByTime = (messages: Message[]): Message[] => {
    return messages.sort((a: Message, b: Message) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  };

  const removeDuplicateMessages = (messages: Message[]): Message[] => {
    return messages.reduce((acc: Message[], msg: Message) => {
      if (!acc.find((m) => m._id === msg._id)) {
        acc.push(msg);
      }
      return acc;
    }, []);
  };

  // Memoized helper functions
  const updateMessageReadStatus = useCallback((userId: string, friendId: string) => {
    setMessages(prevMessages => 
      prevMessages.map(msg => {
        const shouldMarkAsRead = msg.sender._id === userId && 
          msg.recipient === friendId && 
          !msg.isRead;
        
        if (shouldMarkAsRead) {
          console.log('Marking message as read:', msg._id);
          return { ...msg, isRead: true };
        }
        return msg;
      })
    );
  }, []);

  const autoMarkNewMessageAsRead = useCallback(async (senderId: string) => {
    try {
      await api.put(`/chat/messages/${senderId}/read`);
      console.log('Auto-marked new message as read');
      
      socketService.emit('mark_messages_read', {
        senderId: senderId
      });
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  }, []);

  const addNewMessageToChat = useCallback((message: Message) => {
    setMessages(prevMessages => {
      const messageExists = prevMessages.some(msg => msg._id === message._id);
      if (messageExists) return prevMessages;
      
      const newMessages = [...prevMessages, message];
      return sortMessagesByTime(newMessages);
    });
  }, []);

  const showMessageNotifications = useCallback((message: Message) => {
    NotificationService.showMessageNotification(
      message.sender.username,
      message.content,
      message.messageType === 'file'
    );
    
    toast.success(`New message from ${message.sender.username}`, {
      icon: '💬',
      duration: 3000,
    });
  }, []);

  // Load friends from API with debouncing
  const loadFriends = useCallback(async () => {
    if (loadingFriendsRef.current) return;

    loadingFriendsRef.current = true;
    try {
      const response = await api.get("/users/friends/with-messages");
      if (response.data.success) {
        const newFriends = response.data.data || [];
        setFriends(newFriends);
      }
    } catch (error) {
      console.error("Failed to load friends:", error);
      const apiError = error as ApiError;
      if (apiError.response?.status !== 429) {
        toast.error("Failed to load friends");
      }
    } finally {
      loadingFriendsRef.current = false;
    }
  }, []);

  // Memoized helper functions that depend on loadFriends
  const markMessagesAsReadMemo = useCallback(async (friendId: string) => {
    try {
      await api.put(`/chat/messages/${friendId}/read`);
      console.log('Messages marked as read for friend:', friendId);
      
      setTimeout(() => {
        if (!loadingFriendsRef.current) {
          loadFriends();
        }
      }, 500);
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  }, [loadFriends]);

  const updateFriendsListMemo = useCallback(() => {
    setTimeout(() => {
      if (!loadingFriendsRef.current) {
        loadFriends();
      }
    }, 1000);
  }, [loadFriends]);

  // Load messages function
  const loadMessages = useCallback(async (friendId: string) => {
    try {
      const response = await api.get(`/chat/history/${friendId}`);
      if (response.data.success) {
        const rawMessages = response.data.data.data || [];
        const uniqueMessages = removeDuplicateMessages(rawMessages);
        const sortedMessages = sortMessagesByTime(uniqueMessages);
        
        setMessages(sortedMessages);
        await markMessagesAsReadMemo(friendId);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Failed to load messages");
    }
  }, [markMessagesAsReadMemo]);

  // Handle read receipts update - Fixed TypeScript error
  const handleMessagesRead = useCallback((data: unknown) => {
    const readData = data as MessageReadData;
    const currentUser = currentUserRef.current;
    const currentSelectedFriend = selectedFriendRef.current;
    
    console.log('=== MESSAGES READ EVENT ===');
    console.log('Read by:', readData.readBy);
    console.log('Current user:', currentUser?._id);
    console.log('Current selected friend:', currentSelectedFriend?._id);
    
    if (currentUser && currentSelectedFriend && readData.readBy === currentSelectedFriend._id) {
      console.log('Updating read receipts for messages to:', currentSelectedFriend.username);
      updateMessageReadStatus(currentUser._id, currentSelectedFriend._id);
    }
  }, [updateMessageReadStatus]);

  // Message handler with better real-time updates
  const handleNewMessage = useCallback((data: unknown) => {
    const message = data as Message;
    const currentUser = currentUserRef.current;
    const currentSelectedFriend = selectedFriendRef.current;
    
    if (!currentUser || message.sender._id === currentUser._id) {
      return;
    }

    const isForCurrentUser = message.recipient === currentUser._id;
    const isFromCurrentChatFriend = currentSelectedFriend && 
      message.sender._id === currentSelectedFriend._id;

    if (isForCurrentUser && isFromCurrentChatFriend) {
      addNewMessageToChat(message);
      setTimeout(() => autoMarkNewMessageAsRead(message.sender._id), 500);
    }

    if (isForCurrentUser) {
      updateFriendsListMemo();
      showMessageNotifications(message);
    }
  }, [addNewMessageToChat, updateFriendsListMemo, autoMarkNewMessageAsRead, showMessageNotifications]);

  // Friend status handler
  const handleFriendStatusUpdate = useCallback((data: unknown) => {
    const statusData = data as { userId: string; isOnline: boolean };
    const { userId, isOnline } = statusData;

    setFriends(prev => prev.map(friend =>
      friend._id === userId ? { ...friend, isOnline } : friend
    ));

    setSelectedFriend(prev =>
      prev && prev._id === userId ? { ...prev, isOnline } : prev
    );

    if (isOnline) {
      const friend = friends.find(f => f._id === userId);
      if (friend) {
        NotificationService.showFriendOnlineNotification(friend.username);
      }
    }
  }, [friends]);

  // Helper function for socket sending
  const sendViaSocket = async (tempId: string, content: string, messageType: 'text' | 'file', fileData?: unknown) => {
    if (!selectedFriend) return;

    const messageData: Record<string, unknown> = {
      recipientId: selectedFriend._id,
      content,
      messageType,
      tempId,
    };

    if (messageType === 'file' && fileData) {
      const fileInfo = fileData as { fileUrl: string; fileName: string; fileSize: number };
      messageData.fileData = fileInfo;
    }

    socketService.emit('send_message', messageData);
  };

 // Helper function for HTTP sending - UPDATED
const sendViaHttp = async (tempId: string, content: string, messageType: 'text' | 'file', fileData?: unknown) => {
  if (!selectedFriend) return;

  const requestData: Record<string, unknown> = {
    recipient: selectedFriend._id,
    content,
    messageType,
  };

  if (messageType === 'file' && fileData) {
    const fileInfo = fileData as { fileUrl: string; fileName: string; fileSize: number };
    requestData.fileUrl = fileInfo.fileUrl;
    requestData.fileName = fileInfo.fileName;
    requestData.fileSize = fileInfo.fileSize;
  }

  const response = await api.post('/chat/messages', requestData);
  if (response.data.success) {
    const serverMessage = response.data.data;
    
    // No need to fix URLs - backend handles this now
    setMessages(prevMessages => 
      prevMessages.map(msg => msg._id === tempId ? { ...serverMessage } : msg)
    );
  }
};

// createOptimisticMessage function to handle message creation
const createOptimisticMessage = (
  tempId: string, 
  content: string, 
  messageType: 'text' | 'file',
  fileData?: unknown
): Message => {
  if (!selectedFriend || !user) {
    throw new Error('Missing required data for message creation');
  }

  let displayFileUrl = undefined;
  if (messageType === 'file' && fileData) {
    const fileInfo = fileData as { fileUrl: string };
    const serverUrl = getServerUrl();
    displayFileUrl = fileInfo.fileUrl.startsWith('http') 
      ? fileInfo.fileUrl 
      : `${serverUrl}${fileInfo.fileUrl}`;
  }

  return {
    _id: tempId,
    sender: {
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
    },
    recipient: selectedFriend._id,
    content,
    messageType,
    fileUrl: displayFileUrl,
    fileName: messageType === 'file' && fileData ? (fileData as { fileName: string }).fileName : undefined,
    isRead: false,
    createdAt: new Date(),
  };
};


  // Message sending with improved file URL handling
  const handleSendMessage = async (content: string, messageType: 'text' | 'file' = 'text', fileData?: unknown) => {
    if (!selectedFriend || !user) return;

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    try {
      const optimisticMessage = createOptimisticMessage(tempId, content, messageType, fileData);

      setMessages(prevMessages => {
        const newMessages = [...prevMessages, optimisticMessage];
        return sortMessagesByTime(newMessages);
      });

      sentMessagesRef.current.add(tempId);

      if (socketService.isConnected()) {
        await sendViaSocket(tempId, content, messageType, fileData);
      } else {
        await sendViaHttp(tempId, content, messageType, fileData);
      }
      
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId));
      sentMessagesRef.current.delete(tempId);
      toast.error("Failed to send message");
    }
  };

  // Friend selection with improved read receipt handling
  const handleFriendSelect = async (friend: Friend) => {
    setSelectedFriend(friend);
    
    setFriends(prevFriends => 
      prevFriends.map(f => 
        f._id === friend._id ? { ...f, unreadCount: 0 } : f
      )
    );
    
    await loadMessages(friend._id);
    setSidebarOpen(false);

    setTimeout(() => {
      socketService.emit('mark_messages_read', {
        senderId: friend._id
      });
    }, 1000);
  };

  // Socket event setup - Fixed to reduce nesting
  const handleSocketConnect = useCallback(() => {
    setSocketConnected(true);
  }, []);

  const handleSocketDisconnect = useCallback(() => {
    setSocketConnected(false);
  }, []);

  const handleSocketConnectError = useCallback(() => {
    setSocketConnected(false);
  }, []);

  const handleMessageSent = useCallback((data: MessageSentData) => {
    if (!data.success || !data.tempId || !data.messageId) return;
    
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg._id === data.tempId ? { ...msg, _id: data.messageId || msg._id } : msg
      )
    );
    
    if (data.tempId) {
      sentMessagesRef.current.delete(data.tempId);
    }
  }, []);

  const handleMessageError = useCallback((data: MessageErrorData) => {
    toast.error(`Message failed: ${data.message}`);
  }, []);

  const setupSocketEvents = useCallback(() => {
    socketService.on("connect", handleSocketConnect);
    socketService.on("disconnect", handleSocketDisconnect);
    socketService.on("connect_error", handleSocketConnectError);
    socketService.on("new_message", handleNewMessage);
    socketService.on("friend_status_update", handleFriendStatusUpdate);
    socketService.on("messages_read", handleMessagesRead);

    socketService.onMessageSent(handleMessageSent);
    socketService.onMessageError(handleMessageError);
  }, [
    handleSocketConnect,
    handleSocketDisconnect,
    handleSocketConnectError,
    handleNewMessage,
    handleFriendStatusUpdate,
    handleMessagesRead,
    handleMessageSent,
    handleMessageError
  ]);

  const cleanupSocketEvents = useCallback(() => {
    socketService.off("connect", handleSocketConnect);
    socketService.off("disconnect", handleSocketDisconnect);
    socketService.off("connect_error", handleSocketConnectError);
    socketService.off("new_message", handleNewMessage);
    socketService.off("friend_status_update", handleFriendStatusUpdate);
    socketService.off("messages_read", handleMessagesRead);
    socketService.off("message_sent");
    socketService.off("message_error");
    socketService.disconnect();
  }, [
    handleSocketConnect,
    handleSocketDisconnect,
    handleSocketConnectError,
    handleNewMessage,
    handleFriendStatusUpdate,
    handleMessagesRead
  ]);

  // Initialize the app - Extracted for better organization
  const initializeUserAndPermissions = useCallback(async () => {
    const currentUser = getUser();
    if (!currentUser) {
      navigate("/login");
      return null;
    }

    setUser(currentUser);
    await NotificationService.requestPermission();
    return currentUser;
  }, [navigate]);

  const initializeSocketConnection = useCallback(async () => {
    await socketService.connect();
    setupSocketEvents();
    setSocketConnected(socketService.isConnected());
  }, [setupSocketEvents]);

  const handleInitializationError = useCallback((error: unknown) => {
    console.error("Failed to initialize SwiftTalk:", error);
    toast.error("Failed to initialize SwiftTalk. Please refresh the page.");
  }, []);

  // Initialize everything once - FIXED VERSION
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initializeApp = async () => {
      try {
        const currentUser = await initializeUserAndPermissions();
        if (!currentUser) return;

        await loadFriends();
        await initializeSocketConnection();
      } catch (error) {
        handleInitializationError(error);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
    
    // CRITICAL FIX: Only return cleanup on component unmount, not on every render
    return () => {
      console.log("Chat component unmounting - cleaning up socket");
      cleanupSocketEvents();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // FIXED: Empty dependency array to run only once

  // Separate useEffect for handling component unmount cleanup
  useEffect(() => {
    // This runs when component unmounts or when user logs out
    return () => {
      if (socketService.isConnected()) {
        console.log("Component cleanup - disconnecting socket");
        socketService.disconnect();
      }
    };
  }, []);



  const handleLogout = () => {
    removeToken();
    removeUser();
    socketService.disconnect();
    navigate("/login");
    toast.success("Logged out of SwiftTalk successfully");
  };

  const onFriendAdded = async () => {
    setShowAddFriend(false);
    await loadFriends();
    toast.success("Friends list updated!");
  };

  const onRequestHandled = async () => {
    setShowFriendRequests(false);
    await loadFriends();
    toast.success("Friends list updated!");
  };

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            SwiftTalk
          </h3>
          <p className="text-gray-600">Connecting you to conversations...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-600 mb-2">Session Error</h3>
          <p className="text-gray-600 mb-4">No user session found</p>
          <button onClick={() => navigate("/login")} className="btn btn-primary">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden cursor-default"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:w-1/3 lg:max-w-sm ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="text-white font-medium">{user.username[0].toUpperCase()}</span>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm md:text-base">{user.username}</h2>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${socketConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                  <p className="text-xs text-gray-500">{socketConnected ? "Connected" : "Connecting..."}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              SwiftTalk
            </h1>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-3 border-b border-gray-200 flex gap-2">
          <button onClick={() => setShowFriendRequests(true)} className="btn btn-secondary text-xs flex-1 transition-all hover:scale-105">
            Requests
          </button>
          <button onClick={() => setShowAddFriend(true)} className="btn btn-primary text-xs flex-1 transition-all hover:scale-105">
            Add Friend
          </button>
          <button onClick={handleLogout} className="btn btn-secondary text-xs px-3 transition-all hover:scale-105">
            Logout
          </button>
        </div>

        {/* Connection Status Warning */}
        {!socketConnected && (
          <div className="p-2 bg-yellow-50 border-b border-yellow-200">
            <p className="text-xs text-yellow-800 text-center">Real-time messaging temporarily unavailable</p>
          </div>
        )}

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto">
          <FriendsList friends={friends} selectedFriend={selectedFriend} onFriendSelect={handleFriendSelect} />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFriend ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <button
                onClick={handleSidebarToggle}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700 mr-3 transition-colors"
                aria-label="Toggle sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center flex-1 min-w-0">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  {selectedFriend.avatar ? (
                    <img src={selectedFriend.avatar} alt={selectedFriend.username} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-white font-medium">{selectedFriend.username[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{selectedFriend.username}</h3>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${selectedFriend.isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}></div>
                    <p className="text-sm text-gray-500">{selectedFriend.isOnline ? "Online" : "Offline"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <MessageList messages={messages} currentUserId={user._id} />

            {/* Message Input */}
            <MessageInput onSendMessage={handleSendMessage} disabled={!socketConnected} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <button
              onClick={handleSidebarToggle}
              className="lg:hidden fixed top-4 left-4 p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg z-30 transition-all hover:scale-110"
              aria-label="Toggle sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Welcome to SwiftTalk
              </h3>
              <p className="text-gray-600 mb-4">Select a friend to start chatting</p>
              {friends.length === 0 && (
                <div className="mt-4">
                  <p className="text-gray-500 mb-2">You don't have any friends yet</p>
                  <button
                    onClick={() => setShowAddFriend(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
                  >
                    Add Your First Friend
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddFriend && (
        <AddFriend onClose={() => setShowAddFriend(false)} onFriendAdded={onFriendAdded} />
      )}

      {showFriendRequests && (
        <FriendRequests onClose={() => setShowFriendRequests(false)} onRequestHandled={onRequestHandled} />
      )}
    </div>
  );
}