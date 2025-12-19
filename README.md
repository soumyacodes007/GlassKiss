<p align="center">
  <img src="https://img.shields.io/badge/Built%20with-Motia-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDZWMThMNCAyMkwxMiAxOEwyMCAyMlYxOFY2TDEyIDJaIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=" alt="Built with Motia"/>
  <img src="https://img.shields.io/badge/Zero--Trust-SQL%20Enforcement-00d9ff?style=for-the-badge" alt="Zero-Trust SQL"/>
  <img src="https://img.shields.io/badge/AI--Powered-Scope%20Extraction-ff6b6b?style=for-the-badge" alt="AI Powered"/>
  <img src="https://img.shields.io/badge/Pre--Execution-Blocking-10b981?style=for-the-badge" alt="Pre-Execution Blocking"/>
</p>

<h1 align="center">🔐 Glasskiss</h1>

<p align="center">
  <strong>The Zero-Trust SQL Enforcer that blocks disasters <em>before</em> they happen.</strong>
</p>

<p align="center">
  <a href="#-the-problem">Problem</a> •
  <a href="#-the-solution">Solution</a> •
  <a href="#-why-motia">Why Motia</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a>
</p>

---

## 💀 The Problem

Every engineering team's dirty secret:

> *"Developers have permanent SSH keys and database credentials to Production because 'sometimes we need to fix things fast.'"*

**The reality?**
- 🔓 Stolen laptop → Full production breach
- 😠 Disgruntled employee → `DROP TABLE users;`
- 🤦 Fat-finger typo → `DELETE FROM orders;` (no WHERE clause)
- 📋 SOC2 audit → "Who accessed what, when, and why?" → 🤷

---

## ✨ The Solution

Glasskiss is a **time-bound, Just-in-Time (JIT) access orchestrator** that provisions temporary production credentials, requires multi-party approval, streams sessions in real-time to compliance logs, and **automatically revokes access using durable timers**.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   "I need to fix user #123's billing"                                │
│                     ↓                                                │
│   🤖 AI extracts: tables=[users, billing], entity=[user:123]         │
│                     ↓                                                │
│   ✅ Access approved WITH scope enforcement                          │
│                     ↓                                                │
│   🔒 SELECT * FROM users WHERE id=123  → ✅ Allowed                   │
│   🚫 DELETE FROM users                 → ❌ BLOCKED (pre-execution)  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🏆 Why Motia?

Glasskiss isn't just a demo — it's a **production-ready architecture pattern** that would take months to build from scratch.

### Traditional Backend vs Motia

| Challenge | Traditional Backend | With Motia |
|-----------|-------------------|------------|
| **Durable Timers** | DIY with Redis/SQS + cron + failure handling | `emit('timer', { delay: '30m' })` ✨ |
| **Event-Driven Workflow** | Manual event bus, retry logic, dead letters | Built-in with automatic retries |
| **Real-Time Streaming** | WebSocket servers, connection management | `ctx.streams.push()` — done |
| **State Management** | Redis setup, serialization, TTL logic | `ctx.state.set()` with native TTL |
| **Multi-Step Approval** | Custom state machines, race conditions | Event steps with natural flow |
| **Crash Recovery** | Checkpointing, replay logic, idempotency | Durable by default |
| **Observability** | Tracing setup, log aggregation | Workbench visualization |
| **Time to Production** | 3-6 months | **1 hackathon weekend** 🚀 |

---

## 🧱 Motia Primitives Used

| Primitive | Glasskiss Usage |
|-----------|-----------------|
| **API Steps** | Access request entry, approve/reject endpoints, SQL command logging |
| **Event Steps** | Risk calculation, provisioning, monitoring, anomaly detection, revocation, audit |
| **Streams** | Real-time approval status, session logs, scope enforcement decisions |
| **State Management** | Access requests, credentials, audit trail, monitoring data |
| **Durable Timers** | Guaranteed access expiration (survives crashes!) |
| **Cron Jobs** | Daily zombie credential defense (2 AM scan) |

---

## 🏛️ Architecture

```mermaid
flowchart TB
    subgraph Entry["📝 Access Request"]
        A[Developer Request<br/>'Fix billing for user #123']
    end

    subgraph AI["🤖 AI Analysis Layer"]
        B[Risk Scorer<br/>Score: 50/100]
        C[Scope Extractor<br/>Groq LLM]
        D[Proposed Scope<br/>tables: users, billing<br/>entities: user:123]
    end

    subgraph Approval["💬 Approval Layer"]
        E[Slack Interactive<br/>Approve/Reject Buttons]
        F[Multi-Party Check<br/>High risk = 2 approvals]
    end

    subgraph Provision["🔑 Provisioning Layer"]
        G[Credential Manager<br/>CREATE USER temp_xxx]
        H[Scope Policy<br/>Attached to credentials]
        I[Durable Timer<br/>Auto-revoke in 30m]
    end

    subgraph Enforce["🛡️ Zero-Trust Enforcement"]
        J[SQL Proxy]
        K[Scope Validator<br/>Table + Entity check]
        L[Blast Radius Controller<br/>WHERE clause required]
        M{Query Safe?}
        N[✅ Execute]
        O[❌ Block + Alert]
    end

    subgraph Revoke["🚫 Revocation Layer"]
        P[Timer Expires OR<br/>Anomaly Detected]
        Q[DROP USER + Kill Sessions]
        R[AI Audit Report]
    end

    A --> B --> C --> D --> E --> F
    F -->|Approved| G --> H --> I
    H --> J --> K --> L --> M
    M -->|Yes| N
    M -->|No| O --> P
    I -->|Timer fires| P --> Q --> R

    style Entry fill:#3b82f6,color:#fff
    style AI fill:#8b5cf6,color:#fff
    style Approval fill:#f59e0b,color:#fff
    style Provision fill:#10b981,color:#fff
    style Enforce fill:#ef4444,color:#fff
    style Revoke fill:#6b7280,color:#fff
```

---

## 🎯 Features

### 1️⃣ AI-Powered Scope Extraction

**Traditional break-glass:** "I need to fix user #123's billing" → *Grants access to ALL users* 😱

**Glasskiss:** Uses **Groq LLM** to parse natural language into enforceable SQL policy:

```mermaid
flowchart LR
    subgraph Input["📝 Human Request"]
        A["'Fix billing calculation<br/>for user #123'"]
    end

    subgraph AI["🤖 Groq LLM Processing"]
        B[Entity Extraction]
        C[Table Detection]
        D[Operation Inference]
    end

    subgraph Output["🔒 Enforced Policy"]
        E["tables: ['users', 'billing']<br/>entities: [{type: 'user', id: '123'}]<br/>operations: ['SELECT', 'UPDATE']<br/>maxRows: 1"]
    end

    A --> B --> C --> D --> E

    style Input fill:#3b82f6,color:#fff
    style AI fill:#8b5cf6,color:#fff
    style Output fill:#10b981,color:#fff
```

**Why this is sophisticated:**
- Understands context: `"customer John"` → `WHERE name = 'John'`
- Handles synonyms: `"account"`, `"user"`, `"customer"` → `users` table
- Smart operation detection: `"fix"` → UPDATE, `"check"` → SELECT

---

### 2️⃣ Blast Radius Control (The Killer Feature 💣)

Most security tools are **reactive** — they tell you *after* you dropped the table.

Glasskiss is **proactive** — it blocks the query *before* it hits the database.

```mermaid
flowchart TB
    subgraph Query["Incoming SQL"]
        A["DELETE FROM users;"]
    end

    subgraph Checks["🛡️ Pre-Execution Checks"]
        B{WHERE Clause?}
        C{Table Allowed?}
        D{Operation Allowed?}
        E{Row Limit OK?}
        F{Scope Filter<br/>Matches Entity?}
    end

    subgraph Result["Decision"]
        G["❌ BLOCKED<br/>403 Forbidden<br/>'DELETE requires WHERE clause'"]
        H["✅ ALLOWED<br/>Query Executes"]
    end

    A --> B
    B -->|No| G
    B -->|Yes| C
    C -->|No| G
    C -->|Yes| D
    D -->|No| G
    D -->|Yes| E
    E -->|No| G
    E -->|Yes| F
    F -->|No| G
    F -->|Yes| H

    style Query fill:#3b82f6,color:#fff
    style Checks fill:#f59e0b,color:#fff
    style G fill:#ef4444,color:#fff
    style H fill:#10b981,color:#fff
```

| Check | Rule | Severity |
|-------|------|----------|
| **No WHERE clause** | DELETE/UPDATE must have WHERE | 🔴 Critical |
| **Row limit** | Max rows based on approval scope | 🟡 Medium |
| **Table allowlist** | Only access approved tables | 🔴 High |
| **Operation allowlist** | Only perform approved operations | 🔴 High |
| **Scope filter** | Writes must include approved entity ID | 🔴 High |

**Blocked Examples:**
```sql
-- ❌ No WHERE clause (affects all rows)
DELETE FROM users;

-- ❌ DROP operations never allowed
DROP TABLE users;

-- ❌ Wrong entity (approved for user 123, trying 999)
DELETE FROM users WHERE id = 999;

-- ✅ Correct scope
UPDATE users SET status = 'active' WHERE id = 123;
```

---

### 3️⃣ Durable Timer-Based Revocation

Access expiration that **survives crashes**. Powered by Motia's durable timers.

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GK as Glasskiss
    participant Timer as Durable Timer
    participant DB as Database

    Dev->>GK: Request 30min access
    GK->>DB: CREATE USER temp_xyz VALID UNTIL now+30m
    GK->>Timer: Schedule revocation in 30m
    Note over Timer: System crashes!
    Note over Timer: System restarts
    Timer-->>Timer: Timer survives ✓
    Timer->>GK: Timer fires at exact time
    GK->>DB: DROP USER temp_xyz
    GK->>Dev: Access revoked (Slack notification)
```

---

### 4️⃣ Real-Time Compliance Streaming

Every action streams to auditors in real-time. No more "what happened?" post-mortems.

```mermaid
flowchart LR
    subgraph Actions["Developer Actions"]
        A1["SELECT * FROM users..."]
        A2["UPDATE billing SET..."]
        A3["DELETE FROM... ❌"]
    end

    subgraph Streams["📡 Motia Streams"]
        S1[Session Log Stream]
        S2[Scope Enforcement Stream]
        S3[Audit Report Stream]
    end

    subgraph Consumers["Real-Time Consumers"]
        C1["🖥️ Workbench Dashboard"]
        C2["📊 SIEM Integration"]
        C3["🔔 Slack Alerts"]
    end

    A1 --> S1 --> C1
    A2 --> S1
    A3 --> S2 --> C3
    S1 --> C2
    S2 --> C2
    S3 --> C2

    style Actions fill:#3b82f6,color:#fff
    style Streams fill:#8b5cf6,color:#fff
    style Consumers fill:#10b981,color:#fff
```

---

### 5️⃣ Interactive Slack Approval Workflow

No context-switching. Approve or reject with buttons, right in Slack.

```mermaid
flowchart TB
    subgraph Request["Access Request"]
        A["dev_42 requests prod_postgres access<br/>Reason: 'Fix user #123 billing'"]
    end

    subgraph Slack["💬 Slack Message"]
        B["🔐 Access Request<br/>━━━━━━━━━━━━━━━<br/>Requester: dev_42<br/>Resource: prod_postgres<br/>Risk Score: 50/100<br/>Proposed Scope: users, billing<br/>━━━━━━━━━━━━━━━<br/>[✅ Approve] [❌ Reject]"]
    end

    subgraph Actions["Approver Action"]
        C["Click Approve"]
        D["Click Reject"]
    end

    subgraph Result["Outcome"]
        E["🔑 Credentials provisioned<br/>📧 DM sent to requester"]
        F["❌ Request rejected<br/>📧 Notification sent"]
    end

    A --> B
    B --> C --> E
    B --> D --> F

    style Request fill:#3b82f6,color:#fff
    style Slack fill:#f59e0b,color:#fff
    style E fill:#10b981,color:#fff
    style F fill:#ef4444,color:#fff
```

---

### 6️⃣ AI-Generated Audit Reports

After each session, AI summarizes what happened for compliance.

```mermaid
flowchart TB
    subgraph Session["📊 Session Data"]
        A1["5 SELECT queries"]
        A2["2 UPDATE queries"]
        A3["1 blocked DELETE"]
        A4["Duration: 18 minutes"]
    end

    subgraph AI["🤖 AI Audit Generator"]
        B["Groq LLM Analysis"]
    end

    subgraph Report["📋 Compliance Report"]
        C["Summary: Developer accessed user #123's<br/>billing records to fix calculation error.<br/>7 queries executed within scope.<br/>1 dangerous DELETE blocked pre-execution.<br/><br/>Risk Assessment: LOW<br/>Scope Compliance: 87.5%<br/>Recommendation: Approved pattern"]
    end

    A1 --> B
    A2 --> B
    A3 --> B
    A4 --> B
    B --> C

    style Session fill:#3b82f6,color:#fff
    style AI fill:#8b5cf6,color:#fff
    style Report fill:#10b981,color:#fff
```

---

## 🧠 Critical AI Usage: Observer, Not Actor

> **"Many AI projects just let an LLM 'do things,' which is dangerous."**

Glasskiss uses AI as a **parser**, not an **actor**. This is mature AI engineering.

```mermaid
flowchart TB
    subgraph Dangerous["❌ Naive AI Architecture"]
        D1["User: 'Fix John's billing'"]
        D2["LLM executes SQL directly"]
        D3["💥 Uncontrolled database access"]
    end

    subgraph Safe["✅ Glasskiss Architecture"]
        S1["User: 'Fix John's billing'"]
        S2["LLM extracts scope:<br/>entities: [user:john]<br/>tables: [billing]"]
        S3["Scope becomes policy"]
        S4["Policy enforced at proxy"]
        S5["LLM never touches DB"]
    end

    D1 --> D2 --> D3
    S1 --> S2 --> S3 --> S4 --> S5

    style Dangerous fill:#ef4444,color:#fff
    style Safe fill:#10b981,color:#fff
```

**The AI sandbox pattern:**
1. AI **parses** messy human input into structured policy
2. Policy is **validated** before application
3. Enforcement happens in **deterministic code**
4. AI never has direct database access

This architecture places the LLM inside a "sandbox" where its output is validated before being applied — the hallmark of production-ready AI systems.

---

## 🔒 Zero-Trust: The 2025 Security Standard

Zero-trust security is the biggest trend in enterprise software. Glasskiss embodies it:

| Zero-Trust Principle | Glasskiss Implementation |
|---------------------|--------------------------|
| **Never trust, always verify** | Every query checked against scope policy |
| **Least privilege access** | AI extracts minimum required scope from reason |
| **Assume breach** | Pre-execution blocking stops damage before it happens |
| **Continuous validation** | Real-time monitoring throughout session |
| **Explicit verification** | Multi-party approval for high-risk requests |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- (Optional) PostgreSQL for real database enforcement

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/glasskiss.git
cd glasskiss
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Required for AI features
GROQ_API_KEY=your_groq_api_key

# Optional: Slack integration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APPROVAL_CHANNEL=#security-approvals

# Optional: Real PostgreSQL enforcement
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_ADMIN_USER=postgres
POSTGRES_ADMIN_PASSWORD=your_password
```

### 3. Start the Dev Server

```bash
npm run dev
```

### 4. Open Workbench

Navigate to **http://localhost:3000/__motia** and select the `glasskiss` flow.

### 5. Test the Workflow

```bash
# Submit an access request
curl -X POST http://localhost:3000/access-request \
  -H "Content-Type: application/json" \
  -d '{
    "requester": "dev_42",
    "resource": "prod_postgres",
    "accessLevel": "READ_WRITE",
    "reason": "Fix billing calculation for user #123",
    "duration": 30
  }'
```

Watch the magic happen in Workbench! 🎩

---

## 📁 Project Structure

```
src/
├── api/                              # API Steps (Entry Points)
│   ├── access-request-api.step.ts    # Submit access request
│   ├── approve-request-api.step.ts   # Approve endpoint
│   ├── reject-request-api.step.ts    # Reject endpoint
│   └── log-command-api.step.ts       # Log SQL commands
│
├── events/                           # Event Steps (Business Logic)
│   ├── calculate-risk.step.ts        # AI risk scoring
│   ├── request-approval.step.ts      # Slack approval workflow
│   ├── provision-credentials.step.ts # Generate temp creds + scope
│   ├── start-timer.step.ts           # Durable access timer
│   ├── start-monitoring.step.ts      # Session monitoring
│   ├── detect-anomaly.step.ts        # SQL watchdog
│   ├── revoke-access.step.ts         # Credential revocation
│   └── generate-audit.step.ts        # AI compliance report
│
├── cron/                             # Scheduled Tasks
│   └── check-active-creds.cron.step.ts # Zombie defense
│
├── streams/                          # Real-Time Streams
│   ├── approval-stream.stream.ts     # Approval status
│   ├── session-log.stream.ts         # Command logs
│   ├── scope-enforcement.stream.ts   # Enforcement decisions
│   └── audit-report.stream.ts        # Audit reports
│
└── services/                         # Core Business Logic
    ├── ai-service.ts                 # Groq integration
    ├── scope-analyzer.ts             # Reason → SQL scope
    ├── blast-radius-controller.ts    # Pre-execution guardrails
    ├── risk-analyzer.ts              # Risk scoring
    ├── credential-manager.ts         # PostgreSQL provisioning
    ├── slack-service.ts              # Slack integration
    └── glasskiss-types.ts            # Zod schemas
```

---

## 🎥 Demo Scenarios

### ✅ Happy Path
1. Request: "Fix billing for user #123"
2. AI extracts scope → Risk calculated (low)
3. Slack approval → Credentials provisioned
4. Execute: `SELECT * FROM users WHERE id = 123` ✅
5. Timer expires → Auto-revoke
6. AI audit: "5 queries within scope, 0 violations"

### ❌ Scope Violation Path
1. Approved for user #123
2. Try: `SELECT * FROM users` (no WHERE for 123)
3. **BLOCKED**: "Query must include WHERE id = 123"
4. Slack alert sent to security channel

### 💥 Blast Radius Violation Path
1. Try: `DELETE FROM users;`
2. **BLOCKED**: "DELETE requires WHERE clause"
3. Query never reaches database

---

## 🏆 Why This Wins

| Criteria | Glasskiss |
|----------|-----------|
| **Motia Primitives** | Uses ALL primitives correctly |
| **Real Business Value** | Replaces tools like Teleport, CyberArk |
| **AI Safety** | Observer pattern — AI analyzes, never acts |
| **Fail-Closed** | Multiple failsafes ensure security |
| **Zero-Trust** | Intent → Enforced Policy (unique!) |
| **Blast Radius Control** | Pre-execution blocking, not just detection |
| **Developer Experience** | Slack buttons, no context-switching |
| **Compliance-Ready** | Real-time streams, AI audit reports |

---

## 👥 Author

Built for the **Motia Hackathon** — showcasing the power of durable workflows, real-time streams, and human-in-the-loop orchestration.

---

## 📜 License

MIT

---

<p align="center">
  <strong>Stop granting permanent production access. Start using Glasskiss.</strong>
</p>