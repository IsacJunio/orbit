import * as path from 'path';

/**
 * Central configuration for the security core.
 * Adjust paths if the project structure changes.
 */
export const SecurityConfig = {
    // Directory containing security artifacts (relative to this file)
    baseDir: path.resolve(__dirname),

    // Files used by the security modules
    credentialFile: path.resolve(__dirname, 'credentials.json'),
    sessionFile: path.resolve(__dirname, 'sessions.json'),
    integrityManifestFile: path.resolve(__dirname, 'integrity.manifest.json'),

    // Environment variable name for the encryption passphrase
    cryptoPassphraseEnv: 'CRYPTO_PASSPHRASE',
};
