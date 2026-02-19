import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { blogApi } from '@/services/api';
import type { BlogPost } from '@/data/mockBlogPosts';

const BlogPostPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!postId) return;
    const load = async () => {
      setIsLoading(true);
      const res = await blogApi.getBlogPostById(postId);
      if (res.success && res.data) {
        setPost(res.data);
      } else {
        setNotFound(true);
      }
      setIsLoading(false);
    };
    load();
  }, [postId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Пост не найден</h2>
          <Button onClick={() => navigate('/aloevera?tab=blog')}>Назад</Button>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/aloevera?tab=blog')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold truncate">{post.title}</h1>
        </div>
      </div>

      <div className="h-56 bg-cover bg-center" style={{ backgroundImage: `url(${post.imageUrl})` }} />

      <div className="p-6 space-y-4">
        <h2 className="text-2xl font-bold">{post.title}</h2>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatDate(post.date)}</span>
          <span className="flex items-center gap-1"><User className="w-4 h-4" />{post.author}</span>
        </div>
        <div className="text-foreground leading-relaxed whitespace-pre-line">{post.content}</div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default BlogPostPage;
