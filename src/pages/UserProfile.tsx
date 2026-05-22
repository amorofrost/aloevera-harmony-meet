import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersApi } from '@/services/api';
import type { User } from '@/types/user';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProfileBody } from '@/components/profile/profile-body';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { Loader2, Frown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UserProfile() {
  const { accountName } = useParams<{ accountName: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!accountName) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    usersApi.getUserByAccountName(accountName)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setUser(res.data);
        else setNotFound(true);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountName]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b p-4">
        <h1 className="text-xl font-semibold">@{accountName}</h1>
      </div>
      <div className="p-4 relative z-10">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {notFound && (
          <div className="text-center p-8 space-y-4">
            <Frown className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-semibold">{t('profile.notFound')}</p>
            <Button onClick={() => navigate('/friends')}>{t('common.backToFriends')}</Button>
          </div>
        )}
        {user && <ProfileBody user={user} />}
      </div>
      <BottomNavigation />
    </div>
  );
}
