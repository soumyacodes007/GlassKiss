# Complete CLI DX Test
# Run this AFTER restarting the dev server

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  GLASSKISS ZERO-COPY-PASTE TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Request
Write-Host "Step 1: Request Access (auto-saves request ID)" -ForegroundColor Yellow
Write-Host "Command: glasskiss request '...'" -ForegroundColor Gray
Write-Host ""
npx tsx cli/glasskiss.ts request "Fix critical payment processing error for order #777" --time 5m

Write-Host "`n`nStep 2: Approve (auto-uses saved request ID + auto-fetches session ID)" -ForegroundColor Yellow
Write-Host "Command: glasskiss approve" -ForegroundColor Gray
Write-Host ""
npx tsx cli/glasskiss.ts approve

Write-Host "`n`nStep 3: Test Query (auto-uses saved session ID)" -ForegroundColor Yellow
Write-Host "Command: glasskiss query 'SELECT...'" -ForegroundColor Gray
Write-Host ""
npx tsx cli/glasskiss.ts query "SELECT * FROM orders WHERE id=777"

Write-Host "`n`nStep 4: Test BLOCKED Query (should trigger Slack alert)" -ForegroundColor Yellow
Write-Host "Command: glasskiss query 'DROP TABLE...'" -ForegroundColor Gray
Write-Host ""
npx tsx cli/glasskiss.ts query "DROP TABLE users"

Write-Host "`n`n========================================" -ForegroundColor Green
Write-Host "  TEST COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nZero copy-paste needed! Check:" -ForegroundColor Cyan
Write-Host "  - Request ID was auto-saved" -ForegroundColor Gray
Write-Host "  - Approve used saved request ID" -ForegroundColor Gray
Write-Host "  - Session ID was auto-fetched & saved" -ForegroundColor Gray
Write-Host "  - Queries used saved session ID" -ForegroundColor Gray
Write-Host "  - Blocked query sent Slack alert" -ForegroundColor Gray
