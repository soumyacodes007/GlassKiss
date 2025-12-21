# GlassKiss End-to-End Demo with Slack Integration

## Prerequisites

1. ✅ `.env` file configured with:
   - `SLACK_BOT_TOKEN=xoxb-...`
   - `SLACK_CHANNEL_ID=C0...`
   - `GROQ_API_KEY=gsk_...`

2. ✅ Slack bot added to the channel
3. ✅ Dev server running: `npm run dev`

## Demo Flow

### Part 1: CLI Request → Slack Notification

```powershell
# Submit request via CLI
npx tsx cli/glasskiss.ts request "Update subscription_status for customer charles@example.com - payment cleared manually" --time 5m
```

**What happens:**
1. CLI sends request to server
2. AI (Groq) analyzes risk and extracts scope
3. **Slack notification sent** with:
   - Request details
   - Risk score
   - Approve/Reject buttons

**Check Slack** - You should see a message like:
```
🔐 Access Request Pending Approval

Requester: debjy
Resource: prod_postgres
Access Level: READ_WRITE
Risk Score: 🟡 50/100 (MEDIUM)

Reason:
> Update subscription_status for customer charles@example.com - payment cleared manually

Required Approvals: 1
Designated Approvers: tech_lead_1

Request ID: abc123xyz
```

### Part 2: Approve via CLI (or Slack)

**Option A: Approve via CLI**
```powershell
npx tsx cli/glasskiss.ts approve <request-id>
```

**Option B: Approve via Slack** (if interactivity is configured)
- Click "Approve" button in Slack
- Or use: `POST /slack/interactivity`

**Server logs will show:**
```
[INFO] ProvisionCredentials Extracting scope using AI (Groq)
[AI] ✅ Scope extracted: Access to subscriptions for charles@example.com
[INFO] 🤖 AI-powered scope extraction successful
  ├ tables: [subscriptions, users]
  ├ operations: [SELECT, UPDATE]
  ├ entities: [{type: "user", email: "charles@example.com"}]
[INFO] Credentials provisioned
  └ sessionId: abc123xyz789
```

**Copy the sessionId!**

### Part 3: Test Scope Enforcement

**Test 1: ALLOWED (within scope)**
```powershell
npx tsx cli/glasskiss.ts query abc123xyz789 "SELECT * FROM subscriptions WHERE email='charles@example.com'"
```
✅ Should succeed

**Test 2: BLOCKED (DROP TABLE)**
```powershell
npx tsx cli/glasskiss.ts query abc123xyz789 "DROP TABLE users"
```
❌ Should block with:
- Reason: "Blocked: DROP without safeguard"
- **Slack alert sent!** 🚨

**Test 3: BLOCKED (No WHERE clause)**
```powershell
npx tsx cli/glasskiss.ts query abc123xyz789 "DELETE FROM users"
```
❌ Should block with:
- Reason: "Blocked: DELETE all rows (no WHERE)"
- **Slack alert sent!** 🚨

**Test 4: BLOCKED (Wrong scope)**
```powershell
npx tsx cli/glasskiss.ts query abc123xyz789 "UPDATE admin_settings SET value='hacked'"
```
❌ Should block (table not in scope)

### Part 4: Check Slack Alerts

After blocked queries, check Slack for security alerts:
```
🚫 Security Alert: BLOCKED

Severity: 🔴 CRITICAL
Request ID: abc123xyz
Session: abc123xyz789

Details:
**Blocked Query:**
```
DROP TABLE users
```
**Reason:** Blocked: DROP without safeguard
```

## Quick Test Commands

```powershell
# 1. Request
npx tsx cli/glasskiss.ts request "Fix billing for user@example.com" --time 5m

# 2. Get request ID from output, then approve
npx tsx cli/glasskiss.ts approve <request-id>

# 3. Get session ID from server logs, then test
npx tsx cli/glasskiss.ts query <session-id> "SELECT * FROM users WHERE email='user@example.com'"
npx tsx cli/glasskiss.ts query <session-id> "DROP TABLE users"
```

## Expected Demo Flow

1. 📝 **CLI Request** → Beautiful colored output
2. 🤖 **AI Analysis** → Scope extracted in real-time
3. 💬 **Slack Notification** → Rich approval card
4. ✅ **Approval** → Credentials provisioned
5. 🔍 **Allowed Query** → Executes successfully
6. 🚫 **Blocked Query** → 403 + Slack alert
7. ⏰ **Auto-Revoke** → After 5 minutes

## Troubleshooting

**Slack not sending?**
- Check `.env` has correct `SLACK_BOT_TOKEN`
- Verify bot is in the channel
- Check server logs for Slack errors

**AI not working?**
- Check `.env` has `GROQ_API_KEY`
- Falls back to rule-based scope extraction

**Session not found?**
- Make sure to copy the `sessionId` from server logs
- It appears after "Credentials provisioned"
