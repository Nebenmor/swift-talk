import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageDocument extends Document {
  sender: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  content: string;
  messageType: 'text' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const messageSchema = new Schema<IMessageDocument>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    messageType: {
      type: String,
      enum: ['text', 'file'],
      default: 'text',
      required: true,
    },
    fileUrl: {
      type: String,
      required: function (this: IMessageDocument): boolean {
        return this.messageType === 'file';
      },
    },
    fileName: {
      type: String,
      required: function (this: IMessageDocument): boolean {
        return this.messageType === 'file';
      },
    },
    fileSize: {
      type: Number,
      min: [0, 'File size cannot be negative'],
      required: function (this: IMessageDocument): boolean {
        return this.messageType === 'file';
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for faster queries
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ recipient: 1, isRead: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });

// Virtual for chat room ID (sorted participant IDs)
messageSchema.virtual('chatRoom').get(function (this: IMessageDocument) {
  const participants = [this.sender.toString(), this.recipient.toString()];
  return [...participants].sort((a, b) => a.localeCompare(b)).join('-');
});

// Static method to get chat history between two users
messageSchema.statics.getChatHistory = async function (
  userId1: string,
  userId2: string,
  page: number = 1,
  limit: number = 50
) {
  const skip = (page - 1) * limit;

  const messages = await this.find({
    $or: [
      { sender: userId1, recipient: userId2 },
      { sender: userId2, recipient: userId1 },
    ],
  })
    .populate('sender', 'username avatar isOnline')
    .populate('recipient', 'username avatar isOnline')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();

  const total = await this.countDocuments({
    $or: [
      { sender: userId1, recipient: userId2 },
      { sender: userId2, recipient: userId1 },
    ],
  });

  return {
    messages: messages.reverse(), // Reverse to show oldest first
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to mark messages as read
messageSchema.statics.markAsRead = async function (
  senderId: string,
  recipientId: string
) {
  return await this.updateMany(
    {
      sender: senderId,
      recipient: recipientId,
      isRead: false,
    },
    {
      isRead: true,
    }
  );
};

// Static method to get unread message count
messageSchema.statics.getUnreadCount = async function (
  recipientId: string,
  senderId?: string
) {
  const query: any = {
    recipient: recipientId,
    isRead: false,
  };

  if (senderId) {
    query.sender = senderId;
  }

  return await this.countDocuments(query);
};

// Static method to get latest message between users
messageSchema.statics.getLatestMessage = async function (
  userId1: string,
  userId2: string
) {
  return await this.findOne({
    $or: [
      { sender: userId1, recipient: userId2 },
      { sender: userId2, recipient: userId1 },
    ],
  })
    .populate('sender', 'username avatar')
    .sort({ createdAt: -1 })
    .lean();
};

// Pre-save validation
messageSchema.pre('save', function (next) {
  // If it's a file message, ensure file fields are present
  if (this.messageType === 'file') {
    if (!this.fileUrl || !this.fileName || !this.fileSize) {
      return next(new Error('File messages must include fileUrl, fileName, and fileSize'));
    }
  }

  // Prevent self-messaging
  if (this.sender.toString() === this.recipient.toString()) {
    return next(new Error('Cannot send message to yourself'));
  }

  next();
});

export const Message = mongoose.model<IMessageDocument>('Message', messageSchema);