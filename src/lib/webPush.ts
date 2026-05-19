import { pushApi } from '@/services/api';

const DEVICE_ID_KEY = 'webPushDeviceId';

export function isWebPushSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && typeof window !== 'undefined'
    && 'PushManager' in window;
}

export type SubscriptionStatus = 'subscribed' | 'denied' | 'unsupported' | 'available';

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  if (!isWebPushSupported()) return 'unsupported';
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'denied';

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'available';
  } catch {
    return 'available';
  }
}

export async function enableWebPush(): Promise<{ deviceId: string }> {
  if (!isWebPushSupported()) throw new Error('Web Push not supported in this browser');

  // Register service worker, then wait for an active registration (required for Safari 16.4+
  // first-install: register() may return a worker in installing/waiting state, and calling
  // pushManager.subscribe() on a non-active registration throws InvalidStateError).
  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;

  // Request permission
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(`Notification permission ${perm}`);

  // Fetch VAPID public key
  const vapidResp = await pushApi.getVapidPublicKey();
  const publicKey = vapidResp.data?.publicKey;
  if (!publicKey) throw new Error('VAPID public key not configured on server');

  // Subscribe
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  // Extract keys
  const subJson = sub.toJSON();
  const endpoint = subJson.endpoint!;
  const p256dh = subJson.keys!.p256dh;
  const auth = subJson.keys!.auth;

  // Read or generate deviceId
  let deviceId = localStorage.getItem(DEVICE_ID_KEY) ?? '';

  const resp = await pushApi.subscribe({
    deviceId: deviceId || undefined,
    endpoint,
    p256dh,
    auth,
    userAgent: navigator.userAgent,
  });

  if (!resp.success || !resp.data) throw new Error('Failed to register push subscription with API');

  deviceId = resp.data.deviceId;
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return { deviceId };
}

export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();

  const deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (deviceId) {
    await pushApi.unsubscribe(deviceId);
    localStorage.removeItem(DEVICE_ID_KEY);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);  // throws InvalidCharacterError on malformed input — let it propagate
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
