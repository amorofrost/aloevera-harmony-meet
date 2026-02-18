import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNavigation from '@/components/ui/bottom-navigation';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: Date;
  imageUrl: string;
  author: string;
}

const mockBlogPosts: BlogPost[] = [
  {
    id: 'b1',
    title: 'За кулисами нового альбома',
    excerpt: 'Эксклюзивный репортаж из студии записи. Как создавался новый звук группы...',
    content: 'Мы провели несколько недель в студии, экспериментируя с новыми звуками и аранжировками. Каждый трек на новом альбоме — это результат долгих часов работы и вдохновения. Продюсер Алексей Козлов помог нам найти уникальное звучание, которое объединяет электронику и живые инструменты.\n\nРабота над альбомом началась ещё в прошлом году, когда мы собрались вместе после тура и поняли, что хотим двигаться в новом направлении. Мы записали более 30 демо-версий, из которых отобрали 12 лучших треков.\n\nОсобенно гордимся заглавной композицией — она стала настоящим гимном для наших фанатов. Премьера альбома состоится этой весной, и мы уже не можем дождаться, чтобы поделиться им с вами!',
    date: new Date('2024-02-20'),
    imageUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&h=400&fit=crop',
    author: 'AloeVera Team',
  },
  {
    id: 'b2',
    title: 'Итоги тура 2023',
    excerpt: 'Вспоминаем лучшие моменты прошлогоднего тура по России...',
    content: 'Тур 2023 года стал для нас самым масштабным за всю историю группы. Мы посетили 25 городов России, от Калининграда до Владивостока, и выступили перед более чем 200 000 зрителей.\n\nКаждый город запомнился чем-то особенным. В Екатеринбурге зрители устроили флешмоб с фонариками, в Новосибирске мы впервые исполнили новую песню, а в Казани нас встретили овациями ещё до начала концерта.\n\nМы благодарны каждому, кто пришёл на наши концерты. Ваша энергия — это то, что вдохновляет нас продолжать. До встречи в новом туре!',
    date: new Date('2024-01-15'),
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=400&fit=crop',
    author: 'AloeVera Team',
  },
  {
    id: 'b3',
    title: 'Интервью: О вдохновении и музыке',
    excerpt: 'Большое интервью с участниками группы о творческом процессе...',
    content: 'В этом интервью мы поговорили с участниками группы о том, что вдохновляет их на создание музыки, какие артисты повлияли на их творчество и куда движется современная музыкальная сцена.\n\n«Для меня вдохновение — это повседневная жизнь», — говорит вокалист. — «Я могу услышать мелодию в шуме города или найти текст в случайном разговоре. Главное — быть открытым миру».\n\nГитарист добавляет: «Мы слушаем очень разную музыку — от классики до электроники. Это помогает нам не замыкаться в одном жанре и постоянно искать что-то новое».\n\nБарабанщик рассказал о своём подходе к ритму: «Я всегда стараюсь найти грув, который заставит людей двигаться. Музыка должна быть живой и энергичной».',
    date: new Date('2024-02-10'),
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop',
    author: 'Music Magazine',
  },
];

const BlogPostPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();

  const post = mockBlogPosts.find((p) => p.id === postId);

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Пост не найден</h2>
          <Button onClick={() => navigate('/aloevera')}>Назад</Button>
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/aloevera')}>
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
