const { searchCoursesByText } = require("../services/vectorSearch");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "searchCourses",
      description:
        "Cerca tra i corsi disponibili su IncluDO quelli più coerenti con le preferenze raccolte dall'utente. Da chiamare solo dopo aver raccolto area di interesse, tempo disponibile e preferenza remoto/presenza.",
      parameters: {
        type: "object",
        properties: {
          area: {
            type: "string",
            description: "Area di interesse o mestiere descritto dall'utente, es. 'lavorazione del legno'",
          },
          skills: {
            type: "array",
            items: { type: "string" },
            description: "Competenze specifiche menzionate dall'utente, se presenti",
          },
          duration: {
            type: "string",
            description: "Durata o tempo disponibile a settimana descritto dall'utente",
          },
          remote: {
            type: "boolean",
            description: "true se l'utente preferisce corsi da remoto, false se preferisce la presenza",
          },
          level: {
            type: "string",
            description: "Livello attuale dichiarato dall'utente: principiante, intermedio o esperto",
          },
          goal: {
            type: "string",
            description: "Obiettivo finale dell'utente: trovare lavoro, acquisire una skill, cambiare carriera",
          },
        },
        required: ["area"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "presentFinalCourses",
      description:
        "Dichiara i corsi finali raccomandati all'utente, al massimo due, tra quelli restituiti da searchCourses.",
      parameters: {
        type: "object",
        properties: {
          courseIds: {
            type: "array",
            items: { type: "string" },
            description: "Id dei corsi raccomandati (massimo due), tra quelli restituiti da searchCourses",
          },
          reasoning: {
            type: "string",
            description: "Breve motivazione di perché questi corsi sono coerenti con il profilo dell'utente",
          },
        },
        required: ["courseIds", "reasoning"],
      },
    },
  },
];

function buildSearchQueryString(args) {
  const parts = [args.area];
  if (args.skills?.length) parts.push(`Skill: ${args.skills.join(", ")}.`);
  if (args.duration) parts.push(`Durata desiderata: ${args.duration}.`);
  if (typeof args.remote === "boolean") parts.push(`Remoto: ${args.remote ? "sì" : "no"}.`);
  if (args.level) parts.push(`Livello: ${args.level}.`);
  if (args.goal) parts.push(`Obiettivo: ${args.goal}.`);
  return parts.filter(Boolean).join(" ");
}

async function runSearchCourses(args) {
  const queryString = buildSearchQueryString(args);
  return searchCoursesByText(queryString, 5);
}

module.exports = { TOOLS, runSearchCourses };
