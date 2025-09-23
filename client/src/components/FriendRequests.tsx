import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';

interface FriendRequest {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  requestId: string;
  requestedAt: Date;
}

interface FriendRequestsProps {
  readonly onClose: () => void;
  readonly onRequestHandled: () => void;
}

// Proper error type instead of any
interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function FriendRequests({ onClose, onRequestHandled }: FriendRequestsProps) {
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const [pendingResponse, sentResponse] = await Promise.all([
        api.get('/users/friends/requests/pending'),
        api.get('/users/friends/requests/sent')
      ]);

      if (pendingResponse.data.success) {
        setPendingRequests(pendingResponse.data.data || []);
      }

      if (sentResponse.data.success) {
        setSentRequests(sentResponse.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load requests:', error);
      toast.error('Failed to load friend requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      const response = await api.put(`/users/friends/requests/${requestId}/accept`);
      
      if (response.data.success) {
        toast.success('Friend request accepted!');
        setPendingRequests(prev => prev.filter(req => req.requestId !== requestId));
        onRequestHandled();
      }
    } catch (error) {
      console.error('Failed to accept request:', error);
      
      const apiError = error as ApiError;
      const message = apiError.response?.data?.message || 'Failed to accept friend request';
      toast.error(message);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      const response = await api.put(`/users/friends/requests/${requestId}/decline`);
      
      if (response.data.success) {
        toast.success('Friend request declined');
        setPendingRequests(prev => prev.filter(req => req.requestId !== requestId));
        onRequestHandled();
      }
    } catch (error) {
      console.error('Failed to decline request:', error);
      
      const apiError = error as ApiError;
      const message = apiError.response?.data?.message || 'Failed to decline friend request';
      toast.error(message);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      const response = await api.put(`/users/friends/requests/${requestId}/decline`);
      
      if (response.data.success) {
        toast.success('Friend request cancelled');
        setSentRequests(prev => prev.filter(req => req.requestId !== requestId));
        onRequestHandled();
      }
    } catch (error) {
      console.error('Failed to cancel request:', error);
      
      const apiError = error as ApiError;
      const message = apiError.response?.data?.message || 'Failed to cancel friend request';
      toast.error(message);
    } finally {
      setProcessingRequest(null);
    }
  };

  const formatDate = (dateString: Date | string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hour${Math.floor(diffInHours) > 1 ? 's' : ''} ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)} day${Math.floor(diffInHours / 24) > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading friend requests...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Friend Requests</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'received'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Received ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'sent'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sent ({sentRequests.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'received' ? (
            <div className="space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No pending friend requests</p>
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <div key={request.requestId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        {request.avatar ? (
                          <img 
                            src={request.avatar} 
                            alt={request.username} 
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="font-medium text-gray-600">
                            {request.username[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{request.username}</p>
                        <p className="text-sm text-gray-500">{formatDate(request.requestedAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.requestId)}
                        disabled={processingRequest === request.requestId}
                        className="btn btn-primary text-sm px-3 py-1 disabled:opacity-50"
                      >
                        {processingRequest === request.requestId ? 'Processing...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(request.requestId)}
                        disabled={processingRequest === request.requestId}
                        className="btn btn-secondary text-sm px-3 py-1 disabled:opacity-50"
                      >
                        {processingRequest === request.requestId ? 'Processing...' : 'Decline'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sentRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No sent friend requests</p>
                </div>
              ) : (
                sentRequests.map((request) => (
                  <div key={request.requestId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        {request.avatar ? (
                          <img 
                            src={request.avatar} 
                            alt={request.username} 
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="font-medium text-gray-600">
                            {request.username[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{request.username}</p>
                        <p className="text-sm text-gray-500">Sent {formatDate(request.requestedAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                        Pending
                      </span>
                      <button
                        onClick={() => handleCancelRequest(request.requestId)}
                        disabled={processingRequest === request.requestId}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                      >
                        {processingRequest === request.requestId ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="btn btn-secondary w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}