# IncluDO - Chatbot di orientamento ai corsi

Chatbot che aiuta le persone a orientarsi tra i corsi di formazione in mestieri artigianali tradizionali offerti da IncluDO. Il progetto integra:

- Frontend React (Vite), in stile chat.
- Backend Node.js/Express, esposto come Cloud Function di Firebase.
- Mistral AI per la conversazione (con tool-calling) e per gli embeddings.
- Un sistema RAG (Retrieval Augmented Generation) sui corsi, con Firestore come vector store.
- Persistenza della cronologia conversazionale su Firestore.
- Deploy su Firebase Hosting + Cloud Functions.

**Demo pubblica**: [includo-chatbot.web.app](https://includo-chatbot.web.app)

## Acronimi usati in questo documento

RAG (Retrieval Augmented Generation), LLM (Large Language Model), API (Application Programming Interface), CLI (Command Line Interface), SDK (Software Development Kit), GCP (Google Cloud Platform), UI (User Interface).

## Struttura del repository

```
ProgettoAgentiIA/
├── data/courses.seed.json      # corsi da caricare nel sistema RAG
├── backend/functions/          # backend Node.js (Cloud Function)
├── frontend/                   # app React (Vite)
├── docs/relazione-tecnica.md   # relazione tecnica del progetto
├── firebase.json, .firebaserc, firestore.rules, firestore.indexes.json
```

## Prerequisiti

- Node.js 20.
- Un account Google con accesso a [Firebase Console](https://console.firebase.google.com).
- Un account su [console.mistral.ai](https://console.mistral.ai) per generare una API key.
- `npm install -g firebase-tools`.

## 1. Setup locale

### Backend

```bash
cd backend/functions
npm install
cp .env.example .env      # per uso con l'emulatore, vedi sezione dedicata
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Il frontend, in sviluppo, gira su `http://localhost:5173` e proxya le chiamate a `/api` verso l'emulatore Hosting (`http://127.0.0.1:5000`).

### Emulatori Firebase (sviluppo locale)

```bash
firebase emulators:start --only functions,firestore,hosting
```

Nota: la ricerca vettoriale (`findNearest`) su Firestore è una funzionalità relativamente recente; verifica che la versione degli emulatori installata la supporti. In caso di problemi, testa la RAG direttamente contro il progetto Firebase reale.

## 2. Deploy passo-passo su Firebase

1. **Crea il progetto Firebase**: vai su [Firebase Console](https://console.firebase.google.com), crea un nuovo progetto (es. `includo-chatbot`) e annota il **Project ID**.
2. **Passa al piano Blaze** (pay-as-you-go): necessario perché le Cloud Functions 2nd gen effettuano chiamate di rete in uscita verso le API di Mistral. Resti comunque entro le soglie gratuite di Firebase per un uso da progetto d'esame.
3. **Abilita le API necessarie** nella console Google Cloud dello stesso progetto: Cloud Firestore, Cloud Functions, Cloud Build, Artifact Registry.
4. **Genera una API key Mistral** su [console.mistral.ai](https://console.mistral.ai) (piano gratuito "La Plateforme", richiede solo verifica del numero di telefono, nessuna carta).
5. **Installa la Firebase CLI e autenticati**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
6. **Collega il repository al progetto Firebase**:
   ```bash
   firebase use --add
   ```
   Seleziona il progetto creato al punto 1 (aggiorna anche `.firebaserc` se necessario).
7. **Crea il database Firestore** dalla console, in modalità nativa, scegliendo una regione europea (es. `europe-southwest1`, Madrid). Usa la stessa regione per Firestore e per le Cloud Functions, per ridurre la latenza e mantenere la configurazione coerente.
8. **Configura i secret delle Cloud Functions**:
   ```bash
   firebase functions:secrets:set MISTRAL_API_KEY
   firebase functions:secrets:set ADMIN_INGEST_KEY
   ```
9. **Deploy delle regole Firestore**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
10. **Crea l'indice vettoriale** per la collezione `courses` (necessario per `findNearest`, non gestibile da `firestore.indexes.json`). Il modo più semplice è dalla console Google Cloud, senza installare `gcloud`:
    - Vai su `console.cloud.google.com/firestore/databases/-default-/indexes?project=<IL-TUO-PROJECT-ID>`, scheda **Composite**, **Create Index**.
    - **Collection ID**: `courses`
    - **Query scope**: **Collection** (non "Collection group": i corsi sono una raccolta di primo livello, non annidata)
    - Campo: **Field path** = `embedding`, tipo **Vector**, **Dimensions** = `1024` (dimensione prodotta dal modello `mistral-embed`), **Distance measure**: Cosine.

    In alternativa, con `gcloud` installato:
    ```bash
    gcloud auth login
    gcloud config set project <IL-TUO-PROJECT-ID>
    gcloud firestore indexes composite create \
      --collection-group=courses \
      --query-scope=COLLECTION \
      --field-config field-path=embedding,vector-config='{"dimension":1024,"flat":{}}'
    ```
    Verifica la sintassi esatta contro la [documentazione ufficiale aggiornata](https://firebase.google.com/docs/firestore/vector-search), poiché i flag `gcloud` per questa funzionalità sono cambiati più volte tra versioni della CLI. Attendi che l'indice risulti pronto prima di procedere.
11. **Deploy delle Cloud Functions**:
    ```bash
    firebase deploy --only functions
    ```
12. **Carica i corsi nel sistema RAG** chiamando l'endpoint di ingest (sostituisci `<ADMIN_INGEST_KEY>` e l'URL con quelli reali):
    ```bash
    curl -X POST https://<region>-<project-id>.cloudfunctions.net/api/courses/ingest \
      -H "Content-Type: application/json" \
      -H "x-admin-key: <ADMIN_INGEST_KEY>" \
      -d @data/courses.seed.json
    ```
13. **Build del frontend**:
    ```bash
    cd frontend
    npm run build
    ```
14. **Deploy dell'hosting**:
    ```bash
    firebase deploy --only hosting
    ```
15. **Test end-to-end** sull'URL pubblico mostrato al termine del deploy (es. `https://includo-chatbot.web.app`).

### Nota su Hosting e prefisso `/api`

Firebase Hosting inoltra alla Cloud Function il percorso completo della richiesta (es. `/api/ping`), mentre una chiamata diretta all'URL della funzione riceve solo la parte dopo il nome della funzione (es. `/ping`). L'app Express (`backend/functions/src/app.js`) monta quindi le stesse route sia su `/api` sia sulla radice, per rispondere correttamente in entrambi i casi: tramite il dominio Hosting in produzione, e tramite l'URL diretto della funzione durante debug/test manuali.

Se testi `/api/ping` con il browser o `curl` subito dopo un deploy e ricevi un 404 nonostante la funzione risponda correttamente all'URL diretto, è probabile una cache dell'edge CDN di Hosting sulla risposta precedente: riprova dopo qualche minuto o aggiungi un parametro di query per bypassarla (es. `?t=123`). Le richieste POST (come quelle della chat) non vengono comunque cachate.


## Documentazione aggiuntiva

Per l'architettura, le motivazioni delle scelte tecniche, i dettagli del sistema RAG e della memoria conversazionale, consulta [docs/relazione-tecnica.md](docs/relazione-tecnica.md).
