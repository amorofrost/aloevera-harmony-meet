import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Search, Calendar, Heart, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const BottomNavigation = () => {
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    {
      icon: Search,
      label: t('nav.search'),
      href: '/search',
      path: '/search'
    },
    {
      icon: Calendar,
      label: t('nav.events'),
      href: '/events',
      path: '/events'
    },
    {
      icon: Heart,
      label: t('nav.likes'),
      href: '/likes',
      path: '/likes'
    },
    {
      icon: MessageCircle,
      label: t('nav.chats'),
      href: '/chats',
      path: '/chats'
    },
    {
      icon: User,
      label: t('nav.profile'),
      href: '/profile',
      path: '/profile'
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50">
      <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2 min-w-0 flex-1",
                "transition-all duration-200",
                isActive && "nav-active"
              )}
            >
              <Icon 
                className={cn(
                  "w-6 h-6 mb-1 transition-all duration-200",
                  isActive ? "text-primary scale-110" : "text-muted-foreground"
                )} 
              />
              <span 
                className={cn(
                  "text-xs font-medium transition-all duration-200 truncate",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;