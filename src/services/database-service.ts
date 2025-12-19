/**
 * Real PostgreSQL Database Service
 * Handles actual credential provisioning and revocation
 */

import pg from 'pg'
const { Pool } = pg

export interface DatabaseCredentials {
    username: string
    password: string
    expiresAt: string
    sessionId: string
}

// Create connection pool using environment variables
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'glasskiss',
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'password',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
})

export class DatabaseService {
    /**
     * Test database connection
     */
    static async testConnection(): Promise<boolean> {
        try {
            const client = await pool.connect()
            await client.query('SELECT 1')
            client.release()
            console.log('[DATABASE] ✅ Connection successful')
            return true
        } catch (error) {
            console.error('[DATABASE] ❌ Connection failed:', error)
            return false
        }
    }

    /**
     * Initialize database schema for GlassKiss
     */
    static async initializeSchema(): Promise<void> {
        const client = await pool.connect()
        try {
            // Create audit log table
            await client.query(`
                CREATE TABLE IF NOT EXISTS glasskiss_audit_log (
                    id SERIAL PRIMARY KEY,
                    request_id VARCHAR(64) NOT NULL,
                    session_id VARCHAR(64),
                    username VARCHAR(128),
                    action VARCHAR(64) NOT NULL,
                    details JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            // Create temp users tracking table
            await client.query(`
                CREATE TABLE IF NOT EXISTS glasskiss_temp_users (
                    id SERIAL PRIMARY KEY,
                    request_id VARCHAR(64) NOT NULL,
                    username VARCHAR(128) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    revoked_at TIMESTAMP,
                    status VARCHAR(32) DEFAULT 'active'
                )
            `)

            // Create sample data table for testing
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255),
                    name VARCHAR(255),
                    status VARCHAR(32) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            await client.query(`
                CREATE TABLE IF NOT EXISTS billing (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    amount DECIMAL(10,2),
                    status VARCHAR(32),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)

            // Insert sample data if empty
            const result = await client.query('SELECT COUNT(*) FROM users')
            if (parseInt(result.rows[0].count) === 0) {
                await client.query(`
                    INSERT INTO users (id, email, name, status) VALUES 
                    (123, 'user123@example.com', 'Test User 123', 'active'),
                    (456, 'user456@example.com', 'Test User 456', 'active'),
                    (789, 'user789@example.com', 'Test User 789', 'inactive')
                `)
                await client.query(`
                    INSERT INTO billing (user_id, amount, status) VALUES 
                    (123, 99.99, 'paid'),
                    (123, 149.99, 'pending'),
                    (456, 199.99, 'paid')
                `)
            }

            console.log('[DATABASE] ✅ Schema initialized')
        } finally {
            client.release()
        }
    }

    /**
     * Provision temporary database credentials
     * Creates a real PostgreSQL user with time-limited access
     */
    static async provisionCredentials(
        requestId: string,
        resource: string,
        durationMinutes: number
    ): Promise<DatabaseCredentials> {
        const client = await pool.connect()

        try {
            // Generate unique username and password
            const username = `gk_${requestId.substring(0, 8)}`
            const password = this.generateSecurePassword()
            const sessionId = this.generateSessionId()
            const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)

            // Create the temporary database user
            // Using VALID UNTIL for automatic expiry at database level
            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${username}') THEN
                        CREATE ROLE ${username} WITH LOGIN PASSWORD '${password}' VALID UNTIL '${expiresAt.toISOString()}';
                    END IF;
                END
                $$;
            `)

            // Grant limited permissions
            await client.query(`GRANT CONNECT ON DATABASE glasskiss TO ${username}`)
            await client.query(`GRANT USAGE ON SCHEMA public TO ${username}`)
            await client.query(`GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO ${username}`)
            await client.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ${username}`)

            // Track the temporary user
            await client.query(`
                INSERT INTO glasskiss_temp_users (request_id, username, expires_at, status)
                VALUES ($1, $2, $3, 'active')
                ON CONFLICT (username) DO UPDATE SET 
                    expires_at = EXCLUDED.expires_at,
                    status = 'active',
                    revoked_at = NULL
            `, [requestId, username, expiresAt])

            // Log the action
            await client.query(`
                INSERT INTO glasskiss_audit_log (request_id, session_id, username, action, details)
                VALUES ($1, $2, $3, 'PROVISION', $4)
            `, [requestId, sessionId, username, JSON.stringify({
                resource,
                durationMinutes,
                expiresAt: expiresAt.toISOString()
            })])

            console.log(`[DATABASE] ✅ Created temp user: ${username} (expires: ${expiresAt.toISOString()})`)

            return {
                username,
                password,
                expiresAt: expiresAt.toISOString(),
                sessionId,
            }
        } finally {
            client.release()
        }
    }

    /**
     * Revoke temporary credentials
     * Terminates active sessions and drops the user
     */
    static async revokeCredentials(
        username: string,
        requestId: string,
        reason: string
    ): Promise<boolean> {
        const client = await pool.connect()

        try {
            // Terminate all active connections for this user
            await client.query(`
                SELECT pg_terminate_backend(pid) 
                FROM pg_stat_activity 
                WHERE usename = $1
            `, [username])

            // Revoke all privileges
            await client.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${username}`)
            await client.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${username}`)
            await client.query(`REVOKE CONNECT ON DATABASE glasskiss FROM ${username}`)

            // Drop the user role
            await client.query(`DROP ROLE IF EXISTS ${username}`)

            // Update tracking
            await client.query(`
                UPDATE glasskiss_temp_users 
                SET status = 'revoked', revoked_at = NOW() 
                WHERE username = $1
            `, [username])

            // Log the action
            await client.query(`
                INSERT INTO glasskiss_audit_log (request_id, username, action, details)
                VALUES ($1, $2, 'REVOKE', $3)
            `, [requestId, username, JSON.stringify({ reason })])

            console.log(`[DATABASE] ✅ Revoked credentials for: ${username}`)
            return true
        } catch (error) {
            console.error(`[DATABASE] ❌ Failed to revoke ${username}:`, error)
            return false
        } finally {
            client.release()
        }
    }

    /**
     * Execute a query as a specific user (for testing scope enforcement)
     */
    static async executeAsUser(
        username: string,
        password: string,
        query: string
    ): Promise<{ success: boolean; rows?: any[]; error?: string }> {
        const userPool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DATABASE || 'glasskiss',
            user: username,
            password: password,
            ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
        })

        try {
            const result = await userPool.query(query)
            await userPool.end()
            return { success: true, rows: result.rows }
        } catch (error: any) {
            await userPool.end()
            return { success: false, error: error.message }
        }
    }

    /**
     * Get expired but not revoked credentials (for zombie defense)
     */
    static async getZombieCredentials(): Promise<string[]> {
        const client = await pool.connect()
        try {
            const result = await client.query(`
                SELECT username FROM glasskiss_temp_users 
                WHERE status = 'active' AND expires_at < NOW()
            `)
            return result.rows.map(r => r.username)
        } finally {
            client.release()
        }
    }

    /**
     * Log a command execution
     */
    static async logCommand(
        requestId: string,
        sessionId: string,
        command: string,
        blocked: boolean,
        reason?: string
    ): Promise<void> {
        const client = await pool.connect()
        try {
            await client.query(`
                INSERT INTO glasskiss_audit_log (request_id, session_id, action, details)
                VALUES ($1, $2, $3, $4)
            `, [requestId, sessionId, blocked ? 'BLOCKED' : 'EXECUTED', JSON.stringify({
                command: command.substring(0, 500),
                blocked,
                reason
            })])
        } finally {
            client.release()
        }
    }

    // Helper methods
    private static generateSecurePassword(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
        let password = ''
        for (let i = 0; i < 24; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return password
    }

    private static generateSessionId(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36)
    }
}

// Export pool for direct access if needed
export { pool }
