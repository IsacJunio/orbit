import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

/**
 * IntegrityChecker verifies the integrity of critical application files.
 * It maintains a manifest of expected SHA‑256 hashes and can validate current files against it.
 */
export class IntegrityChecker {
    private static readonly manifestFile = path.resolve(__dirname, 'integrity.manifest.json');

    /** Ensure the manifest file exists */
    private static ensureManifest(): void {
        if (!fs.existsSync(this.manifestFile)) {
            fs.mkdirSync(path.dirname(this.manifestFile), { recursive: true });
            fs.writeFileSync(this.manifestFile, JSON.stringify({}), { mode: 0o600 });
        }
    }

    /** Compute SHA‑256 hash of a file */
    private static hashFile(filePath: string): string {
        const data = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /** Register or update a file's expected hash in the manifest */
    static registerFile(filePath: string): void {
        this.ensureManifest();
        const manifest = JSON.parse(fs.readFileSync(this.manifestFile, 'utf8')) as Record<string, string>;
        const absolutePath = path.resolve(filePath);
        manifest[absolutePath] = this.hashFile(absolutePath);
        fs.writeFileSync(this.manifestFile, JSON.stringify(manifest, null, 2), { mode: 0o600 });
    }

    /** Validate a single file against the stored manifest */
    static validateFile(filePath: string): boolean {
        this.ensureManifest();
        const manifest = JSON.parse(fs.readFileSync(this.manifestFile, 'utf8')) as Record<string, string>;
        const absolutePath = path.resolve(filePath);
        const expected = manifest[absolutePath];
        if (!expected) return false; // not registered
        const actual = this.hashFile(absolutePath);
        return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
    }

    /** Validate all registered files; returns list of mismatched paths */
    static validateAll(): string[] {
        this.ensureManifest();
        const manifest = JSON.parse(fs.readFileSync(this.manifestFile, 'utf8')) as Record<string, string>;
        const mismatches: string[] = [];
        for (const [filePath, expected] of Object.entries(manifest)) {
            if (!fs.existsSync(filePath)) {
                mismatches.push(filePath + ' (missing)');
                continue;
            }
            const actual = this.hashFile(filePath);
            if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))) {
                mismatches.push(filePath);
            }
        }
        return mismatches;
    }
}
