import { ChatWindow } from "./components/ChatWindow";
import { ChatInput } from "./components/ChatInput";
import { useChat } from "./hooks/useChat";

export default function App() {
  const { messages, loading, error, sendMessage } = useChat();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>IncluDO</h1>
        <p>Trova il tuo percorso formativo tra i mestieri artigianali</p>
      </header>
      <main className="chat-container">
        <ChatWindow messages={messages} loading={loading} />
        {error && <p className="chat-error">{error}</p>}
        <ChatInput onSend={sendMessage} disabled={loading} />
      </main>
    </div>
  );
}
