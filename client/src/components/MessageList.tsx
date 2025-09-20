import { useEffect, useRef } from 'react';
import type { Message } from '../types';

interface MessageListProps {
  readonly messages: Message[];
  readonly currentUserId: string;
}

export default function MessageList({ messages, currentUserId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">No messages yet. Start the conversation!</p>
      </div>
    );
  }

  let lastMessageDate = '';

  return (
    <div className="p-4 space-y-4">
      {messages.map((message) => {
        const isOwn = message.sender._id === currentUserId;
        const messageDate = formatDate(new Date(message.createdAt));
        const showDateDivider = messageDate !== lastMessageDate;
        lastMessageDate = messageDate;

        return (
          <div key={message._id}>
            {/* Date divider */}
            {showDateDivider && (
              <div className="flex items-center justify-center my-4">
                <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {messageDate}
                </div>
              </div>
            )}

            {/* Message */}
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  isOwn
                    ? 'message-sent rounded-br-md'
                    : 'message-received border rounded-bl-md'
                }`}
              >
                {/* Sender name for received messages */}
                {!isOwn && (
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    {message.sender.username}
                  </p>
                )}

                {/* Message content */}
                {message.messageType === 'text' ? (
                  <p className="text-sm">{message.content}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm">{message.content}</p>
                    {message.fileUrl && (
                      <a
                        href={message.fileUrl}
                        download={message.fileName}
                        className="text-xs underline hover:no-underline"
                      >
                        📎 {message.fileName}
                      </a>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                <p
                  className={`text-xs mt-1 ${
                    isOwn ? 'text-blue-200' : 'text-gray-500'
                  }`}
                >
                  {formatTime(message.createdAt)}
                  {isOwn && message.isRead && (
                    <span className="ml-1">✓✓</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}