import React from 'react';

interface EventPostmarkProps {
  location: string;
  date: Date;
  className?: string;
}

const EventPostmark: React.FC<EventPostmarkProps> = ({ location, date, className = '' }) => {
  const year = date.getFullYear();
  const city = location.split(',')[1]?.trim() || location.split(',')[0].trim();
  
  return (
    <div className={`relative inline-block ${className}`}>
      {/* Postmark Background */}
      <div className="relative bg-white border-2 border-dashed border-red-500 rounded-lg p-2 text-center text-xs font-mono shadow-sm">
        {/* Corner decorations */}
        <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
        
        {/* Content */}
        <div className="text-red-700 leading-tight">
          <div className="font-bold text-[10px] uppercase tracking-wider">
            {city}
          </div>
          <div className="text-[9px] mt-0.5">
            {year}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventPostmark;