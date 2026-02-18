// src/services/api/usersApi.ts
import { apiClient, isApiMode } from './apiClient';
import type { User } from '@/types';

// Simple mock users for testing
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Test User 1',
    email: 'user1@example.com',
    age: 25,
    location: 'Test City',
    gender: 'Male',
    bio: 'Mock user 1',
    photos: [],
    preferences: {
      showMe: 'all',
      ageRange: [18, 50],
      maxDistance: 100,
      profileVisibility: 'public',
    },
    settings: {
      language: 'en',
      notifications: true,
    },
  },
  {
    id: '2',
    name: 'Test User 2',
    email: 'user2@example.com',
    age: 28,
    location: 'Another City',
    gender: 'Female',
    bio: 'Mock user 2',
    photos: [],
    preferences: {
      showMe: 'all',
      ageRange: [20, 40],
      maxDistance: 50,
      profileVisibility: 'public',
    },
    settings: {
      language: 'en',
      notifications: true,
    },
  },
];

export const usersApi = {
  // Get all users
  async getUsers(skip = 0, take = 10) {
    if (isApiMode()) {
      return apiClient.get<User[]>(`/api/v1/users?skip=${skip}&take=${take}`);
    }

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      success: true,
      data: mockUsers.slice(skip, skip + take),
      timestamp: new Date().toISOString(),
    };
  },

  // Get user by ID
  async getUserById(id: string) {
    if (isApiMode()) {
      return apiClient.get<User>(`/api/v1/users/${id}`);
    }

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 200));
    const user = mockUsers.find(u => u.id === id);
    
    if (!user) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    };
  },

  // Update user
  async updateUser(id: string, data: Partial<User>) {
    if (isApiMode()) {
      return apiClient.put<User>(`/api/v1/users/${id}`, data);
    }

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 500));
    const user = mockUsers.find(u => u.id === id);
    
    if (!user) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: { ...user, ...data },
      timestamp: new Date().toISOString(),
    };
  },
};
