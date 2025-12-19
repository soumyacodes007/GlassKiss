import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { BlastRadiusController } from '../services/blast-radius-controller'
import { AccessScope, Credentials } from '../services/glasskiss-types'
import { SlackService } from '../services/slack-service'

const bodySchema = z.object({
    command: z.string(),
})

const responseSchema = z.object({
    logged: z.boolean(),
    flagged: z.boolean(),
    blocked: z.boolean().optional(),
    blockReason: z.string().optional(),
    scopeInfo: z.string().optional(),
})

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'LogCommandAPI',
    description: 'Logs SQL commands from active sessions',
    flows: ['glasskiss'],
    method: 'POST',
    path: '/session/:sessionId/log',
    bodySchema,
    responseSchema: {
        200: responseSchema,
    },
    emits: ['detect-anomaly'],
}

export const handler: Handlers['LogCommandAPI'] = async (
    req,
    { logger, streams, emit, state }
) => {
    const { sessionId } = req.pathParams
    const { command } = req.body

    // Find the request associated with this session
    const allCredentials = await state.getGroup<Credentials>('credentials')
    const credential = allCredentials.find((c) => c.sessionId === sessionId)

    if (!credential) {
        return {
            status: 404,
            body: { error: 'Session not found' },
        } as any
    }

    const requestId = credential.requestId
    const accessScope = credential.accessScope as AccessScope | undefined

    // ========================================
    // SCOPE & BLAST RADIUS ENFORCEMENT
    // ========================================

    // Create blast radius controller with scope config
    const blastRadiusController = accessScope
        ? BlastRadiusController.fromScope(accessScope)
        : new BlastRadiusController()

    // Check command against blast radius limits
    const blastCheck = blastRadiusController.checkCommand(command, accessScope)

    if (!blastCheck.allowed) {
        logger.warn('Command BLOCKED by blast radius control', {
            requestId,
            sessionId,
            command: command.substring(0, 100),
            reason: blastCheck.reason,
            severity: blastCheck.severity,
            violationType: blastCheck.violationType,
        })

        // Log the blocked command to enforcement stream
        const enforcementId = randomBytes(8).toString('hex')
        await streams.scopeEnforcement.set(sessionId, enforcementId, {
            id: enforcementId,
            sessionId,
            requestId,
            timestamp: new Date().toISOString(),
            command,
            decision: 'blocked',
            reason: blastCheck.reason,
            violationType: blastCheck.violationType === 'scope_violation' ? 'scope'
                : blastCheck.violationType === 'row_limit' ? 'row_limit'
                    : blastCheck.violationType === 'no_where' ? 'blast_radius'
                        : blastCheck.violationType === 'table_blocked' ? 'table'
                            : blastCheck.violationType === 'operation_blocked' ? 'operation'
                                : 'blast_radius',
            severity: blastCheck.severity,
        })

        // 🚨 SEND SLACK ALERT FOR BLOCKED QUERY
        try {
            await SlackService.sendSecurityAlert({
                requestId,
                sessionId,
                alertType: 'blocked',
                severity: blastCheck.severity === 'critical' ? 'critical'
                    : blastCheck.severity === 'high' ? 'high'
                        : 'medium',
                details: `**Blocked Query:**\n\`\`\`${command.substring(0, 200)}\`\`\`\n**Reason:** ${blastCheck.reason}`,
            })
            logger.info('Slack alert sent for blocked query', { requestId, sessionId })
        } catch (slackError) {
            logger.warn('Failed to send Slack alert', { error: slackError })
        }

        // Return 403 Forbidden for blocked commands
        return {
            status: 403,
            body: {
                logged: false,
                flagged: true,
                blocked: true,
                blockReason: blastCheck.reason,
                scopeInfo: accessScope?.scopeDescription,
            },
        } as any
    }

    // ========================================
    // COMMAND ALLOWED - PROCEED TO LOGGING
    // ========================================

    // Determine query type
    const queryType = determineQueryType(command)

    // Create log entry in session log stream
    const logId = randomBytes(8).toString('hex')
    await streams.sessionLog.set(sessionId, logId, {
        id: logId,
        requestId,
        sessionId,
        timestamp: new Date().toISOString(),
        command,
        queryType,
        flagged: false,
    })

    // Log the allowed command to enforcement stream
    const enforcementId = randomBytes(8).toString('hex')
    await streams.scopeEnforcement.set(sessionId, enforcementId, {
        id: enforcementId,
        sessionId,
        requestId,
        timestamp: new Date().toISOString(),
        command,
        decision: 'allowed',
        severity: 'low',
    })

    logger.info('Command ALLOWED and logged', {
        requestId,
        sessionId,
        queryType,
        command: command.substring(0, 100),
        scopeApplied: !!accessScope,
    })

    // Emit to anomaly detector for additional analysis
    await emit({
        topic: 'detect-anomaly',
        data: {
            requestId,
            sessionId,
            command,
            logId,
        },
    })

    return {
        status: 200,
        body: {
            logged: true,
            flagged: false,
            blocked: false,
            scopeInfo: accessScope?.scopeDescription,
        },
    }
}

function determineQueryType(command: string): string {
    const upperCmd = command.trim().toUpperCase()

    if (upperCmd.startsWith('SELECT')) return 'SELECT'
    if (upperCmd.startsWith('INSERT')) return 'INSERT'
    if (upperCmd.startsWith('UPDATE')) return 'UPDATE'
    if (upperCmd.startsWith('DELETE')) return 'DELETE'
    if (upperCmd.startsWith('DROP')) return 'DROP'
    if (upperCmd.startsWith('CREATE')) return 'CREATE'
    if (upperCmd.startsWith('ALTER')) return 'ALTER'
    if (upperCmd.startsWith('TRUNCATE')) return 'TRUNCATE'

    return 'OTHER'
}
