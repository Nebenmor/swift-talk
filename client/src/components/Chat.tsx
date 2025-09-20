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
  const isInitialized = useRef(false);
  const socketListenersSetup = useRef(false);

  // Load friends from API
  const loadFriends = useCallback(async () => {
    try {
      const response = await api.get('/users/friends/with-messages');
      if (response.data.success) {
        setFriends(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to load friends:", error);
      toast.error("Failed to load friends");
    }
  }, []);

  // Load chat messages
  const loadMessages = useCallback(async (friendId: string) => {
    try {
      const response = await api.get(`/chat/history/${friendId}`);
      if (response.data.success) {
        // Remove duplicates based on message ID
        const uniqueMessages = response.data.data.data?.filter((msg: Message, index: number, arr: Message[]) => 
          arr.findIndex(m => m._id === msg._id) === index
        ) || [];
        
        setMessages(uniqueMessages);
        
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

  // Handle new message from socket
  const handleNewMessage = useCallback((message: Message) => {
    console.log('New message received:', message);
    
    // Only add message if it's for the current chat
    if (selectedFriend && 
        (message.sender._id === selectedFriend._id || message.recipient === selectedFriend._id)) {
      
      setMessages(prevMessages => {
        // Check if message already exists to prevent duplicates
        const messageExists = prevMessages.some(msg => msg._id === message._id);
        if (messageExists) {
          return prevMessages;
        }
        
        // Add new message
        return [...prevMessages, message];
      });
    }
    
    // Always update friends list to show latest message
    loadFriends();
    
    // Show notifications for messages from others
    if (message.sender._id !== user?._id) {
      // Show desktop notification
      const isFile = message.messageType === 'file';
      NotificationService.showMessageNotification(
        message.sender.username,
        message.content,
        isFile
      );
      
      // Show toast only if not in current chat
      if (!selectedFriend || selectedFriend._id !== message.sender._id) {
        toast.success(`💬 New message from ${message.sender.username}`, {
          icon: '🔔',
          duration: 4000,
        });
      }
    }
  }, [selectedFriend, user?._id, loadFriends]);

  // Handle friend status updates
  const handleFriendStatusUpdate = useCallback(
    ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setFriends((prev) =>
        prev.map((friend) =>
          friend._id === userId ? { ...friend, isOnline } : friend
        )
      );
      
      // Update selected friend status as well
      if (selectedFriend && selectedFriend._id === userId) {
        setSelectedFriend(prev => prev ? { ...prev, isOnline } : null);
      }

      // Show notification for friends coming online (less intrusive)
      if (isOnline) {
        const friend = friends.find(f => f._id === userId);
        if (friend) {
          NotificationService.showFriendOnlineNotification(friend.username);
        }
      }
    },
    [selectedFriend, friends]
  );

  // Handle socket connection
  const handleSocketConnection = useCallback(() => {
    console.log('Socket connected successfully');
    setSocketConnected(true);
  }, []);

  const handleSocketDisconnection = useCallback(() => {
    console.log('Socket disconnected');
    setSocketConnected(false);
  }, []);

  const handleSocketError = useCallback((error: any) => {
    console.error('Socket connection error:', error);
    setSocketConnected(false);
  }, []);

  // Setup socket event listeners only once
  const setupSocketListeners = useCallback(() => {
    if (socketListenersSetup.current) return;
    
    const connectAndSetupListeners = async () => {
      try {
        await socketService.connect();
        
        socketService.on("connect", handleSocketConnection);
        socketService.on("disconnect", handleSocketDisconnection);
        socketService.on("connect_error", handleSocketError);
        socketService.on("new_message", handleNewMessage);
        socketService.on("friend_status_update", handleFriendStatusUpdate);
        
        setSocketConnected(socketService.isConnected());
        socketListenersSetup.current = true;
      } catch (error) {
        console.error("Failed to connect socket and setup listeners:", error);
      }
    };
    
    connectAndSetupListeners();
  }, [handleSocketConnection, handleSocketDisconnection, handleSocketError, handleNewMessage, handleFriendStatusUpdate]);

  // Initialize user and socket connection
  useEffect(() => {
    if (isInitialized.current) return;

    const initializeChat = async () => {
      const currentUser = getUser();
      
      if (!currentUser) {
        navigate('/login');
        return;
      }

      setUser(currentUser);
      
      try {
        // Initialize notifications
        await NotificationService.requestPermission();
        
        setupSocketListeners();
        await loadFriends();
        isInitialized.current = true;
      } catch (error) {
        console.error("Failed to initialize chat:", error);
        toast.error("Failed to initialize chat. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    initializeChat();

    return () => {
      if (isInitialized.current) {
        socketService.off("connect", handleSocketConnection);
        socketService.off("disconnect", handleSocketDisconnection);  
        socketService.off("connect_error", handleSocketError);
        socketService.off("new_message", handleNewMessage);
        socketService.off("friend_status_update", handleFriendStatusUpdate);
        socketService.disconnect();
        isInitialized.current = false;
        socketListenersSetup.current = false;
      }
    };
  }, [navigate, loadFriends, setupSocketListeners, handleSocketConnection, handleSocketDisconnection, handleSocketError, handleNewMessage, handleFriendStatusUpdate]);

  // Monitor socket connection status
  useEffect(() => {
    const checkSocketStatus = () => {
      setSocketConnected(socketService.isConnected());
    };

    const interval = setInterval(checkSocketStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleFriendSelect = (friend: Friend) => {
    setSelectedFriend(friend);
    loadMessages(friend._id);
    // Close sidebar on mobile after selecting friend
    setSidebarOpen(false);
  };

  const handleSendMessage = async (content: string, messageType: 'text' | 'file' = 'text', fileData?: any) => {
    if (!selectedFriend || !user) return;

    try {
      const requestData: any = {
        recipient: selectedFriend._id,
        content,
        messageType,
      };

      // Add file data if it's a file message
      if (messageType === 'file' && fileData) {
        requestData.fileUrl = fileData.fileUrl;
        requestData.fileName = fileData.fileName;
        requestData.fileSize = fileData.fileSize;
      }

      const response = await api.post('/chat/messages', requestData);

      if (response.data.success) {
        const newMessage = response.data.data;
        
        // Add message to local state immediately to avoid waiting for socket
        setMessages(prevMessages => {
          const messageExists = prevMessages.some(msg => msg._id === newMessage._id);
          if (!messageExists) {
            return [...prevMessages, newMessage];
          }
          return prevMessages;
        });
        
        // Emit via socket for real-time delivery to other user
        if (socketConnected) {
          const socketData: any = {
            recipientId: selectedFriend._id,
            content,
            messageType,
          };

          if (messageType === 'file' && fileData) {
            socketData.fileData = fileData;
          }

          socketService.emit("send_message", socketData);
        }

        // Update friends list to reflect latest message
        setTimeout(loadFriends, 100); // Small delay to ensure backend is updated
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
    toast.success("Logged out successfully");
  };

  const handleAddFriend = () => {
    setShowAddFriend(true);
  };

  const handleShowFriendRequests = () => {
    setShowFriendRequests(true);
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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  // No user found
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">No user session found</p>
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary"
          >
            Go to Login
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
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                user.username[0].toUpperCase()
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm md:text-base">{user.username}</h2>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <p className="text-xs text-gray-500">
                  {socketConnected ? 'Connected' : 'Connecting...'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action buttons */}
        <div className="p-3 border-b border-gray-200 flex gap-2">
          <button
            onClick={handleShowFriendRequests}
            className="btn btn-secondary text-xs flex-1"
            title="Friend Requests"
          >
            Requests
          </button>
          <button
            onClick={handleAddFriend}
            className="btn btn-primary text-xs flex-1"
            title="Add Friend"
          >
            Add Friend
          </button>
          <button
            onClick={handleLogout}
            className="btn btn-secondary text-xs px-3"
            title="Logout"
          >
            Logout
          </button>
        </div>

        {/* Connection Status Warning */}
        {!socketConnected && (
          <div className="p-2 bg-yellow-50 border-b border-yellow-200">
            <p className="text-xs text-yellow-800 text-center">
              Connection issues detected. Messages may not be delivered in real-time.
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
              {/* Mobile menu button */}
              <button
                onClick={toggleSidebar}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700 mr-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center flex-1 min-w-0">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                  {selectedFriend.avatar ? (
                    <img
                      src={selectedFriend.avatar}
                      alt={selectedFriend.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    selectedFriend.username[0].toUpperCase()
                  )}
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {selectedFriend.username}
                  </h3>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${selectedFriend.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
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
            {/* Mobile menu button */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden fixed top-4 left-4 p-3 bg-blue-600 text-white rounded-full shadow-lg z-30"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Welcome to SwiftTalk
              </h3>
              <p className="text-gray-600 mb-4">Select a friend to start chatting</p>
              {friends.length === 0 && (
                <div className="mt-4">
                  <p className="text-gray-500 mb-2">You don't have any friends yet</p>
                  <button
                    onClick={handleAddFriend}
                    className="btn btn-primary"
                  >
                    Add Your First Friend
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <AddFriend
          onClose={() => setShowAddFriend(false)}
          onFriendAdded={onFriendAdded}
        />
      )}

      {/* Friend Requests Modal */}
      {showFriendRequests && (
        <FriendRequests
          onClose={() => setShowFriendRequests(false)}
          onRequestHandled={onRequestHandled}
        />
      )}
    </div>
  );
}