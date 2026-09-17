# DebugDiary 2.0 — Implementation Plan & Team Blueprint

---

## 0. Plain English Overview (Read This First!)

### What are we building?
**DebugDiary 2.0** is an **automated memory bank for software teams**. 
- **The Problem:** In software development, developers waste hours solving bugs that a teammate already fixed months ago.
- **The Solution:** Whenever code is pushed to GitHub, DebugDiary listens in the background, extracts *what broke* and *how it was fixed*, lets a human quickly verify it, and saves it. 
- **The Result:** When an error happens later, a developer simply pastes the error message into DebugDiary. The system shows them the exact root cause, the solution, a clickable link to the GitHub commit, and an **interactive visual graph** showing related bugs and affected code files!

---

### How the System Works in 3 Simple Steps

#### Step 1: Saving a Fix (Automated Ingestion & Review)
1. A developer pushes a bug fix to GitHub (e.g. commit message: `"Fix: resolved JWT token expiration loop"`).
2. GitHub sends a webhook message to **Ketan's Backend**.
3. **Pratibha's AI Engine** scans the code, hides any passwords or secret API keys (`[REDACTED]`), and uses Gemini AI to turn the raw diff into a structured **Incident Summary Card**:
   - *Title:* Expired JWT retry loop
   - *Symptom:* Users getting logged out after 1 hour
   - *Root Cause:* Missing refresh token in retry interceptor
   - *Resolution:* Re-attach refresh token and retry request once
   - *Affected File:* `src/api/client.ts`
4. The draft card appears in **Manika's Review Queue UI**. A senior developer clicks **"Approve"**, and it gets published into the official team database!

#### Step 2: Finding a Fix (Hybrid Search)
1. A developer encounters a terminal error: `AxiosError: 401 token expired`.
2. They paste it into **Manika's Search Assistant UI**.
3. **Pratibha's Search Engine** runs two searches at once:
   - *Keyword search:* Finds exact words like `"AxiosError"`.
   - *Meaning search (Vector Search):* Understands that `"token expired"` means `"logged out"`.
4. The UI displays ranked past solutions with exact fix steps and clickable GitHub commit links.

#### Step 3: Exploring the Visual Knowledge Graph
1. The developer clicks **"View Knowledge Graph"** for a bug.
2. **Manika's D3.js Graph Component** displays an interactive floating network of nodes:
   - **Purple Circles:** Solved Bugs
   - **Gold Circles:** Code Files (e.g. `client.ts`)
   - **Green Circles:** Tags (e.g. `authentication`)
3. **Pratibha's Similarity Mesh** automatically draws a glowing line between Bug A and Bug B if their vector similarity is higher than 70%.
4. The developer can drag nodes, zoom in, and click on neighboring bug nodes to see how different parts of the system are connected!

---

### The 3 Roles & Team Breakdown

#### ⚙️ Ketan (Backend, Database & GitHub Lead)
- **Role Analogy:** Building the house structure, database tables, and plumbing pipes.
- **Your Job:**
  1. Set up the PostgreSQL database (tables for users, workspaces, incidents, evidence).
  2. Write FastAPI login, signup, and workspace permission endpoints.
  3. Listen to GitHub webhooks when code is pushed.
  4. Write the `/api/incidents/{id}/graph-neighborhood` API so Manika can fetch graph nodes for D3.js.

#### 🧠 Pratibha (AI, Security & Search Engine Lead)
- **Role Analogy:** Building the brain, security guard, and smart search engine.
- **Your Job:**
  1. Build the **Secret Redactor** (hiding passwords/tokens as `[REDACTED]`).
  2. Write the **Gemini AI Extraction Pipeline** to convert code diffs into JSON Incident Cards.
  3. Set up **pgvector** embeddings and calculate pairwise similarity (>70% score = `SIMILAR_TO` edge).
  4. Build the **Hybrid Search Ranker** and write SQL analytics aggregation queries.

#### 🎨 Manika (Frontend, UI & Visualizations Lead)
- **Role Analogy:** Building the user interface, interactive dashboards, and visual charts.
- **Your Job:**
  1. Build the Next.js single-page application with a modern dark-theme UI.
  2. Create the **Review Queue Screen** (split-view: AI draft on left, code diff on right, Approve/Reject buttons).
  3. Create the **Interactive D3.js Knowledge Graph** (draggable nodes, color-coded types, click-to-inspect sidebar).
  4. Create the **Search Assistant Screen** and **Analytics Dashboard** (D3 charts for error trends & hotspots).

---

## 1. System Architecture & Module Division

```
                      +------------------------------------------+
                      |         Next.js Frontend (Manika)        |
                      |  - Auth & Workspace Onboarding          |
                      |  - Review Queue & Verifier Interface    |
                      |  - Natural Language Search & Citations  |
                      |  - Interactive D3.js Knowledge Graph    |
                      |  - Analytics & Hotspot Dashboards       |
                      +--------------------+---------------------+
                                           | REST APIs / JSON
                                           v
                      +--------------------+---------------------+
                      |         FastAPI Backend (Ketan)          |
                      |  - User & JWT Auth System               |
                      |  - Workspace & Repo Management           |
                      |  - GitHub OAuth & REST/Webhook Gateway  |
                      |  - Graph Neighborhood Serializer        |
                      |  - Database Models (SQLAlchemy)          |
                      +----------+-------------------+-----------+
                                 |                   |
               Internal Pipelines|                   | Database & Vectors
                                 v                   v
+--------------------------------+---+   +-----------+---------------------+
|         AI & IR Engine (Pratibha)  |   |    PostgreSQL + pgvector (K1/P2) |
|  - Rule-Based Relevance Filter     |   |  - Relational Tables (10 entities)|
|  - Sensitive Data Redaction        |   |  - Vector Embeddings & Similarity  |
|  - Gemini LLM Structured Ingest    |   |  - Similarity Mesh (Threshold >0.7)|
|  - Hybrid Search & Scoring Engine  |   +---------------------------------+
+------------------------------------+
```

---

## 2. Role-by-Role Task Ownership Matrix

### Ketan: Backend, Database & GitHub Integration Lead
- **Primary Focus:** System foundation, database design, REST endpoints, GitHub authentication, webhook processing, and graph adjacency payload serialization.
- **Key Modules Owned:**
  1. **Auth & Workspace Module:** JWT token flow, password hashing, workspace creation, membership roles.
  2. **Database Engine:** SQLAlchemy ORM models, migrations (Alembic), PostgreSQL connection pooling.
  3. **GitHub Integration Module:** GitHub OAuth, GitHub REST API client, repo synchronization, signed webhook verification.
  4. **Graph Neighborhood API Endpoint:** Endpoint (`GET /api/incidents/{id}/graph-neighborhood`) returning nodes (Incident, File, Tag, Commit) and edges (`SIMILAR_TO`, `AFFECTS_FILE`, `TAGGED_WITH`).

### Pratibha: AI, Information Retrieval & Security Lead
- **Primary Focus:** Data sanitization, structured extraction via LLMs, vector search, pgvector similarity linking, hybrid retrieval, and analytics logic.
- **Key Modules Owned:**
  1. **Sensitive Data Redaction Module:** Regex + pattern scanner to redact API keys, JWTs, passwords, and tokens before LLM processing.
  2. **AI Extraction Pipeline:** Google Gemini API integration with Pydantic JSON schema validation (Symptom, Root Cause, Resolution, Confidence).
  3. **Vector Similarity Mesh Engine:** Calculates cosine similarity between incident embeddings; automatically generates `SIMILAR_TO` edges for incidents exceeding a 0.70 similarity threshold.
  4. **Hybrid Search Engine & Analytics Aggregator:** Combines full-text SQL search with pgvector cosine similarity; aggregates metrics for repository hotspots and error trends.

### Manika: Frontend, User Experience & Analytics Lead
- **Primary Focus:** Client interface, responsive design, state management, search UI, D3.js interactive knowledge graph, and dashboard visualizer.
- **Key Modules Owned:**
  1. **Project Setup & Component System:** Next.js (App Router), TypeScript, Tailwind CSS, Reusable UI Components.
  2. **Review Queue Interface:** UI for reviewers to inspect drafts, edit root causes/fixes, approve, or reject incidents.
  3. **Interactive D3.js Knowledge Graph:** Force-directed network diagram showing connected bug nodes, shared file hotspots, and similarity links with node dragging, zoom/pan, and a click-to-inspect sidebar.
  4. **Search & Analytics Dashboards:** Natural language search bar with ranked result cards, citation references, and D3.js analytics charts.

---

## 3. Phase-by-Phase Execution Roadmap

### Phase 1: Environment & Repository Foundation (Week 1)
- **Goal:** Set up unified code repository, database containers, and shared schemas.
- **Tasks:**
  - **Ketan:** Initialize repository structure (`frontend/`, `backend/`, `infra/`), set up Docker Compose for PostgreSQL + pgvector, write SQLAlchemy base models (`User`, `Workspace`, `Repository`).
  - **Pratibha:** Set up Google Gemini API access, create Pydantic schemas for LLM structured output, test raw text redaction logic.
  - **Manika:** Initialize Next.js project with TypeScript & Tailwind CSS, set up Axios / React Query client, build layout shell and navigation sidebar.

### Phase 2: Core Backend, Auth & GitHub Ingestion (Weeks 2–3)
- **Goal:** Implement user onboarding, workspace setup, and GitHub repository synchronization.
- **Tasks:**
  - **Ketan:** Implement JWT authentication (`/api/auth/register`, `/api/auth/login`), workspace CRUD APIs, and GitHub webhook listener (`/api/webhooks/github`).
  - **Pratibha:** Build the **Rule-Based Relevance Filter** (scoring commits with `fix`, `bug`, `resolve`, `hotfix` signals to avoid unnecessary AI calls).
  - **Manika:** Build Login/Register screens, Workspace Selection page, and Repository Management page (connect repo, sync status).

### Phase 3: AI Extraction Pipeline & Security Redaction (Weeks 4–5)
- **Goal:** Transform raw commits/PRs into sanitized, structured incident drafts.
- **Tasks:**
  - **Ketan:** Build the `Incident`, `EvidenceArtifact`, and `IncidentReview` tables, link incoming webhook events to extraction jobs.
  - **Pratibha:** Build the **Sensitive Data Redaction Engine** (replacing tokens with `[REDACTED]`), connect Gemini structured extraction with retry logic, save draft incidents with status `pending_review`.
  - **Manika:** Build the **Incident Review Queue Screen** (view AI draft alongside original commit diff, edit fields, Approve/Reject buttons).

### Phase 4: Hybrid Search & Vector Graph Mesh (Weeks 6–7)
- **Goal:** Enable hybrid search ranking and D3.js interactive vector graph visualization.
- **Tasks:**
  - **Ketan:** Build `GET /api/incidents/{id}/graph-neighborhood` endpoint returning node-link JSON payloads for D3.js.
  - **Pratibha:** Setup `pgvector` similarity threshold calculation (> 0.70) to dynamically link similar bug nodes into a **Vector Similarity Mesh**.
  - **Manika:** Build the **Interactive D3.js Knowledge Graph Screen** (force-directed canvas, color-coded node types, interactive hover tooltips, click-to-inspect sidebar, and similarity weight indicators).
  - **Manika:** Build the **Search Assistant Screen** (query box, search result cards with match confidence, root cause summary, and clickable commit links).

### Phase 5: Analytics Dashboard, Polishing & Testing (Week 8)
- **Goal:** Complete analytics views, conduct testing, and finalize deployment.
- **Tasks:**
  - **Ketan:** Write API endpoints for analytics metrics (`/api/analytics/summary`, `/api/analytics/hotspots`), conduct API security audit.
  - **Pratibha:** Create benchmark test dataset (50–100 sample incidents) to measure search precision/recall, verify redaction edge cases.
  - **Manika:** Implement the **Analytics Dashboard** (D3.js / Chart.js graphs for trends, hotspots, category distribution), polish dark theme UI.

---

## 4. Detailed Step-by-Step Task Checklist by Member

### 👤 Ketan (Backend & Database)
- [ ] **Task 1.1:** Setup FastAPI project structure and PostgreSQL + pgvector Docker container.
- [ ] **Task 1.2:** Write SQLAlchemy models for `User`, `Workspace`, `WorkspaceMember`, and `Repository`.
- [ ] **Task 1.3:** Build JWT authentication middleware and password hashing with `passlib`/`bcrypt`.
- [ ] **Task 1.4:** Create workspace onboarding endpoints (`POST /api/workspaces`, `POST /api/workspaces/members`).
- [ ] **Task 1.5:** Implement GitHub OAuth and GitHub REST API helper functions to fetch commits & PRs.
- [ ] **Task 1.6:** Implement GitHub Webhook endpoint (`POST /api/webhooks/github`) with HMAC signature verification.
- [ ] **Task 1.7:** Write database models for `Incident`, `EvidenceArtifact`, `IncidentReview`, and `IncidentTag`.
- [ ] **Task 1.8:** Create Review Queue API endpoints (`GET /api/incidents/review-queue`, `POST /api/incidents/{id}/review`).
- [ ] **Task 1.9:** Build Graph Neighborhood Serializer endpoint (`GET /api/incidents/{id}/graph-neighborhood`) returning `nodes` and `links` JSON.
- [ ] **Task 1.10:** Build Analytics endpoints (`GET /api/analytics`) pulling pre-aggregated SQL queries.

### 👤 Pratibha (AI, Information Retrieval & Security)
- [ ] **Task 2.1:** Configure Google Gemini SDK (`google-generativeai`) with structured JSON response schema.
- [ ] **Task 2.2:** Build **Redaction Engine** (`redact_secrets(text: str) -> str`) scanning for API keys, tokens, emails, and passwords.
- [ ] **Task 2.3:** Build **Relevance Filter** (`is_relevant_commit(commit_msg, diff) -> bool`) checking bug keywords and test file changes.
- [ ] **Task 2.4:** Write **Extraction Pipeline Prompt** that forces Gemini to return `title`, `symptom`, `root_cause`, `resolution`, `affected_files`, `tags`, and `confidence_score`.
- [ ] **Task 2.5:** Setup text embedding generation function (`get_embedding(text: str) -> List[float]`).
- [ ] **Task 2.6:** Write pgvector SQL queries for vector similarity search.
- [ ] **Task 2.7:** Build **Vector Similarity Mesh Engine** (computing pairwise cosine similarity and generating `SIMILAR_TO` edges for scores > 0.70).
- [ ] **Task 2.8:** Build **Hybrid Ranker** combining keyword matching (PostgreSQL `tsvector`), vector similarity, and verified status.
- [ ] **Task 2.9:** Implement SQL aggregation queries for Analytics (hotspot files, frequent categories, review time).
- [ ] **Task 2.10:** Conduct precision/recall validation tests on sample bug dataset.

### 👤 Manika (Frontend & User Experience)
- [ ] **Task 3.1:** Initialize Next.js 14+ app router, TypeScript config, and Tailwind CSS.
- [ ] **Task 3.2:** Build reusable UI components (Buttons, Inputs, Cards, Modals, Badges, Tabs, Toast notifications).
- [ ] **Task 3.3:** Build Authentication pages (Login, Register with GitHub OAuth button).
- [ ] **Task 3.4:** Build Workspace & Repository Onboarding UI (connect GitHub repo, sync status indicator).
- [ ] **Task 3.5:** Build **Review Queue Screen**:
  - Split-view showing AI draft incident on the left and raw commit diff/evidence on the right.
  - Form fields allowing reviewer to edit Title, Root Cause, and Resolution.
  - Approve, Edit, and Reject action buttons.
- [ ] **Task 3.6:** Build **Interactive D3.js Knowledge Graph Screen**:
  - Force-directed canvas visualizing nodes (`Incident`, `File`, `Tag`, `Commit`) and edges (`SIMILAR_TO`, `AFFECTS_FILE`, `TAGGED_WITH`).
  - Node color coding (Purple = Incident, Gold = File, Green = Tag, Blue = Commit).
  - Node dragging, zoom/pan controls, and edge weight line thickness.
  - Click-to-inspect sidebar showing full bug story when a node is selected.
- [ ] **Task 3.7:** Build **Search Assistant Screen**:
  - Error/stack-trace input text area.
  - Ranked result cards displaying similarity score, root cause, resolution steps, and clickable commit links.
- [ ] **Task 3.8:** Build **Analytics Dashboard** using D3.js / Chart.js:
  - Incident trend line chart (incidents over time).
  - Category breakdown pie chart.
  - Repository / File hotspot list.
- [ ] **Task 3.9:** Connect all screens to FastAPI endpoints using React Query for smooth caching & loading states.
- [ ] **Task 3.10:** Perform mobile responsiveness and dark mode polish.

---

## 5. API Specifications Reference

| Method | Endpoint | Description | Assigned To |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | User registration | Ketan |
| `POST` | `/api/auth/login` | User login (JWT) | Ketan |
| `GET` | `/api/workspaces` | List user workspaces | Ketan |
| `POST` | `/api/repositories/connect` | Link GitHub repository | Ketan |
| `POST` | `/api/webhooks/github` | Receive GitHub events | Ketan |
| `GET` | `/api/incidents/review-queue` | Get pending AI drafts | Ketan / Manika |
| `POST` | `/api/incidents/{id}/review` | Approve/Edit/Reject draft | Ketan / Manika |
| `GET` | `/api/incidents/{id}/graph-neighborhood` | Fetch nodes & edges JSON for D3.js | Ketan / Manika |
| `POST` | `/api/search` | Hybrid search query | Pratibha / Ketan |
| `POST` | `/api/search/feedback` | Log user feedback | Ketan / Manika |
| `GET` | `/api/analytics/dashboard` | Get KPIs and charts data | Pratibha / Manika |

---

## 6. Viva Demonstration & Defense Strategy

1. **Ketan's Demo:** Show the GitHub webhook trigger -> Make a commit with a bug fix in a sample repo -> Demonstrate signed payload verification in backend logs.
2. **Pratibha's Demo:** Show secret redaction in action (paste a commit with a dummy API key, show it redacted as `[REDACTED_API_KEY]`) -> Explain the hybrid search scoring formula and vector similarity mesh algorithm (> 0.70 threshold).
3. **Manika's Demo:** Walk through the Review Queue UI -> Approve an incident -> Open the **Interactive D3.js Knowledge Graph** (click on nodes, demonstrate connected similar bugs and affected files) -> Open the Search Assistant -> Show ranked citations and D3.js analytics charts.
