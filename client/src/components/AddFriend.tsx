import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';

interface AddFriendProps {
  readonly onClose: () => void;
  readonly onFriendAdded: () => void;
}

interface SearchResult {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
}

export default function AddFriend({ onClose, onFriendAdded }: AddFriendProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  
  // Use ref for timeout to avoid dependency issues
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on component unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.get(`/users/search?q=${encodeURIComponent(query.trim())}&limit=5`);
      if (response.data.success) {
        setSearchResults(response.data.data || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    
    // Clear selected user when typing
    if (selectedUser) {
      setSelectedUser(null);
    }

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for search
    if (value.trim().length >= 2 && !selectedUser) {
      searchTimeoutRef.current = setTimeout(() => {
        searchUsers(value);
      }, 500);
    } else {
      setSearchResults([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser && !username.trim()) {
      toast.error('Please select a user or enter a username');
      return;
    }

    setLoading(true);

    try {
      const usernameToSend = selectedUser ? selectedUser.username : username.trim();
      
      const response = await api.post('/users/friends/request', {
        username: usernameToSend
      });

      if (response.data.success) {
        toast.success('Friend request sent!');
        onFriendAdded();
        onClose();
      } else {
        toast.error(response.data.message || 'Failed to send friend request');
      }
    } catch (error: unknown) {
      console.error('Failed to send friend request:', error);
      
      let message = 'Failed to send friend request';
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
        message = axiosError.response?.data?.message || 
                 axiosError.response?.data?.error || 
                 'Failed to send friend request';
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: SearchResult) => {
    // Clear timeout when user is selected
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    setSelectedUser(user);
    setUsername(user.username);
    setSearchResults([]);
  };

  const clearSelection = () => {
    setSelectedUser(null);
    setUsername('');
    setSearchResults([]);
  };

  // Determine if we should show "No users found" message
  const shouldShowNoResults = username.trim().length >= 2 && 
                              !searching && 
                              !selectedUser && 
                              searchResults.length === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Friend</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4 relative">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Search Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={handleInputChange}
              required
              className="form-input"
              placeholder="Type username to search..."
              autoFocus
              autoComplete="off"
            />
            
            {/* Search Results Dropdown */}
            {searchResults.length > 0 && !selectedUser && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                {searchResults.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => handleUserSelect(user)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-blue-50"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        {user.avatar ? (
                          <img 
                            src={user.avatar} 
                            alt={user.username} 
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-600">
                            {user.username[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Loading indicator */}
            {searching && (
              <div className="absolute right-3 top-9 text-gray-400">
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
              </div>
            )}
            
            {/* No results message */}
            {shouldShowNoResults && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 p-3 shadow-lg">
                <p className="text-gray-500 text-sm">No users found matching "{username}"</p>
              </div>
            )}
          </div>

          {/* Selected user display */}
          {selectedUser && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                  {selectedUser.avatar ? (
                    <img 
                      src={selectedUser.avatar} 
                      alt={selectedUser.username} 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="font-medium text-gray-600">
                      {selectedUser.username[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{selectedUser.username}</p>
                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-gray-400 hover:text-gray-600"
                  title="Clear selection"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || (!selectedUser && !username.trim())}
              className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}