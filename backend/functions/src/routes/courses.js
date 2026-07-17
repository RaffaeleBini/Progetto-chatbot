const express = require("express");
const { db } = require("../services/firestoreClient");
const { ingestCourses } = require("../services/courseIngest");

const router = express.Router();

function requireAdminKey(req, res, next) {
  const provided = req.header("x-admin-key");
  const expected = process.env.ADMIN_INGEST_KEY;
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: "Non autorizzato" });
  }
  next();
}

router.post("/ingest", requireAdminKey, async (req, res) => {
  const courses = req.body;
  if (!Array.isArray(courses) || courses.length === 0) {
    return res.status(400).json({ error: "Il corpo della richiesta deve essere un array di corsi non vuoto" });
  }

  try {
    const results = await ingestCourses(courses);
    res.json({ ingested: results });
  } catch (error) {
    console.error("Errore durante l'ingest dei corsi", error);
    res.status(500).json({ error: "Errore durante l'ingest dei corsi" });
  }
});

router.get("/", async (_req, res) => {
  const snapshot = await db.collection("courses").get();
  const courses = snapshot.docs.map((doc) => {
    const { embedding, embeddingString, updatedAt, ...rest } = doc.data();
    return { id: doc.id, ...rest };
  });
  res.json({ courses });
});

module.exports = router;
