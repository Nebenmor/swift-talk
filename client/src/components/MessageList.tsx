import { useEffect, useRef } from 'react';
import type { Message } from '../types';

interface MessageListProps {
  readonly messages: Message[];
  readonly currentUserId: string;
}

export default function MessageList({ messages, currentUserId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date | string) => {
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

  const isImageFile = (fileName?: string) => {
    if (!fileName) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  };

  const isPdfFile = (fileName?: string) => {
    if (!fileName) return false;
    return fileName.toLowerCase().endsWith('.pdf');
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm md:text-base">No messages yet. Start the conversation!</p>
        </div>
      </div>
    );
  }

  // Sort messages by creation time (oldest first) to display in correct order
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let lastMessageDate = '';

  return (
    <div 
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4"
      style={{ maxHeight: 'calc(100vh - 200px)' }}
    >
      {sortedMessages.map((message, index) => {
        const isOwn = message.sender._id === currentUserId;
        const messageDate = formatDate(message.createdAt);
        const showDateDivider = messageDate !== lastMessageDate;
        lastMessageDate = messageDate;

        // Check if we should group this message with the previous one
        const prevMessage = index > 0 ? sortedMessages[index - 1] : null;
        const shouldGroup = prevMessage && 
          prevMessage.sender._id === message.sender._id && 
          (new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime()) < 60000; // 1 minute

        return (
          <div key={message._id}>
            {/* Date divider */}
            {showDateDivider && (
              <div className="flex items-center justify-center my-4 md:my-6">
                <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {messageDate}
                </div>
              </div>
            )}

            {/* Message */}
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end space-x-2 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                
                {/* Avatar */}
                {!isOwn && !shouldGroup && (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                    {message.sender.avatar ? (
                      <img
                        src={message.sender.avatar}
                        alt={message.sender.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium text-gray-600">
                        {message.sender.username[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Spacer for grouped messages */}
                {!isOwn && shouldGroup && <div className="w-8" />}

                {/* Message bubble */}
                <div className="flex-1">
                  <div
                    className={`px-3 py-2 md:px-4 md:py-3 rounded-2xl break-words ${
                      isOwn
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md shadow-sm'
                    }`}
                  >
                    {/* Sender name for received messages (only if not grouped) */}
                    {!isOwn && !shouldGroup && (
                      <p className="text-xs font-medium text-blue-600 mb-1">
                        {message.sender.username}
                      </p>
                    )}

                    {/* Message content */}
                    {message.messageType === 'text' ? (
                      <p className="text-sm md:text-base whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="space-y-2">
                        {/* File message content */}
                        <p className="text-sm md:text-base">{message.content}</p>
                        
                        {message.fileUrl && (
                          <div className="mt-2">
                            {isImageFile(message.fileName) ? (
                              // Image preview
                              <div className="relative">
                                <img
                                  src={message.fileUrl}
                                  alt={message.fileName}
                                  className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  style={{ maxHeight: '300px' }}
                                  onClick={() => window.open(message.fileUrl, '_blank')}
                                />
                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                                  {message.fileName}
                                </div>
                              </div>
                            ) : isPdfFile(message.fileName) ? (
                              // PDF file
                              <a
                                href={message.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center space-x-2 p-3 rounded-lg border-2 border-dashed transition-colors ${
                                  isOwn 
                                    ? 'border-blue-200 hover:border-blue-100' 
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                              >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">{message.fileName}</span>
                              </a>
                            ) : (
                              // Generic file
                              <a
                                href={message.fileUrl}
                                download={message.fileName}
                                className={`inline-flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                                  isOwn 
                                    ? 'border-blue-200 hover:border-blue-100' 
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm">{message.fileName}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timestamp and read status */}
                    <div className={`flex items-center justify-between mt-1 ${
                      isOwn ? 'justify-end' : 'justify-start'
                    }`}>
                      <p className={`text-xs ${
                        isOwn ? 'text-blue-200' : 'text-gray-500'
                      }`}>
                        {formatTime(message.createdAt)}
                      </p>
                      {isOwn && (
                        <div className="ml-2">
                          {message.isRead ? (
                            <span className="text-blue-200 text-xs">✓✓</span>
                          ) : (
                            <span className="text-blue-300 text-xs">✓</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}