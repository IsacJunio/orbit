import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

/**
 * SessionManager handles simple local session management.
 * Sessions are stored in a JSON file with a securely generated token and expiration timestamp.
 */
export class SessionManager {
    private static sessionFile = ''
    private static readonly tokenLength = 32 // 256-bit token
    private static readonly defaultTTL = 1000 * 60 * 60 // 1 hour in ms

    /** Initialize with a secure storage path (call after app.whenReady) */
    static initialize(userDataPath: string): void {
        const securityDir = path.join(userDataPath, 'security')
        if (!fs.existsSync(securityDir)) {
            fs.mkdirSync(securityDir, { recursive: true })
        }
        this.sessionFile = path.join(securityDir, 'sessions.json')
    }

    private static ensureStore(): void {
        if (!this.sessionFile) {
            throw new Error('SessionManager not initialized. Call SessionManager.initialize(userDataPath) first.')
        }
        if (!fs.existsSync(this.sessionFile)) {
            fs.mkdirSync(path.dirname(this.sessionFile), { recursive: true })
            fs.writeFileSync(this.sessionFile, JSON.stringify({}))
        }
    }

    private static load(): Record<string, { token: string; expiresAt: number }> {
        this.ensureStore()
        return JSON.parse(fs.readFileSync(this.sessionFile, 'utf8')) as any
    }

    private static save(data: Record<string, { token: string; expiresAt: number }>): void {
        fs.writeFileSync(this.sessionFile, JSON.stringify(data, null, 2))
    }

    /** Create a new session for a given user identifier */
    static createSession(userId: string, ttlMs?: number): string {
        const token = crypto.randomBytes(this.tokenLength).toString('hex')
        const expiresAt = Date.now() + (ttlMs ?? this.defaultTTL)
        const sessions = this.load()
        sessions[userId] = { token, expiresAt }
        this.save(sessions)
        return token
    }

    /** Validate a session token for a user (timing-safe comparison) */
    static validateSession(userId: string, token: string): boolean {
        const sessions = this.load()
        const record = sessions[userId]
        if (!record) return false

        // Use timing-safe comparison to prevent timing attacks
        try {
            const tokenBuf = Buffer.from(token, 'hex')
            const storedBuf = Buffer.from(record.token, 'hex')
            if (tokenBuf.length !== storedBuf.length) return false
            if (!crypto.timingSafeEqual(tokenBuf, storedBuf)) return false
        } catch {
            return false
        }

        if (Date.now() > record.expiresAt) {
            // Session expired, clean up
            delete sessions[userId]
            this.save(sessions)
            return false
        }
        return true
    }

    /** Invalidate a session */
    static invalidateSession(userId: string): void {
        const sessions = this.load()
        if (sessions[userId]) {
            delete sessions[userId]
            this.save(sessions)
        }
    }
}
