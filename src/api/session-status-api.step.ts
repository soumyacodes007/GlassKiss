/**
 * Session Status API
 * Returns session details including remaining time, scope, and query history
 */

import { ApiRouteConfig, Handlers } from 'motia'

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'SessionStatusAPI',
    description: 'Get session status including remaining time and query history',
    method: 'GET',
    path: '/session/:sessionId/status',
    flows: ['glasskiss'],
    emits: [],
}

export const handler: Handlers['SessionStatusAPI'] = async (
    req,
    { logger, state, streams }
) => {
    const { sessionId } = req.pathParams

    logger.info('Fetching session status', { sessionId })

    // Find credentials for this session
    const allCredentials = await state.getGroup('credentials')
    const credential = allCredentials.find((c: any) => c.sessionId === sessionId)

    if (!credential) {
        return {
            status: 404,
            body: {
                error: 'Session not found',
            },
        } as any
    }

    // Calculate remaining time
    const expiresAt = new Date((credential as any).expiresAt)
    const now = new Date()
    const remainingMs = expiresAt.getTime() - now.getTime()
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000))
    const remainingMinutes = Math.floor(remainingSeconds / 60)
    const remainingSecondsDisplay = remainingSeconds % 60

    // Get query history from stream
    const sessionLogs = await streams.sessionLog.getGroup(sessionId)
    const queries = sessionLogs.map((log: any) => ({
        timestamp: log.timestamp,
        command: log.command,
        queryType: log.queryType,
        flagged: log.flagged,
        blocked: log.blocked || false,
        blockReason: log.blockReason,
    }))

    // Get request details for scope
    const requestState = await state.get('access-requests', (credential as any).requestId)

    return {
        status: 200,
        body: {
            sessionId,
            requestId: (credential as any).requestId,
            requester: (credential as any).requester,
            resource: (credential as any).resource,
            accessLevel: (credential as any).accessLevel,
            scope: (credential as any).scope || (requestState as any)?.scope || 'General access',
            createdAt: (credential as any).createdAt,
            expiresAt: (credential as any).expiresAt,
            remaining: {
                seconds: remainingSeconds,
                display: remainingSeconds > 0
                    ? `${remainingMinutes}m ${remainingSecondsDisplay}s`
                    : 'EXPIRED',
            },
            expired: remainingSeconds <= 0,
            queries: {
                total: queries.length,
                allowed: queries.filter((q: any) => !q.blocked).length,
                blocked: queries.filter((q: any) => q.blocked).length,
                history: queries,
            },
        },
    }
}
