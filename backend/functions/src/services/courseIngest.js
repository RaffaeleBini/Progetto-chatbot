const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("./firestoreClient");
const { embedText } = require("./mistralClient");

function buildEmbeddingString(course) {
  const { title, description, duration, skills, remote } = course;
  return `${title}. ${description} Durata: ${duration}. Skill: ${skills.join(", ")}. Remoto: ${remote ? "sì" : "no"}.`;
}

async function ingestCourse(course) {
  const embeddingString = buildEmbeddingString(course);
  const values = await embedText(embeddingString);

  await db
    .collection("courses")
    .doc(course.id)
    .set({
      title: course.title,
      description: course.description,
      duration: course.duration,
      remote: course.remote,
      skills: course.skills,
      embeddingString,
      embedding: FieldValue.vector(values),
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { id: course.id, title: course.title };
}

async function ingestCourses(courses) {
  const results = [];
  for (const course of courses) {
    results.push(await ingestCourse(course));
  }
  return results;
}

module.exports = { buildEmbeddingString, ingestCourse, ingestCourses };
