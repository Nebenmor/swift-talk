import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';

interface FileData {
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

interface MessageInputProps {
  readonly onSendMessage: (content: string, messageType?: 'text' | 'file', fileData?: FileData) => void;
  readonly disabled?: boolean;
}

interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
}

export default function MessageInput({ onSendMessage, disabled = false }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isUploading) {
      onSendMessage(message.trim());
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !isUploading) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 120; // Max height in pixels
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Check file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('File type not supported. Please upload images, PDFs, or documents.');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // FIXED: Upload file first to get URL
      const uploadResponse = await api.post('/chat/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (uploadResponse.data.success) {
        const fileData = uploadResponse.data.data;
        
        console.log('File uploaded successfully:', fileData);
        
        // FIXED: Send file message with correct data structure
        const fileInfo: FileData = {
          fileUrl: fileData.url,
          fileName: file.name,
          fileSize: file.size,
        };
        
        // Send the file message
        onSendMessage(file.name, 'file', fileInfo);
        
        toast.success('File uploaded and sent successfully!');
      } else {
        toast.error('File upload failed');
      }
    } catch (error) {
      console.error('File upload failed:', error);
      const apiError = error as ApiError;
      const errorMessage = apiError.response?.data?.message || 'File upload failed';
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="p-3 md:p-4 bg-white border-t border-gray-200">
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Connecting to SwiftTalk..." : "Type your message..."}
            className={`w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white'
            }`}
            rows={1}
            style={{ 
              minHeight: '48px', 
              maxHeight: '120px',
            }}
            disabled={disabled || isUploading}
          />
          
          {/* Character count for long messages */}
          {message.length > 800 && (
            <div className="absolute -top-6 right-0 text-xs text-gray-500">
              {message.length}/1000
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          {/* File upload button */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,application/pdf,.txt,.doc,.docx"
            disabled={disabled || isUploading}
          />
          <button
            type="button"
            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
            disabled={isUploading || disabled}
            className={`p-3 rounded-full transition-all duration-200 ${
              isUploading || disabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 active:scale-95'
            }`}
            title={disabled ? "Connecting..." : isUploading ? "Uploading..." : "Attach file"}
          >
            {isUploading ? (
              <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={!message.trim() || disabled || isUploading}
            className={`p-3 rounded-full transition-all duration-200 ${
              !message.trim() || disabled || isUploading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 active:scale-95 shadow-lg'
            }`}
            title={disabled ? "Connecting..." : !message.trim() ? "Type a message" : "Send message"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
      
      {/* Status messages */}
      {disabled && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Connecting to SwiftTalk... Messages will be sent once connected.
        </p>
      )}
      
      {isUploading && (
        <p className="text-xs text-blue-600 mt-2 text-center flex items-center justify-center">
          <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
          Uploading file to SwiftTalk...
        </p>
      )}
    </div>
  );
}