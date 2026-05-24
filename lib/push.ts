// Helpers for browser-side Web Push subscription lifecycle.
//
// The flow:
// 1. Register /sw.js
// 2. Ask the user for notification permission
// 3. Subscribe via PushManager using our VAPID public key
// 4. Persist the subscription in Convex
//
// The corresponding server side lives in convex/pushSubscriptions.ts and
// convex/notifications.ts.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Whether the current browser meets the prerequisites for Web Push. */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Whether VAPID is configured on the client. Server can also reject silently. */
export function isPushConfigured(): boolean {
  return !!VAPID_PUBLIC_KEY;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers aren't supported in this browser");
  }
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Returns the active subscription (if any) without prompting for permission. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await registerServiceWorker();
  return reg.pushManager.getSubscription();
}

export interface SerializedSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function serialize(sub: PushSubscription): SerializedSubscription {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

/**
 * Prompts the user, creates the subscription, and returns the serialized form
 * ready to be persisted by Convex. Throws if permission is denied or VAPID
 * isn't configured.
 */
export async function subscribePush(): Promise<SerializedSubscription> {
  if (!isPushSupported()) {
    throw new Error("Push isn't supported in this browser");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — ask an admin to configure web push"
    );
  }

  const reg = await registerServiceWorker();

  if (Notification.permission === "denied") {
    throw new Error(
      "Notifications are blocked in your browser settings — re-enable them, then try again"
    );
  }
  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      throw new Error("Permission to send notifications was not granted");
    }
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast to BufferSource — TS narrows Uint8Array<ArrayBufferLike> too
      // tightly, but the runtime expects any BufferSource.
      applicationServerKey: urlBase64ToUint8Array(
        VAPID_PUBLIC_KEY
      ) as unknown as BufferSource,
    });
  }
  return serialize(sub);
}

/**
 * Unsubscribes the current browser. Returns the endpoint that was removed
 * so callers can drop the row from Convex.
 */
export async function unsubscribePush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const reg = await registerServiceWorker();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
