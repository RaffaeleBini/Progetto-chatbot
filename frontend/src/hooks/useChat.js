import { useCallback, useState } from "react";
import { getStoredSessionId, storeSessionId } from "../utils/session";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  text: "Ciao! Sono l'assistente di orientamento di IncluDO. Ti aiuto a trovare il percorso formativo più adatto a te. Per iniziare: quale mestiere o area ti incuriosisce di più?",
};

let messageCounter = 0;
function nextMessageId() {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

export function useChat() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    setMessages((prev) => [...prev, { id: nextMessageId(), role: "user", text: trimmed }]);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getStoredSessionId(), message: trimmed }),
      });

      if (!response.ok) {
        throw new Error(`Richiesta fallita con stato ${response.status}`);
      }

      const data = await response.json();
      storeSessionId(data.sessionId);

      setMessages((prev) => [
        ...prev,
        { id: nextMessageId(), role: "assistant", text: data.reply, courses: data.courses || null },
      ]);
    } catch (err) {
      setError("Non sono riuscito a contattare l'assistente. Riprova tra poco.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return { messages, loading, error, sendMessage };
}
