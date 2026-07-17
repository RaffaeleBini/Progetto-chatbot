const { v4: uuidv4 } = require("uuid");
const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("./firestoreClient");

const HISTORY_LIMIT = 20;

async function ensureSession(sessionId) {
  const id = sessionId || uuidv4();
  const ref = db.collection("conversations").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    await ref.set({ createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }
  return id;
}

async function appendMessage(sessionId, message) {
  const conversationRef = db.collection("conversations").doc(sessionId);
  await conversationRef.collection("messages").add({
    ...message,
    createdAt: FieldValue.serverTimestamp(),
  });
  await conversationRef.update({ updatedAt: FieldValue.serverTimestamp() });
}

async function getHistory(sessionId) {
  const snapshot = await db
    .collection("conversations")
    .doc(sessionId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .limitToLast(HISTORY_LIMIT)
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

function toMistralMessages(history) {
  return history.map((message) => {
    if (message.type === "toolCalls") {
      return {
        role: "assistant",
        content: null,
        toolCalls: message.content.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      };
    }
    if (message.type === "toolResult") {
      return { role: "tool", name: message.toolName, toolCallId: message.toolCallId, content: JSON.stringify(message.content) };
    }
    return { role: message.role, content: message.content };
  });
}

module.exports = { ensureSession, appendMessage, getHistory, toMistralMessages };
