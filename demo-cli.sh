#!/usr/bin/env bash
# GlassKiss CLI Demo Script
# Run this to demonstrate the complete workflow

echo "🎬 GlassKiss CLI Demo - Complete Workflow"
echo "========================================"
echo ""

# Color support
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}📝 STEP 1: Submit Access Request${NC}"
echo "Command: glasskiss request \"Update subscription for charles@example.com - payment cleared\" --time 5m"
echo ""
npx tsx cli/glasskiss.ts request "Update subscription_status for customer charles@example.com - payment cleared manually" --time 5m
echo ""

# Extract request ID (you'll need to save this manually in the demo)
read -p "Enter Request ID from above: " REQUEST_ID
echo ""

echo -e "${CYAN}✅ STEP 2: Approve Request${NC}"
echo "Command: glasskiss approve $REQUEST_ID"
echo ""
npx tsx cli/glasskiss.ts approve $REQUEST_ID
echo ""

echo -e "${YELLOW}⚠️  Note: Check server logs for SESSION_ID${NC}"
read -p "Enter Session ID from server logs: " SESSION_ID
echo ""

echo -e "${CYAN}🔍 STEP 3: Test ALLOWED Query${NC}"
echo "Command: glasskiss query $SESSION_ID \"SELECT * FROM subscriptions WHERE email='charles@example.com'\""
echo ""
npx tsx cli/glasskiss.ts query "$SESSION_ID" "SELECT * FROM subscriptions WHERE email='charles@example.com'"
echo ""

echo -e "${CYAN}🚫 STEP 4: Test BLOCKED Query (DROP TABLE)${NC}"
echo "Command: glasskiss query $SESSION_ID \"DROP TABLE users\""
echo ""
npx tsx cli/glasskiss.ts query "$SESSION_ID" "DROP TABLE users"
echo ""

echo -e "${CYAN}🚫 STEP 5: Test BLOCKED Query (No WHERE)${NC}"
echo "Command: glasskiss query $SESSION_ID \"DELETE FROM users\""
echo ""
npx tsx cli/glasskiss.ts query "$SESSION_ID" "DELETE FROM users"
echo ""

echo -e "${GREEN}✅ Demo Complete!${NC}"
echo ""
echo "🎯 Key Features Demonstrated:"
echo "  ✓ Natural language access requests"
echo "  ✓ AI-powered scope extraction"
echo "  ✓ Time-bound access (5 minutes)"
echo "  ✓ Scope enforcement (allowed queries)"
echo "  ✓ Blast radius control (blocked queries)"
echo "  ✓ Beautiful CLI output"
