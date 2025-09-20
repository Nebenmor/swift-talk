// src/components/Chat.tsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import FriendsList from "./FriendsList";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import AddFriend from "./AddFriend";
import { getUser, removeToken, removeUser } from "../lib/auth";
import { socketService } from "../lib/socket";
import api from "../lib/api";
import type { User, Friend, Message } from "../types";

export default function Chat() {
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
        setMessages(response.data.data.data || []);
        
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
    if (
      selectedFriend &&
      (message.sender._id === selectedFriend._id ||
        message.recipient === selectedFriend._id)
    ) {
      setMessages((prev) => [...prev, message]);
    }
    // Only show toast for messages from others
    if (message.sender._id !== user?._id) {
      toast.success(`New message from ${message.sender.username}`);
    }
  }, [selectedFriend, user?._id]);

  // Handle friend status updates
  const handleFriendStatusUpdate = useCallback(
    ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setFriends((prev) =>
        prev.map((friend) =>
          friend._id === userId ? { ...friend, isOnline } : friend
        )
      );
    },
    []
  );

  // Initialize user and socket connection
  useEffect(() => {
    const initializeChat = async () => {
      const currentUser = getUser();
      
      if (!currentUser) {
        navigate('/login');
        return;
      }

      setUser(currentUser);
      
      try {
        // Connect socket
        socketService.connect();
        
        // Load initial data
        await loadFriends();
        
        // Set up socket event listeners
        socketService.on("new_message", handleNewMessage);
        socketService.on("friend_status_update", handleFriendStatusUpdate);
        
      } catch (error) {
        console.error("Failed to initialize chat:", error);
        toast.error("Failed to initialize chat");
      } finally {
        setLoading(false);
      }
    };

    initializeChat();

    // Cleanup function
    return () => {
      socketService.off("new_message");
      socketService.off("friend_status_update");
      socketService.disconnect();
    };
  }, [navigate, loadFriends, handleNewMessage, handleFriendStatusUpdate]);

  const handleFriendSelect = (friend: Friend) => {
    setSelectedFriend(friend);
    loadMessages(friend._id);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedFriend || !user) return;

    try {
      const response = await api.post('/chat/messages', {
        recipient: selectedFriend._id,
        content,
      });

      if (response.data.success) {
        // Add message to local state immediately
        setMessages((prev) => [...prev, response.data.data]);
        
        // Emit via socket for real-time delivery
        socketService.emit("send_message", {
          recipientId: selectedFriend._id,
          content,
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
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

  const onFriendAdded = () => {
    loadFriends();
    setShowAddFriend(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
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
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">No user session found</p>
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary mt-4"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{user.username}</h2>
            <p className="text-sm text-gray-500">Online</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddFriend}
              className="btn btn-primary text-sm"
            >
              Add Friend
            </button>
            <button
              onClick={handleLogout}
              className="btn btn-secondary text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto">
          <FriendsList
            friends={friends}
            selectedFriend={selectedFriend}
            onFriendSelect={handleFriendSelect}
          />
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedFriend ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  {selectedFriend.username[0].toUpperCase()}
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">
                    {selectedFriend.username}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedFriend.isOnline ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <MessageList messages={messages} currentUserId={user._id} />
            </div>

            {/* Message Input */}
            <MessageInput onSendMessage={handleSendMessage} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Welcome to Chat App
              </h3>
              <p className="text-gray-600">Select a friend to start chatting</p>
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
    </div>
  );
}