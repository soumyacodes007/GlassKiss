# Glasskiss - Ephemeral Break-Glass Access Controller

**Winner Project for Motia Hackathon**

Glasskiss is a time-bound, Just-in-Time (JIT) access orchestrator that provisions temporary production credentials, requires multi-party approval, streams sessions in real-time to compliance logs, and automatically revokes access using durable timers.

## 🎯 Problem Statement

Every engineering team's dirty secret: Developers have permanent SSH keys or database credentials to Production because "sometimes we need to fix things fast."

**The Risks:**
- Stolen laptops → Data breaches
- Disgruntled employees → Sabotage
- Accidental `DROP TABLE` → Catastrophic failures
- SOC2/Compliance audits fail → No customers

## 💡 The Solution

Glasskiss uses Motia's powerful primitives to create a **fail-closed**, **auditable**, **time-limited** access control system.

### Core Features

✅ **AI-Powered Risk Assessment** - Analyzes access requests for ticket references, urgency, and patterns  
✅ **Multi-Party Approval** - High-risk requests require multiple approvals  
✅ **Temporary Credentials** - Database-level expiry as failsafe  
✅ **Real-Time Monitoring** - All commands logged to streams  
✅ **Anomaly Detection** - Dangerous SQL patterns trigger immediate revocation  
✅ **Durable Timers** - Guaranteed access expiration (survives crashes)  
✅ **Zombie Defense** - Daily cron scans for leaked credentials  
✅ **Compliance Audit** - AI-generated access reports  

### 🆕 Zero-Trust SQL Enforcement + AI (NEW!)

✅ **🤖 AI-Powered Scope Extraction** - Groq LLM understands "fix user #123" → enforces `WHERE id=123`  
✅ **Reason-Bound Access** - Approved scope = Enforced SQL policy  
✅ **Blast Radius Control** - Row limits, WHERE requirements, table restrictions  
✅ **Pre-Execution Blocking** - 403 BEFORE dangerous queries run (not just detection)  
✅ **Scope Enforcement Stream** - Real-time visibility into allow/block decisions  
✅ **🔔 Interactive Slack Buttons** - Approve/Reject directly from Slack  
✅ **🚨 Slack Security Alerts** - Real-time alerts when queries are blocked  

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      📝 ACCESS REQUEST                              │
│         "Debug payment failure for customer John - order #789"      │
└────────────────────────────────┬────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│              🤖 AI RISK ANALYSIS + SCOPE EXTRACTION                 │
│  ┌─────────────────────┐   ┌──────────────────────────────────────┐│
│  │ Risk Score: 50/100  │   │ Proposed Scope:                      ││
│  │ Factors: prod, write│   │   tables: [users, orders]            ││
│  │ Required Approvals:1│   │   operations: [SELECT, UPDATE]       ││
│  └─────────────────────┘   │   entities: [order: 789]             ││
│                            └──────────────────────────────────────┘│
└────────────────────────────────┬────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  💬 SLACK APPROVAL (Interactive!)                   │
│        Approver sees: risk + proposed scope → Approves BOTH         │
└────────────────────────────────┬────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│              🔑 PROVISION (Scoped Credentials + Policy)             │
│              CREATE USER temp_xxx VALID UNTIL + Scope Policy        │
└────────────────────────────────┬────────────────────────────────────┘
                                 ↓
              ┌──────────────────┴───────────────────┐
              ↓                                      ↓
┌─────────────────────────┐          ┌───────────────────────────────┐
│     ⏰ DURABLE TIMER    │          │   🔒 LIVE POLICY ENFORCEMENT  │
│   (Auto-revokes at TTL) │          │  Every query checked against  │
│                         │          │  scope BEFORE execution       │
└───────────┬─────────────┘          │                               │
            │                        │  ✅ SELECT...WHERE id=789     │
            │                        │  ❌ DELETE FROM users (BLOCKED)│
            │                        │  📢 Slack alert on block      │
            │                        └───────────────┬───────────────┘
            └──────────────────┬─────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                           🚫 REVOKE                                 │
│                 Terminate sessions, DROP USER                       │
└────────────────────────────────┬────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        📊 AI AUDIT REPORT                           │
│   "Access granted for reason X, scope Y, actual usage Z"            │
│   "5 queries within scope, 2 blocked (DELETE, DROP)"                │
└─────────────────────────────────────────────────────────────────────┘
```

## 🚀 Motia Primitives Used

| Primitive | Usage |
|-----------|-------|
| **API Steps** | Access request entry, approve/reject endpoints, command logging |
| **Event Steps** | Risk calculation, provisioning, monitoring, anomaly detection, revocation, audit |
| **Streams** | Real-time approval status, session logs, audit reports |
| **State Management** | Access requests, credentials, audit trail |
| **Timers** | Durable access expiration |
| **Cron Jobs** | Daily zombie credential defense |

## 📁 Project Structure

```
src/
├── api/                              # API Steps (Controllers)
│   ├── access-request-api.step.ts    # Entry point for access requests
│   ├── approve-request-api.step.ts   # Approve endpoint
│   ├── reject-request-api.step.ts    # Reject endpoint
│   └── log-command-api.step.ts       # Log SQL commands
├── events/                           # Event Steps (Business Logic)
│   ├── calculate-risk.step.ts        # AI risk scoring
│   ├── request-approval.step.ts      # Create approval workflow
│   ├── provision-credentials.step.ts # Generate temp credentials + scope
│   ├── start-timer.step.ts           # Durable access timer
│   ├── start-monitoring.step.ts      # Initialize session monitoring
│   ├── detect-anomaly.step.ts        # SQL watchdog
│   ├── revoke-access.step.ts         # Force credential revocation
│   └── generate-audit.step.ts        # Compliance reporting
├── cron/                             # Scheduled Tasks
│   └── check-active-creds.cron.step.ts # Zombie defense
├── streams/                          # Real-time Streams
│   ├── approval-stream.stream.ts     # Approval status stream
│   ├── session-log.stream.ts         # Command log stream
│   ├── scope-enforcement.stream.ts   # 🆕 Scope enforcement decisions
│   └── audit-report.stream.ts        # Audit report stream
└── services/                         # Business Logic Layer
    ├── glasskiss-types.ts            # Zod schemas & types
    ├── risk-analyzer.ts              # Risk scoring logic
    ├── scope-analyzer.ts             # 🆕 Reason → SQL scope extraction
    ├── blast-radius-controller.ts    # 🆕 Row limits & query enforcement
    └── credential-manager.ts         # Simulated PostgreSQL provisioning
```

## 🎮 Getting Started

### Start Motia Dev Server

```bash
npm run dev
```

Then open **Motia Workbench**: http://localhost:3000/__motia

Select the `glasskiss` flow to visualize the workflow.

## 🧪 Testing the Workflow

### 1. Submit Access Request

```bash
curl -X POST http://localhost:3000/access-request \
  -H "Content-Type: application/json" \
  -d '{
    "requester": "dev_42",
    "resource": "prod_postgres",
    "accessLevel": "READ_WRITE",
    "reason": "Urgent bugfix #123 - customer data issue",
    "duration": 2
  }'
```

**Response:**
```json
{
  "requestId": "abc123...",
  "status": "pending_risk",
  "message": "Access request submitted for risk analysis"
}
```

Watch in Workbench as the workflow progresses through risk calculation → approval workflow.

### 2. Approve Request

```bash
curl -X POST http://localhost:3000/approve/{requestId} \
  -H "Content-Type: application/json" \
  -d '{"approver": "tech_lead_1"}'
```

Watch credentials get provisioned and monitoring start.

### 3. Simulate Session Activity

```bash
# Benign query
curl -X POST http://localhost:3000/session/{sessionId}/log \
  -H "Content-Type: application/json" \
  -d '{"command": "SELECT * FROM users WHERE id = 1;"}'

# Dangerous query (triggers force revoke!)
curl -X POST http://localhost:3000/session/{sessionId}/log \
  -H "Content-Type: application/json" \
  -d '{"command": "DROP TABLE users;"}'
```

Watch the anomaly detector flag the dangerous command and trigger immediate revocation!

### 4. View Audit Report

After revocation (either by timer or force), check the audit report stream in Workbench.

## 🎨 Workbench Features

### Real-Time Streams

- **Approval Request Stream**: Watch approval status change from `pending` → `approved`
- **Session Log Stream**: See all SQL commands logged in real-time
- **Audit Report Stream**: Final compliance report with AI summary

### Workflow Visualization

The glasskiss flow shows:
- Entry point (Access Request API)
- Sequential risk calculation and approval
- **Parallel execution** of timer and monitoring after provisioning
- Convergence at revocation
- Final audit generation

### State Inspection

Use the **States Plugin** to inspect:
- `access-requests`: All access request metadata
- `credentials`: Active temporary credentials
- `audit-reports`: Historical compliance reports
- `monitoring`: Session monitoring data

## 🔒 Security Features

### Fail-Closed Design

- Credentials have database-level expiry (failsafe)
- Revocation retries 3 times, then alerts security
- Default action is **DENY**

### Zombie Defense

Daily cron job (`2 AM`) scans for:
- Expired credentials still in state
- Orphaned database users
- Force-revokes and alerts security

### Anomaly Detection

Dangerous patterns automatically trigger force revocation:
- `DROP TABLE/DATABASE` without confirmation
- `DELETE` without WHERE clause
- `UPDATE` without WHERE clause
- `TRUNCATE TABLE`

### 🆕 AI-Powered Scope Extraction (Groq LLM)

**The Problem**: Traditional break-glass gives blanket access. "I need to fix user #123's billing" grants access to ALL users.

**The Solution**: GlassKiss uses **Groq AI (openai/gpt-oss-120b)** to extract structured scope from natural language:

```
📝 Approval Reason: "Fix billing calculation for user #123 in users table"
                                    ↓
                        🤖 Groq AI Processing
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "tables": ["users", "billing"],                               │
│   "entities": [{"type": "user", "id": "123"}],                  │
│   "operations": ["SELECT", "UPDATE"],                           │
│   "maxRows": 1,                                                 │
│   "summary": "Access to users/billing for user 123"             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
                      ✅ Scope Enforced at Query Time
```

**Why AI?**
- Understands context: "customer John" → `WHERE name = 'John'`
- Handles synonyms: "account", "user", "customer" → `users` table
- Smart operation detection: "fix" → `UPDATE`, "check" → `SELECT`


### 🆕 Blast Radius Control

**Pre-execution guardrails** that BLOCK dangerous queries before they run (not just detect after).

| Check | Rule | Severity |
|-------|------|----------|
| No WHERE clause | DELETE/UPDATE must have WHERE | Critical |
| Row limit | Max rows affected based on approval | Medium |
| Table allowlist | Only access approved tables | High |
| Operation allowlist | Only perform approved operations | High |
| Scope filter | Write queries must include approved entity ID | High |

**Blocked Patterns:**
```sql
-- ❌ BLOCKED: No WHERE clause (affects all rows)
DELETE FROM users;
UPDATE users SET status = 'inactive';

-- ❌ BLOCKED: DROP operations
DROP TABLE users;
TRUNCATE TABLE orders;

-- ❌ BLOCKED: Outside approved scope
SELECT * FROM admin_logs;  -- Table not in scope
DELETE FROM users WHERE id = 999;  -- Wrong entity ID
```

**Enforcement Flow:**
```
SQL Command → Scope Check → Blast Radius Check → Allow/Block → Log
                  ↓                   ↓
            Return 403          Return 403
```

## 📊 Risk Scoring Algorithm

| Factor | Risk Points |
|--------|-------------|
| No Jira/GitHub ticket reference | +30 |
| Vague reason (< 20 chars) | +25 |
| Urgent/emergency keywords | +15 |
| Production resource | +20 |
| READ_WRITE access | +15 |

**Approval Requirements:**
- Low risk (< 30): 1 approval
- Medium risk (30-70): 1 approval
- High risk (> 70): 2 approvals (multi-sig)

## 🏆 Why This Wins

1. **Perfect Motia Showcase**: Uses ALL Motia primitives correctly
2. **Real Business Value**: Replaces tools like Teleport, CyberArk
3. **Zero Hallucination Risk**: AI only analyzes (Observer), never acts (Actor)
4. **Fail-Closed Architecture**: Multiple failsafes ensure security
5. **Beautiful Workbench Visualization**: Clear workflow representation
6. **Production-Ready Pattern**: Template for similar access control systems
7. **🆕 Zero-Trust at SQL Level**: Intent → Enforced Policy (nobody else does this!)
8. **🆕 True Blast Radius Control**: Pre-execution blocking, not just detection

## 🎥 Demo Flow

### Happy Path
1. Submit request with good reason + ticket: "Fix billing for user #123"
2. Watch risk score calculate (low risk)
3. Approve request → credentials provisioned WITH scope
4. Execute scoped SELECT: `SELECT * FROM users WHERE id = 123` ✅
5. Timer expires → auto-revoke
6. View audit: "User executed 5 SELECT queries within scope"

### Scope Violation Path (NEW!)
1. Submit request: "Fix billing for user #123"
2. Approve → get scoped credentials
3. Try: `SELECT * FROM users` (no WHERE for user 123)
4. **BLOCKED** with 403: "Query must include scope filter: WHERE id = 123"
5. Enforcement stream shows: `decision: blocked, violationType: scope`

### Blast Radius Violation Path (NEW!)
1. Submit request → approve
2. Try: `DELETE FROM users;` (no WHERE clause)
3. **BLOCKED** with 403: "DELETE requires WHERE clause. Mass deletes not permitted."
4. Query never reaches database!

### Dangerous Command Path
1. Submit request → approve
2. Execute: `DROP TABLE users;`
3. **BLOCKED** by blast radius control (operation not allowed)
4. View audit: "1 dangerous command blocked pre-execution"

## 👥 Authors

Built for the Motia Hackathon - Showcasing the power of durable workflows, real-time streams, and human-in-the-loop orchestration.

## 📜 License

MIT