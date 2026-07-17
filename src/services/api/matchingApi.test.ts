import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub out API mode so we stay in mock mode for all tests in this file.
vi.mock('@/config/api.config', () => ({
  API_CONFIG: { mode: 'mock', baseURL: '', timeout: 30000 },
  isApiMode: () => false,
  isMockMode: () => true,
}));

// Stub out apiClient so getCurrentUserIdFromToken has a token to decode.
// The payload below decodes to { nameid: 'mock-user-1' }.
const MOCK_TOKEN = [
  'header',
  btoa(JSON.stringify({ nameid: 'mock-user-1' })),
  'sig',
].join('.');

vi.mock('@/services/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    postForm: vi.fn(),
    getAccessToken: vi.fn(() => MOCK_TOKEN),
  },
  // A vi.fn (default: mock mode) so individual tests can flip to api-mode
  // for a single call via mockReturnValueOnce(true).
  isApiMode: vi.fn(() => false),
}));

import { matchingApi, getCurrentUserIdFromToken } from './matchingApi';
import { apiClient, isApiMode } from './apiClient';
import { mockMatches, mockSentLikes, mockReceivedLikes, mockSearchProfiles } from '@/data/mockProfiles';

describe('getCurrentUserIdFromToken', () => {
  it('decodes the nameid claim from the stored JWT', () => {
    expect(getCurrentUserIdFromToken()).toBe('mock-user-1');
  });
});

describe('matchingApi — mock mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSearchProfiles returns profiles excluding the current user', async () => {
    const res = await matchingApi.getSearchProfiles();
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    // The current user (mock-user-1) should not appear in the results.
    expect(res.data?.every(u => u.id !== 'mock-user-1')).toBe(true);
  });

  it('getSearchProfiles returns a non-empty list when mock profiles exist', async () => {
    const allExceptMe = mockSearchProfiles.filter(u => u.id !== 'mock-user-1');
    const res = await matchingApi.getSearchProfiles();
    expect(res.data?.length).toBe(allExceptMe.length);
  });

  it('getMatches returns mock matches', async () => {
    const res = await matchingApi.getMatches();
    expect(res.success).toBe(true);
    expect(res.data?.length).toBe(mockMatches.length);
  });

  it('getMatches result items each have an otherUser object', async () => {
    const res = await matchingApi.getMatches();
    for (const m of res.data ?? []) {
      expect(m.otherUser).toBeDefined();
      expect(typeof m.otherUser.id).toBe('string');
    }
  });

  it('getSentLikes returns mock sent likes', async () => {
    const res = await matchingApi.getSentLikes();
    expect(res.success).toBe(true);
    expect(res.data?.length).toBe(mockSentLikes.length);
  });

  it('getSentLikes result items each have a toUser object', async () => {
    const res = await matchingApi.getSentLikes();
    for (const l of res.data ?? []) {
      expect(l.toUser).toBeDefined();
    }
  });

  it('getReceivedLikes returns mock received likes', async () => {
    const res = await matchingApi.getReceivedLikes();
    expect(res.success).toBe(true);
    expect(res.data?.length).toBe(mockReceivedLikes.length);
  });

  it('getReceivedLikes result items each have a fromUser object', async () => {
    const res = await matchingApi.getReceivedLikes();
    for (const l of res.data ?? []) {
      expect(l.fromUser).toBeDefined();
    }
  });

  it('sendLike returns isMatch=false in mock mode', async () => {
    const res = await matchingApi.sendLike('some-user');
    expect(res.success).toBe(true);
    expect(res.data?.isMatch).toBe(false);
  });
});

describe('matchingApi — api mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sendLike posts anonymous:true when requested (api mode)', async () => {
    vi.mocked(isApiMode).mockReturnValueOnce(true);
    const postSpy = vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: { isMatch: false }, timestamp: '' });

    await matchingApi.sendLike('u2', true);

    expect(postSpy).toHaveBeenCalledWith('/api/v1/matching/likes', { toUserId: 'u2', anonymous: true });
  });

  it('sendLike defaults anonymous:false (api mode)', async () => {
    vi.mocked(isApiMode).mockReturnValueOnce(true);
    const postSpy = vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: { isMatch: false }, timestamp: '' });

    await matchingApi.sendLike('u2');

    expect(postSpy).toHaveBeenCalledWith('/api/v1/matching/likes', { toUserId: 'u2', anonymous: false });
  });

  it('getAnonymousReceivedCount maps the {count} envelope to a number (api mode)', async () => {
    vi.mocked(isApiMode).mockReturnValueOnce(true);
    vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: { count: 3 }, timestamp: '' });

    const res = await matchingApi.getAnonymousReceivedCount();

    expect(res.success).toBe(true);
    expect(res.data).toBe(3);
  });

  it('getAnonymousReceivedCount defaults to 0 in mock mode', async () => {
    const res = await matchingApi.getAnonymousReceivedCount();
    expect(res.success).toBe(true);
    expect(res.data).toBe(0);
  });
});

describe('matchingApi — promise cache deduplication', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usersApi.getUsers is never called in mock mode (no network enrichment needed)', async () => {
    const { usersApi } = await import('@/services/api/usersApi');
    const spy = vi.spyOn(usersApi, 'getUsers');

    await Promise.all([
      matchingApi.getMatches(),
      matchingApi.getSentLikes(),
      matchingApi.getReceivedLikes(),
    ]);

    // In mock mode the three enrichment calls must not touch usersApi.getUsers at all.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
