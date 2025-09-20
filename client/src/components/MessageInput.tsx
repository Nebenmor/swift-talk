import { useState, useRef } from 'react';

interface MessageInputProps {
  readonly onSendMessage: (content: string) => void;
  readonly disabled?: boolean;
}

export default function MessageInput({ onSendMessage, disabled = false }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        onSendMessage(`File: ${file.name}`); // This would be enhanced to handle file messages
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert('File upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        <div className="flex-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Connecting..." : "Type a message..."}
            className={`form-input resize-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
            disabled={disabled}
          />
        </div>

        <div className="flex space-x-2">
          {/* File upload button */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,application/pdf,.txt,.doc,.docx"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => !disabled && fileInputRef.current?.click()}
            disabled={isUploading || disabled}
            className={`btn btn-secondary px-3 py-2 ${(isUploading || disabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={disabled ? "Connecting..." : "Attach file"}
          >
            {isUploading ? '⏳' : '📎'}
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className={`btn btn-primary px-4 py-2 ${(!message.trim() || disabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={disabled ? "Connecting..." : "Send message"}
          >
            Send
          </button>
        </div>
      </form>
      
      {disabled && (
        <p className="text-xs text-gray-500 mt-1 text-center">
          Waiting for connection... Messages will be sent once connected.
        </p>
      )}
    </div>
  );
}