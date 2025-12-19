import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { CredentialManager } from '../services/credential-manager'
import { AccessState, AccessScope } from '../services/glasskiss-types'
import { ScopeAnalyzer } from '../services/scope-analyzer'
import { AIService } from '../services/ai-service'

const inputSchema = z.object({
    requestId: z.string(),
    requester: z.string(),
    resource: z.string(),
    accessLevel: z.string(),
    duration: z.number(),
    reason: z.string().optional(),  // Added for scope generation
})

export const config: EventConfig = {
    type: 'event',
    name: 'ProvisionCredentials',
    description: 'Provisions temporary credentials with AI-powered scope extraction',
    flows: ['glasskiss'],
    subscribes: ['provision-credentials'],
    emits: ['start-monitoring', 'start-timer'],
    input: inputSchema,
}

export const handler: Handlers['ProvisionCredentials'] = async (
    input,
    { logger, state, emit }
) => {
    const { requestId, requester, resource, accessLevel, duration, reason } = input

    logger.info('Provisioning credentials', {
        requestId,
        requester,
        resource,
        duration,
    })

    try {
        let accessScope: AccessScope | undefined

        // 🤖 AI-POWERED SCOPE EXTRACTION using Groq
        if (reason) {
            try {
                logger.info('Extracting scope using AI (Groq)', { requestId })

                const aiScope = await AIService.extractScope(
                    reason,
                    resource,
                    accessLevel
                )

                // Convert AI response to AccessScope format
                accessScope = {
                    allowedTables: aiScope.tables,
                    allowedOperations: aiScope.operations as ('SELECT' | 'INSERT' | 'UPDATE' | 'DELETE')[],
                    rowFilters: {},
                    maxRowsAffected: aiScope.maxRows,
                    extractedEntities: aiScope.entities.map(e => ({
                        type: e.type,
                        field: `${e.type}_id`,
                        value: e.id,
                    })),
                    scopeDescription: aiScope.summary,
                }

                // Build row filters from entities
                for (const entity of aiScope.entities) {
                    for (const table of aiScope.tables) {
                        accessScope.rowFilters[table] = `${entity.type}_id = ${entity.id}`
                    }
                }

                logger.info('🤖 AI-powered scope extraction successful', {
                    requestId,
                    summary: aiScope.summary,
                    tables: aiScope.tables,
                    operations: aiScope.operations,
                    entities: aiScope.entities,
                })
            } catch (aiError) {
                logger.warn('AI scope extraction failed, falling back to rule-based', {
                    requestId,
                    error: aiError
                })

                // Fallback to rule-based extraction
                accessScope = ScopeAnalyzer.analyzeReason(
                    reason,
                    resource,
                    accessLevel as 'READ_ONLY' | 'READ_WRITE'
                )
            }
        }

        if (accessScope) {
            logger.info('Access scope generated', {
                requestId,
                allowedTables: accessScope.allowedTables,
                allowedOperations: accessScope.allowedOperations,
                maxRowsAffected: accessScope.maxRowsAffected,
                scopeDescription: accessScope.scopeDescription,
            })
        }

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

        // Store credentials in state WITH access scope (in production, encrypt this!)
        await state.set('credentials', requestId, {
            id: requestId,
            requestId,
            username: credentials.username,
            password: credentials.password,
            resource,
            expiresAt: credentials.expiresAt,
            createdAt: new Date().toISOString(),
            sessionId: credentials.sessionId,
            accessScope,  // Include enforced scope policy
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

        logger.info('Access activated with AI-powered scope enforcement', {
            requestId,
            scopeDescription: accessScope?.scopeDescription ?? 'No scope restrictions',
        })
    } catch (error) {
        logger.error('Credential provisioning failed', { requestId, error })
        throw error
    }
}

