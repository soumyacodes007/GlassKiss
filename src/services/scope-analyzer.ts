/**
 * Scope Analyzer Service
 * Extracts structured access scope from natural language reasons
 * Maps approved intent to enforceable SQL policies
 */

export interface ExtractedEntity {
    type: string      // 'user', 'order', 'account', etc.
    field: string     // Database field name: 'id', 'user_id', etc.
    value: string     // The actual ID value
}

export interface AccessScope {
    allowedTables: string[]
    allowedOperations: string[]
    rowFilters: Record<string, string>  // table -> WHERE condition
    maxRowsAffected: number
    extractedEntities: ExtractedEntity[]
    scopeDescription: string
}

// Common table name patterns
const TABLE_PATTERNS: Record<string, string[]> = {
    users: ['user', 'users', 'account', 'accounts', 'customer', 'customers', 'member', 'members'],
    orders: ['order', 'orders', 'purchase', 'purchases', 'transaction', 'transactions'],
    billing: ['billing', 'payment', 'payments', 'invoice', 'invoices', 'subscription', 'subscriptions'],
    products: ['product', 'products', 'item', 'items', 'inventory'],
    sessions: ['session', 'sessions', 'login', 'logins', 'auth'],
}

// Entity extraction patterns
const ENTITY_PATTERNS = [
    { regex: /user\s*[#:]?\s*(\d+)/gi, type: 'user', field: 'user_id' },
    { regex: /customer\s*[#:]?\s*(\d+)/gi, type: 'user', field: 'user_id' },
    { regex: /account\s*[#:]?\s*(\d+)/gi, type: 'user', field: 'user_id' },
    { regex: /order\s*[#:]?\s*(\d+)/gi, type: 'order', field: 'order_id' },
    { regex: /transaction\s*[#:]?\s*(\d+)/gi, type: 'order', field: 'transaction_id' },
    { regex: /invoice\s*[#:]?\s*(\d+)/gi, type: 'billing', field: 'invoice_id' },
    { regex: /id\s*[=:]?\s*(\d+)/gi, type: 'entity', field: 'id' },
    { regex: /#(\d+)/g, type: 'entity', field: 'id' },
]

// Operation keywords
const OPERATION_KEYWORDS: Record<string, string[]> = {
    SELECT: ['view', 'read', 'check', 'verify', 'investigate', 'debug', 'look', 'see', 'find', 'query'],
    UPDATE: ['fix', 'update', 'modify', 'change', 'correct', 'edit', 'patch', 'adjust'],
    INSERT: ['add', 'create', 'insert', 'new'],
    DELETE: ['delete', 'remove', 'drop', 'clear'],
}

export class ScopeAnalyzer {
    /**
     * Analyzes a reason string and extracts structured access scope
     */
    static analyzeReason(
        reason: string,
        resource: string,
        accessLevel: 'READ_ONLY' | 'READ_WRITE'
    ): AccessScope {
        const entities = this.extractEntities(reason)
        const tables = this.extractTables(reason, resource)
        const operations = this.extractOperations(reason, accessLevel)
        const rowFilters = this.generateRowFilters(entities, tables)
        const maxRowsAffected = this.calculateMaxRows(reason, accessLevel)

        return {
            allowedTables: tables,
            allowedOperations: operations,
            rowFilters,
            maxRowsAffected,
            extractedEntities: entities,
            scopeDescription: this.generateScopeDescription(entities, tables, operations),
        }
    }

    /**
     * Extract entity references from the reason
     */
    private static extractEntities(reason: string): ExtractedEntity[] {
        const entities: ExtractedEntity[] = []
        const seen = new Set<string>()

        for (const pattern of ENTITY_PATTERNS) {
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
            let match

            while ((match = regex.exec(reason)) !== null) {
                const key = `${pattern.type}:${match[1]}`
                if (!seen.has(key)) {
                    seen.add(key)
                    entities.push({
                        type: pattern.type,
                        field: pattern.field,
                        value: match[1],
                    })
                }
            }
        }

        return entities
    }

    /**
     * Extract table references from the reason
     */
    private static extractTables(reason: string, resource: string): string[] {
        const lowerReason = reason.toLowerCase()
        const tables: string[] = []

        for (const [tableName, keywords] of Object.entries(TABLE_PATTERNS)) {
            for (const keyword of keywords) {
                if (lowerReason.includes(keyword)) {
                    if (!tables.includes(tableName)) {
                        tables.push(tableName)
                    }
                    break
                }
            }
        }

        // If no tables found, infer from resource
        if (tables.length === 0) {
            if (resource.includes('postgres') || resource.includes('db')) {
                // Default to users table for generic database access
                tables.push('users')
            }
        }

        return tables
    }

    /**
     * Extract allowed operations from the reason
     */
    private static extractOperations(
        reason: string,
        accessLevel: 'READ_ONLY' | 'READ_WRITE'
    ): string[] {
        const lowerReason = reason.toLowerCase()
        const operations: string[] = []

        // Always allow SELECT
        operations.push('SELECT')

        if (accessLevel === 'READ_ONLY') {
            return operations
        }

        // Check for write operation keywords
        for (const [op, keywords] of Object.entries(OPERATION_KEYWORDS)) {
            if (op === 'SELECT') continue

            for (const keyword of keywords) {
                if (lowerReason.includes(keyword)) {
                    if (!operations.includes(op)) {
                        operations.push(op)
                    }
                    break
                }
            }
        }

        // If READ_WRITE but no specific write ops found, allow UPDATE
        if (accessLevel === 'READ_WRITE' && operations.length === 1) {
            operations.push('UPDATE')
        }

        // Never allow DELETE/DROP unless explicitly mentioned
        if (!lowerReason.includes('delete') && !lowerReason.includes('remove')) {
            const deleteIndex = operations.indexOf('DELETE')
            if (deleteIndex > -1) {
                operations.splice(deleteIndex, 1)
            }
        }

        return operations
    }

    /**
     * Generate row-level filters based on extracted entities
     */
    private static generateRowFilters(
        entities: ExtractedEntity[],
        tables: string[]
    ): Record<string, string> {
        const filters: Record<string, string> = {}

        for (const table of tables) {
            const conditions: string[] = []

            for (const entity of entities) {
                // Map entity types to table fields
                if (entity.type === 'user' && ['users', 'orders', 'billing', 'sessions'].includes(table)) {
                    const field = table === 'users' ? 'id' : 'user_id'
                    conditions.push(`${field} = ${entity.value}`)
                } else if (entity.type === 'order' && table === 'orders') {
                    conditions.push(`id = ${entity.value}`)
                } else if (entity.type === 'billing' && table === 'billing') {
                    conditions.push(`id = ${entity.value}`)
                } else if (entity.type === 'entity') {
                    conditions.push(`${entity.field} = ${entity.value}`)
                }
            }

            if (conditions.length > 0) {
                filters[table] = conditions.join(' AND ')
            }
        }

        return filters
    }

    /**
     * Calculate maximum rows that can be affected
     */
    private static calculateMaxRows(
        reason: string,
        accessLevel: 'READ_ONLY' | 'READ_WRITE'
    ): number {
        // READ_ONLY can read unlimited rows
        if (accessLevel === 'READ_ONLY') {
            return 1000
        }

        const lowerReason = reason.toLowerCase()

        // Bulk operations need explicit approval
        if (lowerReason.includes('bulk') || lowerReason.includes('mass') || lowerReason.includes('all')) {
            return 100
        }

        // Single entity fixes
        if (lowerReason.match(/#\d+/) || lowerReason.match(/id\s*[=:]\s*\d+/i)) {
            return 1
        }

        // Default conservative limit
        return 10
    }

    /**
     * Generate human-readable scope description
     */
    private static generateScopeDescription(
        entities: ExtractedEntity[],
        tables: string[],
        operations: string[]
    ): string {
        const parts: string[] = []

        parts.push(`Operations: ${operations.join(', ')}`)
        parts.push(`Tables: ${tables.join(', ')}`)

        if (entities.length > 0) {
            const entityDesc = entities.map(e => `${e.type}=${e.value}`).join(', ')
            parts.push(`Scope: ${entityDesc}`)
        }

        return parts.join(' | ')
    }

    /**
     * Validate a SQL command against the access scope
     */
    static validateCommand(
        command: string,
        scope: AccessScope
    ): { valid: boolean; reason?: string } {
        const upperCmd = command.trim().toUpperCase()

        // Extract operation type
        const operation = this.getOperationType(upperCmd)

        // Check if operation is allowed
        if (!scope.allowedOperations.includes(operation)) {
            return {
                valid: false,
                reason: `Operation ${operation} not allowed. Permitted: ${scope.allowedOperations.join(', ')}`,
            }
        }

        // Extract table from command
        const table = this.extractTableFromCommand(command)

        // Check if table is allowed
        if (table && !scope.allowedTables.includes(table.toLowerCase())) {
            return {
                valid: false,
                reason: `Table '${table}' not in allowed scope. Permitted: ${scope.allowedTables.join(', ')}`,
            }
        }

        // For write operations, check row filters
        if (['UPDATE', 'DELETE', 'INSERT'].includes(operation) && table) {
            const requiredFilter = scope.rowFilters[table.toLowerCase()]

            if (requiredFilter) {
                // Check if command contains the required WHERE conditions
                const hasRequiredScope = this.hasRequiredScope(command, requiredFilter)

                if (!hasRequiredScope) {
                    return {
                        valid: false,
                        reason: `Query must include scope filter: WHERE ${requiredFilter}`,
                    }
                }
            }
        }

        return { valid: true }
    }

    /**
     * Get operation type from SQL command
     */
    private static getOperationType(upperCmd: string): string {
        if (upperCmd.startsWith('SELECT')) return 'SELECT'
        if (upperCmd.startsWith('INSERT')) return 'INSERT'
        if (upperCmd.startsWith('UPDATE')) return 'UPDATE'
        if (upperCmd.startsWith('DELETE')) return 'DELETE'
        if (upperCmd.startsWith('DROP')) return 'DROP'
        if (upperCmd.startsWith('CREATE')) return 'CREATE'
        if (upperCmd.startsWith('ALTER')) return 'ALTER'
        if (upperCmd.startsWith('TRUNCATE')) return 'TRUNCATE'
        return 'OTHER'
    }

    /**
     * Extract table name from SQL command
     */
    private static extractTableFromCommand(command: string): string | null {
        const patterns = [
            /FROM\s+(\w+)/i,           // SELECT FROM table
            /UPDATE\s+(\w+)/i,         // UPDATE table
            /INTO\s+(\w+)/i,           // INSERT INTO table
            /DELETE\s+FROM\s+(\w+)/i,  // DELETE FROM table
            /TABLE\s+(\w+)/i,          // DROP TABLE / TRUNCATE TABLE
        ]

        for (const pattern of patterns) {
            const match = command.match(pattern)
            if (match) {
                return match[1]
            }
        }

        return null
    }

    /**
     * Check if command contains required scope conditions
     */
    private static hasRequiredScope(command: string, requiredFilter: string): boolean {
        const lowerCmd = command.toLowerCase()

        // Parse required conditions
        const conditions = requiredFilter.toLowerCase().split(' and ').map(c => c.trim())

        // Check each condition is present
        for (const condition of conditions) {
            // Extract field and value from "field = value"
            const match = condition.match(/(\w+)\s*=\s*(\d+)/)
            if (match) {
                const field = match[1]
                const value = match[2]

                // Check if command contains this filter
                const filterPattern = new RegExp(`${field}\\s*=\\s*${value}`, 'i')
                if (!filterPattern.test(lowerCmd)) {
                    return false
                }
            }
        }

        return conditions.length > 0
    }
}
