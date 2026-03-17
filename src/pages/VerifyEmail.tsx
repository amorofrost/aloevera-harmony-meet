import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { authApi } from '@/services/api/authApi';
import heroBg from '@/assets/hero-bg.jpg';

type State = 'loading' | 'success' | 'error';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    const token = searchParams.get('token');

    // If token is absent, treat as error state immediately
    if (!token) {
      setState('error');
      return;
    }

    // Token is present, call verifyEmail API
    const verify = async () => {
      try {
        const response = await authApi.verifyEmail(token);
        if (response.success) {
          setState('success');
        } else {
          setState('error');
        }
      } catch {
        setState('error');
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 relative">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      <div className="text-center relative z-10">
        {state === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 mx-auto mb-6 animate-spin text-primary" />
            <p className="text-xl text-foreground">{t('verifyEmail.loading')}</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto mb-6 text-green-500" />
            <p className="text-xl text-foreground mb-8">{t('verifyEmail.success')}</p>
            <Button onClick={() => navigate('/')} size="lg">
              {t('verifyEmail.successButton')}
            </Button>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="w-16 h-16 mx-auto mb-6 text-destructive" />
            <p className="text-xl text-foreground mb-8">{t('verifyEmail.error')}</p>
            <Button onClick={() => navigate('/')} size="lg" variant="outline">
              {t('verifyEmail.errorButton')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
