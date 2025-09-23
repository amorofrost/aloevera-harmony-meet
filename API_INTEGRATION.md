# 🔌 Backend API Integration Guide

This document explains how the frontend dating app connects to your backend microservice.

## 📁 Files Added/Modified

### **`src/lib/api.ts`** - API Client
- **Purpose:** Central API client for communicating with backend microservice
- **Features:**
  - Handles API requests with proper error handling
  - Supports self-signed SSL certificates (development)
  - Configurable base URL via environment variables
  - TypeScript typed responses

### **`src/hooks/use-api.ts`** - React API Hook
- **Purpose:** React hook for managing API call state
- **Features:**
  - Loading, error, and success states
  - Reusable across components
  - Automatic state management

### **`src/vite-env.d.ts`** - TypeScript Environment Types
- **Purpose:** Defines TypeScript types for environment variables
- **Added:** `VITE_API_URL` and other environment variable types

### **`src/pages/Profile.tsx`** - Updated Profile Component
- **Added:** API test button in settings section
- **Features:**
  - Test backend connectivity
  - Display API response in real-time
  - Error handling with user-friendly messages

### **`.env.example`** - Environment Configuration Template
- **Purpose:** Example environment configuration
- **Contains:** API URL and app configuration variables

## 🚀 How It Works

### 1. **API Configuration**
```typescript
// The API base URL is configurable via environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://20.153.164.3:5002';
```

### 2. **Making API Calls**
```typescript
// Health check example
export async function checkBackendHealth() {
  return apiRequest<HealthResponse>('/debug/health');
}
```

### 3. **Using in React Components**
```typescript
const healthCheck = useHealthCheck();

const handleApiTest = async () => {
  await healthCheck.execute(() => checkBackendHealth());
};
```

### 4. **Displaying Results**
The Profile component shows:
- ✅ **Success:** Green indicator + JSON response
- ❌ **Error:** Red indicator + error message
- ⏳ **Loading:** "Testing..." button state

## 🔧 Configuration

### **Environment Variables**
Create a `.env` file in project root:
```env
VITE_API_URL=https://20.153.164.3:5002
VITE_APP_NAME=AloeVera Harmony Meet
VITE_DEBUG_MODE=true
```

### **Backend URL**
- **Development:** `https://20.153.164.3:5002`
- **Production:** Set `VITE_API_URL` to your production backend URL

## 🔒 Self-Signed Certificate Handling

### **Browser Security**
Since your backend uses a self-signed certificate:

1. **First-time setup:** Visit `https://20.153.164.3:5002` directly in browser
2. **Accept certificate warning:** Click "Advanced" → "Proceed to site"
3. **API calls will work:** After accepting the certificate once

### **Error Messages**
The app provides helpful error messages:
- **Network error:** Backend not reachable
- **Certificate error:** Instructions to accept self-signed cert
- **HTTP errors:** Specific error codes and messages

## 🎯 API Test Button

### **Location**
Profile page → Settings → Below "Sign Out" button

### **Functionality**
- **Click "API Test"** → Calls `/debug/health` endpoint
- **Shows loading state** → "Testing..." button text
- **Displays result** → JSON response or error message
- **Visual indicators** → Green (success) or Red (error)

### **Sample Response**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-23T10:30:00Z",
  "version": "1.0.0",
  "environment": "development"
}
```

## 🔄 Adding More API Endpoints

### **1. Add to `api.ts`**
```typescript
export async function getUserProfile(userId: string) {
  return apiRequest<User>(`/api/users/${userId}`);
}

export async function updateUserProfile(userId: string, data: Partial<User>) {
  return apiRequest<User>(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
```

### **2. Create Custom Hook (Optional)**
```typescript
export function useUserProfile(userId: string) {
  return useApiCall<User>();
}
```

### **3. Use in Components**
```typescript
const userProfile = useUserProfile(userId);

const loadProfile = async () => {
  await userProfile.execute(() => getUserProfile(userId));
};
```

## 🚨 Common Issues & Solutions

### **"Network Error"**
- ✅ Check if backend is running on `https://20.153.164.3:5002`
- ✅ Verify firewall/network connectivity
- ✅ Check browser console for detailed error

### **"Certificate Error"**
- ✅ Visit backend URL directly in browser first
- ✅ Accept the self-signed certificate warning
- ✅ Retry the API test

### **"CORS Error"**
- ✅ Backend must include proper CORS headers
- ✅ Add frontend domain to backend CORS whitelist
- ✅ Check `Access-Control-Allow-Origin` header

### **"404 Not Found"**
- ✅ Verify `/debug/health` endpoint exists on backend
- ✅ Check backend routing configuration
- ✅ Ensure correct API URL in environment

## 📚 Next Steps

1. **Authentication:** Add login/logout API calls
2. **User Management:** Connect user profile CRUD operations
3. **Messaging:** Real-time chat API integration
4. **File Uploads:** Profile photo upload endpoint
5. **Events:** Event creation and management APIs

## 🔧 Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Set custom backend URL
VITE_API_URL=https://your-backend.com npm run dev

# Build for production
npm run build
```

The API integration is now ready for testing! Use the "API Test" button in the Profile settings to verify connectivity with your backend microservice. 🚀