const SESSION_STORAGE_KEY = "includo-chat-session-id";

export function getStoredSessionId() {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

export function storeSessionId(sessionId) {
  localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}
