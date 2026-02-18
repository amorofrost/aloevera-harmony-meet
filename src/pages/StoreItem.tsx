import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BottomNavigation from '@/components/ui/bottom-navigation';

interface StoreItem {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  category: string;
  description: string;
}

const mockStoreItems: StoreItem[] = [
  { id: 's1', title: 'Футболка "Новые горизонты"', price: 2500, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=800&fit=crop', category: 'Одежда', description: 'Официальная футболка из коллекции «Новые горизонты». 100% хлопок, прямой крой. Принт с логотипом AloeVera на груди и арт-работой на спине. Доступные размеры: S, M, L, XL, XXL.' },
  { id: 's2', title: 'Виниловая пластинка — Первый альбом', price: 3500, imageUrl: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=800&h=800&fit=crop', category: 'Музыка', description: 'Коллекционное издание первого альбома на виниле. Включает вкладыш с текстами песен и эксклюзивными фотографиями из студии. Вес — 180 г, качество звука Hi-Fi.' },
  { id: 's3', title: 'Постер "AloeVera Fest 2024"', price: 800, imageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=800&fit=crop', category: 'Мерч', description: 'Официальный постер фестиваля AloeVera Fest 2024. Размер 60×90 см, плотная матовая бумага. Лимитированный тираж — всего 500 экземпляров.' },
  { id: 's4', title: 'Худи "AloeVera"', price: 4500, imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=800&fit=crop', category: 'Одежда', description: 'Тёплое худи с вышитым логотипом AloeVera. Флисовая подкладка, карман-кенгуру, регулируемый капюшон. Отлично подходит для концертов на открытом воздухе.' },
];

const StoreItemPage = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const item = mockStoreItems.find((i) => i.id === itemId);

  if (!item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Товар не найден</h2>
          <Button onClick={() => navigate('/aloevera?tab=store')}>Назад</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/aloevera?tab=store')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold truncate">{item.title}</h1>
        </div>
      </div>

      <div className="h-80 bg-cover bg-center" style={{ backgroundImage: `url(${item.imageUrl})` }} />

      <div className="p-6 space-y-4">
        <Badge variant="secondary">{item.category}</Badge>
        <h2 className="text-2xl font-bold">{item.title}</h2>
        <p className="text-2xl font-bold text-primary">{item.price}₽</p>
        <p className="text-foreground leading-relaxed">{item.description}</p>
        <Button className="w-full" size="lg">
          <ShoppingBag className="w-5 h-5 mr-2" />
          Добавить в корзину
        </Button>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default StoreItemPage;
