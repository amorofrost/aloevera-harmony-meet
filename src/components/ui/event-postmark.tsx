import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EventPostmarkProps {
  location: string;
  date: Date;
  className?: string;
}

const EventPostmark: React.FC<EventPostmarkProps> = ({ location, date, className = '' }) => {
  const year = date.getFullYear();
  const city = location.split(',')[1]?.trim() || location.split(',')[0].trim();
  
  // Get location-specific artistic design
  const getLocationDesign = (location: string) => {
    const locationLower = location.toLowerCase();
    
    if (locationLower.includes('москва')) {
      return {
        bgColor: 'from-red-400 via-orange-400 to-yellow-400',
        illustration: (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Moscow Red Square inspired design */}
            <div className="relative">
              {/* Kremlin towers */}
              <div className="flex space-x-1">
                <div className="w-2 h-6 bg-red-600 rounded-t-sm relative">
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-yellow-400 rounded-full"></div>
                </div>
                <div className="w-3 h-8 bg-red-700 rounded-t-sm relative">
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-yellow-400 rounded-full"></div>
                </div>
                <div className="w-2 h-6 bg-red-600 rounded-t-sm relative">
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-yellow-400 rounded-full"></div>
                </div>
              </div>
              {/* Flowing decorative elements */}
              <div className="absolute -right-2 -top-1 w-3 h-1 bg-orange-300 rounded-full transform rotate-12"></div>
              <div className="absolute -left-2 top-2 w-2 h-1 bg-yellow-300 rounded-full transform -rotate-12"></div>
            </div>
          </div>
        )
      };
    }
    
    if (locationLower.includes('санкт-петербург') || locationLower.includes('петербург')) {
      return {
        bgColor: 'from-blue-400 via-indigo-400 to-purple-400',
        illustration: (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Saint Petersburg bridges and waters */}
            <div className="relative">
              {/* Bridge arch */}
              <div className="w-8 h-4 border-2 border-blue-200 rounded-t-full bg-transparent"></div>
              {/* Water waves */}
              <div className="absolute -bottom-1 left-0 w-full">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-blue-300 rounded-full"></div>
                  <div className="w-2 h-1 bg-blue-200 rounded-full"></div>
                  <div className="w-1 h-1 bg-blue-300 rounded-full"></div>
                  <div className="w-2 h-1 bg-blue-200 rounded-full"></div>
                </div>
              </div>
              {/* Flowing elements */}
              <div className="absolute -right-1 top-1 w-4 h-1 bg-indigo-300 rounded-full transform rotate-45 opacity-70"></div>
              <div className="absolute -left-1 top-2 w-3 h-1 bg-purple-300 rounded-full transform -rotate-45 opacity-70"></div>
            </div>
          </div>
        )
      };
    }
    
    // Default artistic design for other locations
    return {
      bgColor: 'from-emerald-400 via-teal-400 to-cyan-400',
      illustration: (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Abstract flowing design */}
          <div className="relative">
            {/* Central organic shape */}
            <div className="w-6 h-6 bg-emerald-200 rounded-full relative overflow-hidden">
              <div className="absolute top-1 left-1 w-2 h-2 bg-teal-300 rounded-full"></div>
              <div className="absolute bottom-1 right-1 w-3 h-1 bg-cyan-300 rounded-full"></div>
            </div>
            {/* Flowing decorative elements */}
            <div className="absolute -top-1 -right-1 w-4 h-1 bg-teal-300 rounded-full transform rotate-30"></div>
            <div className="absolute -bottom-1 -left-1 w-3 h-1 bg-emerald-300 rounded-full transform -rotate-30"></div>
            <div className="absolute top-2 -left-2 w-2 h-2 bg-cyan-200 rounded-full opacity-60"></div>
          </div>
        </div>
      )
    };
  };

  const design = getLocationDesign(location);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`relative inline-block ${className} group cursor-pointer`}>
            {/* Postmark Background with gradient */}
            <div className={`relative w-16 h-16 bg-gradient-to-br ${design.bgColor} rounded-lg p-1 shadow-lg border-2 border-white transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl`}>
              {/* Postmark border effect */}
              <div className="absolute inset-1 border border-white/30 rounded-md border-dashed"></div>
              
              {/* Corner postal marks */}
              <div className="absolute -top-0.5 -left-0.5 w-2 h-2 bg-white rounded-full border border-gray-300 shadow-sm"></div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full border border-gray-300 shadow-sm"></div>
              <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 bg-white rounded-full border border-gray-300 shadow-sm"></div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-white rounded-full border border-gray-300 shadow-sm"></div>
              
              {/* Artistic illustration */}
              <div className="absolute inset-2 flex items-center justify-center">
                {design.illustration}
              </div>
              
              {/* Year display */}
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                <div className="bg-white/90 px-1 py-0.5 rounded text-[8px] font-bold text-gray-800 shadow-sm">
                  {year}
                </div>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-sm font-medium">{city}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default EventPostmark;