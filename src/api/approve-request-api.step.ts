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
    name: 'ApproveRequestAPI',
    description: 'Allows approvers to approve access requests',
    flows: ['glasskiss'],
    method: 'POST',
    path: '/approve/:requestId',
    bodySchema: z.object({
        approver: z.string(),
    }),
    responseSchema: {
        200: responseSchema,
        404: z.object({ error: z.string() }),
    },
    emits: ['provision-credentials'],
    virtualSubscribes: ['request-approval'],
}

export const handler: Handlers['ApproveRequestAPI'] = async (
    req,
    { logger, state, streams, emit }
) => {
    const { requestId } = req.pathParams
    const { approver } = req.body

    logger.info('Processing approval', { requestId, approver })

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

    // Update approval
    const currentApprovals = approval.currentApprovals + 1
    await streams.approvalRequest.set('approvals', approval.id, {
        ...approval,
        currentApprovals,
        status: currentApprovals >= approval.requiredApprovals ? 'approved' : 'pending',
    })

    // Update state
    const updatedApprovers = [...requestState.approvers, approver]
    await state.set('access-requests', requestId, {
        ...requestState,
        approvers: updatedApprovers,
        status: currentApprovals >= approval.requiredApprovals ? 'approved' : 'pending_approval',
        approvedAt:
            currentApprovals >= approval.requiredApprovals
                ? new Date().toISOString()
                : undefined,
    })

    // If all approvals received, provision credentials
    if (currentApprovals >= approval.requiredApprovals) {
        logger.info('All approvals received, provisioning credentials', {
            requestId,
        })

        await emit({
            topic: 'provision-credentials',
            data: {
                requestId,
                requester: requestState.requester,
                resource: requestState.resource,
                accessLevel: requestState.accessLevel,
                duration: requestState.duration,
            },
        })

        return {
            status: 200,
            body: {
                requestId,
                status: 'approved',
                message: 'Request approved, provisioning credentials',
            },
        }
    }

    return {
        status: 200,
        body: {
            requestId,
            status: 'pending_approval',
            message: `Approval recorded (${currentApprovals}/${approval.requiredApprovals})`,
        },
    }
}
