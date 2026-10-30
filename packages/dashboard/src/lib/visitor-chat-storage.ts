const visitorKey = (botId: string) => `desk:visitor:${botId}`;
const convKey = (botId: string) => `desk:conv:${botId}`;
const contactKey = (botId: string) => `desk:contact:${botId}`;

export type StoredVisitorContact = { dialCode: string; phoneNumber: string };

export function getStoredVisitorContact(botId: string): StoredVisitorContact | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(contactKey(botId));
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as StoredVisitorContact;
    if (p.dialCode && p.phoneNumber) return p;
  } catch {
    /* ignore */
  }
  return null;
}

export function setStoredVisitorContact(botId: string, contact: StoredVisitorContact) {
  if (typeof window === "undefined") return;
  localStorage.setItem(contactKey(botId), JSON.stringify(contact));
}

export function getOrCreateVisitorId(botId: string): string {
  if (typeof window === "undefined") return "";
  const key = visitorKey(botId);
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getStoredConversationId(botId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(convKey(botId));
}

export function setStoredConversationId(botId: string, conversationId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(convKey(botId), conversationId);
}

export function clearStoredConversationId(botId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(convKey(botId));
}
