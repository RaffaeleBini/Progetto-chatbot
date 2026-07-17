const express = require("express");
const cors = require("cors");
const coursesRouter = require("./routes/courses");
const chatRouter = require("./routes/chat");

const app = express();
const api = express.Router();

app.use(cors());
app.use(express.json());

api.get("/ping", (_req, res) => {
  res.json({ status: "ok" });
});

api.use("/courses", coursesRouter);
api.use("/chat", chatRouter);

// Firebase Hosting inoltra il percorso completo (es. "/api/ping") alla function,
// mentre una chiamata diretta all'URL della Cloud Function riceve solo "/ping":
// montiamo le route su entrambi i prefissi per supportare i due casi.
app.use("/api", api);
app.use("/", api);

module.exports = app;
