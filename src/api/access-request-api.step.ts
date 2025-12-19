import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { accessRequestSchema } from '../services/glasskiss-types'

const responseSchema = z.object({
    requestId: z.string(),
    status: z.string(),
    message: z.string(),
})

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'AccessRequestAPI',
    description: 'Entry point for requesting temporary production access',
    flows: ['glasskiss'],
    method: 'POST',
    path: '/access-request',
    bodySchema: accessRequestSchema,
    responseSchema: {
        201: responseSchema,
        400: z.object({ error: z.string() }),
    },
    emits: ['calculate-risk-score'],
}

export const handler: Handlers['AccessRequestAPI'] = async (
    req,
    { logger, emit, state }
) => {
    try {
        const { requester, resource, accessLevel, reason, duration } = req.body

        // Generate unique request ID
        const requestId = randomBytes(12).toString('hex')

        logger.info('Access request received', {
            requestId,
            requester,
            resource,
            accessLevel,
        })

        // Initialize state
        await state.set('access-requests', requestId, {
            id: requestId,
            requester,
            resource,
            accessLevel,
            reason,
            duration,
            riskScore: 0,
            status: 'pending_risk',
            approvers: [],
            requiredApprovals: 0,
            createdAt: new Date().toISOString(),
        })

        // Emit to risk calculator
        await emit({
            topic: 'calculate-risk-score',
            data: {
                requestId,
                reason,
                resource,
                accessLevel,
            },
        })

        return {
            status: 201,
            body: {
                requestId,
                status: 'pending_risk',
                message: 'Access request submitted for risk analysis',
            },
        }
    } catch (error) {
        logger.error('Access request failed', { error })
        return {
            status: 400,
            body: { error: 'Failed to process access request' },
        }
    }
}
