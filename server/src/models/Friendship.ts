import mongoose, { Schema } from 'mongoose';
import { IFriendshipDocument } from '../types';

const friendshipSchema = new Schema<IFriendshipDocument>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester is required'],
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'declined', 'blocked'],
        message: 'Status must be one of: pending, accepted, declined, blocked',
      },
      default: 'pending',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index to ensure unique friendship relationships
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ recipient: 1, status: 1 });
friendshipSchema.index({ requester: 1, status: 1 });

// Prevent duplicate friendship requests
friendshipSchema.pre('save', async function (next) {
  // Prevent self-friendship
  if (this.requester.toString() === this.recipient.toString()) {
    return next(new Error('Cannot send friend request to yourself'));
  }

  // Check for existing friendship in either direction
  const existingFriendship = await mongoose.model('Friendship').findOne({
    $or: [
      { requester: this.requester, recipient: this.recipient },
      { requester: this.recipient, recipient: this.requester },
    ],
  });

  if (existingFriendship && this.isNew) {
    return next(new Error('Friendship request already exists'));
  }

  next();
});

// Static method to check friendship status
friendshipSchema.statics.getFriendshipStatus = async function (
  userId1: string,
  userId2: string
): Promise<string | null> {
  const friendship = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
  });

  return friendship?.status || null;
};

// Static method to get all friends of a user
friendshipSchema.statics.getFriends = async function (userId: string) {
  const friendships = await this.find({
    $or: [
      { requester: userId, status: 'accepted' },
      { recipient: userId, status: 'accepted' },
    ],
  })
    .populate('requester', 'username email avatar isOnline lastSeen')
    .populate('recipient', 'username email avatar isOnline lastSeen')
    .lean();

  return friendships.map((friendship) => {
    // Return the friend (the other person in the friendship)
    const friend =
      friendship.requester._id.toString() === userId
        ? friendship.recipient
        : friendship.requester;

    return {
      ...friend,
      friendshipId: friendship._id,
      friendsSince: friendship.createdAt,
    };
  });
};

// Static method to get pending friend requests
friendshipSchema.statics.getPendingRequests = async function (userId: string) {
  const pendingRequests = await this.find({
    recipient: userId,
    status: 'pending',
  })
    .populate('requester', 'username email avatar isOnline lastSeen')
    .lean();

  return pendingRequests.map((request) => ({
    ...request.requester,
    requestId: request._id,
    requestedAt: request.createdAt,
  }));
};

// Static method to get sent friend requests
friendshipSchema.statics.getSentRequests = async function (userId: string) {
  const sentRequests = await this.find({
    requester: userId,
    status: 'pending',
  })
    .populate('recipient', 'username email avatar isOnline lastSeen')
    .lean();

  return sentRequests.map((request) => ({
    ...request.recipient,
    requestId: request._id,
    requestedAt: request.createdAt,
  }));
};

// Static method to accept friend request
friendshipSchema.statics.acceptRequest = async function (
  requestId: string,
  userId: string
) {
  const friendship = await this.findOneAndUpdate(
    {
      _id: requestId,
      recipient: userId,
      status: 'pending',
    },
    {
      status: 'accepted',
    },
    { new: true }
  ).populate('requester', 'username email avatar isOnline lastSeen');

  if (!friendship) {
    throw new Error('Friend request not found or already processed');
  }

  return friendship;
};

// Static method to decline friend request
friendshipSchema.statics.declineRequest = async function (
  requestId: string,
  userId: string
) {
  const friendship = await this.findOneAndUpdate(
    {
      _id: requestId,
      recipient: userId,
      status: 'pending',
    },
    {
      status: 'declined',
    },
    { new: true }
  );

  if (!friendship) {
    throw new Error('Friend request not found or already processed');
  }

  return friendship;
};

// Static method to remove friendship
friendshipSchema.statics.removeFriendship = async function (
  userId1: string,
  userId2: string
) {
  const result = await this.findOneAndDelete({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
  });

  if (!result) {
    throw new Error('Friendship not found');
  }

  return result;
};

// Static method to block user
friendshipSchema.statics.blockUser = async function (
  blockerId: string,
  blockedId: string
) {
  // Find existing friendship or create new one with blocked status
  const friendship = await this.findOneAndUpdate(
    {
      $or: [
        { requester: blockerId, recipient: blockedId },
        { requester: blockedId, recipient: blockerId },
      ],
    },
    {
      status: 'blocked',
      requester: blockerId,
      recipient: blockedId,
    },
    {
      new: true,
      upsert: true,
    }
  );

  return friendship;
};

export const Friendship = mongoose.model<IFriendshipDocument>(
  'Friendship',
  friendshipSchema
);
