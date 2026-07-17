const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const app = require("./src/app");

const mistralApiKey = defineSecret("MISTRAL_API_KEY");
const adminIngestKey = defineSecret("ADMIN_INGEST_KEY");

exports.api = onRequest(
  {
    region: "europe-southwest1",
    secrets: [mistralApiKey, adminIngestKey],
    cors: true,
  },
  app
);
