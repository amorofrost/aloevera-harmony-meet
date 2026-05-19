import { Heart, Users, MessageSquare, MessageCircle, Megaphone, Calendar, Bell, Star, Award } from 'lucide-react';
import type { NotificationType } from '@/types/notification';
import type { LucideIcon } from 'lucide-react';

export const notificationIcons: Record<NotificationType, LucideIcon> = {
  likeReceived: Heart,
  matchCreated: Users,
  messageReceived: MessageSquare,
  forumReplyToThread: MessageCircle,
  communityBroadcast: Megaphone,
  eventPublished: Calendar,
  eventReminder: Bell,
  eventInviteReceived: Star,
  rankUp: Award,
};
