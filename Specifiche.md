## Progetto

Il Progetto consiste nel realizzare un chatbot AI-based integrando front end, back end e modelli AI, che aiuti gli utenti a orientarsi tra i corsi di incluDO in base alle loro preferenze di studio.

Si richiede di sviluppare:

- Il front end con React (mia preferenza per frontend), in stile chat.
- Il back end con Node.js (mia preferenza per backend) con integrata l’AI.
- Il system prompt dell’LLM.
- La RAG.
- Il sistema di memoria.

## Descrizione del Cliente: IncluDO

### Da dove nasce l’idea

I fondatori, marito e moglie, hanno visto il loro paese svuotarsi nel tempo, con la chiusura di molte botteghe storiche. Le poche rimaste faticano a trovare giovani disposti a imparare questi mestieri, mettendo a rischio la sopravvivenza di queste attività.

IncluDO nasce per preservare e trasmettere queste competenze, offrendo al contempo opportunità di formazione e inserimento lavorativo a chi ne ha più bisogno.

### Vision

🤝 Diventare un punto di riferimento nella formazione di mestieri tradizionali, rendendoli accessibili a migranti e persone in riabilitazione sociale.

### Mission

Creare percorsi di formazione per includere nel mondo del lavoro migranti e persone svantaggiate, contribuendo a salvaguardare mestieri artigianali destinati a scomparire.

### Chi siamo

I fondatori provengono dal mondo del no profit e hanno voluto unire le loro competenze per dare vita a un progetto che coniuga inclusione sociale e tutela delle tradizioni locali.

### Come funziona

IncluDO organizza percorsi professionali gratuiti, sviluppati in collaborazione con artigiani locali, che insegnano il proprio mestiere alle nuove generazioni.

I percorsi sono gratuiti e vengono finanziati in parte attraverso fondi europei e regionali per il ripopolamento dei borghi e in parte attraverso sponsorizzazioni di aziende locali.

Per supportare il loro percorso, gli allievi organizzano workshop per turisti, dove possono mettere in pratica quanto appreso e contribuire in parte al finanziamento della propria formazione.

## Premessa per usare la RAG correttamente

Quando una persona parla con un chatbot, non fornisce subito tutte le informazioni utili.

In genere la conversazione procede così:

- L’utente fa una domanda incompleta.
- Il chatbot chiede chiarimenti.
- L’utente aggiunge dettagli.
  - Solo quando tutti i pezzi sono completi il chatbot può dare una risposta “giusta”.
    Questo è lo stesso processo che useremmo parlando con un umano.

Se il chatbot chiamasse la RAG a ogni messaggio, sprecherebbe risorse, eseguirebbe ricerche inutili e soprattutto recupererebbe contenuti non allineati alla domanda finale.

Per risolvere questo problema, quasi tutte le architetture moderne fanno una cosa semplice ed elegante: la RAG viene registrata come una function call / tool dell’LLM.

Questo significa che:

- Il modello ha una funzione disponibile, per esempio searchCourses() o RAGQuery().
- L’LLM decide autonomamente quando chiamarla.
- Se l’utente non ha ancora dato abbastanza informazioni, il modello continua la conversazione senza chiamare la RAG.
- Solo quando percepisce che la domanda è completa, fa la chiamata alla funzione.

Per esempio:

Utente: “Voglio trovare un corso di programmazione”
LLM: “Hai preferenze sul linguaggio o sulla durata?”
Utente: “Sì, vorrei un corso breve, su JavaScript e se possibile da remoto.”
LLM → chiama il tool → searchCourses({ skills: ["javascript"], duration: "short", remote: true })
Questa logica è efficace perché:

Riduce l’onere dello sviluppatore.
Mantiene la conversazione naturale.
Dà all’LLM il controllo totale del “momento giusto”.
È uno dei pattern più raffinati dell’AI.

## Requisiti

Dovrai creare le descrizioni di tutti i corsi disponibili su incluDo, puoi farlo usando un’AI.

Per ogni corso devi definire: Titolo, Descrizione, Durata, Se è erogato da remoto o meno, skills che sviluppa questo corso.

Crea un sistema RAG per strutturare e interrogare efficacemente queste informazioni.

Crea i file json per ogni corso:
[
{
"id": "course-web-dev",
"title": "Web Development",
"description": "Impari a creare siti web con HTML, CSS, JS...",
"skills": ["HTML", "CSS", "JavaScript", "React"],
"duration": "3 mesi",
"remote": true
}
]

Nel tuo back end crea un endpoint a cui passi il json sopra.

A questo punto nel back end generi la stringa di testo da embeddare tipo:
"Web Development. Impari a creare siti web con HTML, CSS, JavaScript e React. Durata: 3 mesi. Skill: HTML, CSS, JS, React. Remoto: sì."

Crea l’embedding della stringa di cui sopra.
Inserisci nel DB tutto:
{
"id": "course-web-dev",
"vector": [-0.0123, 0.88, 0.234, ...], // embedding
"metadata": {
"title": "Web Development",
"duration": "3 mesi",
"remote": true,
"skills": ["HTML", "CSS", "JavaScript", "React"]
}
}

Crea nel tuo back end un endpoint che prenda come input il messaggio dell’utente e usi la RAG per trovare i corsi corretti, per il system prompt vedi la sezione sotto.

Non dimenticare la persistenza dei dati conversazionali, fondamentali per recuperare tutte le informazioni sulla chat.

Crea la UI nel front end, deve essere una chat.

Il deploy deve essere effettuato su Firebase.

## System prompt

### Ruolo

“Sei un chatbot esperto di orientamento formativo…”

### Obiettivo

“Il tuo scopo è analizzare il profilo dell’utente e consigliare i corsi migliori…”

### Informazioni da raccogliere

Area di interesse (AI, programmazione, marketing, UX…)
Tempo disponibile a settimana
Preferenza remoto/presenza
Obiettivo finale (trovare lavoro, acquisire una skill, cambiare carriera)
Livello attuale (principiante, intermedio…)

### Stile

Fai domande una per volta
Non dare raccomandazioni prima della fine

### Risultato

Suggerisci max 2 corsi
Spiega perché sono coerenti con la personalità dell’utente
