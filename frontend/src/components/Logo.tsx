import React from 'react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', iconOnly = false, size = 'md' }) => {
  const iconDimensions = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const textClasses = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* High-tech shield circuit icon */}
      <div className={`relative ${iconDimensions} rounded-lg bg-gradient-to-br from-[#1E293B] to-[#0F1724] border border-[#2B3340] flex items-center justify-center p-1.5 shadow-sm overflow-hidden shrink-0 group`}>
        {/* Subtle grid background glow */}
        <div className="absolute inset-0 bg-[#4AC777]/10 opacity-60 group-hover:opacity-100 transition-opacity" />
        
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10">
          {/* Shield outline */}
          <path
            d="M20 4L32 9V19C32 27.5 26.9 33.4 20 36C13.1 33.4 8 27.5 8 19V9L20 4Z"
            stroke="#4AC777"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner core / circuit node */}
          <circle cx="20" cy="19" r="4" fill="#FFFFFF" />
          <path
            d="M20 10V15M20 23V28M15 19H10M25 19H30"
            stroke="#4AC777"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Node dots */}
          <circle cx="20" cy="10" r="1.5" fill="#4AC777" />
          <circle cx="20" cy="28" r="1.5" fill="#4AC777" />
          <circle cx="10" cy="19" r="1.5" fill="#4AC777" />
          <circle cx="30" cy="19" r="1.5" fill="#4AC777" />
        </svg>
      </div>

      {!iconOnly && (
        <span className={`font-space font-bold tracking-tight text-white ${textClasses}`}>
          Guard<span className="text-[#4AC777]">Rail</span>
        </span>
      )}
    </div>
  );
};
