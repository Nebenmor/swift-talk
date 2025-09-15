import { User } from '../models/User';
import { Friendship } from '../models/Friendship';
import { Message } from '../models/Message';
import { FriendResponse, IUser } from '../types';

export class UserService {
  static async searchUsers(
    query: string,
    currentUserId: string,
    limit = 10
  ): Promise<IUser[]> {
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

  static async getUserById(userId: string): Promise<IUser | null> {
    const user = await User.findById(userId).select('-password').lean();
    return user;
  }

  static async getUserByUsername(username: string): Promise<IUser | null> {
    const user = await User.findOne({ username: username.toLowerCase() })
      .select('-password')
      .lean();
    return user;
  }

  static async getFriends(userId: string): Promise<FriendResponse[]> {
    const friends = await Friendship.getFriends(userId) as any[];
    
    return friends.map((friend) => ({
      _id: friend._id,
      username: friend.username,
      email: friend.email,
      avatar: friend.avatar,
      isOnline: friend.isOnline,
      lastSeen: friend.lastSeen,
      friendshipStatus: 'accepted' as const,
    }));
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
    const pendingRequests = await Friendship.getPendingRequests(userId);
    return pendingRequests;
  }

  static async getSentFriendRequests(userId: string) {
    const sentRequests = await Friendship.getSentRequests(userId);
    return sentRequests;
  }

  static async acceptFriendRequest(
    userId: string,
    requestId: string
  ): Promise<void> {
    await Friendship.acceptRequest(requestId, userId);
  }

  static async declineFriendRequest(
    userId: string,
    requestId: string
  ): Promise<void> {
    await Friendship.declineRequest(requestId, userId);
  }

  static async removeFriend(
    userId: string,
    friendId: string
  ): Promise<void> {
    await Friendship.removeFriendship(userId, friendId);
  }

  static async blockUser(
    blockerId: string,
    blockedId: string
  ): Promise<void> {
    await Friendship.blockUser(blockerId, blockedId);
  }

  static async updateOnlineStatus(
    userId: string,
    isOnline: boolean
  ): Promise<void> {
    const user = await User.findById(userId);
    if (user) {
      await user.setOnlineStatus(isOnline);
    }
  }

  static async getOnlineFriends(userId: string): Promise<FriendResponse[]> {
    const friends = await this.getFriends(userId);
    return friends.filter(friend => friend.isOnline);
  }

  static async getFriendshipStatus(
    userId: string,
    otherUserId: string
  ): Promise<string | null> {
    return await Friendship.getFriendshipStatus(userId, otherUserId);
  }

  static async getUserStats(userId: string) {
    const [friendsCount, unreadMessagesCount] = await Promise.all([
      Friendship.countDocuments({
        $or: [
          { requester: userId, status: 'accepted' },
          { recipient: userId, status: 'accepted' },
        ],
      }),
      Message.getUnreadCount(userId),
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
        const lastMessage = await Message.getLatestMessage(userId, friend._id);
        const unreadCount = await Message.getUnreadCount(userId, friend._id);
        
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
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });
  }
}