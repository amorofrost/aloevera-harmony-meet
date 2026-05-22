import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Pin, Send, ThumbsUp, MessageSquare, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { replySchema, type ReplySchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { forumsApi } from '@/services/api';
import type { ForumTopicDetail as TopicDetailType } from '@/data/mockForumData';
import { BbcodeRenderer } from '@/components/ui/bbcode-renderer';
import { BbcodeToolbar } from '@/components/ui/bbcode-toolbar';
import { ImageAttachmentPicker } from '@/components/ui/image-attachment-picker';
import { ImageAttachmentDisplay } from '@/components/ui/image-attachment-display';
import { uploadImage } from '@/services/api/imagesApi';
import { UserBadges } from '@/components/ui/user-badges';
import { AttendedEventBadges } from '@/components/ui/attended-event-badges';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLanguage } from '@/contexts/LanguageContext';

interface TopicDetailProps {
  topicId: string;
  onBack: () => void;
}

const TopicDetail: React.FC<TopicDetailProps> = ({ topicId, onBack }) => {
  const [topic, setTopic] = useState<TopicDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const replyForm = useForm<ReplySchema>({
    resolver: zodResolver(replySchema),
  });
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canReply = (topic?.noviceCanReply ?? true) || (!!user && user.rank !== 'novice');
  const isModeratorOrAdmin = user?.staffRole === 'moderator' || user?.staffRole === 'admin';
  const canEditReply = (reply: { authorId?: string }) =>
    !!user && (reply.authorId === user.id || isModeratorOrAdmin);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const res = await forumsApi.getTopic(topicId);
      if (res.success && res.data) setTopic(res.data);
      setIsLoading(false);
    };
    load();
  }, [topicId]);

  useEffect(() => {
    let cancelled = false;
    forumsApi.getSubscription(topicId).then((r) => {
      if (cancelled) return;
      if (r.success && r.data) setIsSubscribed(r.data.subscribed);
    });
    return () => { cancelled = true; };
  }, [topicId]);

  const toggleSubscription = async () => {
    if (isSubscribing || isSubscribed === null) return;
    setIsSubscribing(true);
    const previous = isSubscribed;
    setIsSubscribed(!previous); // optimistic
    try {
      const r = previous
        ? await forumsApi.unsubscribeFromTopic(topicId)
        : await forumsApi.subscribeToTopic(topicId);
      if (!r.success) {
        setIsSubscribed(previous);
        showApiError(r, t('forum.subscribeFailed'));
      } else if (r.data) {
        setIsSubscribed(r.data.subscribed);
      }
    } catch (err) {
      setIsSubscribed(previous);
      showApiError(err, t('forum.subscribeFailed'));
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSendReply = replyForm.handleSubmit(async (data) => {
    if (isSending) return;
    setIsSending(true);
    try {
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const uploadRes = await uploadImage(file);
        imageUrls.push(uploadRes.url);
      }
      const res = await forumsApi.createReply(topicId, data.content, imageUrls);
      if (!res.success) {
        showApiError(res, 'Failed to post reply');
        return;
      }
      if (res.data && topic) {
        setTopic({
          ...topic,
          replies: [...topic.replies, res.data],
          replyCount: topic.replyCount + 1,
        });
      }
      replyForm.reset();
      setImageFiles([]);
      toast.success('Reply posted');
    } catch (err) {
      showApiError(err, 'Failed to post reply');
    } finally {
      setIsSending(false);
    }
  });

  const handleAuthorClick = (authorId?: string) => {
    if (authorId) {
      navigate(`/friends?userId=${authorId}`);
    }
  };

  const startEditing = (replyId: string, content: string) => {
    setEditingReplyId(replyId);
    setEditingContent(content);
  };

  const cancelEditing = () => {
    setEditingReplyId(null);
    setEditingContent('');
  };

  const saveEdit = async (replyId: string) => {
    if (isSavingEdit) return;
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    setIsSavingEdit(true);
    try {
      const res = await forumsApi.updateReply(topicId, replyId, trimmed);
      if (!res.success || !res.data) {
        showApiError(res, t('forum.editFailed'));
        return;
      }
      if (topic) {
        const updated = res.data;
        setTopic({
          ...topic,
          replies: topic.replies.map(r => (r.id === replyId ? { ...r, ...updated } : r)),
        });
      }
      setEditingReplyId(null);
      setEditingContent('');
      toast.success(t('forum.saveEdit'));
    } catch (err) {
      showApiError(err, t('forum.editFailed'));
    } finally {
      setIsSavingEdit(false);
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

  const AuthorBadge = ({ authorId, authorName, authorAvatar, size = 'md' }: { authorId?: string; authorName: string; authorAvatar?: string; size?: 'sm' | 'md' }) => {
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
        <div className={`${avatarSize} rounded-full overflow-hidden ${size === 'md' ? 'bg-primary/20' : 'bg-muted'} flex items-center justify-center`}>
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName}
              className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex'); }}
            />
          ) : null}
          <span
            className={`${textSize} font-semibold ${size === 'md' ? 'text-primary' : ''}`}
            style={{ display: authorAvatar ? 'none' : 'flex' }}
          >
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

  const { ref: registerRef, ...registerRest } = replyForm.register('content');

  return (
    <div className="space-y-4">
      {/* Original post */}
      <Card className="profile-card">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            {topic.isPinned && <Pin className="w-3.5 h-3.5 text-primary" />}
            <h2 className="text-lg font-bold flex-1">{topic.title}</h2>
            {isSubscribed !== null && (
              <Button
                variant={isSubscribed ? 'default' : 'outline'}
                size="sm"
                onClick={toggleSubscription}
                disabled={isSubscribing}
                className="shrink-0"
                aria-pressed={isSubscribed}
                aria-label={isSubscribed ? t('forum.unsubscribe') : t('forum.subscribe')}
              >
                {isSubscribed ? <Bell className="w-4 h-4 mr-1" /> : <BellOff className="w-4 h-4 mr-1" />}
                {isSubscribed ? t('forum.subscribed') : t('forum.subscribe')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 mb-4">
            <AuthorBadge authorId={topic.authorId} authorName={topic.authorName} authorAvatar={topic.authorAvatar} size="md" />
            <span className="text-xs text-muted-foreground">· {formatDate(topic.createdAt)}</span>
          </div>
          <BbcodeRenderer content={topic.content} />
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
        {topic.replies.map((reply) => {
          const isEditingThis = editingReplyId === reply.id;
          const mayEdit = canEditReply(reply);
          return (
          <Card key={reply.id} className="profile-card">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                <AuthorBadge authorId={reply.authorId} authorName={reply.authorName} authorAvatar={reply.authorAvatar} size="sm" />
                <AttendedEventBadges
                  imageUrls={reply.authorEventBadgeImageUrls ?? []}
                  totalCount={reply.authorEventBadgeTotalCount ?? 0}
                />
                <UserBadges rank={reply.authorRank} staffRole={reply.authorStaffRole} />
                <span className="text-xs text-muted-foreground">· {formatDate(reply.createdAt)}</span>
              </div>
              <div className="pl-9">
                {isEditingThis ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      placeholder={t('forum.editPlaceholder')}
                      className="min-h-[100px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isSavingEdit}>
                        {t('forum.cancelEdit')}
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(reply.id)} disabled={isSavingEdit || !editingContent.trim()}>
                        {isSavingEdit ? t('forum.savingEdit') : t('forum.saveEdit')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <BbcodeRenderer content={reply.content} />
                    <ImageAttachmentDisplay imageUrls={reply.imageUrls ?? []} />
                  </>
                )}
              </div>
              {!isEditingThis && (
                <div className="flex flex-wrap items-center gap-1 pl-9 mt-2">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                    <ThumbsUp className="w-3 h-3 mr-1" /> {reply.likes}
                  </Button>
                  {mayEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => startEditing(reply.id, reply.content)}
                    >
                      <Pencil className="w-3 h-3 mr-1" /> {t('forum.editReply')}
                    </Button>
                  )}
                  {reply.editedAt && (
                    <span className="text-xs text-muted-foreground italic">
                      · {t('forum.editedBy', {
                        name: reply.editedByName ?? reply.authorName,
                        date: formatDate(reply.editedAt),
                      })}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>

      {/* Reply input */}
      {canReply ? (
        <form onSubmit={handleSendReply} className="pt-2 pb-4 space-y-1">
          <div className="space-y-2">
            <div className="relative">
              <BbcodeToolbar textareaRef={contentRef} />
              <Textarea
                {...registerRest}
                ref={(el) => {
                  registerRef(el);
                  contentRef.current = el;
                }}
                placeholder="Написать ответ..."
                className="min-h-[100px]"
              />
            </div>
            <ImageAttachmentPicker files={imageFiles} onChange={setImageFiles} />
            <div className="flex justify-end">
              <Button type="submit" disabled={isSending}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {replyForm.formState.errors.content && (
            <p className="text-xs text-destructive">{replyForm.formState.errors.content.message}</p>
          )}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {t('forum.replyRestricted')}
        </p>
      )}
    </div>
  );
};

export default TopicDetail;
