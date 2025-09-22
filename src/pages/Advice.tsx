import React, { useState } from 'react';
import { Lightbulb, Heart, Users, Star, BookOpen, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { useLanguage } from '@/contexts/LanguageContext';

// Mock advice data
const mockAdvice = {
  daily: [
    {
      id: '1',
      title: 'Совет дня от Веры',
      content: 'Будьте собой! Настоящая связь возникает только когда вы искренни. Не бойтесь показать свои увлечения и страсти.',
      author: 'Вера (AloeVera)',
      category: 'authenticity',
      image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=300&fit=crop&crop=face'
    }
  ],
  articles: [
    {
      id: '2',
      title: 'Как начать разговор с новым человеком',
      content: 'Лучший способ начать беседу - найти общие интересы. Если вы оба фанаты AloeVera, начните с обсуждения любимых песен!',
      author: 'Психолог Анна Петрова',
      category: 'communication',
      readTime: '5 мин',
      likes: 124
    },
    {
      id: '3',
      title: 'Музыка как язык любви',
      content: 'Музыкальные предпочтения многое говорят о человеке. Обсуждение любимых исполнителей может стать началом глубокой связи.',
      author: 'Музыкальный терапевт Дмитрий Волков',
      category: 'music',
      readTime: '7 мин',
      likes: 89
    },
    {
      id: '4',
      title: 'Здоровые границы в отношениях',
      content: 'Важно помнить о своих потребностях и границах. Здоровые отношения строятся на взаимном уважении и понимании.',
      author: 'Семейный психолог Мария Иванова',
      category: 'relationships',
      readTime: '10 мин',
      likes: 156
    }
  ],
  challenges: [
    {
      id: '5',
      title: 'Вызов: Поделитесь плейлистом',
      description: 'Создайте плейлист из 5 песен AloeVera, которые описывают ваше настроение, и поделитесь с новым знакомством.',
      reward: '50 очков любви',
      participants: 342,
      completed: false
    },
    {
      id: '6',
      title: 'Неделя комплиментов',
      description: 'Делайте искренние комплименты всем своим совпадениям в течение недели. Посмотрите, как это изменит ваше общение!',
      reward: '100 очков любви',
      participants: 189,
      completed: true
    }
  ]
};

const Advice = () => {
  const [activeTab, setActiveTab] = useState('daily');
  const [completedChallenges, setCompletedChallenges] = useState<string[]>(['6']);
  const { t } = useLanguage();

  const getCategoryIcon = (category: string) => {
    const icons = {
      authenticity: Heart,
      communication: Users,
      music: Play,
      relationships: Star
    };
    return icons[category as keyof typeof icons] || Lightbulb;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      authenticity: 'bg-aloe-coral text-white',
      communication: 'bg-aloe-gold text-white',
      music: 'bg-aloe-flame text-white',
      relationships: 'bg-aloe-lavender text-white'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500 text-white';
  };

  const handleToggleChallenge = (challengeId: string) => {
    if (completedChallenges.includes(challengeId)) {
      setCompletedChallenges(completedChallenges.filter(id => id !== challengeId));
    } else {
      setCompletedChallenges([...completedChallenges, challengeId]);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-foreground">
            Советы любви
          </h1>
          <Lightbulb className="w-6 h-6 text-primary" />
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">Совет дня</TabsTrigger>
            <TabsTrigger value="articles">Статьи</TabsTrigger>
            <TabsTrigger value="challenges">Вызовы</TabsTrigger>
          </TabsList>

          {/* Daily Advice Tab */}
          <TabsContent value="daily" className="mt-6">
            {mockAdvice.daily.map((advice) => (
              <Card key={advice.id} className="profile-card mb-6">
                <CardContent className="p-0">
                  <div 
                    className="h-32 bg-cover bg-center relative rounded-t-3xl"
                    style={{ backgroundImage: `url(${advice.image})` }}
                  >
                    <div className="absolute inset-0 bg-black/40 rounded-t-3xl" />
                    <div className="absolute bottom-4 left-4 text-white">
                      <Badge className={getCategoryColor(advice.category)}>
                        Совет дня
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-3">{advice.title}</h3>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      {advice.content}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Heart className="w-4 h-4 text-primary" />
                      <span>От {advice.author}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Articles Tab */}
          <TabsContent value="articles" className="mt-6">
            <div className="space-y-4">
              {mockAdvice.articles.map((article) => {
                const CategoryIcon = getCategoryIcon(article.category);
                
                return (
                  <Card key={article.id} className="profile-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${getCategoryColor(article.category)}`}>
                          <CategoryIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">{article.title}</CardTitle>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4" />
                              <span>{article.readTime}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="w-4 h-4" />
                              <span>{article.likes}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {article.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {article.author}
                        </span>
                        <Button variant="ghost" size="sm">
                          Читать далее
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Challenges Tab */}
          <TabsContent value="challenges" className="mt-6">
            <div className="space-y-4">
              {mockAdvice.challenges.map((challenge) => {
                const isCompleted = completedChallenges.includes(challenge.id);
                
                return (
                  <Card key={challenge.id} className="profile-card">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">{challenge.title}</CardTitle>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {challenge.description}
                          </p>
                        </div>
                        <div className="ml-4">
                          {isCompleted ? (
                            <Badge className="bg-green-500 text-white">
                              Выполнено
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Активно
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{challenge.participants} участников</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span>{challenge.reward}</span>
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => handleToggleChallenge(challenge.id)}
                        className={`w-full ${isCompleted ? 'btn-match' : 'btn-like'}`}
                        variant={isCompleted ? "secondary" : "default"}
                      >
                        {isCompleted ? 'Выполнено' : 'Принять вызов'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Advice;