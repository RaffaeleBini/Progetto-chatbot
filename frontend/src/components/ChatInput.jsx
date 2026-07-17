import { useState } from "react";

export function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Scrivi un messaggio..."
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !value.trim()}>
        Invia
      </button>
    </form>
  );
}
