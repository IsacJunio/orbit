/**
 * Central configuration for the security core.
 * Paths are now set dynamically via initialize() calls on each module.
 * This config provides shared constants only.
 */
export const SecurityConfig = {
    // Rate limiting
    maxLoginAttempts: 5,
    lockoutDurationMs: 15 * 60 * 1000, // 15 minutes

    // Session defaults
    defaultSessionTTL: 1000 * 60 * 60, // 1 hour

    // Valid IPC collections (whitelist)
    validCollections: ['orders', 'tasks', 'documents', 'suppliers', 'orderTemplates', 'orderHistory', 'settings'] as const
}

export type ValidCollection = typeof SecurityConfig.validCollections[number]

export function isValidCollection(name: string): name is ValidCollection {
    return (SecurityConfig.validCollections as readonly string[]).includes(name)
}
