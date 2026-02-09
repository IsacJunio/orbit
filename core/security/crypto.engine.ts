import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CryptoEngine provides encryption and decryption utilities for sensitive data at rest.
 * Uses AES-256-GCM with a key derived from a machine-unique passphrase.
 * The passphrase is stored securely in the provided directory.
 */
export class CryptoEngine {
    private static readonly algorithm = 'aes-256-gcm';
    private static readonly keyLength = 32; // 256 bits
    private static readonly ivLength = 12; // 96 bits for GCM
    private static keyStorePath: string | null = null;

    static initialize(userDataPath: string): void {
        const securityDir = path.join(userDataPath, 'security');
        if (!fs.existsSync(securityDir)) {
            fs.mkdirSync(securityDir, { recursive: true });
        }
        this.keyStorePath = path.join(securityDir, '.keystore');
    }

    private static getKey(): Buffer {
        if (!this.keyStorePath) {
            throw new Error('CryptoEngine not initialized. Call CryptoEngine.initialize(userDataPath) first.');
        }

        // If key file exists, read it
        if (fs.existsSync(this.keyStorePath)) {
            const stored = fs.readFileSync(this.keyStorePath, 'utf8');
            return Buffer.from(stored, 'hex');
        }

        // Generate a new random key and store it
        const newKey = crypto.randomBytes(this.keyLength);
        fs.writeFileSync(this.keyStorePath, newKey.toString('hex'), { mode: 0o600 });
        return newKey;
    }

    static encrypt(plainText: string): { iv: string; authTag: string; data: string } {
        const key = this.getKey();
        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return {
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            data: encrypted.toString('hex'),
        };
    }

    static decrypt(payload: { iv: string; authTag: string; data: string }): string {
        const { iv, authTag, data } = payload;
        const key = this.getKey();
        const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(data, 'hex')),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    }
}
