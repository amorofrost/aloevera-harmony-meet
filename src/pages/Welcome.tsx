import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { authApi, apiClient } from '@/services/api';
import heroBg from '@/assets/hero-bg.jpg';
import appIcon from '@/assets/app-icon.jpg';

const Welcome = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showRegister, setShowRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    name: '',
    bio: '',
    location: '',
    age: '',
    gender: ''
  });

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) errors.push('One special character');
    return errors;
  };

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await authApi.login(loginData);

      if (!response.success) {
        throw new Error((response as any).error?.message || 'Login failed');
      }

      if (response.data) {
        apiClient.setAccessToken(response.data.accessToken);
        console.log('Login successful:', response.data.user);
        navigate('/friends');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Validate password
      const passwordErrors = validatePassword(registerData.password);
      if (passwordErrors.length > 0) {
        throw new Error('Password must have: ' + passwordErrors.join(', '));
      }

      // Validate required fields
      if (!registerData.email || !registerData.name) {
        throw new Error('Email and name are required');
      }

      const response = await authApi.register({
        email: registerData.email,
        password: registerData.password,
        name: registerData.name,
        age: registerData.age ? parseInt(registerData.age) : undefined,
        location: registerData.location || undefined,
        gender: registerData.gender || undefined,
        bio: registerData.bio || undefined,
      });

      if (!response.success) {
        throw new Error((response as any).error?.message || 'Registration failed');
      }

      setSuccess('Account created! Please check your email to verify your account before logging in.');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'facebook' | 'vk') => {
    // TODO: Redirect to OAuth endpoint when integrated
    // window.location.href = `${API_CONFIG.baseURL}/api/v1/auth/oauth/${provider}/login`;
    setError(`${provider} login will be available soon`);
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
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-white">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-white">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm">{success}</span>
              </div>
            </div>
          )}

          {!showRegister ? (
            // Login Form
            <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">Sign In</h2>
              
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
                    disabled={isLoading}
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
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <Button
                onClick={handleLogin}
                size="lg"
                className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  t('auth.signIn')
                )}
              </Button>
              
              {/* OAuth Buttons */}
              <div className="space-y-3 pt-4 border-t border-white/20">
                <p className="text-white/60 text-sm">Or continue with</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    onClick={() => handleOAuthLogin('google')}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                    disabled={isLoading}
                  >
                    Google
                  </Button>
                  <Button
                    onClick={() => handleOAuthLogin('facebook')}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                    disabled={isLoading}
                  >
                    Facebook
                  </Button>
                  <Button
                    onClick={() => handleOAuthLogin('vk')}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                    disabled={isLoading}
                  >
                    VK
                  </Button>
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-white/80 hover:text-white underline text-sm block w-full"
                >
                  {t('auth.noAccount')}
                </button>
                <button
                  className="text-white/60 hover:text-white/80 text-xs block w-full"
                >
                  Forgot password?
                </button>
              </div>
            </div>
          ) : (
            // Registration Form
            <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">Create Account</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-white font-medium">
                    {t('auth.email')} *
                  </Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder={t('auth.enterEmail')}
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-white/60">Your email will be used as your login</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-white font-medium">
                    Display Name *
                  </Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="Your name"
                    value={registerData.name}
                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-white font-medium">
                    {t('auth.password')} *
                  </Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder={t('auth.createPassword')}
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                  {registerData.password && (
                    <div className="text-xs text-white/70 space-y-1 mt-2">
                      {validatePassword(registerData.password).map((err, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="text-red-300">✗</span> {err}
                        </div>
                      ))}
                      {validatePassword(registerData.password).length === 0 && (
                        <div className="flex items-center gap-1 text-green-300">
                          <span>✓</span> Password meets requirements
                        </div>
                      )}
                    </div>
                  )}
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
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-white font-medium">
                      {t('auth.gender')}
                    </Label>
                    <Select 
                      value={registerData.gender} 
                      onValueChange={(value) => setRegisterData({ ...registerData, gender: value })}
                      disabled={isLoading}
                    >
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
                    disabled={isLoading}
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
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <Button
                onClick={handleRegister}
                size="lg"
                className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  t('auth.createAccount')
                )}
              </Button>
              
              {/* OAuth Buttons */}
              <div className="space-y-3 pt-4 border-t border-white/20">
                <p className="text-white/60 text-sm">Or sign up with</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    onClick={() => handleOAuthLogin('google')}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                    disabled={isLoading}
                  >
                    Google
                  </Button>
                  <Button
                    onClick={() => handleOAuthLogin('facebook')}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                    disabled={isLoading}
                  >
                    Facebook
                  </Button>
                  <Button
                    onClick={() => handleOAuthLogin('vk')}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                    disabled={isLoading}
                  >
                    VK
                  </Button>
                </div>
              </div>
              
              <div className="text-center">
                <button
                  onClick={() => setShowRegister(false)}
                  className="text-white/80 hover:text-white underline text-sm"
                  disabled={isLoading}
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