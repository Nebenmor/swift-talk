import React from 'react';
import { MessageCircle } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text = 'Loading...',
  fullScreen = true,
}) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const containerClass = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-white bg-opacity-90 z-50'
    : 'flex items-center justify-center p-4';

  return (
    <div className={containerClass}>
      <div className="text-center">
        <div className="relative">
          <MessageCircle className={`${sizes[size]} text-primary-600 animate-bounce-gentle mx-auto`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`${sizes[size]} border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin`}></div>
          </div>
        </div>
        {text && (
          <p className="mt-4 text-sm text-gray-600 font-medium">{text}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;