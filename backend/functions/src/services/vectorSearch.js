const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("./firestoreClient");
const { embedText } = require("./mistralClient");

async function searchCoursesByText(queryText, limit = 5) {
  const values = await embedText(queryText);

  const vectorQuery = db.collection("courses").findNearest({
    vectorField: "embedding",
    queryVector: FieldValue.vector(values),
    limit,
    distanceMeasure: "COSINE",
  });

  const snapshot = await vectorQuery.get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      description: data.description,
      duration: data.duration,
      remote: data.remote,
      skills: data.skills,
    };
  });
}

module.exports = { searchCoursesByText };
