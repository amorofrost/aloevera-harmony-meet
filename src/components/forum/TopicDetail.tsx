import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pin, Send, ThumbsUp, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { forumsApi } from '@/services/api';
import type { ForumTopicDetail as TopicDetailType } from '@/data/mockForumData';

interface TopicDetailProps {
  topicId: string;
  onBack: () => void;
}

const TopicDetail: React.FC<TopicDetailProps> = ({ topicId, onBack }) => {
  const [topic, setTopic] = useState<TopicDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const res = await forumsApi.getTopic(topicId);
      if (res.success && res.data) setTopic(res.data);
      setIsLoading(false);
    };
    load();
  }, [topicId]);

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending) return;
    setIsSending(true);
    const res = await forumsApi.createReply(topicId, replyText.trim());
    if (res.success && res.data && topic) {
      setTopic({
        ...topic,
        replies: [...topic.replies, res.data],
        replyCount: topic.replyCount + 1,
      });
      setReplyText('');
    }
    setIsSending(false);
  };

  const handleAuthorClick = (authorId?: string) => {
    if (authorId) {
      navigate(`/friends?userId=${authorId}`);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'только что';
    if (hours < 24) return `${hours}ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}д назад`;
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  const AuthorBadge = ({ authorId, authorName, size = 'md' }: { authorId?: string; authorName: string; size?: 'sm' | 'md' }) => {
    const isClickable = Boolean(authorId);
    const avatarSize = size === 'md' ? 'w-8 h-8' : 'w-7 h-7';
    const textSize = size === 'md' ? 'text-sm' : 'text-xs';

    return (
      <div
        className={`flex items-center gap-2 ${isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={isClickable ? () => handleAuthorClick(authorId) : undefined}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={isClickable ? (e) => { if (e.key === 'Enter') handleAuthorClick(authorId); } : undefined}
      >
        <div className={`${avatarSize} rounded-full ${size === 'md' ? 'bg-primary/20' : 'bg-muted'} flex items-center justify-center`}>
          <span className={`${textSize} font-semibold ${size === 'md' ? 'text-primary' : ''}`}>
            {authorName.charAt(0)}
          </span>
        </div>
        <span className={`font-medium ${textSize} ${isClickable ? 'text-primary underline-offset-2 hover:underline' : ''}`}>
          {authorName}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
    );
  }

  if (!topic) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Тема не найдена</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Назад
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Original post */}
      <Card className="profile-card">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            {topic.isPinned && <Pin className="w-3.5 h-3.5 text-primary" />}
            <h2 className="text-lg font-bold">{topic.title}</h2>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <AuthorBadge authorId={topic.authorId} authorName={topic.authorName} size="md" />
            <span className="text-xs text-muted-foreground">· {formatDate(topic.createdAt)}</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground">{topic.content}</p>
          <Separator className="my-4" />
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> {topic.replyCount} ответов
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      <div className="space-y-3">
        {topic.replies.map((reply) => (
          <Card key={reply.id} className="profile-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AuthorBadge authorId={reply.authorId} authorName={reply.authorName} size="sm" />
                <span className="text-xs text-muted-foreground">· {formatDate(reply.createdAt)}</span>
              </div>
              <p className="text-sm leading-relaxed pl-9">{reply.content}</p>
              <div className="flex items-center gap-1 pl-9 mt-2">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                  <ThumbsUp className="w-3 h-3 mr-1" /> {reply.likes}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reply input */}
      <div className="flex gap-2 pt-2 pb-4">
        <Input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Написать ответ..."
          onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
          className="flex-1"
        />
        <Button onClick={handleSendReply} disabled={!replyText.trim() || isSending}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default TopicDetail;
