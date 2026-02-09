import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
    interface Window {
        electron: ElectronAPI
        api: {
            db: {
                get: (collection: string) => Promise<any>
                set: (collection: string, data: any) => Promise<any>
                add: (collection: string, item: any) => Promise<any>
                update: (collection: string, id: string, updates: any) => Promise<any>
                delete: (collection: string, id: string) => Promise<any>
            }
            file: {
                openOrderFolder: (orderNumber: string) => Promise<string>
                attachFiles: (orderNumber: string) => Promise<{ success: boolean; files: string[] }>
                attachGeneralFiles: (folderId: string) => Promise<{ success: boolean; files: { name: string; path: string }[] }>
                getOrderFiles: (orderNumber: string) => Promise<{ name: string; path: string }[]>
                openFile: (filePath: string) => Promise<void>
                exportOrders: (pdfData: string, orderNumbers: string[], baseFilename: string) => Promise<{ success: boolean; path: string | null }>
            }
            settings: {
                getAutoStart: () => Promise<boolean>
                setAutoStart: (enabled: boolean) => Promise<{ success: boolean; reason?: string | null }>
                getNotificationsEnabled: () => Promise<boolean>
                setNotificationsEnabled: (enabled: boolean) => Promise<boolean>
                testNotification: () => Promise<{ success: boolean; message: string }>
                onNotification: (callback: (data: { title: string; body: string }) => void) => () => void
                getBackupSchedule: () => Promise<string>
                setBackupSchedule: (time: string) => Promise<boolean>
                getVersionInfo: () => Promise<{
                    appVersion: string
                    electronVersion: string
                    chromeVersion: string
                    nodeVersion: string
                }>
                getWeeklyReportSchedule: () => Promise<{
                    enabled: boolean
                    day: string
                    time: string
                }>
                setWeeklyReportSchedule: (schedule: { enabled: boolean; day: string; time: string }) => Promise<boolean>
                // Database location management
                getDbPath: () => Promise<string | null>
                selectDbFolder: () => Promise<{ success: boolean; path?: string | null; error?: string }>
                resetDbToDefault: () => Promise<{ success: boolean; path?: string; error?: string }>
            }
            security: {
                encrypt: (plainText: string) => Promise<{ iv: string; authTag: string; data: string }>
                decrypt: (payload: { iv: string; authTag: string; data: string }) => Promise<string>
                storeCredential: (username: string, password: string) => Promise<void>
                validateCredential: (username: string, password: string) => Promise<boolean>
                createSession: (userId: string, ttlMs?: number) => Promise<string>
                validateSession: (userId: string, token: string) => Promise<boolean>
                invalidateSession: (userId: string) => Promise<void>
                registerFile: (filePath: string) => Promise<void>
                validateFile: (filePath: string) => Promise<boolean>
                validateAll: () => Promise<string[]>
            }
            sap: {
                listScripts: () => Promise<string[]>
                executeScript: (name: string, params: string[]) => Promise<{ output?: string; error?: string }>
                checkConnection: () => Promise<{ connected: boolean }>
            }
        }
    }
}

