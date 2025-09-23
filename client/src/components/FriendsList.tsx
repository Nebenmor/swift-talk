import type { Friend, Message } from '../types';

interface FriendsListProps {
  readonly friends: Friend[];
  readonly selectedFriend: Friend | null;
  readonly onFriendSelect: (friend: Friend) => void;
}

export default function FriendsList({ friends, selectedFriend, onFriendSelect }: FriendsListProps) {
  // Properly typed message parameter
  const formatLastMessage = (message: Message | undefined): string => {
    if (!message) return 'No messages yet';
    return message.messageType === 'file' ? 'File' : message.content;
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent, friend: Friend) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onFriendSelect(friend);
    }
  };

  if (friends.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No friends yet</p>
        <p className="text-sm">Add some friends to start chatting!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {friends.map((friend) => (
        <button
          key={friend._id}
          onClick={() => onFriendSelect(friend)}
          onKeyDown={(e) => handleKeyDown(e, friend)}
          className={`w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-50 ${
            selectedFriend?._id === friend._id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
          }`}
          tabIndex={0}
          aria-pressed={selectedFriend?._id === friend._id}
        >
          <div className="flex items-center">
            <div className="relative">
              <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                {friend.username[0].toUpperCase()}
              </div>
              {friend.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900 truncate">
                  {friend.username}
                </p>
                {friend.lastMessage && (
                  <p className="text-xs text-gray-500">
                    {formatTime(friend.lastMessage.createdAt.toString())}
                  </p>
                )}
              </div>
              <p className="text-sm text-gray-600 truncate">
                {formatLastMessage(friend.lastMessage)}
              </p>
            </div>
            {friend.unreadCount && friend.unreadCount > 0 && (
              <div className="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                {friend.unreadCount}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}