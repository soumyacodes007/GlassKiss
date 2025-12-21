# GlassKiss CLI

Developer-friendly command-line interface for GlassKiss break-glass access control.

## Installation

```bash
# For development (run directly)
npx tsx cli/glasskiss.ts <command>

# For production (build and link globally)
npm run build
npm link
glasskiss <command>
```

## Commands

### 1. Request Access

Submit an access request with natural language reason:

```bash
npx tsx cli/glasskiss.ts request "Update subscription_status for charles@example.com - payment cleared" --time 5m
```

**Options:**
- `--time, -t <duration>` - Duration (e.g., `5m`, `2h`, `30m`) [default: `5m`]
- `--resource, -r <name>` - Resource name [default: `prod_postgres`]
- `--access, -a <level>` - Access level (`READ_ONLY` or `READ_WRITE`) [default: `READ_WRITE`]
- `--requester <name>` - Your name [default: system username]

**Example Output:**
```
🔐 GlassKiss Access Request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ Requester: developer
ℹ Resource: prod_postgres
ℹ Access Level: READ_WRITE
ℹ Duration: 5m (5 minutes)
📝 Reason: "Update subscription_status for charles@example.com - payment cleared"

⏳ Submitting request...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Request submitted!

Request ID: abc123def456
Status: pending_risk

🤖 AI is analyzing your request...

💡 Next steps:
   1. Wait for approval (check Slack or run: glasskiss status abc123def456)
   2. Or approve manually: glasskiss approve abc123def456
```

### 2. Approve Request

Approve a pending access request:

```bash
npx tsx cli/glasskiss.ts approve abc123def456 --approver senior_dev_1
```

**Options:**
- `--approver, -a <name>` - Approver name [default: `senior_dev_1`]

**Example Output:**
```
✅ Approving Access Request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Request approved!

Request ID: abc123def456
Status: approved

🔑 Credentials are being provisioned...
   Check status: glasskiss status abc123def456
```

### 3. Execute Query

Execute SQL with scope enforcement:

```bash
npx tsx cli/glasskiss.ts query session_xyz "SELECT * FROM subscriptions WHERE email='charles@example.com'"
```

**Example Output (Allowed):**
```
🔍 Executing Query
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session: session_xyz
Query: SELECT * FROM subscriptions WHERE email='charles@example.com'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Query logged successfully!

📋 Scope: Access to subscriptions table for email='charles@example.com'
```

**Example Output (Blocked):**
```
🔍 Executing Query
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session: session_xyz
Query: DROP TABLE users
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Query BLOCKED!

🚫 Reason: Operation DROP not in approved scope
📋 Your approved scope: Access to subscriptions table for email='charles@example.com'
```

### 4. Check Status

Check request status:

```bash
npx tsx cli/glasskiss.ts status abc123def456
```

## Environment Variables

- `GLASSKISS_API` - API base URL [default: `http://localhost:3000`]

Example:
```bash
export GLASSKISS_API=https://glasskiss-prod.example.com
npx tsx cli/glasskiss.ts request "Emergency fix" --time 5m
```

## Demo Workflow

```bash
# 1. Start the server
npm run dev

# 2. Request access (in another terminal)
npx tsx cli/glasskiss.ts request "Fix subscription for user@example.com" --time 5m
# Output: Request ID: abc123

# 3. Approve the request
npx tsx cli/glasskiss.ts approve abc123

# 4. Execute queries (get session ID from server logs or status)
npx tsx cli/glasskiss.ts query session_xyz "SELECT * FROM subscriptions WHERE email='user@example.com'"

# 5. Try a blocked query
npx tsx cli/glasskiss.ts query session_xyz "DROP TABLE users"
# Output: ❌ Query BLOCKED!
```

## Features

- ✅ **Natural Language Requests** - Just describe what you need to do
- ✅ **AI Scope Extraction** - Groq LLM understands your intent
- ✅ **Time-Bound Access** - Specify duration with friendly formats (`5m`, `2h`)
- ✅ **Real-Time Enforcement** - Queries checked before execution
- ✅ **Beautiful Terminal Output** - Colored, formatted, easy to read
- ✅ **Error Handling** - Clear error messages when things go wrong

## Help

```bash
npx tsx cli/glasskiss.ts help
# or
npx tsx cli/glasskiss.ts --help
```
