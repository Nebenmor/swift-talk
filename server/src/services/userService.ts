import { User } from '../models/User';
import { Friendship } from '../models/Friendship';
import { Message } from '../models/Message';
import { FriendResponse, IUserResponse } from '../types';

export class UserService {
  static async searchUsers(
    query: string,
    currentUserId: string,
    limit = 10
  ): Promise<IUserResponse[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    
    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { username: searchRegex },
        { email: searchRegex },
      ],
    })
      .select('-password')
      .limit(limit)
      .lean();

    return users;
  }

  static async getUserById(userId: string): Promise<IUserResponse | null> {
    const user = await User.findById(userId).select('-password').lean();
    return user;
  }

  static async getUserByUsername(username: string): Promise<IUserResponse | null> {
    const user = await User.findOne({ username: username.toLowerCase() })
      .select('-password')
      .lean();
    return user;
  }

  static async getFriends(userId: string): Promise<FriendResponse[]> {
    // Use direct MongoDB query instead of missing custom method
    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: 'accepted' },
        { recipient: userId, status: 'accepted' }
      ]
    })
    .populate('requester', 'username email avatar isOnline lastSeen')
    .populate('recipient', 'username email avatar isOnline lastSeen')
    .lean();

    const friends = friendships.map(friendship => {
      const friend = (friendship.requester as any)._id.toString() === userId 
        ? friendship.recipient as any
        : friendship.requester as any;
      
      return {
        _id: friend._id.toString(),
        username: friend.username,
        email: friend.email,
        avatar: friend.avatar,
        isOnline: friend.isOnline,
        lastSeen: friend.lastSeen,
        friendshipStatus: 'accepted' as const,
      };
    });

    return friends;
  }

  static async sendFriendRequest(
    requesterId: string,
    recipientUsername: string
  ): Promise<void> {
    // Find recipient user
    const recipient = await User.findOne({ 
      username: recipientUsername.toLowerCase() 
    });
    
    if (!recipient) {
      throw new Error('User not found');
    }

    if (recipient._id.toString() === requesterId) {
      throw new Error('Cannot send friend request to yourself');
    }

    // Check if friendship already exists
    const existingFriendship = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: recipient._id },
        { requester: recipient._id, recipient: requesterId },
      ],
    });

    if (existingFriendship) {
      switch (existingFriendship.status) {
        case 'pending':
          // Check who sent the original request
          if (existingFriendship.requester.toString() === requesterId) {
            throw new Error('You have already sent a friend request to this user');
          } else {
            throw new Error('This user has already sent you a friend request. Please check your pending requests and accept it instead.');
          }
        case 'accepted':
          throw new Error('You are already friends with this user');
        case 'declined':
          // Allow sending a new request if the previous one was declined
          // But only if enough time has passed (optional: add time check)
          await Friendship.findByIdAndDelete(existingFriendship._id);
          break;
        case 'blocked':
          throw new Error('Cannot send friend request to this user');
      }
    }

    // Create friend request with better error handling
    try {
      const friendship = new Friendship({
        requester: requesterId,
        recipient: recipient._id,
        status: 'pending',
      });

      await friendship.save();
    } catch (error: any) {
      // Handle mongoose duplicate key error more gracefully
      if (error.code === 11000) {
        // This shouldn't happen due to our check above, but handle it anyway
        throw new Error('A friend request already exists between you and this user');
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  static async getPendingFriendRequests(userId: string) {
    // Direct query instead of missing custom method
    const pendingRequests = await Friendship.find({
      recipient: userId,
      status: 'pending'
    })
    .populate('requester', 'username email avatar isOnline lastSeen')
    .lean();

    return pendingRequests.map((request: any) => ({
      _id: request.requester._id,
      username: request.requester.username,
      email: request.requester.email,
      avatar: request.requester.avatar,
      isOnline: request.requester.isOnline,
      lastSeen: request.requester.lastSeen,
      requestId: request._id,
      requestedAt: request.createdAt,
    }));
  }

  static async getSentFriendRequests(userId: string) {
    // Direct query instead of missing custom method
    const sentRequests = await Friendship.find({
      requester: userId,
      status: 'pending'
    })
    .populate('recipient', 'username email avatar isOnline lastSeen')
    .lean();

    return sentRequests.map((request: any) => ({
      _id: request.recipient._id,
      username: request.recipient.username,
      email: request.recipient.email,
      avatar: request.recipient.avatar,
      isOnline: request.recipient.isOnline,
      lastSeen: request.recipient.lastSeen,
      requestId: request._id,
      requestedAt: request.createdAt,
    }));
  }

  static async acceptFriendRequest(
    userId: string,
    requestId: string
  ): Promise<void> {
    const friendship = await Friendship.findById(requestId);
    
    if (!friendship) {
      throw new Error('Friend request not found');
    }

    if (friendship.recipient.toString() !== userId) {
      throw new Error('You are not authorized to accept this friend request');
    }

    if (friendship.status !== 'pending') {
      throw new Error('This friend request has already been processed');
    }

    friendship.status = 'accepted';
    await friendship.save();
  }

  static async declineFriendRequest(
    userId: string,
    requestId: string
  ): Promise<void> {
    const friendship = await Friendship.findById(requestId);
    
    if (!friendship) {
      throw new Error('Friend request not found');
    }

    if (friendship.recipient.toString() !== userId) {
      throw new Error('You are not authorized to decline this friend request');
    }

    if (friendship.status !== 'pending') {
      throw new Error('This friend request has already been processed');
    }

    // Delete the friendship request instead of marking as declined
    await Friendship.findByIdAndDelete(requestId);
  }

  static async removeFriend(
    userId: string,
    friendId: string
  ): Promise<void> {
    const result = await Friendship.findOneAndDelete({
      $or: [
        { requester: userId, recipient: friendId, status: 'accepted' },
        { requester: friendId, recipient: userId, status: 'accepted' }
      ]
    });

    if (!result) {
      throw new Error('Friendship not found or you are not friends with this user');
    }
  }

  static async blockUser(
    blockerId: string,
    blockedId: string
  ): Promise<void> {
    if (blockerId === blockedId) {
      throw new Error('Cannot block yourself');
    }

    // Remove existing friendship if any
    await Friendship.findOneAndDelete({
      $or: [
        { requester: blockerId, recipient: blockedId },
        { requester: blockedId, recipient: blockerId }
      ]
    });

    // Create block relationship
    try {
      const blockFriendship = new Friendship({
        requester: blockerId,
        recipient: blockedId,
        status: 'blocked'
      });

      await blockFriendship.save();
    } catch (error: any) {
      if (error.code === 11000) {
        // User is already blocked
        throw new Error('User is already blocked');
      }
      throw error;
    }
  }

  static async updateOnlineStatus(
    userId: string,
    isOnline: boolean
  ): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      isOnline,
      lastSeen: new Date()
    });
  }

  static async getOnlineFriends(userId: string): Promise<FriendResponse[]> {
    const friends = await this.getFriends(userId);
    return friends.filter(friend => friend.isOnline);
  }

  static async getFriendshipStatus(
    userId: string,
    otherUserId: string
  ): Promise<string | null> {
    const friendship = await Friendship.findOne({
      $or: [
        { requester: userId, recipient: otherUserId },
        { requester: otherUserId, recipient: userId }
      ]
    });

    if (!friendship) {
      return null;
    }

    // Return more detailed status information
    if (friendship.status === 'pending') {
      // Indicate who sent the request
      if (friendship.requester.toString() === userId) {
        return 'pending_sent';
      } else {
        return 'pending_received';
      }
    }

    return friendship.status;
  }

  static async getUserStats(userId: string) {
    const [friendsCount, unreadMessagesCount, sentRequestsCount, receivedRequestsCount] = await Promise.all([
      Friendship.countDocuments({
        $or: [
          { requester: userId, status: 'accepted' },
          { recipient: userId, status: 'accepted' },
        ],
      }),
      Message.countDocuments({
        recipient: userId,
        isRead: false
      }),
      Friendship.countDocuments({
        requester: userId,
        status: 'pending'
      }),
      Friendship.countDocuments({
        recipient: userId,
        status: 'pending'
      })
    ]);

    return {
      friendsCount,
      unreadMessagesCount,
      sentRequestsCount,
      receivedRequestsCount,
    };
  }

  static async getFriendsWithLastMessage(userId: string) {
    const friends = await this.getFriends(userId);
    
    const friendsWithMessages = await Promise.all(
      friends.map(async (friend) => {
        // Get latest message between users
        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, recipient: friend._id },
            { sender: friend._id, recipient: userId }
          ]
        })
        .sort({ createdAt: -1 })
        .populate('sender', 'username')
        .lean();

        // Get unread count
        const unreadCount = await Message.countDocuments({
          sender: friend._id,
          recipient: userId,
          isRead: false
        });
        
        return {
          ...friend,
          lastMessage,
          unreadCount,
        };
      })
    );

    // Sort by last message time (most recent first)
    return friendsWithMessages.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt || new Date()).getTime() - new Date(a.lastMessage.createdAt || new Date()).getTime();
    });
  }
}