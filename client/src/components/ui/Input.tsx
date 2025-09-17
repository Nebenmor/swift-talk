import React from 'react';
import { clsx } from 'clsx';
import { InputProps } from '../../types';

const Input: React.FC<InputProps> = ({
  id,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  disabled = false,
  required = false,
  error,
  className,
  autoComplete,
  autoFocus,
}) => {
  const baseStyles = 'block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm transition-colors';
  const errorStyles = error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : '';
  const disabledStyles = disabled ? 'bg-gray-50 text-gray-500' : '';

  return (
    <div>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={clsx(baseStyles, errorStyles, disabledStyles, className)}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};
