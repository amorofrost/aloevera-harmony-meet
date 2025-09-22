import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface SwipeCardProps {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  className?: string;
}

const SwipeCard: React.FC<SwipeCardProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  className
}) => {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleStart = (clientX: number, clientY: number) => {
    setDragStart({ x: clientX, y: clientY });
    setIsDragging(true);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!dragStart) return;

    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleEnd = () => {
    if (!dragStart) return;

    const threshold = 100;
    const absX = Math.abs(dragOffset.x);

    if (absX > threshold) {
      if (dragOffset.x > 0) {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    }

    // Reset
    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  const rotation = dragOffset.x * 0.1;
  const opacity = 1 - Math.abs(dragOffset.x) * 0.002;

  return (
    <div
      ref={cardRef}
      className={cn(
        "swipe-card relative cursor-grab active:cursor-grabbing",
        isDragging && "transition-none",
        !isDragging && "transition-transform",
        className
      )}
      style={{
        transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y * 0.1}px) rotate(${rotation}deg)`,
        opacity: opacity,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
      
      {/* Swipe indicators */}
      {isDragging && (
        <>
          <div 
            className={cn(
              "absolute inset-0 rounded-3xl border-4 transition-opacity",
              dragOffset.x > 50 ? "border-green-400 bg-green-400/10 opacity-100" : "opacity-0"
            )}
          >
            <div className="absolute top-8 left-8 bg-green-400 text-white px-4 py-2 rounded-xl font-bold text-lg transform rotate-12">
              LIKE
            </div>
          </div>
          
          <div 
            className={cn(
              "absolute inset-0 rounded-3xl border-4 transition-opacity",
              dragOffset.x < -50 ? "border-red-400 bg-red-400/10 opacity-100" : "opacity-0"
            )}
          >
            <div className="absolute top-8 right-8 bg-red-400 text-white px-4 py-2 rounded-xl font-bold text-lg transform -rotate-12">
              PASS
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SwipeCard;