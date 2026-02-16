import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Users, Music, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomNavigation = () => {
  const location = useLocation();

  const navItems = [
    { icon: MessageSquare, label: 'Talks', href: '/talks', path: '/talks' },
    { icon: Users, label: 'Друзья', href: '/friends', path: '/friends' },
    { icon: Music, label: 'AloeVera', href: '/aloevera', path: '/aloevera' },
    { icon: Settings, label: 'Настройки', href: '/settings', path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50">
      <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link key={item.href} to={item.href}
              className={cn("flex flex-col items-center justify-center py-1 px-2 min-w-0 flex-1", "transition-all duration-200", isActive && "nav-active")}>
              <Icon className={cn("w-6 h-6 mb-1 transition-all duration-200", isActive ? "text-primary scale-110" : "text-muted-foreground")} />
              <span className={cn("text-xs font-medium transition-all duration-200 truncate", isActive ? "text-primary" : "text-muted-foreground")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
