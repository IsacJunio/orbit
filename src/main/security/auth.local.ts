import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * AuthLocal provides secure handling of local user credentials.
 * Passwords are hashed with PBKDF2 (SHA-256) using a per‑user random salt.
 * Credential records are stored in a JSON file under the security directory.
 */
export class AuthLocal {
    private static readonly credentialFile = path.resolve(__dirname, 'credentials.json');
    private static readonly iterations = 100_000;
    private static readonly keyLen = 32; // 256‑bit
    private static readonly digest = 'sha256';

    /** Ensure the credential storage file exists */
    private static ensureStore(): void {
        if (!fs.existsSync(this.credentialFile)) {
            fs.mkdirSync(path.dirname(this.credentialFile), { recursive: true });
            fs.writeFileSync(this.credentialFile, JSON.stringify({}), { mode: 0o600 });
        }
    }

    /** Generate a salted hash for a plain password */
    static hashPassword(password: string): { salt: string; hash: string } {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLen, this.digest).toString('hex');
        return { salt, hash };
    }

    /** Verify a password against stored salt and hash */
    static verifyPassword(password: string, salt: string, hash: string): boolean {
        const derived = crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLen, this.digest).toString('hex');
        return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
    }

    /** Store a new user credential */
    static storeCredential(username: string, password: string): void {
        this.ensureStore();
        const { salt, hash } = this.hashPassword(password);
        const data = JSON.parse(fs.readFileSync(this.credentialFile, 'utf8')) as Record<string, any>;
        data[username] = { salt, hash };
        fs.writeFileSync(this.credentialFile, JSON.stringify(data, null, 2), { mode: 0o600 });
    }

    /** Validate login attempt */
    static validateCredential(username: string, password: string): boolean {
        this.ensureStore();
        const data = JSON.parse(fs.readFileSync(this.credentialFile, 'utf8')) as Record<string, any>;
        const record = data[username];
        if (!record) return false;
        return this.verifyPassword(password, record.salt, record.hash);
    }
}
