import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { CredentialManager } from '../services/credential-manager'
import { AccessState } from '../services/glasskiss-types'

const inputSchema = z.object({
    requestId: z.string(),
    requester: z.string(),
    resource: z.string(),
    accessLevel: z.string(),
    duration: z.number(),
})

export const config: EventConfig = {
    type: 'event',
    name: 'ProvisionCredentials',
    description: 'Provisions temporary credentials with database-level expiry',
    flows: ['glasskiss'],
    subscribes: ['provision-credentials'],
    emits: ['start-monitoring', 'start-timer'],
    input: inputSchema,
}

export const handler: Handlers['ProvisionCredentials'] = async (
    input,
    { logger, state, emit }
) => {
    const { requestId, requester, resource, accessLevel, duration } = input

    logger.info('Provisioning credentials', {
        requestId,
        requester,
        resource,
        duration,
    })

    try {
        // Provision credentials using CredentialManager
        const credentials = await CredentialManager.provisionCredentials(
            requestId,
            resource,
            duration
        )

        logger.info('Credentials provisioned', {
            requestId,
            username: credentials.username,
            expiresAt: credentials.expiresAt,
            sessionId: credentials.sessionId,
        })

        // Store credentials in state (in production, encrypt this!)
        await state.set('credentials', requestId, {
            id: requestId,
            requestId,
            username: credentials.username,
            password: credentials.password,
            resource,
            expiresAt: credentials.expiresAt,
            createdAt: new Date().toISOString(),
            sessionId: credentials.sessionId,
        })

        // Update request state
        const requestState = await state.get<AccessState>(
            'access-requests',
            requestId
        )
        if (requestState) {
            await state.set('access-requests', requestId, {
                ...requestState,
                status: 'active',
            })
        }

        // Emit parallel events for monitoring and timer
        await emit({
            topic: 'start-monitoring',
            data: {
                requestId,
                sessionId: credentials.sessionId,
            },
        })

        await emit({
            topic: 'start-timer',
            data: {
                requestId,
                duration,
            },
        })

        logger.info('Access activated, monitoring and timer started', {
            requestId,
        })
    } catch (error) {
        logger.error('Credential provisioning failed', { requestId, error })
        throw error
    }
}
