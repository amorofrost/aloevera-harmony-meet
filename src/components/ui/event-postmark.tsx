import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EventPostmarkProps {
  location: string;
  date: Date;
  title: string;
  category: string;
  className?: string;
  onClick?: () => void;
  showEventName?: boolean;
}

const EventPostmark: React.FC<EventPostmarkProps> = ({ location, date, title, category, className = '', onClick, showEventName = false }) => {
  const year = date.getFullYear();
  const city = location.split(',')[1]?.trim() || location.split(',')[0].trim();
  
  // Get event-specific artistic design
  const getEventDesign = (title: string, category: string) => {
    const titleLower = title.toLowerCase();
    
    // Concert designs
    if (category === 'concert') {
      if (titleLower.includes('новые горизонты')) {
        return {
          bgColor: 'from-orange-400 via-red-400 to-pink-400',
          illustration: (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Musical horizon with flowing elements */}
              <div className="relative">
                {/* Sound waves */}
                <div className="flex space-x-0.5 items-end">
                  <div className="w-1 h-3 bg-white/80 rounded-full"></div>
                  <div className="w-1 h-5 bg-white/90 rounded-full"></div>
                  <div className="w-1 h-4 bg-white/80 rounded-full"></div>
                  <div className="w-1 h-6 bg-white rounded-full"></div>
                  <div className="w-1 h-4 bg-white/80 rounded-full"></div>
                  <div className="w-1 h-3 bg-white/70 rounded-full"></div>
                </div>
                {/* Flowing musical notes */}
                <div className="absolute -top-1 -right-2 w-2 h-2 bg-yellow-300 rounded-full transform rotate-12"></div>
                <div className="absolute -top-2 left-2 w-1.5 h-1.5 bg-orange-200 rounded-full"></div>
                <div className="absolute -bottom-1 -left-1 w-3 h-1 bg-pink-300 rounded-full transform -rotate-12"></div>
              </div>
            </div>
          )
        };
      }
      
      if (titleLower.includes('акустический') || titleLower.includes('близко к сердцу')) {
        return {
          bgColor: 'from-amber-300 via-orange-300 to-red-300',
          illustration: (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Acoustic guitar silhouette */}
              <div className="relative">
                <div className="w-4 h-6 bg-amber-100 rounded-full relative">
                  <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-orange-200 rounded-full"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-amber-700"></div>
                </div>
                {/* Strings */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 flex space-x-0.5">
                  <div className="w-0.5 h-2 bg-yellow-200"></div>
                  <div className="w-0.5 h-2 bg-yellow-200"></div>
                  <div className="w-0.5 h-2 bg-yellow-200"></div>
                </div>
                {/* Heart shape */}
                <div className="absolute -right-1 -top-1 w-2 h-2 bg-red-400 transform rotate-45 rounded-tl-full rounded-br-full"></div>
              </div>
            </div>
          )
        };
      }
      
      if (titleLower.includes('summer') || titleLower.includes('летний')) {
        return {
          bgColor: 'from-yellow-300 via-orange-300 to-red-400',
          illustration: (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Summer concert with sun */}
              <div className="relative">
                <div className="w-4 h-4 bg-yellow-200 rounded-full relative">
                  <div className="absolute top-1 left-1 w-2 h-2 bg-orange-300 rounded-full"></div>
                </div>
                {/* Sun rays */}
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0.5 h-2 bg-yellow-300"></div>
                <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-2 h-0.5 bg-yellow-300"></div>
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0.5 h-2 bg-yellow-300"></div>
                <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-0.5 bg-yellow-300"></div>
                {/* Musical elements */}
                <div className="absolute -right-2 -bottom-1 w-2 h-1 bg-orange-400 rounded-full transform rotate-45"></div>
              </div>
            </div>
          )
        };
      }
    }
    
    // Festival designs
    if (category === 'festival') {
      if (titleLower.includes('fest')) {
        return {
          bgColor: 'from-purple-400 via-pink-400 to-red-400',
          illustration: (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Festival stage and crowd */}
              <div className="relative">
                {/* Stage */}
                <div className="w-6 h-2 bg-purple-200 rounded-sm"></div>
                {/* Crowd */}
                <div className="absolute -bottom-1 left-0 w-full flex justify-center space-x-0.5">
                  <div className="w-1 h-2 bg-pink-300 rounded-t-full"></div>
                  <div className="w-1 h-3 bg-purple-300 rounded-t-full"></div>
                  <div className="w-1 h-2 bg-red-300 rounded-t-full"></div>
                  <div className="w-1 h-3 bg-pink-300 rounded-t-full"></div>
                  <div className="w-1 h-2 bg-purple-300 rounded-t-full"></div>
                </div>
                {/* Confetti */}
                <div className="absolute -top-2 left-1 w-1 h-1 bg-yellow-400 rounded-full"></div>
                <div className="absolute -top-1 right-1 w-1 h-1 bg-green-400 rounded-full"></div>
                <div className="absolute -top-2 right-0 w-1 h-1 bg-blue-400 rounded-full"></div>
              </div>
            </div>
          )
        };
      }
    }
    
    // Meetup designs
    if (category === 'meetup') {
      return {
        bgColor: 'from-green-400 via-teal-400 to-blue-400',
        illustration: (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* People gathering in circle */}
            <div className="relative">
              <div className="w-5 h-5 border border-green-200 rounded-full bg-transparent relative">
                {/* People around circle */}
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-teal-300 rounded-full"></div>
                <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-1 h-1 bg-blue-300 rounded-full"></div>
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-green-300 rounded-full"></div>
                <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-1 h-1 bg-teal-300 rounded-full"></div>
                {/* Center connection */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-blue-400 rounded-full"></div>
              </div>
              {/* Guitar for music meetup */}
              <div className="absolute -right-2 -bottom-1 w-2 h-3 bg-green-200 rounded-sm transform rotate-12"></div>
            </div>
          </div>
        )
      };
    }
    
    // Party designs
    if (category === 'party') {
      if (titleLower.includes('новогодний') || titleLower.includes('новый год')) {
        return {
          bgColor: 'from-blue-400 via-purple-400 to-indigo-500',
          illustration: (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* New Year tree and fireworks */}
              <div className="relative">
                {/* Christmas tree */}
                <div className="w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-green-300"></div>
                <div className="w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-green-400 -mt-1"></div>
                <div className="w-0.5 h-2 bg-amber-600 mx-auto"></div>
                {/* Fireworks */}
                <div className="absolute -top-2 -right-1 flex space-x-0.5">
                  <div className="w-0.5 h-1 bg-yellow-400"></div>
                  <div className="w-0.5 h-2 bg-red-400"></div>
                  <div className="w-0.5 h-1 bg-blue-400"></div>
                </div>
                {/* Stars */}
                <div className="absolute -top-1 -left-2 w-1 h-1 bg-yellow-300 rounded-full"></div>
                <div className="absolute top-1 -right-2 w-1 h-1 bg-purple-300 rounded-full"></div>
              </div>
            </div>
          )
        };
      }
      
      if (titleLower.includes('винтажный') || titleLower.includes('ретро')) {
        return {
          bgColor: 'from-amber-400 via-yellow-400 to-orange-400',
          illustration: (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Vintage vinyl record */}
              <div className="relative">
                <div className="w-5 h-5 bg-amber-900 rounded-full relative">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-amber-800 rounded-full"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-yellow-300 rounded-full"></div>
                </div>
                {/* Vintage decorative elements */}
                <div className="absolute -top-1 -right-1 w-2 h-1 bg-orange-300 rounded-full transform rotate-45"></div>
                <div className="absolute -bottom-1 -left-1 w-1 h-2 bg-amber-300 rounded-full transform -rotate-45"></div>
              </div>
            </div>
          )
        };
      }
    }
    
    // Yachting designs
    if (category === 'yachting') {
      const isAustralia = location.toLowerCase().includes('австрали');
      const isGreece = location.toLowerCase().includes('греци') || location.toLowerCase().includes('миконос');
      
      if (isAustralia) {
        return {
          bgColor: 'from-orange-400 via-red-400 to-yellow-500',
          illustration: (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Australian yacht with flag elements */}
              <div className="relative">
                {/* Yacht sail */}
                <div className="w-4 h-5 bg-white rounded-t-lg transform -rotate-12 relative">
                  <div className="absolute top-1 left-1 w-2 h-1 bg-red-400 rounded"></div>
                  <div className="absolute bottom-1 right-1 w-1 h-2 bg-blue-400 rounded"></div>
                </div>
                {/* Yacht hull */}
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-5 h-1 bg-white rounded-full"></div>
                {/* Australian elements - sun and waves */}
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-yellow-300 rounded-full"></div>
                <div className="absolute -bottom-0.5 -left-2 w-3 h-0.5 bg-orange-300 rounded-full"></div>
              </div>
            </div>
          )
        };
      }
      
      if (isGreece) {
        return {
          bgColor: 'from-blue-400 via-cyan-400 to-white',
          illustration: (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Greek yacht with island elements */}
              <div className="relative">
                {/* Yacht sail */}
                <div className="w-4 h-5 bg-white rounded-t-lg transform -rotate-12 relative">
                  <div className="absolute top-1 left-1 w-2 h-1 bg-blue-500 rounded"></div>
                  <div className="absolute bottom-1 right-1 w-1 h-1 bg-blue-500 rounded"></div>
                </div>
                {/* Yacht hull */}
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-5 h-1 bg-white rounded-full"></div>
                {/* Greek elements - island and waves */}
                <div className="absolute -top-1 -right-1 w-2 h-1 bg-white rounded-full"></div>
                <div className="absolute -bottom-0.5 -left-2 w-3 h-0.5 bg-cyan-300 rounded-full"></div>
              </div>
            </div>
          )
        };
      }
      
      // Default yachting design
      return {
        bgColor: 'from-blue-500 via-teal-500 to-cyan-500',
        illustration: (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Generic yacht */}
            <div className="relative">
              {/* Yacht sail */}
              <div className="w-4 h-5 bg-white rounded-t-lg transform -rotate-12"></div>
              {/* Yacht hull */}
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-5 h-1 bg-white rounded-full"></div>
              {/* Waves */}
              <div className="absolute -bottom-0.5 -left-2 w-4 h-0.5 bg-cyan-300 rounded-full"></div>
            </div>
          </div>
        )
      };
    }
    
    // Default design for unmatched events
    return {
      bgColor: 'from-emerald-400 via-teal-400 to-cyan-400',
      illustration: (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Abstract flowing design */}
          <div className="relative">
            <div className="w-4 h-4 bg-emerald-200 rounded-full relative overflow-hidden">
              <div className="absolute top-1 left-1 w-1 h-1 bg-teal-300 rounded-full"></div>
              <div className="absolute bottom-1 right-1 w-2 h-0.5 bg-cyan-300 rounded-full"></div>
            </div>
            {/* Flowing decorative elements */}
            <div className="absolute -top-1 -right-1 w-3 h-0.5 bg-teal-300 rounded-full transform rotate-30"></div>
            <div className="absolute -bottom-1 -left-1 w-2 h-0.5 bg-emerald-300 rounded-full transform -rotate-30"></div>
          </div>
        </div>
      )
    };
  };

  const design = getEventDesign(title, category);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`relative inline-block ${className} group cursor-pointer`}
            onClick={onClick}
          >
            {/* Postmark Background with gradient */}
            <div className={`relative w-16 h-16 bg-gradient-to-br ${design.bgColor} rounded-lg p-1 shadow-lg border-2 border-white transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl`}>
              {/* Postmark border effect */}
              <div className="absolute inset-1 border border-white/30 rounded-md border-dashed"></div>
              
              {/* Corner postal marks */}
              {/*
              <div className="absolute -top-0.5 -left-0.5 w-2 h-2 bg-white rounded-full border border-gray-300 shadow-sm"></div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full border border-gray-300 shadow-sm"></div>
              <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 bg-white rounded-full border border-gray-300 shadow-sm"></div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-white rounded-full border border-gray-300 shadow-sm"></div>
              */}
              
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
          <div className="text-center">
            {showEventName && <p className="text-sm font-medium">{title}</p>}
            <p className="text-sm">{city}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default EventPostmark;
