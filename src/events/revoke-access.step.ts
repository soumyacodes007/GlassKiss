import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { CredentialManager } from '../services/credential-manager'
import { AccessState } from '../services/glasskiss-types'

const inputSchema = z.object({
    requestId: z.string(),
    reason: z.enum(['timer_expired', 'forced', 'anomaly_detected', 'manual']),
    details: z.string().optional(),
})

export const config: EventConfig = {
    type: 'event',
    name: 'RevokeAccess',
    description: 'Revokes credentials and terminates active connections',
    flows: ['glasskiss'],
    subscribes: ['revoke-access', 'force-revoke'],
    emits: ['generate-audit'],
    input: inputSchema,
}

export const handler: Handlers['RevokeAccess'] = async (
    input,
    { logger, state, emit }
) => {
    const { requestId, reason, details } = input

    logger.info('Revoking access', { requestId, reason, details })

    // Get credentials
    const credentials = await state.get('credentials', requestId)
    if (!credentials) {
        logger.warn('No credentials found for revocation', { requestId })
        return
    }

    const username = (credentials as any).username
    const resource = (credentials as any).resource

    // Attempt revocation with retry logic
    let success = false
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.info(`Revocation attempt ${attempt}/${maxRetries}`, {
                requestId,
                username,
            })

            success = await CredentialManager.revokeCredentials(username, resource)

            if (success) {
                logger.info('Credentials revoked successfully', {
                    requestId,
                    username,
                    attempt,
                })
                break
            }
        } catch (error) {
            logger.error(`Revocation attempt ${attempt} failed`, {
                requestId,
                error,
            })

            if (attempt === maxRetries) {
                logger.error('All revocation attempts failed - ALERT SECURITY', {
                    requestId,
                    username,
                })
                // In production: page on-call, send alert
            } else {
                // Wait before retry
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
            }
        }
    }

    // Update state
    const requestState = await state.get<AccessState>(
        'access-requests',
        requestId
    )
    if (requestState) {
        await state.set('access-requests', requestId, {
            ...requestState,
            status: 'revoked',
            revokedAt: new Date().toISOString(),
            revokeReason: reason,
        })
    }

    // Delete credentials from state
    await state.delete('credentials', requestId)

    // Emit to audit generation
    await emit({
        topic: 'generate-audit',
        data: {
            requestId,
        },
    })

    logger.info('Access revocation complete', { requestId, success })
}
