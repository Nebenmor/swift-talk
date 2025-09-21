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

  // Update refs when state changes
  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  useEffect(() => {
    selectedFriendRef.current = selectedFriend;
  }, [selectedFriend]);

  // Load friends from API with debouncing
  const loadFriends = useCallback(async () => {
    if (loadingFriendsRef.current) return;

    loadingFriendsRef.current = true;
    try {
      const response = await api.get('/users/friends/with-messages');
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

  // Load chat messages
  const loadMessages = useCallback(async (friendId: string) => {
    try {
      const response = await api.get(`/chat/history/${friendId}`);
      if (response.data.success) {
        // Remove duplicates and sort by creation time
        const uniqueMessages = response.data.data.data?.reduce((acc: Message[], msg: Message) => {
          if (!acc.find(m => m._id === msg._id)) {
            acc.push(msg);
          }
          return acc;
        }, []) || [];
        
        // Sort messages by creation time (oldest first)
        const sortedMessages = uniqueMessages.sort((a: Message, b: Message) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        setMessages(sortedMessages);
        
        // Mark messages as read
        try {
          await api.put(`/chat/messages/${friendId}/read`);
        } catch (readError) {
          console.error("Failed to mark messages as read:", readError);
        }
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Failed to load messages");
    }
  }, []);

  // FIXED: Message handler with proper typing
  const handleNewMessage = useCallback((data: unknown) => {
    const message = data as Message;
    console.log('New message received via socket:', message);
    
    const currentUser = currentUserRef.current;
    const currentSelectedFriend = selectedFriendRef.current;
    
    if (!currentUser) return;

    // Add message to current chat if it's relevant
    setMessages(prevMessages => {
      // Check if message already exists
      const messageExists = prevMessages.some(msg => msg._id === message._id);
      if (messageExists) {
        console.log('Message already exists, skipping...');
        return prevMessages;
      }
      
      // Only add message if it's part of the current conversation
      const isRelevantToCurrentChat = currentSelectedFriend && (
        (message.sender._id === currentUser._id && message.recipient === currentSelectedFriend._id) ||
        (message.sender._id === currentSelectedFriend._id && message.recipient === currentUser._id)
      );
      
      if (isRelevantToCurrentChat) {
        const newMessages = [...prevMessages, message];
        return newMessages.sort((a: Message, b: Message) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      
      return prevMessages;
    });
    
    // Update friends list after delay
    setTimeout(() => {
      if (!loadingFriendsRef.current) {
        loadFriends();
      }
    }, 1000);
    
    // Show notifications for messages from others
    if (message.sender._id !== currentUser._id) {
      const isFile = message.messageType === 'file';
      NotificationService.showMessageNotification(
        message.sender.username,
        message.content,
        isFile
      );
      
      toast.success(`New message from ${message.sender.username}`, {
        icon: '💬',
        duration: 3000,
      });
    }
  }, [loadFriends]);

  // FIXED: Friend status handler with proper typing
  const handleFriendStatusUpdate = useCallback((data: unknown) => {
    const statusData = data as { userId: string; isOnline: boolean };
    const { userId, isOnline } = statusData;
    
    setFriends((prev) =>
      prev.map((friend) =>
        friend._id === userId ? { ...friend, isOnline } : friend
      )
    );
    
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

  // Initialize everything once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initializeApp = async () => {
      const currentUser = getUser();
      
      if (!currentUser) {
        navigate('/login');
        return;
      }

      setUser(currentUser);
      
      try {
        // Initialize notifications
        await NotificationService.requestPermission();
        
        // Load initial data
        await loadFriends();
        
        // Set up socket connection
        await socketService.connect();
        
        // Set up socket event listeners with proper typing
        socketService.on("connect", () => {
          console.log('Socket connected');
          setSocketConnected(true);
        });
        
        socketService.on("disconnect", () => {
          console.log('Socket disconnected');
          setSocketConnected(false);
        });
        
        socketService.on("connect_error", (error: unknown) => {
          console.error('Socket connection error:', error);
          setSocketConnected(false);
        });
        
        // FIXED: Use the properly typed handlers
        socketService.on("new_message", handleNewMessage);
        socketService.on("friend_status_update", handleFriendStatusUpdate);
        
        setSocketConnected(socketService.isConnected());
        
      } catch (error) {
        console.error("Failed to initialize SwiftTalk:", error);
        toast.error("Failed to initialize SwiftTalk. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    initializeApp();

    // Cleanup function
    return () => {
      socketService.off("connect");
      socketService.off("disconnect");
      socketService.off("connect_error");
      socketService.off("new_message");
      socketService.off("friend_status_update");
      socketService.disconnect();
    };
  }, [navigate, loadFriends, handleNewMessage, handleFriendStatusUpdate]);

  const handleFriendSelect = (friend: Friend) => {
    setSelectedFriend(friend);
    loadMessages(friend._id);
    setSidebarOpen(false);
  };

  const handleSendMessage = async (content: string, messageType: 'text' | 'file' = 'text', fileData?: unknown) => {
    if (!selectedFriend || !user) return;

    try {
      // FIXED: Properly structure the request data to match backend expectations
      const requestData: Record<string, unknown> = {
        recipient: selectedFriend._id,
        content,
        messageType,
      };

      // FIXED: Add file data properly for file messages
      if (messageType === 'file' && fileData && typeof fileData === 'object' && fileData !== null) {
        const fileInfo = fileData as { fileUrl: string; fileName: string; fileSize: number };
        requestData.fileUrl = fileInfo.fileUrl;
        requestData.fileName = fileInfo.fileName;
        requestData.fileSize = fileInfo.fileSize;
      }

      const response = await api.post('/chat/messages', requestData);

      if (response.data.success) {
        const newMessage = response.data.data;
        
        // FIXED: Only add message if it doesn't already exist (prevent duplicates)
        setMessages(prevMessages => {
          const messageExists = prevMessages.some(msg => msg._id === newMessage._id);
          if (!messageExists) {
            const updatedMessages = [...prevMessages, newMessage];
            return updatedMessages.sort((a: Message, b: Message) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          }
          return prevMessages;
        });
        
        // FIXED: Don't emit via socket - the backend will handle broadcasting
        // The socket emission was causing duplicate messages
        
        // Update friends list after a delay
        setTimeout(() => {
          if (!loadingFriendsRef.current) {
            loadFriends();
          }
        }, 500);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message via SwiftTalk");
    }
  };

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
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary"
          >
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
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:w-1/3 lg:max-w-sm
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white font-medium">{user.username[0].toUpperCase()}</span>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm md:text-base">{user.username}</h2>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <p className="text-xs text-gray-500">
                    {socketConnected ? 'Connected' : 'Connecting...'}
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 transition-colors"
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
          <button
            onClick={() => setShowFriendRequests(true)}
            className="btn btn-secondary text-xs flex-1 transition-all hover:scale-105"
          >
            Requests
          </button>
          <button
            onClick={() => setShowAddFriend(true)}
            className="btn btn-primary text-xs flex-1 transition-all hover:scale-105"
          >
            Add Friend
          </button>
          <button
            onClick={handleLogout}
            className="btn btn-secondary text-xs px-3 transition-all hover:scale-105"
          >
            Logout
          </button>
        </div>

        {/* Connection Status Warning */}
        {!socketConnected && (
          <div className="p-2 bg-yellow-50 border-b border-yellow-200">
            <p className="text-xs text-yellow-800 text-center">
              Real-time messaging temporarily unavailable
            </p>
          </div>
        )}

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto">
          <FriendsList
            friends={friends}
            selectedFriend={selectedFriend}
            onFriendSelect={handleFriendSelect}
          />
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
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center flex-1 min-w-0">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  {selectedFriend.avatar ? (
                    <img
                      src={selectedFriend.avatar}
                      alt={selectedFriend.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-medium">{selectedFriend.username[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {selectedFriend.username}
                  </h3>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${selectedFriend.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    <p className="text-sm text-gray-500">
                      {selectedFriend.isOnline ? "Online" : "Offline"}
                    </p>
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
        <AddFriend
          onClose={() => setShowAddFriend(false)}
          onFriendAdded={onFriendAdded}
        />
      )}

      {showFriendRequests && (
        <FriendRequests
          onClose={() => setShowFriendRequests(false)}
          onRequestHandled={onRequestHandled}
        />
      )}
    </div>
  );
}