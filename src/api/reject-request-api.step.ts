import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { AccessState } from '../services/glasskiss-types'

const responseSchema = z.object({
    requestId: z.string(),
    status: z.string(),
    message: z.string(),
})

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'RejectRequestAPI',
    description: 'Allows approvers to reject access requests',
    flows: ['glasskiss'],
    method: 'POST',
    path: '/reject/:requestId',
    bodySchema: z.object({
        approver: z.string(),
        reason: z.string().optional(),
    }),
    responseSchema: {
        200: responseSchema,
        404: z.object({ error: z.string() }),
    },
    emits: [],
    virtualSubscribes: ['request-approval'],
}

export const handler: Handlers['RejectRequestAPI'] = async (
    req,
    { logger, state, streams }
) => {
    const { requestId } = req.pathParams
    const { approver, reason } = req.body

    logger.info('Processing rejection', { requestId, approver })

    // Get request state
    const requestState = await state.get<AccessState>(
        'access-requests',
        requestId
    )
    if (!requestState) {
        return { status: 404, body: { error: 'Request not found' } }
    }

    // Find approval in stream
    const approvals = await streams.approvalRequest.getGroup('approvals')
    const approval = approvals.find((a) => a.requestId === requestId)

    if (!approval) {
        return { status: 404, body: { error: 'Approval request not found' } }
    }

    // Check if approver is authorized
    if (!approval.approvers.includes(approver)) {
        return {
            status: 403,
            body: { error: 'Approver not authorized' },
        } as any
    }

    // Update approval stream
    await streams.approvalRequest.set('approvals', approval.id, {
        ...approval,
        status: 'rejected',
    })

    // Update state
    await state.set('access-requests', requestId, {
        ...requestState,
        status: 'rejected',
    })

    logger.info('Request rejected', { requestId, approver, reason })

    return {
        status: 200,
        body: {
            requestId,
            status: 'rejected',
            message: `Request rejected by ${approver}`,
        },
    }
}
