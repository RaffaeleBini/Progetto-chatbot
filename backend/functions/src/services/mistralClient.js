const { Mistral } = require("@mistralai/mistralai");

const CHAT_MODEL = "mistral-large-latest";
const EMBEDDING_MODEL = "mistral-embed";
const EMBEDDING_DIMENSIONS = 1024;

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error("MISTRAL_API_KEY non configurata: impostala con `firebase functions:secrets:set MISTRAL_API_KEY`.");
    }
    client = new Mistral({ apiKey });
  }
  return client;
}

async function embedText(text) {
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    inputs: [text],
  });
  return response.data[0].embedding;
}

async function generateChatResponse({ messages, tools }) {
  return getClient().chat.complete({
    model: CHAT_MODEL,
    messages,
    tools,
    toolChoice: "auto",
  });
}

module.exports = { embedText, generateChatResponse, CHAT_MODEL, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
