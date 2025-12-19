<p align="center">
  <img src="https://img.shields.io/badge/Built%20with-Motia-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDZWMThMNCAyMkwxMiAxOEwyMCAyMlYxOFY2TDEyIDJaIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=" alt="Built with Motia"/>
  <img src="https://img.shields.io/badge/Zero--Trust-SQL%20Enforcement-b91c1c?style=for-the-badge" alt="Zero-Trust SQL"/>
  <img src="https://img.shields.io/badge/AI--Powered-Scope%20Extraction-000000?style=for-the-badge" alt="AI Powered"/>
  <img src="https://img.shields.io/badge/Pre--Execution-Blocking-b91c1c?style=for-the-badge" alt="Pre-Execution Blocking"/>
</p>

# Glasskiss

**Glasskiss is an Ephemeral Break-Glass Access Controller. It turns 'Permanent Production Access' (a huge security risk) into 'Just-in-Time Scoped Access' using Motia’s durable primitives.**

---

## Limitless Liability: The Current State of Access

**The Ticking Time Bomb**
Every engineering team has a dirty secret: Permanent SSH keys and database credentials sitting on developer laptops—just one stolen device away from a total data breach.

**Manual Failure**
Most "Break-Glass" systems rely on humans to remember to revoke access. But humans forget, scripts fail, and "temporary" access often becomes permanent liability.

**Compliance Nightmare**
SOC2 and HIPAA audits don't just want logs of what happened; they want proof that you couldn't do the wrong thing. Static credentials are an audit failure waiting to happen.

**Broad Access**
Traditional access is "all or nothing." You need to fix one row, but you're given the keys to the entire kingdom. The blast radius is catastrophic.

---

## The Solution

Glasskiss leverages Motia's powerful primitives to create a **fail-closed**, **auditable**, and **time-limited** access control system. Instead of relying on manual processes or fragile scripts, it automates the entire lifecycle of privileged access.

Key Capabilities:
*   **Just-in-Time Provisioning**: Credentials exist only when needed and expire automatically.
*   **Zero-Trust Enforcement**: Default deny. Access is granted explicitly for specific scopes.
*   **Immutable Audit Trails**: comprehensive logging of every action and policy decision.
*   **Automated Revocation**: Durable timers ensure access is removed even if systems restart.

---

## Why Motia?

Glasskiss demonstrates a production-ready architecture pattern achievable with the Motia framework.

### Traditional Backend vs Motia Architecture

| Capability | Traditional Implementation | With Motia Primitives |
|-----------|--------------------------|-----------------------|
| **Durable Timers** | Redis/SQS + Cron + Retries | Native `emit('timer')` |
| **Event Workflow** | Message Bus + Dead Letter Queues | Built-in Event Steps |
| **Real-Time Streams** | WebSocket Server Management | `ctx.streams.push()` |
| **State Management** | Redis Serialization/TTL | Native `ctx.state` |
| **Multi-Step Approval** | Complex State Machines | Linear Event Flow |
| **Crash Recovery** | Manual Checkpointing | Durable by Design |

---

## Motia Primitives Integration

| Primitive | Implementation in Glasskiss |
|-----------|-----------------------------|
| **AI Agents** | "Observer" Agents for scope extraction and risk analysis |
| **API Steps** | Access request handling, approval endpoints, command logging |
| **Event Steps** | Risk calculation, provisioning, monitoring, revocation logic |
| **Streams** | Real-time session logging, enforcement decision streaming |
| **State Management** | Credential storage, request tracking, audit data |
| **Durable Timers** | Guaranteed credential expiration |
| **Cron Jobs** | Daily security scans for orphaned credentials |

---

## Architecture Overview

```mermaid
flowchart TB
    subgraph Entry["Access Request Interface"]
        A[Developer Request]
    end

    subgraph AI["AI Analysis Layer"]
        B[Risk Analysis Engine]
        C[Scope Extraction Agent]
        D[Policy Generation]
    end

    subgraph Approval["Authorization Layer"]
        E[Slack Interactive]
        F[Multi-Party Consensus]
    end

    subgraph Provision["Provisioning Layer"]
        G[Credential Manager]
        H[Policy Attachment]
        I[Durable Revocation Timer]
    end

    subgraph Enforce["Zero-Trust Enforcement"]
        J[SQL Proxy]
        K[Scope Validation]
        L[Blast Radius Control]
        M{Policy Check}
        N[Execute Query]
        O[Block & Alert]
    end

    subgraph Revoke["Revocation Layer"]
        P[Expiration / Anomaly]
        Q[Revocation Agent]
        R[Compliance Report]
    end

    A --> B --> C --> D --> E --> F
    F -->|Approved| G --> H --> I
    H --> J --> K --> L --> M
    M -->|Allowed| N
    M -->|Blocked| O --> P
    I -->|Expires| P --> Q --> R

    style Entry fill:#f3f4f6,stroke:#111,color:#000
    style AI fill:#fee2e2,stroke:#b91c1c,color:#000
    style Approval fill:#f3f4f6,stroke:#111,color:#000
    style Provision fill:#fee2e2,stroke:#b91c1c,color:#000
    style Enforce fill:#111,stroke:#b91c1c,color:#fff
    style Revoke fill:#f3f4f6,stroke:#111,color:#000
```

---

## Enterprise Features

### 1. AI-Powered Scope Extraction

Traditional break-glass workflows grant broad access for narrow problems. GlassKiss employs an AI Agent to parse natural language intent into strict SQL policies.

```mermaid
flowchart LR
    subgraph Input["Request"]
        A["'Fix billing for user #123'"]
    end

    subgraph AI["AI Processing Agent"]
        B[Entity Extraction]
        C[Table Detection]
        D[Operation Inference]
    end

    subgraph Output["Enforced Policy"]
        E["tables: [users, billing]<br/>entities: [user:123]<br/>operations: [SELECT, UPDATE]"]
    end

    A --> B --> C --> D --> E

    style Input fill:#fff,stroke:#000,color:#000
    style AI fill:#fee2e2,stroke:#b91c1c,color:#000
    style Output fill:#111,stroke:#000,color:#fff
```

**Observer Pattern Strategy**: The AI component acts strictly as a parser, translating intent into configuration. It effectively places the LLM in a sandbox where its output is validated before application, ensuring deterministic enforcement.

### 2. Blast Radius Control

Proactive prevention of catastrophic errors through pre-execution analysis. Most security tools are reactive; Glasskiss is proactive.

```mermaid
flowchart TB
    subgraph Query["SQL Command"]
        A["DELETE FROM users;"]
    end

    subgraph Checks["Policy Guardrails"]
        B{WHERE Present?}
        C{Table Permitted?}
        D{Operation Allowed?}
        E{Row Limit Safe?}
    end

    subgraph Result["Enforcement Decision"]
        G["BLOCKED (403 Forbidden)"]
        H["ALLOWED (Execute)"]
    end

    A --> B
    B -->|No| G
    B -->|Yes| C
    C -->|No| G
    C -->|Yes| D
    D -->|No| G
    D -->|Yes| E
    E -->|No| G
    E -->|Yes| H

    style Query fill:#fff,stroke:#000,color:#000
    style Checks fill:#fee2e2,stroke:#b91c1c,color:#000
    style G fill:#b91c1c,stroke:#b91c1c,color:#fff
    style H fill:#111,stroke:#000,color:#fff
```

**Enforcement Rules:**
*   **Critical**: DELETE/UPDATE operations require WHERE clauses.
*   **High**: Operations restricted to approved tables and entity IDs.
*   **Medium**: Maximum row impact limits based on request scope.

### 3. Durable Revocation

Leveraging Motia's durable timers, revocation is guaranteed regardless of system restarts or failures.

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GK as Glasskiss
    participant Timer as Durable Timer
    participant DB as Database

    Dev->>GK: Request Access (30m)
    GK->>DB: CREATE USER temp_user
    GK->>Timer: Schedule Revocation (+30m)
    Note over Timer: System Restart / Failure
    Timer-->>Timer: State Persisted (Survivable)
    Timer->>GK: Trigger Revocation
    GK->>DB: DROP USER temp_user
    GK->>Dev: Notify Expiration
```

### 4. Real-Time Compliance Streaming

All activities, from approval workflows to individual SQL queries, are streamed in real-time to the Motia Workbench.

```mermaid
flowchart LR
    subgraph Source["Event Sources"]
        A[User Actions]
        B[Policy Decisions]
        C[System Events]
    end

    subgraph Stream["Motia Event Stream"]
        D[High-Throughput Ingestion]
    end

    subgraph Sinks["Compliance Consumers"]
        E[Workbench Dashboard]
        F[SIEM Collector]
        G[Audit Archive]
    end

    A --> D
    B --> D
    C --> D
    D --> E
    D --> F
    D --> G

    style Source fill:#fff,stroke:#000,color:#000
    style Stream fill:#fee2e2,stroke:#b91c1c,color:#000
    style Sinks fill:#111,stroke:#000,color:#fff
```

### 5. Interactive Slack Approval Workflow

Seamless ChatOps integration allowing security teams to approve or reject requests without context switching.

```mermaid
flowchart TB
    subgraph Request["Access Request"]
        A["Request: prod_db access"]
    end

    subgraph Slack["Slack Interface"]
        B["Rich Message Block<br/>Risk Score: High"]
        C{Approver Action}
    end

    subgraph Outcome["System Action"]
        D["Provision Credentials"]
        E["Reject & Notify"]
    end

    A --> B --> C
    C -->|Approve Button| D
    C -->|Reject Button| E

    style Request fill:#fff,stroke:#000,color:#000
    style Slack fill:#111,stroke:#000,color:#fff
    style Outcome fill:#fee2e2,stroke:#b91c1c,color:#000
```

### 6. AI-Generated Audit Reports

Automated generation of human-readable compliance logs after every session.

```mermaid
flowchart TB
    subgraph Data["Session Telemetry"]
        A[Command Logs]
        B[Policy Violations]
        C[Access Duration]
    end

    subgraph AI["AI Auditor Agent"]
        D[Contextual Analysis]
        E[Summarization]
    end

    subgraph Report["Compliance Artifact"]
        F["Final Audit Report"]
    end

    A --> D
    B --> D
    C --> D
    D --> E --> F

    style Data fill:#fff,stroke:#000,color:#000
    style AI fill:#fee2e2,stroke:#b91c1c,color:#000
    style Report fill:#111,stroke:#000,color:#fff
```

---

## Strategic AI Architecture

**The "Observer, Not Just Actor" Strategy**

Many AI projects allow an LLM to execute actions directly, introducing non-deterministic risk. Glasskiss utilizes AI strictly for **Scope Extraction**.

The architecture treats the LLM as a parser: It transforms unstructured human text (e.g., "Let me fix John's billing") into a rigorous security policy (e.g., `WHERE user_id = 123`). This sophisticated architecture isolates the AI within a validation sandbox, ensuring that the final enforcement logic remains deterministic and secure.

---

## Quick Start

### Prerequisites
*   Node.js 18+
*   npm or pnpm

### Installation

```bash
git clone https://github.com/yourusername/glasskiss.git
cd glasskiss
npm install
cp .env.example .env
npm run dev
```

Navigate to **http://localhost:3000/__motia** to view the workflow visualization.

---

## License

MIT