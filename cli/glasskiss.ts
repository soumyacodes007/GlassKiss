#!/usr/bin/env node
/**
 * GlassKiss CLI - Developer-friendly break-glass access
 * 
 * Usage:
 *   glasskiss request "Fix billing for user@example.com" --time 5m
 *   glasskiss approve <request-id>
 *   glasskiss query "SELECT * FROM users WHERE id=123"
 *   glasskiss status
 */

import { parseArgs } from 'node:util'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// Configuration
const API_BASE = process.env.GLASSKISS_API || 'http://localhost:3000'
const DEFAULT_REQUESTER = process.env.USER || process.env.USERNAME || 'developer'
const SESSION_FILE = join(process.cwd(), '.glasskiss-session')

// Session storage
interface SessionData {
    lastRequestId?: string
    lastSessionId?: string
    lastApprovedAt?: string
}

function loadSession(): SessionData {
    try {
        if (existsSync(SESSION_FILE)) {
            return JSON.parse(readFileSync(SESSION_FILE, 'utf-8'))
        }
    } catch (e) {
        // Ignore errors
    }
    return {}
}

function saveSession(data: Partial<SessionData>) {
    const current = loadSession()
    const updated = { ...current, ...data }
    writeFileSync(SESSION_FILE, JSON.stringify(updated, null, 2))
}

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
}

function log(msg: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${msg}${colors.reset}`)
}

function error(msg: string) {
    console.error(`${colors.red}❌ ${msg}${colors.reset}`)
}

function success(msg: string) {
    console.log(`${colors.green}✅ ${msg}${colors.reset}`)
}

function info(msg: string) {
    console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`)
}

function parseDuration(timeStr: string): number {
    const match = timeStr.match(/^(\d+)([mh])$/)
    if (!match) {
        throw new Error('Invalid duration format. Use: 5m, 2h, etc.')
    }
    const [, value, unit] = match
    return unit === 'h' ? parseInt(value) * 60 : parseInt(value)
}

async function makeRequest(path: string, options: RequestInit = {}) {
    const url = `${API_BASE}${path}`
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    })

    if (!response.ok && response.status !== 403) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text}`)
    }

    return response.json()
}

async function requestAccess(args: string[]) {
    const { values, positionals } = parseArgs({
        args,
        options: {
            time: { type: 'string', short: 't', default: '5m' },
            resource: { type: 'string', short: 'r', default: 'prod_postgres' },
            access: { type: 'string', short: 'a', default: 'READ_WRITE' },
            requester: { type: 'string', default: DEFAULT_REQUESTER },
        },
        allowPositionals: true,
    })

    const reason = positionals.join(' ')
    if (!reason) {
        error('Reason is required!')
        console.log('\nUsage: glasskiss request "Fix billing for user@example.com" --time 5m')
        process.exit(1)
    }

    const duration = parseDuration(values.time as string)

    log('\n🔐 GlassKiss Access Request', 'bright')
    log('━'.repeat(60), 'gray')

    info(`Requester: ${values.requester}`)
    info(`Resource: ${values.resource}`)
    info(`Access Level: ${values.access}`)
    info(`Duration: ${values.time} (${duration} minutes)`)
    console.log(`${colors.yellow}📝 Reason: "${reason}"${colors.reset}`)

    log('\n⏳ Submitting request...', 'gray')

    try {
        const result = await makeRequest('/access-request', {
            method: 'POST',
            body: JSON.stringify({
                requester: values.requester,
                resource: values.resource,
                accessLevel: values.access,
                reason,
                duration,
            }),
        })

        // Save request ID
        saveSession({ lastRequestId: result.requestId })

        log('━'.repeat(60), 'gray')
        success('Request submitted!')

        log(`\n${colors.bright}Request ID: ${colors.cyan}${result.requestId}${colors.reset}`)
        log(`${colors.gray}(Saved to .glasskiss-session)${colors.reset}`)
        log(`Status: ${colors.yellow}${result.status}${colors.reset}`)

        //
        //log('\n💡 Next steps:')
        //log(`   1. Check Slack for approval notification`)
        //log(`   2. Or approve: ${colors.cyan}glasskiss approve${colors.reset}`)

        log(`\n${'━'.repeat(60)}`, 'gray')

    } catch (err: any) {
        error(`Failed to submit request: ${err.message}`)
        process.exit(1)
    }
}

async function approveRequest(args: string[]) {
    const { values, positionals } = parseArgs({
        args,
        options: {
            approver: { type: 'string', short: 'a', default: 'senior_dev_1' },
        },
        allowPositionals: true,
    })

    // Use saved request ID if not provided
    let requestId = positionals[0]
    if (!requestId) {
        const session = loadSession()
        requestId = session.lastRequestId
        if (!requestId) {
            error('No request ID provided and no saved session found!')
            console.log('\nUsage: glasskiss approve [request-id]')
            console.log('Or run: glasskiss request first')
            process.exit(1)
        }
        info(`Using saved request: ${requestId}`)
    }

    log('\n✅ Approving Access Request', 'bright')
    log('━'.repeat(60), 'gray')

    try {
        const result = await makeRequest(`/approve/${requestId!}`, {
            method: 'POST',
            body: JSON.stringify({
                approver: values.approver,
            }),
        })

        // Debug: log the full result
        console.log('[DEBUG] API Response:', JSON.stringify(result, null, 2))

        success('Request approved!')
        log(`\n${colors.bright}Request ID: ${colors.cyan}${requestId}${colors.reset}`)
        log(`Status: ${colors.green}${result.status || result.body?.status || 'unknown'}${colors.reset}`)

        // Check both result.status and result.body.status
        const approvalStatus = result.status || result.body?.status

        if (approvalStatus === 'approved') {
            log('\n🔑 Credentials are being provisioned...')

            // Wait a moment for credentials to be ready
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Fetch session ID
            log('   Fetching session ID...')
            try {
                const sessionInfo = await makeRequest(`/session-info/${requestId}`)
                if (sessionInfo.sessionId) {
                    // Save session ID automatically!
                    saveSession({ lastSessionId: sessionInfo.sessionId })
                    success(`Session ready: ${sessionInfo.sessionId}`)
                    log(`${colors.gray}(Saved to .glasskiss-session)${colors.reset}`)

                    log(`\n${colors.cyan}✨ You can now run queries without copy-paste:${colors.reset}`)
                    log(`   ${colors.bright}glasskiss query "SELECT * FROM users WHERE id=1"${colors.reset}`)
                } else {
                    log(`${colors.yellow}⏳ Credentials still provisioning. Check server logs for sessionId.${colors.reset}`)
                }
            } catch (e) {
                log(`${colors.yellow}⏳ Credentials still provisioning. Check server logs for sessionId.${colors.reset}`)
            }
        }

        log(`\n${'━'.repeat(60)}`, 'gray')

    } catch (err: any) {
        error(`Failed to approve: ${err.message}`)
        process.exit(1)
    }
}

async function executeQuery(args: string[]) {
    const { positionals } = parseArgs({
        args,
        allowPositionals: true,
    })

    // Check if first arg is a session ID or query
    let sessionId: string | undefined
    let command: string

    // If first arg looks like a session ID (short alphanumeric, no spaces), treat it as such
    if (positionals.length > 1 && positionals[0].length < 20 && !positionals[0].includes(' ')) {
        sessionId = positionals[0]
        command = positionals.slice(1).join(' ')
    } else {
        // Use saved session ID
        const session = loadSession()
        sessionId = session.lastSessionId
        command = positionals.join(' ')

        if (!sessionId && session.lastRequestId) {
            // Try to fetch session ID from the saved request
            log(`\n${colors.yellow}⏳ No session saved, fetching from request...${colors.reset}`)
            try {
                const sessionInfo = await makeRequest(`/session-info/${session.lastRequestId}`)
                if (sessionInfo.sessionId) {
                    sessionId = sessionInfo.sessionId
                    saveSession({ lastSessionId: sessionId })
                    log(`${colors.green}✅ Found session: ${sessionId}${colors.reset}`)
                } else {
                    error('Session not ready yet. Did you approve the request in Slack?')
                    console.log('\n💡 Tip: Check Slack and click Approve, then wait 3 seconds')
                    process.exit(1)
                }
            } catch (e) {
                error('Could not fetch session. Did you approve the request in Slack?')
                console.log('\n💡 Tip: Check Slack and click Approve, then wait 3 seconds')
                process.exit(1)
            }
        } else if (!sessionId) {
            error('No session ID! Get your session ID from server logs after approval.')
            console.log('\nThen save it: echo \'{"lastSessionId":"your_session_id"}\' > .glasskiss-session')
            console.log('\nOr provide explicitly: glasskiss query <session-id> "SELECT ..."')
            process.exit(1)
        }
        info(`Using saved session: ${sessionId}`)
    }

    if (!command) {
        error('Query is required!')
        console.log('\nUsage: glasskiss query "SELECT * FROM users WHERE id=123"')
        process.exit(1)
    }

    log('\n🔍 Executing Query', 'bright')
    log('━'.repeat(60), 'gray')
    log(`Session: ${sessionId}`)
    log(`Query: ${command}`)
    log('━'.repeat(60), 'gray')

    try {
        const result = await makeRequest(`/session/${sessionId}/log`, {
            method: 'POST',
            body: JSON.stringify({ command }),
        })

        if (result.blocked) {
            error('Query BLOCKED!')
            log(`\n${colors.red}🚫 Reason: ${result.blockReason}${colors.reset}`)
            if (result.scopeInfo) {
                log(`\n📋 Your approved scope: ${result.scopeInfo}`)
            }
            log(`\n${'━'.repeat(60)}`, 'gray')
            process.exit(1)
        }

        success('Query logged successfully!')

        if (result.scopeInfo) {
            log(`\n📋 Scope: ${result.scopeInfo}`)
        }

        log(`\n${'━'.repeat(60)}`, 'gray')

    } catch (err: any) {
        // Auto-recovery: If session not found, try to fetch latest session
        if (err.message.includes('404') && err.message.includes('Session not found')) {
            log(`\n${colors.yellow}⚠️  Session expired or not found${colors.reset}`)
            log('🔄 Auto-recovering: Fetching latest session ID...')

            const session = loadSession()
            if (session.lastRequestId) {
                try {
                    const sessionInfo = await makeRequest(`/session-info/${session.lastRequestId}`)
                    if (sessionInfo.sessionId) {
                        saveSession({ lastSessionId: sessionInfo.sessionId })
                        log(`✅ Found new session: ${sessionInfo.sessionId}`)
                        log('🔄 Retrying query...\n')

                        // Retry the query with new session
                        const retryResult = await makeRequest(`/session/${sessionInfo.sessionId}/log`, {
                            method: 'POST',
                            body: JSON.stringify({ command }),
                        })

                        if (retryResult.blocked) {
                            error('Query BLOCKED!')
                            log(`\n${colors.red}🚫 Reason: ${retryResult.blockReason}${colors.reset}`)
                            if (retryResult.scopeInfo) {
                                log(`\n📋 Your approved scope: ${retryResult.scopeInfo}`)
                            }
                            log(`\n${'━'.repeat(60)}`, 'gray')
                            process.exit(1)
                        }

                        success('Query logged successfully!')
                        if (retryResult.scopeInfo) {
                            log(`\n📋 Scope: ${retryResult.scopeInfo}`)
                        }
                        log(`\n${'━'.repeat(60)}`, 'gray')
                        return
                    }
                } catch (recoveryErr) {
                    error(`Auto-recovery failed: Could not fetch new session`)
                }
            }
        }

        error(`Failed to execute query: ${err.message}`)
        process.exit(1)
    }
}

async function showStatus(args: string[]) {
    // Get session from saved file or use provided session ID
    let sessionId = args[0]

    if (!sessionId) {
        const session = loadSession()
        sessionId = session.lastSessionId as string

        if (!sessionId && session.lastRequestId) {
            // Try to fetch session ID from request
            try {
                const sessionInfo = await makeRequest(`/session-info/${session.lastRequestId}`)
                if (sessionInfo.sessionId) {
                    sessionId = sessionInfo.sessionId
                }
            } catch (e) {
                // Ignore
            }
        }

        if (!sessionId) {
            error('No session ID! Provide one or run a query first.')
            process.exit(1)
        }
    }

    log('\n📊 Session Status', 'bright')
    log('━'.repeat(60), 'gray')

    try {
        const status = await makeRequest(`/session/${sessionId}/status`)

        // Session info
        log(`\n${colors.cyan}Session ID:${colors.reset} ${status.sessionId}`)
        log(`${colors.cyan}Requester:${colors.reset}  ${status.requester}`)
        log(`${colors.cyan}Resource:${colors.reset}   ${status.resource}`)
        log(`${colors.cyan}Access:${colors.reset}     ${status.accessLevel}`)
        log(`${colors.cyan}Scope:${colors.reset}      ${status.scope}`)

        // Timer
        if (status.expired) {
            log(`\n${colors.red}⏰ Session EXPIRED${colors.reset}`)
        } else {
            log(`\n${colors.green}⏰ Time Remaining: ${status.remaining.display}${colors.reset}`)
        }

        // Query stats
        log(`\n${colors.bright}Query Statistics:${colors.reset}`)
        log(`  Total:   ${status.queries.total}`)
        log(`  ${colors.green}Allowed: ${status.queries.allowed}${colors.reset}`)
        log(`  ${colors.red}Blocked: ${status.queries.blocked}${colors.reset}`)

        log(`\n${'━'.repeat(60)}`, 'gray')

    } catch (err: any) {
        error(`Failed to get status: ${err.message}`)
        process.exit(1)
    }
}

async function showAudit(args: string[]) {
    // Get session from saved file or use provided session ID
    let sessionId = args[0]

    if (!sessionId) {
        const session = loadSession()
        sessionId = session.lastSessionId as string

        if (!sessionId) {
            error('No session ID! Provide one or run a query first.')
            process.exit(1)
        }
    }

    log('\n📋 Audit Log', 'bright')
    log('━'.repeat(60), 'gray')

    try {
        const status = await makeRequest(`/session/${sessionId}/status`)

        if (status.queries.history.length === 0) {
            log('\n  No queries recorded yet.')
        } else {
            log('')
            for (const query of status.queries.history) {
                const time = new Date(query.timestamp).toLocaleTimeString()
                const statusIcon = query.blocked ? `${colors.red}❌ BLOCKED${colors.reset}` : `${colors.green}✅ ALLOWED${colors.reset}`

                log(`  ${colors.gray}[${time}]${colors.reset} ${statusIcon}`)
                log(`    ${colors.cyan}${query.command.substring(0, 60)}${query.command.length > 60 ? '...' : ''}${colors.reset}`)
                if (query.blocked && query.blockReason) {
                    log(`    ${colors.red}Reason: ${query.blockReason}${colors.reset}`)
                }
                log('')
            }
        }

        log('━'.repeat(60), 'gray')

    } catch (err: any) {
        error(`Failed to get audit log: ${err.message}`)
        process.exit(1)
    }
}

function showHelp() {
    const help = `
${colors.bright}${colors.blue}🔐 GlassKiss CLI${colors.reset} - Break-glass access with AI-powered scope enforcement

${colors.bright}USAGE${colors.reset}
  glasskiss <command> [options]

${colors.bright}COMMANDS${colors.reset}
  ${colors.cyan}request${colors.reset} <reason>              Submit an access request
    --time, -t <duration>      Duration (e.g., 5m, 2h) [default: 5m]
    --resource, -r <name>      Resource name [default: prod_postgres]
    --access, -a <level>       Access level [default: READ_WRITE]
    --requester <name>         Your name [default: $USER]

  ${colors.cyan}approve${colors.reset} <request-id>         Approve a pending request
    --approver, -a <name>      Approver name [default: senior_dev_1]

  ${colors.cyan}query${colors.reset} <sql>                  Execute SQL with scope enforcement
                              (auto-uses saved session)

  ${colors.cyan}status${colors.reset}                       Check current session status
                              Shows: remaining time, scope, query stats

  ${colors.cyan}audit${colors.reset}                        View query history for session
                              Shows: timestamp, query, allowed/blocked

${colors.bright}EXAMPLES${colors.reset}
  ${colors.gray}# Request access to fix an order${colors.reset}
  glasskiss request "Fix order #123 in orders table" --time 5m

  ${colors.gray}# Run a query (after Slack approval)${colors.reset}
  glasskiss query "SELECT * FROM orders WHERE id=123"

  ${colors.gray}# Check session timer and stats${colors.reset}
  glasskiss status

  ${colors.gray}# View audit log of all queries${colors.reset}
  glasskiss audit

${colors.bright}ENVIRONMENT${colors.reset}
  GLASSKISS_API             API base URL [default: http://localhost:3000]

${colors.bright}MORE INFO${colors.reset}
  GitHub: https://github.com/soumyacodes007/GlassKiss
`
    console.log(help)
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
        showHelp()
        process.exit(0)
    }

    const command = args[0]
    const commandArgs = args.slice(1)

    try {
        switch (command) {
            case 'request':
                await requestAccess(commandArgs)
                break
            case 'approve':
                await approveRequest(commandArgs)
                break
            case 'query':
                await executeQuery(commandArgs)
                break
            case 'status':
                await showStatus(commandArgs)
                break
            case 'audit':
                await showAudit(commandArgs)
                break
            default:
                error(`Unknown command: ${command}`)
                console.log('Run "glasskiss help" for usage information')
                process.exit(1)
        }
    } catch (err: any) {
        error(err.message)
        process.exit(1)
    }
}

main()
