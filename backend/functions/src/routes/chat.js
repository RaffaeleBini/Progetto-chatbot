const express = require("express");
const { db } = require("../services/firestoreClient");
const { generateChatResponse } = require("../services/mistralClient");
const { SYSTEM_PROMPT } = require("../prompts/systemPrompt");
const { TOOLS, runSearchCourses } = require("../tools/searchCoursesTool");
const { ensureSession, appendMessage, getHistory, toMistralMessages } = require("../services/sessionMemory");

const router = express.Router();
const MAX_TOOL_ROUNDS = 5;

function extractText(message) {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((chunk) => chunk.text || "").join("");
  }
  return "";
}

async function stripInternalFields(doc) {
  const { embedding, embeddingString, updatedAt, ...rest } = doc.data();
  return { id: doc.id, ...rest };
}

async function handleToolCall(name, args) {
  if (name === "searchCourses") {
    const results = await runSearchCourses(args);
    return { result: { courses: results }, suggestedCourses: null };
  }

  if (name === "presentFinalCourses") {
    const ids = (args.courseIds || []).slice(0, 2);
    const snapshots = await Promise.all(ids.map((id) => db.collection("courses").doc(id).get()));
    const suggestedCourses = await Promise.all(snapshots.filter((doc) => doc.exists).map(stripInternalFields));
    return { result: { acknowledged: true }, suggestedCourses };
  }

  return { result: { error: `Tool sconosciuto: ${name}` }, suggestedCourses: null };
}

router.post("/", async (req, res) => {
  const { sessionId: incomingSessionId, message } = req.body;

  if (typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Il campo 'message' è obbligatorio" });
  }

  try {
    const sessionId = await ensureSession(incomingSessionId);
    const history = await getHistory(sessionId);

    await appendMessage(sessionId, { role: "user", type: "text", content: message });

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...toMistralMessages(history),
      { role: "user", content: message },
    ];

    let response = await generateChatResponse({ messages, tools: TOOLS });
    let suggestedCourses = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const assistantMessage = response.choices[0].message;
      const toolCalls = assistantMessage.toolCalls;
      if (!toolCalls?.length) break;

      const parsedCalls = toolCalls.map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: JSON.parse(call.function.arguments),
      }));

      await appendMessage(sessionId, { role: "assistant", type: "toolCalls", content: parsedCalls });
      messages.push({ role: "assistant", content: assistantMessage.content ?? null, toolCalls });

      for (const call of parsedCalls) {
        const { result, suggestedCourses: newSuggestions } = await handleToolCall(call.name, call.arguments);
        if (newSuggestions) suggestedCourses = newSuggestions;

        await appendMessage(sessionId, {
          role: "tool",
          type: "toolResult",
          toolName: call.name,
          toolCallId: call.id,
          content: result,
        });
        messages.push({ role: "tool", name: call.name, toolCallId: call.id, content: JSON.stringify(result) });
      }

      response = await generateChatResponse({ messages, tools: TOOLS });
    }

    const reply = extractText(response.choices[0].message);
    await appendMessage(sessionId, { role: "assistant", type: "text", content: reply });

    res.json({ sessionId, reply, courses: suggestedCourses });
  } catch (error) {
    console.error("Errore nella gestione della chat", error);
    res.status(500).json({ error: "Errore interno durante l'elaborazione del messaggio" });
  }
});

module.exports = router;
