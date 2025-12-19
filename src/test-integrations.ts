/**
 * Integration Test Script
 * Tests Database, Slack, and AI connections
 * Run with: npx tsx src/test-integrations.ts
 */

import 'dotenv/config'
import { DatabaseService } from './services/database-service.js'
import { SlackService } from './services/slack-service.js'
import { AIService } from './services/ai-service.js'

async function testIntegrations() {
    console.log('='.repeat(60))
    console.log('🧪 GLASSKISS INTEGRATION TESTS')
    console.log('='.repeat(60))

    let allPassed = true

    // Test 1: Database Connection
    console.log('\n📦 Test 1: PostgreSQL Database')
    console.log('-'.repeat(40))
    try {
        const dbConnected = await DatabaseService.testConnection()
        if (dbConnected) {
            console.log('   ✅ Database connection: PASS')

            // Initialize schema
            await DatabaseService.initializeSchema()
            console.log('   ✅ Schema initialization: PASS')
        } else {
            console.log('   ❌ Database connection: FAIL')
            allPassed = false
        }
    } catch (error) {
        console.log('   ❌ Database test error:', error)
        allPassed = false
    }

    // Test 2: Slack Connection
    console.log('\n💬 Test 2: Slack Integration')
    console.log('-'.repeat(40))
    try {
        const slackConnected = await SlackService.testConnection()
        if (slackConnected) {
            console.log('   ✅ Slack connection: PASS')
        } else {
            console.log('   ❌ Slack connection: FAIL')
            allPassed = false
        }
    } catch (error) {
        console.log('   ❌ Slack test error:', error)
        allPassed = false
    }

    // Test 3: AI Connection
    console.log('\n🤖 Test 3: Groq AI Integration')
    console.log('-'.repeat(40))
    try {
        const aiConnected = await AIService.testConnection()
        if (aiConnected) {
            console.log('   ✅ AI connection: PASS')

            // Test risk analysis
            const riskResult = await AIService.analyzeRisk(
                'Emergency fix for user #123 billing issue',
                'prod_postgres',
                'READ_WRITE',
                'dev_42'
            )
            console.log(`   ✅ Risk analysis: ${riskResult.riskScore}/100 (${riskResult.riskLevel})`)
        } else {
            console.log('   ❌ AI connection: FAIL')
            allPassed = false
        }
    } catch (error) {
        console.log('   ❌ AI test error:', error)
        allPassed = false
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    if (allPassed) {
        console.log('🎉 ALL INTEGRATION TESTS PASSED!')
    } else {
        console.log('⚠️  SOME TESTS FAILED - Check the logs above')
    }
    console.log('='.repeat(60))

    process.exit(allPassed ? 0 : 1)
}

testIntegrations().catch(console.error)
