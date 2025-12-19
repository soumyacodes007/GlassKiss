/**
 * Blast Radius Controller Service
 * Enforces limits on SQL operations to prevent mass destruction
 * This is the last line of defense before a query executes
 */

import { AccessScope } from './scope-analyzer'

export interface BlastRadiusResult {
    allowed: boolean
    reason?: string
    violationType?: 'row_limit' | 'no_where' | 'table_blocked' | 'operation_blocked' | 'scope_violation'
    severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface BlastRadiusConfig {
    maxRowsAffected: number
    requireWhereForUpdate: boolean
    requireWhereForDelete: boolean
    blockedOperations: string[]
    blockedTables: string[]
}

// Default conservative configuration
const DEFAULT_CONFIG: BlastRadiusConfig = {
    maxRowsAffected: 100,
    requireWhereForUpdate: true,
    requireWhereForDelete: true,
    blockedOperations: ['DROP', 'TRUNCATE', 'ALTER'],
    blockedTables: ['migrations', 'schema_versions', 'pg_catalog', 'information_schema'],
}

// Dangerous pattern detection
const DANGEROUS_PATTERNS = [
    {
        name: 'DROP without safeguard',
        regex: /^DROP\s+(TABLE|DATABASE|SCHEMA|INDEX)/i,
        severity: 'critical' as const,
    },
    {
        name: 'TRUNCATE table',
        regex: /^TRUNCATE\s+TABLE/i,
        severity: 'critical' as const,
    },
    {
        name: 'DELETE all rows (no WHERE)',
        regex: /^DELETE\s+FROM\s+\w+\s*;?\s*$/i,
        severity: 'critical' as const,
    },
    {
        name: 'UPDATE all rows (no WHERE)',
        regex: /^UPDATE\s+\w+\s+SET\s+[^;]+(?<!WHERE\s+\w+)\s*;?\s*$/i,
        severity: 'high' as const,
    },
    {
        name: 'Mass DELETE with *',
        regex: /DELETE\s+\*\s+FROM/i,
        severity: 'critical' as const,
    },
]

export class BlastRadiusController {
    private config: BlastRadiusConfig

    constructor(config?: Partial<BlastRadiusConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config }
    }

    /**
     * Main entry point - checks if a command is within blast radius
     */
    checkCommand(command: string, scope?: AccessScope): BlastRadiusResult {
        const trimmedCmd = command.trim()
        const upperCmd = trimmedCmd.toUpperCase()

        // Check 1: Dangerous patterns (highest priority)
        const dangerousCheck = this.checkDangerousPatterns(trimmedCmd)
        if (!dangerousCheck.allowed) {
            return dangerousCheck
        }

        // Check 2: Blocked operations
        const operationCheck = this.checkBlockedOperations(upperCmd)
        if (!operationCheck.allowed) {
            return operationCheck
        }

        // Check 3: Blocked tables
        const tableCheck = this.checkBlockedTables(trimmedCmd)
        if (!tableCheck.allowed) {
            return tableCheck
        }

        // Check 4: WHERE clause requirements
        const whereCheck = this.checkWhereClause(trimmedCmd)
        if (!whereCheck.allowed) {
            return whereCheck
        }

        // Check 5: Row limit estimation
        const rowLimitCheck = this.checkRowLimit(trimmedCmd, scope)
        if (!rowLimitCheck.allowed) {
            return rowLimitCheck
        }

        // Check 6: Scope validation (if scope provided)
        if (scope) {
            const scopeCheck = this.checkScopeCompliance(trimmedCmd, scope)
            if (!scopeCheck.allowed) {
                return scopeCheck
            }
        }

        return {
            allowed: true,
            severity: 'low',
        }
    }

    /**
     * Check against known dangerous patterns
     */
    private checkDangerousPatterns(command: string): BlastRadiusResult {
        for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.regex.test(command)) {
                return {
                    allowed: false,
                    reason: `Blocked: ${pattern.name}`,
                    violationType: 'operation_blocked',
                    severity: pattern.severity,
                }
            }
        }

        return { allowed: true, severity: 'low' }
    }

    /**
     * Check if operation type is blocked
     */
    private checkBlockedOperations(upperCmd: string): BlastRadiusResult {
        for (const op of this.config.blockedOperations) {
            if (upperCmd.startsWith(op)) {
                return {
                    allowed: false,
                    reason: `Operation ${op} is blocked by blast radius policy`,
                    violationType: 'operation_blocked',
                    severity: 'high',
                }
            }
        }

        return { allowed: true, severity: 'low' }
    }

    /**
     * Check if command targets a blocked table
     */
    private checkBlockedTables(command: string): BlastRadiusResult {
        const lowerCmd = command.toLowerCase()

        for (const table of this.config.blockedTables) {
            // Check various SQL patterns that reference tables
            const patterns = [
                new RegExp(`from\\s+${table}\\b`, 'i'),
                new RegExp(`into\\s+${table}\\b`, 'i'),
                new RegExp(`update\\s+${table}\\b`, 'i'),
                new RegExp(`table\\s+${table}\\b`, 'i'),
            ]

            for (const pattern of patterns) {
                if (pattern.test(lowerCmd)) {
                    return {
                        allowed: false,
                        reason: `Table '${table}' is protected by blast radius policy`,
                        violationType: 'table_blocked',
                        severity: 'high',
                    }
                }
            }
        }

        return { allowed: true, severity: 'low' }
    }

    /**
     * Check WHERE clause requirements for UPDATE/DELETE
     */
    private checkWhereClause(command: string): BlastRadiusResult {
        const upperCmd = command.toUpperCase().trim()
        const hasWhere = /\bWHERE\b/i.test(command)

        // Check DELETE
        if (upperCmd.startsWith('DELETE') && this.config.requireWhereForDelete && !hasWhere) {
            return {
                allowed: false,
                reason: 'DELETE requires a WHERE clause. Mass deletes are not permitted.',
                violationType: 'no_where',
                severity: 'critical',
            }
        }

        // Check UPDATE
        if (upperCmd.startsWith('UPDATE') && this.config.requireWhereForUpdate && !hasWhere) {
            return {
                allowed: false,
                reason: 'UPDATE requires a WHERE clause. Mass updates are not permitted.',
                violationType: 'no_where',
                severity: 'high',
            }
        }

        return { allowed: true, severity: 'low' }
    }

    /**
     * Estimate and check row limit
     */
    private checkRowLimit(command: string, scope?: AccessScope): BlastRadiusResult {
        const maxRows = scope?.maxRowsAffected ?? this.config.maxRowsAffected
        const upperCmd = command.toUpperCase()

        // Check for LIMIT clause
        const limitMatch = command.match(/LIMIT\s+(\d+)/i)
        if (limitMatch) {
            const limit = parseInt(limitMatch[1], 10)
            if (limit > maxRows) {
                return {
                    allowed: false,
                    reason: `LIMIT ${limit} exceeds maximum allowed (${maxRows})`,
                    violationType: 'row_limit',
                    severity: 'medium',
                }
            }
        }

        // For DELETE/UPDATE without LIMIT, check if WHERE is specific enough
        if ((upperCmd.startsWith('DELETE') || upperCmd.startsWith('UPDATE')) && !limitMatch) {
            // Check for specific ID targeting
            const hasSpecificId = /WHERE\s+\w*id\s*=\s*\d+/i.test(command)
            const hasInClause = /WHERE\s+\w*id\s+IN\s*\(/i.test(command)

            if (!hasSpecificId && !hasInClause) {
                return {
                    allowed: false,
                    reason: `Write operations must target specific IDs or include LIMIT. Max rows: ${maxRows}`,
                    violationType: 'row_limit',
                    severity: 'medium',
                }
            }

            // If using IN clause, count the items
            if (hasInClause) {
                const inMatch = command.match(/IN\s*\(([^)]+)\)/i)
                if (inMatch) {
                    const itemCount = inMatch[1].split(',').length
                    if (itemCount > maxRows) {
                        return {
                            allowed: false,
                            reason: `IN clause contains ${itemCount} items, exceeds max ${maxRows}`,
                            violationType: 'row_limit',
                            severity: 'medium',
                        }
                    }
                }
            }
        }

        return { allowed: true, severity: 'low' }
    }

    /**
     * Check compliance with access scope
     */
    private checkScopeCompliance(command: string, scope: AccessScope): BlastRadiusResult {
        // Check operation type
        const operation = this.getOperationType(command)

        if (!scope.allowedOperations.includes(operation)) {
            return {
                allowed: false,
                reason: `Operation ${operation} not in approved scope. Allowed: ${scope.allowedOperations.join(', ')}`,
                violationType: 'scope_violation',
                severity: 'high',
            }
        }

        // Check table
        const table = this.extractTableName(command)
        if (table && !scope.allowedTables.includes(table.toLowerCase())) {
            return {
                allowed: false,
                reason: `Table '${table}' not in approved scope. Allowed: ${scope.allowedTables.join(', ')}`,
                violationType: 'scope_violation',
                severity: 'high',
            }
        }

        // For write operations, check row filters
        if (['UPDATE', 'DELETE'].includes(operation) && table) {
            const requiredFilter = scope.rowFilters[table.toLowerCase()]

            if (requiredFilter && Object.keys(scope.rowFilters).length > 0) {
                const hasFilter = this.commandContainsFilter(command, requiredFilter)

                if (!hasFilter) {
                    return {
                        allowed: false,
                        reason: `Query must include approved scope: WHERE ${requiredFilter}`,
                        violationType: 'scope_violation',
                        severity: 'high',
                    }
                }
            }
        }

        return { allowed: true, severity: 'low' }
    }

    /**
     * Get operation type from command
     */
    private getOperationType(command: string): string {
        const upperCmd = command.trim().toUpperCase()
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
     * Extract table name from command
     */
    private extractTableName(command: string): string | null {
        const patterns = [
            /FROM\s+(\w+)/i,
            /UPDATE\s+(\w+)/i,
            /INTO\s+(\w+)/i,
            /DELETE\s+FROM\s+(\w+)/i,
            /TABLE\s+(\w+)/i,
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
     * Check if command contains required filter conditions
     */
    private commandContainsFilter(command: string, filter: string): boolean {
        const lowerCmd = command.toLowerCase()
        const conditions = filter.toLowerCase().split(' and ').map(c => c.trim())

        for (const condition of conditions) {
            const match = condition.match(/(\w+)\s*=\s*(\w+)/)
            if (match) {
                const field = match[1]
                const value = match[2]
                const filterRegex = new RegExp(`${field}\\s*=\\s*['"]?${value}['"]?`, 'i')

                if (!filterRegex.test(lowerCmd)) {
                    return false
                }
            }
        }

        return conditions.length > 0
    }

    /**
     * Create a controller with scope-specific configuration
     */
    static fromScope(scope: AccessScope): BlastRadiusController {
        return new BlastRadiusController({
            maxRowsAffected: scope.maxRowsAffected,
            requireWhereForUpdate: true,
            requireWhereForDelete: true,
            // Block any operations not in scope
            blockedOperations: ['DROP', 'TRUNCATE', 'ALTER', 'CREATE']
                .filter(op => !scope.allowedOperations.includes(op)),
        })
    }
}
