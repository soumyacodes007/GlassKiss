import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { RiskAnalyzer } from '../services/risk-analyzer'
import { AccessState } from '../services/glasskiss-types'

const inputSchema = z.object({
    requestId: z.string(),
    reason: z.string(),
    resource: z.string(),
    accessLevel: z.string(),
})

export const config: EventConfig = {
    type: 'event',
    name: 'CalculateRiskScore',
    description: 'Analyzes access request and calculates risk score',
    flows: ['glasskiss'],
    subscribes: ['calculate-risk-score'],
    emits: ['request-approval'],
    input: inputSchema,
}

export const handler: Handlers['CalculateRiskScore'] = async (
    input,
    { logger, state, emit }
) => {
    const { requestId, reason, resource, accessLevel } = input

    logger.info('Calculating risk score', { requestId })

    // Analyze request using RiskAnalyzer service
    const analysis = RiskAnalyzer.analyzeRequest(reason, resource, accessLevel)

    logger.info('Risk analysis complete', {
        requestId,
        riskScore: analysis.riskScore,
        requiredApprovals: analysis.requiredApprovals,
        factors: analysis.factors,
    })

    // Update state with risk score
    const currentState = await state.get<AccessState>('access-requests', requestId)
    if (currentState) {
        await state.set('access-requests', requestId, {
            ...currentState,
            riskScore: analysis.riskScore,
            requiredApprovals: analysis.requiredApprovals,
            status: 'pending_approval',
        })
    }

    // Emit to approval workflow
    await emit({
        topic: 'request-approval',
        data: {
            requestId,
            requester: currentState?.requester || '',
            riskScore: analysis.riskScore,
            resource,
            accessLevel,
            reason,
            requiredApprovals: analysis.requiredApprovals,
        },
    })
}
