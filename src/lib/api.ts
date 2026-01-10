export const api = {
  async login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json();
  },
  async register(payload: { email: string; password: string; bio?: string; location?: string; age?: number; gender?: string; name?: string; }) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Registration failed');
    return res.json();
  },
  async me() {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  },
  async getUsers() {
    const res = await fetch('/api/users', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load users');
    const data = await res.json();
    return data.map((u: any) => ({
      ...u,
      lastSeen: u.lastSeen ? new Date(u.lastSeen) : null,
      eventsAttended: u.eventsAttended?.map((e: any) => ({
        ...e,
        date: e.date ? new Date(e.date) : null,
        endDate: e.endDate ? new Date(e.endDate) : null
      }))
    }));
  },
  async getEvents() {
    const res = await fetch('/api/events', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load events');
    const data = await res.json();
    const mapDates = (e: any) => ({
      ...e,
      date: e.date ? new Date(e.date) : null,
      endDate: e.endDate ? new Date(e.endDate) : null
    });
    return {
      upcoming: data.upcoming?.map(mapDates) ?? [],
      past: data.past?.map(mapDates) ?? []
    };
  },
  async getChats() {
    const res = await fetch('/api/chats', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load chats');
    const data = await res.json();
    const mapMsg = (m: any) => m ? ({ ...m, timestamp: m.timestamp ? new Date(m.timestamp) : null }) : null;
    const mapChat = (c: any) => ({ ...c, lastMessage: mapMsg(c.lastMessage) });
    return {
      privateChats: (data.privateChats || []).map(mapChat),
      eventChats: (data.eventChats || []).map(mapChat),
      communityChats: (data.communityChats || []).map(mapChat)
    };
  },
  async sendMessage(payload: any) {
    const res = await fetch('/api/chats/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },
  async getLikes() {
    const res = await fetch('/api/likes', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load likes');
    const data = await res.json();
    return {
      matches: data.matches ?? [],
      sent: data.sent ?? [],
      received: data.received ?? []
    };
  },
  async sendLike(toUserId: string) {
    const res = await fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: '', fromUserId: 'current-user', toUserId, createdAt: new Date(), isMatch: false })
    });
    if (!res.ok) throw new Error('Failed to send like');
    return res.json();
  },
  async getAdvice() {
    const res = await fetch('/api/advice', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load advice');
    return res.json();
  },
  async getEventById(id: string) {
    const res = await fetch(`/api/events/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load event');
    const e = await res.json();
    return {
      ...e,
      date: e.date ? new Date(e.date) : null,
      endDate: e.endDate ? new Date(e.endDate) : null
    };
  }
};
