# GlassKiss CLI Demo Script (PowerShell)
# Run this to demonstrate the complete workflow

Write-Host "GlassKiss CLI Demo - Complete Workflow" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "STEP 1: Submit Access Request" -ForegroundColor Cyan
Write-Host "Command: glasskiss request" -ForegroundColor Gray
Write-Host ""
npx tsx cli/glasskiss.ts request "Update subscription_status for customer charles@example.com - payment cleared manually" --time 5m
Write-Host ""

# Extract request ID
$REQUEST_ID = Read-Host "Enter Request ID from above"
Write-Host ""

Write-Host "STEP 2: Approve Request" -ForegroundColor Cyan
Write-Host "Command: glasskiss approve $REQUEST_ID" -ForegroundColor Gray
Write-Host ""
npx tsx cli/glasskiss.ts approve $REQUEST_ID
Write-Host ""

Write-Host "NOTE: Check server logs for SESSION_ID" -ForegroundColor Yellow
Write-Host "Look for: 'sessionId:' in the terminal running 'npm run dev'" -ForegroundColor Gray
$SESSION_ID = Read-Host "Enter Session ID from server logs"
Write-Host ""

Write-Host "STEP 3: Test ALLOWED Query" -ForegroundColor Cyan
Write-Host "Command: glasskiss query (SELECT with WHERE)" -ForegroundColor Gray
Write-Host ""
npx tsx cli/glasskiss.ts query $SESSION_ID "SELECT * FROM subscriptions WHERE email='charles@example.com'"
Write-Host ""

Write-Host "STEP 4: Test BLOCKED Query (DROP TABLE)" -ForegroundColor Cyan
Write-Host "Command: glasskiss query (DROP)" -ForegroundColor Gray
Write-Host ""
npx tsx cli/glasskiss.ts query $SESSION_ID "DROP TABLE users"
Write-Host ""

Write-Host "STEP 5: Test BLOCKED Query (No WHERE)" -ForegroundColor Cyan
Write-Host "Command: glasskiss query (DELETE without WHERE)" -ForegroundColor Gray
Write-Host ""
npx tsx cli/glasskiss.ts query $SESSION_ID "DELETE FROM users"
Write-Host ""

Write-Host "Demo Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Key Features Demonstrated:"
Write-Host "  [+] Natural language access requests"
Write-Host "  [+] AI-powered scope extraction"
Write-Host "  [+] Time-bound access (5 minutes)"
Write-Host "  [+] Scope enforcement (allowed queries)"
Write-Host "  [+] Blast radius control (blocked queries)"
Write-Host "  [+] Beautiful CLI output"

