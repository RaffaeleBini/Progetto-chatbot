import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";

export function ChatWindow({ messages, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="chat-window">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {loading && (
        <div className="message-row message-row-assistant">
          <div className="message-bubble message-bubble-assistant message-bubble-typing">Sto pensando...</div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
