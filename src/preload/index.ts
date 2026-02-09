import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
    db: {
        get: (collection: string) => ipcRenderer.invoke('db:get', collection),
        set: (collection: string, data: any) => ipcRenderer.invoke('db:set', collection, data),
        add: (collection: string, item: any) => ipcRenderer.invoke('db:add', collection, item),
        update: (collection: string, id: string, updates: any) => ipcRenderer.invoke('db:update', collection, id, updates),
        delete: (collection: string, id: string) => ipcRenderer.invoke('db:delete', collection, id)
    },
    file: {
        openOrderFolder: (orderNumber: string) => ipcRenderer.invoke('file:openOrderFolder', orderNumber),
        attachFiles: (orderNumber: string) => ipcRenderer.invoke('file:attachFiles', orderNumber),
        attachGeneralFiles: (folderId: string) => ipcRenderer.invoke('file:attachGeneralFiles', folderId),
        getOrderFiles: (orderNumber: string) => ipcRenderer.invoke('file:getOrderFiles', orderNumber),
        openFile: (filePath: string) => ipcRenderer.invoke('file:openFile', filePath),
        exportOrders: (pdfData: string, orderNumbers: string[], baseFilename: string) => ipcRenderer.invoke('file:exportOrders', pdfData, orderNumbers, baseFilename)
    },
    settings: {
        getAutoStart: () => ipcRenderer.invoke('settings:getAutoStart'),
        setAutoStart: (enabled: boolean) => ipcRenderer.invoke('settings:setAutoStart', enabled),
        getNotificationsEnabled: () => ipcRenderer.invoke('settings:getNotificationsEnabled'),
        setNotificationsEnabled: (enabled: boolean) => ipcRenderer.invoke('settings:setNotificationsEnabled', enabled),
        testNotification: () => ipcRenderer.invoke('settings:testNotification'),
        onNotification: (callback: (data: { title: string; body: string }) => void) => {
            ipcRenderer.on('notification:show', (_, data) => callback(data))
            return () => {
                ipcRenderer.removeAllListeners('notification:show')
            }
        },
        getBackupSchedule: () => ipcRenderer.invoke('settings:getBackupSchedule'),
        setBackupSchedule: (time: string) => ipcRenderer.invoke('settings:setBackupSchedule', time),
        getVersionInfo: () => ipcRenderer.invoke('settings:getVersionInfo'),
        getWeeklyReportSchedule: () => ipcRenderer.invoke('settings:getWeeklyReportSchedule'),
        setWeeklyReportSchedule: (schedule: { enabled: boolean; day: string; time: string }) => ipcRenderer.invoke('settings:setWeeklyReportSchedule', schedule),
        // Database location management
        getDbPath: () => ipcRenderer.invoke('settings:getDbPath'),
        selectDbFolder: () => ipcRenderer.invoke('settings:selectDbFolder'),
        resetDbToDefault: () => ipcRenderer.invoke('settings:resetDbToDefault')
    },
    security: {
        encrypt: (plainText: string) => ipcRenderer.invoke('security:encrypt', plainText),
        decrypt: (payload: { iv: string; authTag: string; data: string }) => ipcRenderer.invoke('security:decrypt', payload),
        storeCredential: (username: string, password: string) => ipcRenderer.invoke('security:storeCredential', username, password),
        validateCredential: (username: string, password: string) => ipcRenderer.invoke('security:validateCredential', username, password),
        createSession: (userId: string, ttlMs?: number) => ipcRenderer.invoke('security:createSession', userId, ttlMs),
        validateSession: (userId: string, token: string) => ipcRenderer.invoke('security:validateSession', userId, token),
        invalidateSession: (userId: string) => ipcRenderer.invoke('security:invalidateSession', userId),
        registerFile: (filePath: string) => ipcRenderer.invoke('security:registerFile', filePath),
        validateFile: (filePath: string) => ipcRenderer.invoke('security:validateFile', filePath),
        validateAll: () => ipcRenderer.invoke('security:validateAll')
    },
    sap: {
        listScripts: () => ipcRenderer.invoke('sap:listScripts'),
        executeScript: (name: string, params: string[]) => ipcRenderer.invoke('sap:executeScript', name, params),
        checkConnection: () => ipcRenderer.invoke('sap:checkConnection')
    }
}

// Expose API to renderer
contextBridge.exposeInMainWorld('api', api)

