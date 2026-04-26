import React from 'react';

const Input = ({
  label,
  placeholder,
  error,
  type = 'text',
  value,
  onChange,
  disabled = false,
  className = '',
  ...props
}) => {
  const baseInputStyles = 'w-full bg-primary rounded-lg text-text-primary placeholder-text-tertiary transition-smooth px-4 py-2 outline-none';
  
  const borderStyles = error 
    ? 'border border-error focus:border-error' 
    : 'border border-border-default focus:border-accent focus:ring-focus';
    
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';

  const inputClasses = `${baseInputStyles} ${borderStyles} ${disabledStyles} ${className}`.trim();

  return (
    <div className="w-full flex flex-col">
      {label && (
        <label className="text-text-secondary text-sm mb-1.5 font-medium">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClasses}
        {...props}
      />
      {error && (
        <span className="text-error text-sm mt-1.5">
          {error}
        </span>
      )}
    </div>
  );
};

export default Input;
