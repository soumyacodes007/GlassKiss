# Ngrok Setup for Slack Interactivity

## Step 1: Install ngrok

**Option A: Download from website**
1. Go to https://ngrok.com/download
2. Download for Windows
3. Extract to a folder (e.g., `C:\ngrok`)

**Option B: Using Chocolatey (if installed)**
```powershell
choco install ngrok
```

## Step 2: Start ngrok tunnel

```powershell
# Navigate to ngrok folder (if not in PATH)
cd C:\ngrok

# Start tunnel on port 3000
.\ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

## Step 3: Configure Slack App

1. Go to https://api.slack.com/apps
2. Select your GlassKiss app
3. Go to **"Interactivity & Shortcuts"**
4. Enable interactivity
5. Set **Request URL** to:
   ```
   https://YOUR_NGROK_URL.ngrok-free.app/slack/interactivity
   ```
   Example: `https://abc123.ngrok-free.app/slack/interactivity`
6. Click **Save Changes**

## Step 4: Test!

1. Submit a request via CLI:
   ```powershell
   npx tsx cli/glasskiss.ts request "Test ngrok interactivity" --time 3m
   ```

2. Check Slack - you'll see the approval card

3. **Click "Approve" or "Reject" button** - it should work now!

## Troubleshooting

**If buttons still don't work:**
- Make sure ngrok is running
- Verify the Slack Request URL matches ngrok URL exactly
- Check server logs for incoming POST to `/slack/interactivity`

**Ngrok session expires:**
- Free ngrok URLs change each restart
- Update Slack app Request URL each time you restart ngrok
- Or upgrade to ngrok paid plan for fixed URLs

## For Hackathon Demo

Keep ngrok running during the demo! This way judges can see:
- ✅ Request via CLI
- ✅ Slack notification appears
- ✅ **Click Approve button** (works live!)
- ✅ Credentials auto-provisioned
- ✅ Query execution with blocking

**Much more impressive than CLI-only approval!** 🎯
