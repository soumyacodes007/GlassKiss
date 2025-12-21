import { ApiRouteConfig, Handlers } from 'motia'

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'GetSessionAPI',
    description: 'Get session ID for an approved request',
    method: 'GET',
    path: '/session-info/:requestId',
    flows: ['glasskiss'],
    emits: [],
}

export const handler: Handlers['GetSessionAPI'] = async (
    req,
    { logger, state }
) => {
    const { requestId } = req.pathParams

    logger.info('Fetching session info', { requestId })

    // Get credentials for this request
    const allCredentials = await state.getGroup('credentials')
    logger.info('All credentials found', { count: allCredentials.length, requestIds: allCredentials.map((c: any) => c.requestId) })

    const credential = allCredentials.find((c: any) => c.requestId === requestId)

    logger.info('Credential lookup result', { requestId, found: !!credential, sessionId: (credential as any)?.sessionId })

    if (!credential) {
        return {
            status: 404,
            body: {
                requestId,
                status: 'not_found',
            },
        } as any
    }

    return {
        status: 200,
        body: {
            requestId,
            sessionId: (credential as any).sessionId,
            status: 'active',
        },
    }
}

