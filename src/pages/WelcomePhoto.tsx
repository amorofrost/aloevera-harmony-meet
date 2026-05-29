import React, { useRef, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { showApiError } from '@/lib/apiError';
import { usersApi } from '@/services/api/usersApi';
import { apiClient } from '@/services/api';
import { useLanguage } from '@/contexts/LanguageContext';
import heroBg from '@/assets/hero-bg.jpg';
import appIcon from '@/assets/app-icon.jpg';

const WelcomePhoto: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const state = location.state as { userId: string } | null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!apiClient.getAccessToken() || !state?.userId) {
    return <Navigate to="/" replace />;
  }

  const { userId } = state;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    e.target.value = '';
  }

  async function handleSave() {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await usersApi.uploadProfileImage(userId, file);
      if (!res.success) {
        showApiError(res, t('welcomePhoto.uploadFailed'));
        return;
      }
      toast.success(t('welcomePhoto.photoSaved'));
      navigate('/friends', { replace: true });
    } catch (err) {
      showApiError(err, t('welcomePhoto.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 hero-gradient opacity-80" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="mb-6 floating">
          <img src={appIcon} alt="AloeVera" className="w-20 h-20 rounded-3xl shadow-2xl glow" />
        </div>

        <div className="w-full max-w-sm">
          <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <div>
              <h2 className="text-2xl font-bold text-white">{t('welcomePhoto.title')}</h2>
              <p className="text-sm text-white/70 mt-2">
                {t('welcomePhoto.description')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mx-auto w-32 h-32 rounded-full overflow-hidden flex items-center justify-center bg-white/20 border-2 border-dashed border-white/50 hover:border-white transition-colors"
            >
              {previewUrl ? (
                <img src={previewUrl} alt={t('welcomePhoto.previewAlt')} className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-10 h-10 text-white/70" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            <Button
              onClick={handleSave}
              disabled={!file || isUploading}
              size="lg"
              className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t('welcomePhoto.saving')}
                </>
              ) : (
                t('welcomePhoto.savePhoto')
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePhoto;
