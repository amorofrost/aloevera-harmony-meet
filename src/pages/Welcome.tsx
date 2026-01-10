import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import heroBg from '@/assets/hero-bg.jpg';
import appIcon from '@/assets/app-icon.jpg';
import { api } from '@/lib/api';

const Welcome = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showRegister, setShowRegister] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    bio: '',
    location: '',
    age: '',
    gender: ''
  });

  const handleLogin = async () => {
    try {
      await api.login(loginData.email, loginData.password);
      navigate('/search');
    } catch (e) {
      alert('Не удалось войти. Проверьте почту и пароль.');
    }
  };

  const handleRegister = async () => {
    try {
      await api.register({
        email: registerData.email,
        password: registerData.password,
        bio: registerData.bio,
        location: registerData.location,
        age: registerData.age ? Number(registerData.age) : undefined,
        gender: registerData.gender
      });
      navigate('/search');
    } catch (e) {
      alert('Регистрация не удалась');
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 hero-gradient opacity-80"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* App Icon */}
        <div className="mb-8 floating">
          <img 
            src={appIcon} 
            alt="AloeVera Dating" 
            className="w-24 h-24 rounded-3xl shadow-2xl glow"
          />
        </div>

        {/* Hero Text */}
        <div className="max-w-md mx-auto space-y-6">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            {t('welcome.title')}
          </h1>
          
          <p className="text-xl text-white/90 font-medium drop-shadow-md">
            {t('welcome.subtitle')}
          </p>
          
          <p className="text-lg text-white/80 drop-shadow-md leading-relaxed">
            {t('welcome.description')}
          </p>
        </div>

        {/* Login/Register Forms */}
        <div className="mt-12 w-full max-w-md">
          {!showRegister ? (
            // Login Form
            <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white font-medium">
                    {t('auth.email')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.enterEmail')}
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white font-medium">
                    {t('auth.password')}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('auth.enterPassword')}
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                  />
                </div>
              </div>
              
              <Button
                onClick={handleLogin}
                size="lg"
                className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
              >
                {t('auth.signIn')}
              </Button>
              
              <div className="text-center">
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-white/80 hover:text-white underline text-sm"
                >
                  {t('auth.noAccount')}
                </button>
              </div>
            </div>
          ) : (
            // Registration Form
            <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-white font-medium">
                    {t('auth.email')}
                  </Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder={t('auth.enterEmail')}
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-white font-medium">
                    {t('auth.password')}
                  </Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder={t('auth.createPassword')}
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age" className="text-white font-medium">
                      {t('auth.age')}
                    </Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder={t('auth.age')}
                      value={registerData.age}
                      onChange={(e) => setRegisterData({ ...registerData, age: e.target.value })}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-white font-medium">
                      {t('auth.gender')}
                    </Label>
                    <Select value={registerData.gender} onValueChange={(value) => setRegisterData({ ...registerData, gender: value })}>
                      <SelectTrigger className="bg-white/20 border-white/30 text-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t('auth.male')}</SelectItem>
                        <SelectItem value="female">{t('auth.female')}</SelectItem>
                        <SelectItem value="other">{t('auth.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-white font-medium">
                    {t('auth.location')}
                  </Label>
                  <Input
                    id="location"
                    placeholder={t('auth.cityCountry')}
                    value={registerData.location}
                    onChange={(e) => setRegisterData({ ...registerData, location: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-white font-medium">
                    {t('auth.bio')}
                  </Label>
                  <Textarea
                    id="bio"
                    placeholder={t('auth.aboutYourself')}
                    value={registerData.bio}
                    onChange={(e) => setRegisterData({ ...registerData, bio: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 min-h-[80px]"
                  />
                </div>
              </div>
              
              <Button
                onClick={handleRegister}
                size="lg"
                className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
              >
                {t('auth.createAccount')}
              </Button>
              
              <div className="text-center">
                <button
                  onClick={() => setShowRegister(false)}
                  className="text-white/80 hover:text-white underline text-sm"
                >
                  {t('auth.hasAccount')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Music Notes Animation */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 text-white/20 text-6xl floating animate-pulse">♪</div>
          <div className="absolute top-3/4 right-1/4 text-white/20 text-4xl floating animate-pulse delay-500">♫</div>
          <div className="absolute top-1/2 left-1/6 text-white/20 text-5xl floating animate-pulse delay-1000">♪</div>
          <div className="absolute bottom-1/4 left-1/2 text-white/20 text-3xl floating animate-pulse delay-1500">♫</div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;