import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { AccessState } from '../services/glasskiss-types'

const inputSchema = z.object({
    requestId: z.string(),
})

export const config: EventConfig = {
    type: 'event',
    name: 'GenerateAudit',
    description: 'Generates compliance audit report with AI summary',
    flows: ['glasskiss'],
    subscribes: ['generate-audit'],
    emits: [],
    input: inputSchema,
}

export const handler: Handlers['GenerateAudit'] = async (
    input,
    { logger, state, streams }
) => {
    const { requestId } = input

    logger.info('Generating audit report', { requestId })

    // Get request state
    const requestState = await state.get<AccessState>(
        'access-requests',
        requestId
    )
    if (!requestState) {
        logger.error('Request not found for audit', { requestId })
        return
    }

    // Get all session logs
    const allLogs = await streams.sessionLog.getGroup('all')
    const sessionLogs = allLogs.filter((log) => log.requestId === requestId)

    // Analyze logs
    const totalCommands = sessionLogs.length
    const flaggedCommands = sessionLogs.filter((log) => log.flagged).length

    // Generate summary using simple analysis (could use LLM in production)
    const queryTypeCounts: Record<string, number> = {}
    sessionLogs.forEach((log) => {
        queryTypeCounts[log.queryType] =
            (queryTypeCounts[log.queryType] || 0) + 1
    })

    const summary = generateSummary(queryTypeCounts, flaggedCommands)

    // Create audit report
    const auditReport = {
        id: requestId,
        requestId,
        requester: requestState.requester,
        resource: requestState.resource,
        accessLevel: requestState.accessLevel,
        approvers: requestState.approvers,
        riskScore: requestState.riskScore,
        startTime: requestState.approvedAt || requestState.createdAt,
        endTime: requestState.revokedAt || new Date().toISOString(),
        totalCommands,
        summary,
        flaggedCommands,
        status: requestState.status,
        revokeReason: requestState.revokeReason,
    }

    // Store in audit stream
    await streams.auditReport.set('audits', requestId, auditReport)

    // Also store in state for long-term compliance
    await state.set('audit-reports', requestId, auditReport)

    logger.info('Audit report generated', {
        requestId,
        totalCommands,
        flaggedCommands,
        summary,
    })
}

function generateSummary(
    queryTypeCounts: Record<string, number>,
    flaggedCommands: number
): string {
    const parts: string[] = []

    Object.entries(queryTypeCounts).forEach(([type, count]) => {
        parts.push(`${count} ${type} ${count === 1 ? 'query' : 'queries'}`)
    })

    const summary = `User executed: ${parts.join(', ') || 'no commands'}.`

    if (flaggedCommands > 0) {
        return `${summary} WARNING: ${flaggedCommands} dangerous ${flaggedCommands === 1 ? 'command' : 'commands'} detected and blocked.`
    }

    return summary
}
