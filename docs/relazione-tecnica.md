# Relazione tecnica - Chatbot di orientamento IncluDO

## Acronimi usati in questo documento

- RAG: Retrieval Augmented Generation
- LLM: Large Language Model
- API: Application Programming Interface
- SDK: Software Development Kit
- CLI: Command Line Interface
- GCP: Google Cloud Platform
- UI: User Interface
- UUID: Universally Unique Identifier

## 1. Introduzione

Questo documento descrive lo svolgimento del progetto: un chatbot che aiuta chi lo consulta a orientarsi tra i corsi di formazione offerti da IncluDO, un'organizzazione no-profit che forma persone migranti e persone in percorsi di riabilitazione sociale su mestieri artigianali tradizionali a rischio di scomparire.

L'obiettivo tecnico era costruire, integrando front end, back end e modelli AI, un'esperienza conversazionale che raccoglie il profilo di chi scrive attraverso una serie di domande mirate e, solo quando ha informazioni sufficienti, propone al massimo due corsi coerenti con le sue preferenze.

## 2. Architettura generale

Il sistema è composto da tre livelli:

- **Front end**: applicazione React (con Vite come strumento di build), pubblicata su Firebase Hosting. Espone un'interfaccia di chat e mantiene lato client l'identificativo di sessione.
- **Back end**: applicazione Express, eseguita come Cloud Function di Firebase (seconda generazione, basata su Cloud Run). Espone tre gruppi di endpoint: verifica di stato, gestione dei corsi e gestione della conversazione.
- **Servizi AI e dati**: Mistral AI per la generazione delle risposte (con supporto al tool-calling) e per gli embeddings; Firestore come base dati sia per il vector store dei corsi sia per la memoria conversazionale.

In produzione, Firebase Hosting reindirizza le richieste verso `/api/**` alla Cloud Function, mantenendo front end e back end sullo stesso dominio: questo evita qualunque problema di CORS (Cross-Origin Resource Sharing) e semplifica la configurazione lato client.

## 3. Dati e modellazione dei corsi

Ho definito dieci corsi coerenti con la missione di IncluDO, generati con il supporto di un'AI e poi rivisti per coerenza col dominio: falegnameria e restauro del legno, ceramica, sartoria e tessitura, lavorazione del ferro battuto, panificazione e pasticceria, restauro di mobili e beni culturali, calzoleria, liuteria, apicoltura e trasformazione agroalimentare, oltre a un corso di comunicazione digitale pensato per chi promuove i propri workshop per turisti.

Ogni corso è descritto da: `id`, `title`, `description`, `duration`, `remote` e `skills`. Ho scelto di includere un solo corso completamente da remoto perché la maggior parte dei mestieri artigianali richiede necessariamente la presenza fisica in bottega: questo riflette la realtà del dominio invece di forzare varietà artificiale nei dati.

Il file sorgente si trova in `data/courses.seed.json` e segue esattamente il formato indicato nelle specifiche del progetto. Non viene letto direttamente a runtime dal back end: è l'input che invii una tantum (o ogni volta che aggiorni il catalogo) all'endpoint di ingest.

## 4. Il sistema RAG

### 4.1 Perché il tool-calling invece di una RAG sempre attiva

Le specifiche indicano un vincolo di progettazione preciso: la RAG non deve essere interrogata a ogni messaggio, perché nella fase iniziale di una conversazione l'utente in genere non ha ancora fornito informazioni sufficienti per una ricerca pertinente. Interrogarla comunque sprecherebbe chiamate al modello di embedding e restituirebbe corsi non allineati alla richiesta reale.

Ho quindi registrato la ricerca come funzione (`searchCourses`) disponibile all'LLM tramite il meccanismo di tool-calling di Mistral (compatibile con lo standard OpenAI di function-calling). Il modello, guidato dal system prompt (sezione 6), decide autonomamente quando ha raccolto abbastanza contesto per chiamarla: se mancano ancora informazioni, continua a fare domande in linguaggio naturale, senza toccare la RAG.

### 4.2 Ingest dei corsi

L'endpoint `POST /api/courses/ingest` (protetto da una chiave amministrativa passata nell'header `x-admin-key`, verificata contro un secret di Firebase) riceve l'array di corsi e, per ciascuno:

1. Costruisce una stringa testuale naturale che riassume il corso, ad esempio: "Ceramica e lavorazione dell'argilla. Un percorso completo... Durata: 3 mesi. Skill: tornitura, modellazione, smaltatura, ceramica. Remoto: no."
2. Genera l'embedding di questa stringa chiamando il modello `mistral-embed` di Mistral AI (vettori a 1.024 dimensioni).
3. Scrive su Firestore, nella collezione `courses`, un documento con i metadati del corso e il vettore, salvato con il tipo nativo `FieldValue.vector()` richiesto dalle query vettoriali di Firestore.

### 4.3 Perché Firestore come vector store

Ho scelto Firestore, invece di un database vettoriale esterno (ad esempio Pinecone o Qdrant), perché il catalogo corsi è piccolo (dieci elementi, con margine di crescita limitato per un progetto di questo tipo) e Firestore supporta nativamente le query di similarità tramite `findNearest()`. Questo evita di introdurre un servizio esterno aggiuntivo, un account separato e una superficie di configurazione in più, restando interamente nell'ecosistema Firebase già scelto per il resto del progetto.

La creazione dell'indice vettoriale composito non è gestibile tramite `firestore.indexes.json`: nel corso del progetto l'ho creato direttamente dalla console Google Cloud (scheda "Composite" della sezione Indici di Firestore), impostando il campo `embedding` come tipo Vector con dimensione 1.024 (quella prodotta da `mistral-embed`) e ambito di query **Collection** (non "Collection group", perché `courses` è una raccolta di primo livello, non annidata sotto altri documenti). In alternativa resta disponibile il comando `gcloud firestore indexes composite create` con il flag `--field-config`, documentato nel README, utile se preferisci uno script ripetibile invece della console.

### 4.4 Flusso di una richiesta di chat

L'endpoint `POST /api/chat` riceve `{ sessionId, message }` e segue questi passi:

1. Se manca `sessionId`, ne crea uno nuovo (UUID) e lo restituisce al client, che lo persiste in `localStorage`.
2. Recupera lo storico della conversazione da Firestore (sezione 5) e vi accoda il nuovo messaggio dell'utente.
3. Chiama Mistral passando il system prompt (come primo messaggio di ruolo "system"), lo storico convertito nel formato di messaggi richiesto e la dichiarazione degli strumenti disponibili (`searchCourses` e `presentFinalCourses`).
4. Se il modello risponde con testo semplice, lo salva e lo restituisce: significa che sta ancora raccogliendo informazioni.
5. Se il modello chiama `searchCourses`, il back end costruisce una stringa di query dagli argomenti ricevuti, la trasforma in embedding, esegue `findNearest` su Firestore (cinque risultati, distanza coseno) e restituisce l'esito al modello come risposta di funzione, per un secondo turno di generazione.
6. Quando il modello è pronto a raccomandare, chiama `presentFinalCourses` dichiarando esplicitamente gli identificativi dei corsi scelti (al massimo due, troncati lato back end anche se il modello ne indicasse di più). Questo evita di dover analizzare il testo libero della risposta finale per popolare le card dei corsi nel front end: l'interfaccia riceve dati strutturati, indipendentemente da come il modello formula la frase.

## 5. Gestione della memoria conversazionale

Ogni conversazione è un documento Firestore nella collezione `conversations`, identificato dal `sessionId`. I singoli turni sono salvati in una sottocollezione `messages`, con questi campi: `role` (utente o modello), `type` (testo, chiamata di funzione o risposta di funzione), `content`, `toolName` quando pertinente e una marca temporale.

Salvare separatamente testo, chiamate di funzione e relative risposte permette di ricostruire l'intera traccia decisionale di una conversazione: quando il modello ha deciso di interrogare la RAG, con quali argomenti e cosa ha ricevuto in risposta. È utile sia in fase di debug sia per la stesura di questa stessa relazione.

Per contenere la dimensione del contesto inviato a Mistral a ogni richiesta, recupero solo gli ultimi venti turni della conversazione. È una scelta di compromesso: conversazioni molto lunghe potrebbero perdere dettagli forniti all'inizio. Una possibile estensione futura (sezione nove) è un riassunto automatico dello storico oltre una certa soglia.

## 6. Il system prompt

Il testo integrale, salvato come costante in `backend/functions/src/prompts/systemPrompt.js`, è strutturato secondo lo schema richiesto dalle specifiche:

- **Ruolo**: il chatbot si presenta come esperto di orientamento formativo per IncluDO, con una descrizione sintetica della missione dell'organizzazione, così da poter contestualizzare le proprie risposte.
- **Obiettivo**: analizzare il profilo di chi scrive e raccomandare i corsi più coerenti, basandosi su informazioni reali raccolte in conversazione, non su supposizioni.
- **Informazioni da raccogliere**: area di interesse, tempo disponibile a settimana, preferenza tra remoto e presenza, obiettivo finale, livello attuale di esperienza.
- **Stile**: una domanda alla volta, tono caldo e rispettoso (un dettaglio che ho aggiunto rispetto allo scheletro delle specifiche, per riflettere il fatto che l'utenza di IncluDO può attraversare momenti delicati), nessuna raccomandazione prima di avere informazioni sufficienti.
- **Uso obbligatorio degli strumenti**: il prompt istruisce esplicitamente il modello a non inventare corsi, durate o competenze, e a chiamare `searchCourses` invece di rispondere a memoria.
- **Risultato**: selezione di al massimo due corsi tra quelli restituiti dalla ricerca, con spiegazione del perché ciascuno è coerente con il profilo raccolto.

Il vincolo "una domanda alla volta, nessuna raccomandazione prematura" non è applicato con logica di codice esplicita, ma delegato interamente al system prompt: è il limite intrinseco (e al tempo stesso il punto di forza, in termini di naturalezza della conversazione) del pattern di tool-calling descritto nelle specifiche.

## 7. Decisioni tecniche e alternative scartate

- **Mistral AI come unico provider AI**, per chat/tool-calling ed embeddings: la scelta iniziale era ricaduta su Google Gemini, per l'integrazione nativa con l'ecosistema Firebase/Google Cloud già scelto per il resto del progetto. Durante il primo deploy reale, però, è emerso che l'account Gemini utilizzato richiedeva un saldo prepagato minimo (10 euro) per qualunque chiamata all'API, chat inclusa, non solo per gli embeddings: un vincolo di fatturazione non previsto in fase di progettazione, che contraddiceva il requisito di restare su un provider gratuito. Ho quindi sostituito Gemini con Mistral AI, che offre un piano gratuito realmente senza costi (verifica del numero di telefono, nessuna carta) e copre comunque, con un solo provider, sia la chat con tool-calling sia gli embeddings — mantenendo invariata l'architettura descritta nelle sezioni precedenti. Questo cambio ha richiesto di riscrivere il client AI, il formato di dichiarazione degli strumenti (schema stile OpenAI invece del formato nativo di Gemini) e la conversione dei messaggi di sessione, oltre a ricreare l'indice vettoriale Firestore con la nuova dimensione dei vettori (1.024 invece di 768).
- **Firestore come vector store**, invece di un database vettoriale esterno: scelta motivata dalla dimensione ridotta del catalogo corsi e dal desiderio di ridurre al minimo i servizi esterni da gestire (sezione 4.3).
- **Firestore anche per la memoria conversazionale**, invece di un file locale o SQLite: necessario perché le Cloud Functions sono ambienti serverless stateless, senza un filesystem persistente tra un'invocazione e l'altra.
- **Un'unica Cloud Function Express**, invece di una funzione separata per ogni endpoint: riduce il numero di cold start distinti da gestire e semplifica la configurazione di Firebase Hosting, a fronte di una minima perdita di granularità nello scaling, non rilevante per il volume di traffico atteso da questo progetto.
- **Tool aggiuntivo `presentFinalCourses`**, oltre al solo `searchCourses` suggerito dall'esempio delle specifiche: garantisce in modo deterministico il vincolo di massimo due corsi e fornisce al front end dati strutturati per le card, senza dover interpretare il testo libero della risposta finale.

## 8. Istruzioni di deploy

Le istruzioni dettagliate per il deploy su Firebase e per la pubblicazione su GitHub sono nel file [README.md](../README.md), per evitare di duplicarle in due documenti che potrebbero disallinearsi nel tempo.

## 9. Esempio di conversazione (testata sul deploy reale)

Questo scambio è stato eseguito realmente contro il progetto Firebase in produzione (`includo-chatbot`), non è un esempio ipotetico: conferma che raccolta del profilo, tool-calling, ricerca vettoriale su Firestore e raccomandazione finale funzionano insieme correttamente.

> **Utente**: Ciao, vorrei imparare un mestiere manuale
> **Assistente**: Ciao! È un'ottima scelta. Per cominciare, dimmi: quale tipo di mestiere manuale ti attira di più? Ad esempio: falegnameria, ceramica, sartoria, lavorazione del ferro, panificazione, restauro o altro?
> **Utente**: Mi piace lavorare il legno
> **Assistente**: Bene, la falegnameria è un mestiere bellissimo e molto richiesto. Quante ore alla settimana pensi di poter dedicare a un corso di formazione?
> **Utente**: Circa dieci ore, nei weekend
> **Assistente**: Perfetto, dieci ore nei weekend è un buon impegno. Preferisci seguire il corso in presenza o da remoto?
> **Utente**: Solo in presenza, mi piace lavorare con le mani accanto a un maestro. Sono un principiante e vorrei trovare lavoro in questo settore
> **Assistente**: *(a questo punto chiama `searchCourses`, poi `presentFinalCourses`)* Ho trovato due corsi che potrebbero fare al caso tuo, entrambi in presenza e pensati per chi parte da zero ma vuole costruirsi una vera opportunità di lavoro: **Falegnameria e restauro del legno** (4 mesi, nei weekend, si impara direttamente in bottega da un maestro) e **Restauro di mobili e beni culturali** (6 mesi, per chi si appassiona a ridare vita a mobili e oggetti storici). La risposta include entrambi i corsi come dati strutturati (`courses`), pronti per essere renderizzati come card nel front end.

Durante questo test è emerso un problema reale di configurazione, poi corretto: Firebase Hosting inoltra alla Cloud Function il percorso completo della richiesta (es. `/api/ping`), mentre l'app Express era montata senza il prefisso `/api` (funzionava solo chiamando l'URL della funzione direttamente, dove quel prefisso viene "consumato" come nome della funzione). La soluzione adottata monta le stesse route sia su `/api` sia sulla radice (`backend/functions/src/app.js`), così l'app risponde correttamente sia dietro il rewrite di Hosting sia in chiamata diretta alla funzione durante il debug.

## 10. Limitazioni note

- La ricerca vettoriale di Firestore è una funzionalità relativamente recente: verifica che la versione di `firebase-admin` in uso supporti `FieldValue.vector()` e `findNearest()`, e che il supporto negli emulatori locali sia sufficiente; in caso contrario, testa questa componente contro il progetto reale.
- Il livello gratuito di Mistral AI ha limiti di richieste al minuto piuttosto bassi: sufficienti per un progetto d'esame, ma da tenere presente in caso di dimostrazioni dal vivo con più utenti contemporanei. Le politiche di fatturazione dei provider AI possono cambiare nel tempo (come mostrato dal caso Gemini in sezione 7): è opportuno verificare periodicamente lo stato dell'account prima di una dimostrazione importante.
- Lo storico conversazionale è troncato agli ultimi venti turni, senza un meccanismo di riassunto automatico.
- L'affidabilità del tool-calling dipende dal system prompt: il modello potrebbe, in casi limite, chiamare `searchCourses` troppo presto o non chiamarlo affatto pur avendo informazioni sufficienti.
- L'endpoint di chat non richiede autenticazione utente: chiunque conosca l'URL pubblico può usarlo. È una scelta accettabile per un progetto dimostrativo, non per un servizio in produzione con utenti reali.

## 11. Possibili estensioni future

- Autenticazione degli utenti e cronologia delle conversazioni accessibile da più dispositivi.
- Pannello di amministrazione per aggiungere o aggiornare corsi senza richiamare direttamente l'endpoint di ingest.
- Supporto multilingua, rilevante per l'utenza migrante a cui IncluDO si rivolge.
- Riassunto automatico dello storico conversazionale oltre una certa lunghezza.
- Raccolta di un riscontro post-iscrizione, per misurare quanto le raccomandazioni si traducano in percorsi effettivamente intrapresi.
