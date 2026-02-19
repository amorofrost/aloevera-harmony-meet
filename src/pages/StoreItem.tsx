import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { storeApi } from '@/services/api';
import type { StoreItem } from '@/data/mockStoreItems';

const StoreItemPage = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<StoreItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    const load = async () => {
      setIsLoading(true);
      const res = await storeApi.getStoreItemById(itemId);
      if (res.success && res.data) {
        setItem(res.data);
      } else {
        setNotFound(true);
      }
      setIsLoading(false);
    };
    load();
  }, [itemId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (notFound || !item) {
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
        <Button
          className="w-full"
          size="lg"
          onClick={() => item.externalPurchaseUrl && window.open(item.externalPurchaseUrl, '_blank')}
        >
          <ShoppingBag className="w-5 h-5 mr-2" />
          Добавить в корзину
        </Button>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default StoreItemPage;
