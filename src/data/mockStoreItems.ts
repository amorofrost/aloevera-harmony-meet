export interface StoreItem {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  category: string;
  description: string;
  externalPurchaseUrl?: string;
}

export const mockStoreItems: StoreItem[] = [
  {
    id: 's1',
    title: 'Футболка "Новые горизонты"',
    price: 2500,
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=800&fit=crop',
    category: 'Одежда',
    description: 'Официальная футболка из коллекции «Новые горизонты». 100% хлопок, прямой крой. Принт с логотипом AloeVera на груди и арт-работой на спине. Доступные размеры: S, M, L, XL, XXL.',
    externalPurchaseUrl: 'https://aloemore.ru/store/tshirt-1',
  },
  {
    id: 's2',
    title: 'Виниловая пластинка — Первый альбом',
    price: 3500,
    imageUrl: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=800&h=800&fit=crop',
    category: 'Музыка',
    description: 'Коллекционное издание первого альбома на виниле. Включает вкладыш с текстами песен и эксклюзивными фотографиями из студии. Вес — 180 г, качество звука Hi-Fi.',
    externalPurchaseUrl: 'https://aloemore.ru/store/vinyl-1',
  },
  {
    id: 's3',
    title: 'Постер "AloeVera Fest 2024"',
    price: 800,
    imageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=800&fit=crop',
    category: 'Мерч',
    description: 'Официальный постер фестиваля AloeVera Fest 2024. Размер 60×90 см, плотная матовая бумага. Лимитированный тираж — всего 500 экземпляров.',
    externalPurchaseUrl: 'https://aloemore.ru/store/poster-1',
  },
  {
    id: 's4',
    title: 'Худи "AloeVera"',
    price: 4500,
    imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=800&fit=crop',
    category: 'Одежда',
    description: 'Тёплое худи с вышитым логотипом AloeVera. Флисовая подкладка, карман-кенгуру, регулируемый капюшон. Отлично подходит для концертов на открытом воздухе.',
    externalPurchaseUrl: 'https://aloemore.ru/store/hoodie-1',
  },
];
