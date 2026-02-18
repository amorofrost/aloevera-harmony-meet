// src/services/api/usersApi.ts
import { apiClient, isApiMode } from './apiClient';
import { mockUsers } from '@/data/mockUsers';
import type { User } from '@/types';

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
