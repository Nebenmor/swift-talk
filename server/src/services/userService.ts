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
          throw new Error('Friend request already sent');
        case 'accepted':
          throw new Error('Already friends');
        case 'declined':
          throw new Error('Friend request was declined');
        case 'blocked':
          throw new Error('Cannot send friend request');
      }
    }

    // Create friend request
    const friendship = new Friendship({
      requester: requesterId,
      recipient: recipient._id,
      status: 'pending',
    });

    await friendship.save();
  }

  static async getPendingFriendRequests(userId: string) {
    // Direct query instead of missing custom method
    const pendingRequests = await Friendship.find({
      recipient: userId,
      status: 'pending'
    })
    .populate('requester', 'username avatar')
    .lean();

    return pendingRequests;
  }

  static async getSentFriendRequests(userId: string) {
    // Direct query instead of missing custom method
    const sentRequests = await Friendship.find({
      requester: userId,
      status: 'pending'
    })
    .populate('recipient', 'username avatar')
    .lean();

    return sentRequests;
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
      throw new Error('Not authorized to accept this request');
    }

    if (friendship.status !== 'pending') {
      throw new Error('Request already processed');
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
      throw new Error('Not authorized to decline this request');
    }

    if (friendship.status !== 'pending') {
      throw new Error('Request already processed');
    }

    await Friendship.findByIdAndDelete(requestId);
  }

  static async removeFriend(
    userId: string,
    friendId: string
  ): Promise<void> {
    await Friendship.findOneAndDelete({
      $or: [
        { requester: userId, recipient: friendId, status: 'accepted' },
        { requester: friendId, recipient: userId, status: 'accepted' }
      ]
    });
  }

  static async blockUser(
    blockerId: string,
    blockedId: string
  ): Promise<void> {
    // Remove existing friendship if any
    await Friendship.findOneAndDelete({
      $or: [
        { requester: blockerId, recipient: blockedId },
        { requester: blockedId, recipient: blockerId }
      ]
    });

    // Create block relationship
    const blockFriendship = new Friendship({
      requester: blockerId,
      recipient: blockedId,
      status: 'blocked'
    });

    await blockFriendship.save();
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

    return friendship.status;
  }

  static async getUserStats(userId: string) {
    const [friendsCount, unreadMessagesCount] = await Promise.all([
      Friendship.countDocuments({
        $or: [
          { requester: userId, status: 'accepted' },
          { recipient: userId, status: 'accepted' },
        ],
      }),
      Message.countDocuments({
        recipient: userId,
        isRead: false
      })
    ]);

    return {
      friendsCount,
      unreadMessagesCount,
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