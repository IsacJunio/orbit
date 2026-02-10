import { app } from 'electron'

const isDev = (): boolean => !app.isPackaged

export const logger = {
    info: (...args: unknown[]): void => {
        if (isDev()) console.log('[INFO]', ...args)
    },
    warn: (...args: unknown[]): void => {
        console.warn('[WARN]', ...args)
    },
    error: (...args: unknown[]): void => {
        console.error('[ERROR]', ...args)
    },
    debug: (...args: unknown[]): void => {
        if (isDev()) console.log('[DEBUG]', ...args)
    }
}
