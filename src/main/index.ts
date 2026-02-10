import { app, shell, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import { join, extname, basename, resolve as pathResolve } from 'path'
import * as fs from 'fs'
import { execFile } from 'child_process'
import archiver from 'archiver'
import { DatabaseManager } from './db'
import { DocumentParser } from './services/DocumentParser'
import { CryptoEngine } from './security/crypto.engine'
import { AuthLocal } from './security/auth.local'
import { SessionManager } from './security/session.manager'
import { IntegrityChecker } from './security/integrity.checker'
import { isValidCollection } from './security/security.config'
import { logger } from './utils/logger'


let db: DatabaseManager
let docParser: DocumentParser
let documentsPath: string
let notificationInterval: NodeJS.Timeout | null = null
let mainWindow: BrowserWindow | null = null

// Task notification system
interface Task {
    id: string
    title: string
    description?: string
    startTime: string // HH:MM format
    endTime: string
    dayOfWeek: number
    recurrence: 'none' | 'daily' | 'weekly' | 'weekdays' | 'custom'
    customDays?: number[]
    notified?: boolean // Track if we already notified for this time slot today
}

interface NotificationState {
    [taskId: string]: string // taskId -> last notified date+time
}

let notificationState: NotificationState = {}

// Get documents folder path for orders (only call after app is ready)
function getOrdersFolderPath(): string {
    if (!documentsPath) {
        documentsPath = app.getPath('documents')
    }
    const orbitPath = join(documentsPath, 'Orbit')
    const ordersPath = join(orbitPath, 'Pedidos')

    // Ensure directories exist
    if (!fs.existsSync(orbitPath)) {
        fs.mkdirSync(orbitPath, { recursive: true })
    }
    if (!fs.existsSync(ordersPath)) {
        fs.mkdirSync(ordersPath, { recursive: true })
    }

    return ordersPath
}

function getOrderFolderPath(orderNumber: string): string {
    const ordersPath = getOrdersFolderPath()
    const orderPath = join(ordersPath, orderNumber)

    if (!fs.existsSync(orderPath)) {
        fs.mkdirSync(orderPath, { recursive: true })
    }

    return orderPath
}

function getGenericFolderPath(folderId: string): string {
    if (!documentsPath) {
        documentsPath = app.getPath('documents')
    }
    const orbitPath = join(documentsPath, 'Orbit')
    const generalPath = join(orbitPath, 'Geral')

    if (!fs.existsSync(orbitPath)) fs.mkdirSync(orbitPath, { recursive: true })
    if (!fs.existsSync(generalPath)) fs.mkdirSync(generalPath, { recursive: true })

    const folderPath = join(generalPath, folderId)
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true })

    return folderPath
}

// Check if a task should show on a specific day
function shouldTaskShowOnDay(task: Task, dayOfWeek: number): boolean {
    if (task.recurrence === 'none') {
        return task.dayOfWeek === dayOfWeek
    }
    if (task.recurrence === 'daily') {
        return true
    }
    if (task.recurrence === 'weekly') {
        return task.dayOfWeek === dayOfWeek
    }
    if (task.recurrence === 'weekdays') {
        return dayOfWeek >= 1 && dayOfWeek <= 5
    }
    if (task.recurrence === 'custom' && task.customDays) {
        return task.customDays.includes(dayOfWeek)
    }
    return false
}

// Show notification for a task
function showTaskNotification(task: Task): void {
    // 1. Send in-app notification (Beautiful Toast) if window exists
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('notification:show', {
            title: 'Hora da Tarefa!',
            body: `${task.title}${task.description ? ' - ' + task.description : ''}`
        })
    }

    // 2. Show Native Notification (for background/minimized)
    if (!Notification.isSupported()) {
        logger.warn('Notifications not supported on this system')
        return
    }

    const notification = new Notification({
        title: 'Orbit',
        subtitle: 'Lembrete de Tarefa',
        body: `${task.title}\n${task.description || ''}`,
        icon: join(__dirname, '../../resources/icon.ico'),
        silent: false,
        urgency: 'normal'
    })

    notification.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

    notification.show()
}




// Check for tasks that need notification
function checkTaskNotifications(): void {
    if (!db) return

    try {
        const settings = db.get('settings') || {}
        // Check if notifications are enabled (default: true)
        if (settings.notificationsEnabled === false) return

        const tasks: Task[] = db.get('tasks') || []
        const now = new Date()
        const currentDay = now.getDay() // 0-6
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()
        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
        const todayKey = now.toISOString().split('T')[0] // YYYY-MM-DD

        for (const task of tasks) {
            // Check if task should show today
            if (!shouldTaskShowOnDay(task, currentDay)) continue

            // Parse task start time
            const [taskHour, taskMinute] = task.startTime.split(':').map(Number)

            // Check if it's time for this task (within 1 minute window)
            const taskTotalMinutes = taskHour * 60 + taskMinute
            const currentTotalMinutes = currentHour * 60 + currentMinute

            // Notify if current time is within 0-1 minutes of task start time
            if (currentTotalMinutes >= taskTotalMinutes && currentTotalMinutes <= taskTotalMinutes + 1) {
                // Check if we already notified for this task today at this time
                const notificationKey = `${task.id}_${todayKey}_${task.startTime}`

                if (!notificationState[notificationKey]) {
                    // Mark as notified
                    notificationState[notificationKey] = new Date().toISOString()

                    // Show notification
                    showTaskNotification(task)
                    logger.debug(`[Notification] Task: ${task.title} at ${task.startTime}`)
                }
            }
        }

        // Clean old notification state (older than 24 hours)
        for (const key of Object.keys(notificationState)) {
            if (!key.includes(todayKey)) {
                delete notificationState[key]
            }
        }
    } catch (error) {
        logger.error('Error checking task notifications:', error)
    }
}

// Start notification checker
function startNotificationChecker(): void {
    // Check every 30 seconds
    notificationInterval = setInterval(() => {
        checkTaskNotifications()
    }, 30000)

    // Also check immediately on start
    setTimeout(() => {
        checkTaskNotifications()
    }, 5000) // Wait 5 seconds for DB to be fully initialized
}

// Stop notification checker
function stopNotificationChecker(): void {
    if (notificationInterval) {
        clearInterval(notificationInterval)
        notificationInterval = null
    }
}

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        show: false,
        autoHideMenuBar: true,
        icon: join(__dirname, '../../resources/icon.ico'),
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: true
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow?.maximize()
        mainWindow?.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // Load dev server or production file
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        const devUrl = process.env['ELECTRON_RENDERER_URL']
        if (devUrl) {
            mainWindow.loadURL(devUrl)
        } else {
            mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
        }
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// Rate limiting state for login attempts
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number }>()
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// Validate that IPC sender is the main window
function validateSender(event: Electron.IpcMainInvokeEvent): boolean {
    return event.sender === mainWindow?.webContents
}

// IPC Handlers
function setupIPC() {
    ipcMain.handle('db:get', (event, collection: string) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        if (!isValidCollection(collection)) throw new Error(`Invalid collection: ${collection}`)
        return db.get(collection)
    })
    ipcMain.handle('db:set', (event, collection: string, data: unknown) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        if (!isValidCollection(collection)) throw new Error(`Invalid collection: ${collection}`)
        if (data === null || data === undefined) throw new Error('Invalid data')
        return db.set(collection, data)
    })
    ipcMain.handle('db:add', (event, collection: string, item: unknown) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        if (!isValidCollection(collection)) throw new Error(`Invalid collection: ${collection}`)
        if (!item || typeof item !== 'object') throw new Error('Invalid item')
        return db.add(collection, item)
    })
    ipcMain.handle('db:update', (event, collection: string, id: string, updates: unknown) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        if (!isValidCollection(collection)) throw new Error(`Invalid collection: ${collection}`)
        if (!id || typeof id !== 'string') throw new Error('Invalid id')
        return db.update(collection, id, updates)
    })
    ipcMain.handle('db:delete', (event, collection: string, id: string) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        if (!isValidCollection(collection)) throw new Error(`Invalid collection: ${collection}`)
        if (!id || typeof id !== 'string') throw new Error('Invalid id')
        return db.delete(collection, id)
    })

    // File management handlers
    ipcMain.handle('file:openOrderFolder', async (event, orderNumber: string) => {
        if (!validateSender(event)) return null
        try {
            const folderPath = getOrderFolderPath(orderNumber)
            await shell.openPath(folderPath)
            return folderPath
        } catch (error) {
            logger.error('Error opening folder:', error)
            return null
        }
    })

    ipcMain.handle('file:attachFiles', async (_, orderNumber: string) => {
        try {
            const result = await dialog.showOpenDialog({
                title: 'Selecionar arquivos para anexar',
                properties: ['openFile', 'multiSelections'],
                filters: [
                    { name: 'Todos os arquivos', extensions: ['*'] },
                    { name: 'Documentos', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'] },
                    { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
                ]
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, files: [] }
            }

            // Update parser with latest suppliers
            if (db && docParser) {
                docParser.updateSuppliers(db.get('suppliers'))
            }

            const orderFolder = getOrderFolderPath(orderNumber)
            const attachedFiles: string[] = []

            for (const filePath of result.filePaths) {
                // Parse document to get new name
                let finalName = filePath.split(/[\\/]/).pop() || ''

                try {
                    logger.debug(`Analyzing file: ${filePath}`)
                    const info = await docParser.parse(filePath)

                    if (info.type && (info.number || info.supplier)) {
                        const ext = extname(filePath)
                        const newName = docParser.generateFilename(info, ext)

                        // Prevent overwrite if file exists by appending counter
                        let candidateName = newName
                        let counter = 1
                        while (fs.existsSync(join(orderFolder, candidateName))) {
                            const namePart = basename(newName, ext)
                            candidateName = `${namePart}_${counter}${ext}`
                            counter++
                        }
                        finalName = candidateName
                    }
                } catch (e) {
                    logger.error('OCR/Parsing failed, using original name', e)
                }

                const destPath = join(orderFolder, finalName)

                try {
                    fs.copyFileSync(filePath, destPath)
                    attachedFiles.push(finalName)
                } catch (err) {
                    logger.error('Erro ao copiar arquivo:', err)
                }
            }

            return { success: true, files: attachedFiles }
        } catch (error) {
            logger.error('Error attaching files:', error)
            return { success: false, files: [] }
        }
    })

    ipcMain.handle('file:attachGeneralFiles', async (_, folderId: string) => {
        try {
            const result = await dialog.showOpenDialog({
                title: 'Selecionar arquivos para anexar',
                properties: ['openFile', 'multiSelections'],
                filters: [
                    { name: 'Todos os arquivos', extensions: ['*'] },
                    { name: 'Documentos', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'] },
                    { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
                ]
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, files: [] }
            }

            // Update parser with latest suppliers
            if (db && docParser) {
                docParser.updateSuppliers(db.get('suppliers'))
            }

            const folderPath = getGenericFolderPath(folderId)
            const attachedFiles: { name: string, path: string }[] = []

            for (const filePath of result.filePaths) {
                let finalName = filePath.split(/[\\/]/).pop() || ''

                try {
                    logger.debug(`Analyzing file: ${filePath}`)
                    const info = await docParser.parse(filePath)

                    if (info.type && (info.number || info.supplier)) {
                        const ext = extname(filePath)
                        const newName = docParser.generateFilename(info, ext)

                        let candidateName = newName
                        let counter = 1
                        while (fs.existsSync(join(folderPath, candidateName))) {
                            const namePart = basename(newName, ext)
                            candidateName = `${namePart}_${counter}${ext}`
                            counter++
                        }
                        finalName = candidateName
                    }
                } catch (e) {
                    logger.error('OCR/Parsing failed, using original name', e)
                }

                const destPath = join(folderPath, finalName)

                try {
                    fs.copyFileSync(filePath, destPath)
                    attachedFiles.push({
                        name: finalName,
                        path: destPath
                    })
                } catch (err) {
                    logger.error('Erro ao copiar arquivo:', err)
                }
            }

            return { success: true, files: attachedFiles }
        } catch (error) {
            logger.error('Error attaching files:', error)
            return { success: false, files: [] }
        }
    })

    ipcMain.handle('file:getOrderFiles', async (_, orderNumber: string) => {
        try {
            const orderFolder = getOrderFolderPath(orderNumber)
            const files = fs.readdirSync(orderFolder)
            return files.map(file => ({
                name: file,
                path: join(orderFolder, file)
            }))
        } catch {
            return []
        }
    })

    ipcMain.handle('file:openFile', async (event, filePath: string) => {
        if (!validateSender(event)) return
        try {
            // Validate path is within allowed Orbit directories
            const resolvedPath = pathResolve(filePath)
            const allowedRoots = [
                pathResolve(getOrdersFolderPath()),
                pathResolve(join(documentsPath, 'Orbit'))
            ]
            const isAllowed = allowedRoots.some(root => resolvedPath.startsWith(root))
            if (!isAllowed) {
                logger.warn('Access denied: path outside allowed directories:', resolvedPath)
                return
            }
            await shell.openPath(resolvedPath)
        } catch (error) {
            logger.error('Error opening file:', error)
        }
    })

    // Generic export orders (Pending, Delivered, etc) to ZIP
    ipcMain.handle('file:exportOrders', async (_, pdfData: string, orderNumbers: string[], baseFilename: string = 'Pedidos_Exportados') => {
        try {
            const isPdfOnly = orderNumbers.length === 0
            const extension = isPdfOnly ? 'pdf' : 'zip'
            const defaultName = `${baseFilename}_${new Date().toISOString().split('T')[0]}_${new Date().getHours()}-${new Date().getMinutes()}.${extension}`

            const result = await dialog.showSaveDialog({
                title: `Salvar ${baseFilename.replace(/_/g, ' ')} (${extension.toUpperCase()})`,
                defaultPath: join(app.getPath('documents'), defaultName),
                filters: [
                    { name: isPdfOnly ? 'Arquivo PDF' : 'Arquivo ZIP', extensions: [extension] }
                ],
                properties: ['createDirectory']
            })

            if (result.canceled || !result.filePath) {
                return { success: false, path: null }
            }

            const exportPath = result.filePath

            if (isPdfOnly) {
                // Save PDF directly
                fs.writeFileSync(exportPath, Buffer.from(pdfData, 'base64'))
            } else {
                // ZIP Logic
                const output = fs.createWriteStream(exportPath)
                const archive = archiver('zip', {
                    zlib: { level: 9 } // Maximum compression
                })

                // Listen for errors
                archive.on('error', function (err) {
                    throw err
                })

                // Pipe archive data to the file
                archive.pipe(output)

                // Add PDF to the archive
                const pdfBuffer = Buffer.from(pdfData, 'base64')
                archive.append(pdfBuffer, { name: `${baseFilename}.pdf` })

                // Add attachments for each order
                for (const orderNumber of orderNumbers) {
                    const orderFolder = getOrderFolderPath(orderNumber)
                    try {
                        if (fs.existsSync(orderFolder)) {
                            const files = fs.readdirSync(orderFolder)
                            if (files.length > 0) {
                                // Add directory to zip
                                archive.directory(orderFolder, `Anexos/${orderNumber}`)
                            }
                        }
                    } catch (e) {
                        logger.error(`Error reading attachments for ${orderNumber}:`, e)
                    }
                }

                // Finalize the archive (write data to stream)
                await archive.finalize()

                // Wait for stream to finish
                await new Promise<void>((resolve, reject) => {
                    output.on('close', resolve)
                    output.on('error', reject)
                })
            }

            // Show item in folder
            shell.showItemInFolder(exportPath)

            return { success: true, path: exportPath }
        } catch (error) {
            logger.error('Error exporting orders:', error)
            return { success: false, path: null }
        }
    })

    // Settings handlers for auto-start with Windows
    ipcMain.handle('settings:getAutoStart', () => {
        try {
            const loginItemSettings = app.getLoginItemSettings({
                path: app.getPath('exe')
            })
            return loginItemSettings.openAtLogin
        } catch (error) {
            logger.error('Error getting auto-start setting:', error)
            return false
        }
    })

    ipcMain.handle('settings:setAutoStart', (_, enabled: boolean) => {
        try {
            // Check if running in production mode
            if (!app.isPackaged) {
                logger.info('Auto-start not available in development mode')
                return { success: false, reason: 'development' }
            }

            const exePath = app.getPath('exe')
            const isPortable = exePath.toLowerCase().includes('portable') ||
                !exePath.toLowerCase().includes('program') &&
                !exePath.toLowerCase().includes('appdata')

            if (isPortable) {
                logger.info('Auto-start may not work properly in portable mode')
            }

            app.setLoginItemSettings({
                openAtLogin: enabled,
                path: exePath,
                args: []
            })

            const settings = app.getLoginItemSettings({ path: exePath })
            const actuallySet = settings.openAtLogin === enabled

            logger.info(`Auto-start ${enabled ? 'enabled' : 'disabled'}, verified: ${actuallySet}`)
            return { success: actuallySet, reason: actuallySet ? null : 'registry_failed' }
        } catch (error) {
            logger.error('Error setting auto-start:', error)
            return { success: false, reason: 'error' }
        }
    })

    // Notifications settings
    ipcMain.handle('settings:getNotificationsEnabled', () => {
        try {
            const settings = db.get('settings') || {}
            // Default to true if not set
            return settings.notificationsEnabled !== false
        } catch (error) {
            logger.error('Error getting notifications setting:', error)
            return true
        }
    })

    ipcMain.handle('settings:setNotificationsEnabled', (_, enabled: boolean) => {
        try {
            const settings = db.get('settings') || {}
            settings.notificationsEnabled = enabled
            db.update('settings', 'config', { notificationsEnabled: enabled })
            logger.info(`Notifications ${enabled ? 'enabled' : 'disabled'}`)
            return true
        } catch (error) {
            logger.error('Error setting notifications:', error)
            return false
        }
    })

    // Test notification handler
    // Test notification handler
    ipcMain.handle('settings:testNotification', () => {
        try {
            // Send in-app toast
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('notification:show', {
                    title: 'Teste de Notificação',
                    body: 'Suas notificações estão funcionando perfeitamente!'
                })
            }

            if (!Notification.isSupported()) {
                return { success: false, message: 'Notificações de sistema não suportadas' }
            }

            const notification = new Notification({
                title: 'Orbit',
                subtitle: 'Teste do Sistema',
                body: 'Se você está vendo isso, as notificações nativas também estão funcionando!',
                icon: join(__dirname, '../../resources/icon.ico'),
                silent: false
            })

            notification.show()
            return { success: true, message: 'Notificação de teste enviada!' }
        } catch (error) {
            logger.error('Error testing notification:', error)
            return { success: false, message: 'Erro ao enviar notificação de teste' }
        }
    })
    // Backup Settings
    ipcMain.handle('settings:getBackupSchedule', () => {
        try {
            const settings = db.get('settings') || {}
            return settings.backupSchedule || '18:00'
        } catch (error) {
            logger.error('Error getting backup schedule:', error)
            return '18:00'
        }
    })

    ipcMain.handle('settings:setBackupSchedule', (_, time: string) => {
        try {
            const settings = db.get('settings') || {}
            settings.backupSchedule = time
            db.update('settings', 'config', { backupSchedule: time })
            return true
        } catch (error) {
            logger.error('Error setting backup schedule:', error)
            return false
        }
    })

    // Version info handler - returns app and system versions
    ipcMain.handle('settings:getVersionInfo', () => {
        try {
            return {
                appVersion: app.getVersion(),
                electronVersion: process.versions.electron || '-',
                chromeVersion: process.versions.chrome || '-',
                nodeVersion: process.versions.node || '-'
            }
        } catch (error) {
            logger.error('Error getting version info:', error)
            return {
                appVersion: app.getVersion() || '1.5.0',
                electronVersion: '-',
                chromeVersion: '-',
                nodeVersion: '-'
            }
        }
    })

    // Weekly Report Schedule Handlers
    ipcMain.handle('settings:getWeeklyReportSchedule', () => {
        try {
            const settings = db.get('settings') || {}
            return {
                enabled: settings.weeklyReportEnabled || false,
                day: settings.weeklyReportDay || '1',
                time: settings.weeklyReportTime || '08:00'
            }
        } catch (error) {
            logger.error('Error getting weekly report schedule:', error)
            return { enabled: false, day: '1', time: '08:00' }
        }
    })

    ipcMain.handle('settings:setWeeklyReportSchedule', (_, schedule: { enabled: boolean, day: string, time: string }) => {
        try {
            db.update('settings', 'config', {
                weeklyReportEnabled: schedule.enabled,
                weeklyReportDay: schedule.day,
                weeklyReportTime: schedule.time
            })
            logger.info(`Weekly report schedule updated: ${schedule.day} at ${schedule.time}, enabled: ${schedule.enabled}`)
            return true
        } catch (error) {
            logger.error('Error setting weekly report schedule:', error)
            return false
        }
    })

    // Database Location Handlers
    ipcMain.handle('settings:getDbPath', () => {
        try {
            return db.getPath()
        } catch (error) {
            logger.error('Error getting database path:', error)
            return null
        }
    })

    ipcMain.handle('settings:selectDbFolder', async () => {
        try {
            const result = await dialog.showOpenDialog({
                title: 'Selecionar pasta para o banco de dados',
                properties: ['openDirectory', 'createDirectory'],
                buttonLabel: 'Selecionar'
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, path: null }
            }

            const selectedFolder = result.filePaths[0]
            const newDbPath = join(selectedFolder, 'db.json')

            // Change database path
            const changed = db.changePath(newDbPath)

            if (changed) {
                return { success: true, path: newDbPath }
            } else {
                return { success: false, path: null, error: 'Falha ao mover o banco de dados' }
            }
        } catch (error) {
            logger.error('Error selecting database folder:', error)
            return { success: false, path: null, error: String(error) }
        }
    })

    ipcMain.handle('settings:resetDbToDefault', async () => {
        try {
            const reset = db.resetToDefault()
            if (reset) {
                return { success: true, path: db.getPath() }
            } else {
                return { success: false, error: 'Falha ao resetar o banco de dados' }
            }
        } catch (error) {
            logger.error('Error resetting database path:', error)
            return { success: false, error: String(error) }
        }
    })

    // Security IPC Handlers
    ipcMain.handle('security:encrypt', (event, plainText: string) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        try {
            return CryptoEngine.encrypt(plainText)
        } catch (error) {
            logger.error('Encryption error:', error)
            throw error
        }
    })

    ipcMain.handle('security:decrypt', (event, payload: { iv: string; authTag: string; data: string }) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        try {
            return CryptoEngine.decrypt(payload)
        } catch (error) {
            logger.error('Decryption error:', error)
            throw error
        }
    })

    ipcMain.handle('security:storeCredential', (event, username: string, password: string) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        try {
            AuthLocal.storeCredential(username, password)
        } catch (error) {
            logger.error('Store credential error:', error)
            throw error
        }
    })

    ipcMain.handle('security:validateCredential', (event, username: string, password: string) => {
        if (!validateSender(event)) return false
        try {
            // Rate limiting: check if account is locked
            const now = Date.now()
            const attempts = loginAttempts.get(username)

            if (attempts && now < attempts.lockedUntil) {
                logger.warn(`Login attempt blocked (account locked): ${username}`)
                return false
            }

            const valid = AuthLocal.validateCredential(username, password)

            if (!valid) {
                const current = loginAttempts.get(username) || { count: 0, lastAttempt: 0, lockedUntil: 0 }
                current.count++
                current.lastAttempt = now

                if (current.count >= MAX_LOGIN_ATTEMPTS) {
                    current.lockedUntil = now + LOCKOUT_DURATION_MS
                    current.count = 0
                    logger.warn(`Account locked due to excessive failed attempts: ${username}`)
                }

                loginAttempts.set(username, current)
                return false
            }

            // Successful login: clear attempts
            loginAttempts.delete(username)
            return true
        } catch (error) {
            logger.error('Validate credential error:', error)
            return false
        }
    })

    ipcMain.handle('security:createSession', (event, userId: string, ttlMs?: number) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        try {
            return SessionManager.createSession(userId, ttlMs)
        } catch (error) {
            logger.error('Create session error:', error)
            throw error
        }
    })

    ipcMain.handle('security:validateSession', (event, userId: string, token: string) => {
        if (!validateSender(event)) return false
        try {
            return SessionManager.validateSession(userId, token)
        } catch (error) {
            logger.error('Validate session error:', error)
            return false
        }
    })

    ipcMain.handle('security:invalidateSession', (event, userId: string) => {
        if (!validateSender(event)) return
        try {
            SessionManager.invalidateSession(userId)
        } catch (error) {
            logger.error('Invalidate session error:', error)
        }
    })

    ipcMain.handle('security:registerFile', (event, filePath: string) => {
        if (!validateSender(event)) throw new Error('Unauthorized')
        try {
            IntegrityChecker.registerFile(filePath)
        } catch (error) {
            logger.error('Register file error:', error)
            throw error
        }
    })

    ipcMain.handle('security:validateFile', (event, filePath: string) => {
        if (!validateSender(event)) return false
        try {
            return IntegrityChecker.validateFile(filePath)
        } catch (error) {
            logger.error('Validate file error:', error)
            return false
        }
    })

    ipcMain.handle('security:validateAll', (event) => {
        if (!validateSender(event)) return []
        try {
            return IntegrityChecker.validateAll()
        } catch (error) {
            logger.error('Validate all error:', error)
            return []
        }
    })

    // SAP Automation Handlers
    function getSapScriptsPath(): string {
        if (!documentsPath) {
            documentsPath = app.getPath('documents')
        }
        const sapPath = join(documentsPath, 'Orbit', 'SapScripts')
        if (!fs.existsSync(sapPath)) {
            fs.mkdirSync(sapPath, { recursive: true })
        }
        return sapPath
    }

    ipcMain.handle('sap:listScripts', async (event) => {
        if (!validateSender(event)) return []
        try {
            const scriptsPath = getSapScriptsPath()
            if (!fs.existsSync(scriptsPath)) {
                return []
            }
            const files = fs.readdirSync(scriptsPath)
            return files.filter(f => f.endsWith('.vbs')).map(f => f.replace('.vbs', ''))
        } catch (error) {
            logger.error('Error listing SAP scripts:', error)
            return []
        }
    })

    ipcMain.handle('sap:executeScript', async (event, scriptName: string, params: string[]) => {
        if (!validateSender(event)) return { error: 'Unauthorized' }

        // Validate script name: only alphanumeric, underscore, hyphen
        if (!/^[a-zA-Z0-9_-]+$/.test(scriptName)) {
            return { error: 'Nome de script inválido' }
        }

        const scriptsPath = getSapScriptsPath()
        const scriptPath = join(scriptsPath, `${scriptName}.vbs`)

        // Validate resolved path is within allowed directory (prevent path traversal)
        const resolvedScriptPath = pathResolve(scriptPath)
        if (!resolvedScriptPath.startsWith(pathResolve(scriptsPath))) {
            return { error: 'Caminho de script inválido' }
        }

        if (!fs.existsSync(resolvedScriptPath)) {
            return { error: `Script não encontrado: ${scriptName}.vbs` }
        }

        // Sanitize params: remove any shell metacharacters
        const safeParams = params.map(p => p.replace(/["'`$\\;&|<>(){}\[\]!^~]/g, ''))

        // Use execFile instead of exec to prevent command injection
        return new Promise((resolve) => {
            execFile('cscript', ['//nologo', resolvedScriptPath, ...safeParams],
                { timeout: 60000 },
                (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        logger.error('SAP script error:', error)
                        resolve({ error: stderr || error.message || 'Erro na execução do script' })
                    } else {
                        resolve({ output: stdout || 'Script executado com sucesso' })
                    }
                }
            )
        })
    })

    ipcMain.handle('sap:checkConnection', async (event) => {
        if (!validateSender(event)) return { connected: false }

        const checkScript = `
On Error Resume Next
Set SapGuiAuto = GetObject("SAPGUI")
If Err.Number <> 0 Then
    WScript.Echo "DISCONNECTED"
    WScript.Quit 1
End If
Set application = SapGuiAuto.GetScriptingEngine
If application Is Nothing Then
    WScript.Echo "DISCONNECTED"
    WScript.Quit 1
End If
If application.Children.Count = 0 Then
    WScript.Echo "DISCONNECTED"
    WScript.Quit 1
End If
Set connection = application.Children(0)
If connection.Children.Count = 0 Then
    WScript.Echo "DISCONNECTED"
    WScript.Quit 1
End If
WScript.Echo "CONNECTED"
`
        const scriptsPath = getSapScriptsPath()
        const tempScriptPath = join(scriptsPath, '_check_connection.vbs')
        fs.writeFileSync(tempScriptPath, checkScript)

        // Use execFile instead of exec to prevent shell injection
        return new Promise((resolve) => {
            execFile('cscript', ['//nologo', tempScriptPath],
                { timeout: 10000 },
                (error: any, stdout: string) => {
                    try { fs.unlinkSync(tempScriptPath) } catch { }

                    if (error || !stdout.includes('CONNECTED')) {
                        resolve({ connected: false })
                    } else {
                        resolve({ connected: true })
                    }
                }
            )
        })
    })
}

app.whenReady().then(() => {
    // Initialize documents path after app is ready
    documentsPath = app.getPath('documents')

    const userDataPath = app.getPath('userData')

    // Initialize all security modules with secure paths
    CryptoEngine.initialize(userDataPath)
    AuthLocal.initialize(userDataPath)
    SessionManager.initialize(userDataPath)

    // Initialize database AFTER app is ready
    db = new DatabaseManager()
    docParser = new DocumentParser(db.get('suppliers'))

    app.setAppUserModelId('com.orbit.app')

    // Backup System
    function getBackupPath(): string {
        const orbitDocsPath = join(documentsPath, 'Orbit')
        const backupsPath = join(orbitDocsPath, 'Backups')
        if (!fs.existsSync(backupsPath)) {
            fs.mkdirSync(backupsPath, { recursive: true })
        }
        return backupsPath
    }

    async function performBackup(): Promise<boolean> {
        try {
            const userDataPath = app.getPath('userData')
            const dbPath = join(userDataPath, 'db.json')

            if (!fs.existsSync(dbPath)) return false

            const backupsDir = getBackupPath()
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const backupFile = join(backupsDir, `backup_${timestamp}.json`)

            fs.copyFileSync(dbPath, backupFile)
            logger.info(`Backup created: ${backupFile}`)

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('notification:show', {
                    title: 'Backup Realizado',
                    body: 'Seus dados foram salvos com segurança.'
                })
            }

            return true
        } catch (error) {
            logger.error('Backup failed:', error)
            return false
        }
    }

    // Check backup schedule
    let lastBackupDate: string | null = null

    function checkBackupSchedule(): void {
        const now = new Date()
        const settings = db.get('settings') || {}
        const scheduleTime = settings.backupSchedule || '18:00'

        const [schedHour, schedMinute] = scheduleTime.split(':').map(Number)
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()

        // Check if it's the scheduled time (within the minute)
        if (currentHour === schedHour && currentMinute === schedMinute) {
            const todayDate = now.toDateString()

            // Prevent multiple backups in the same minute/day cycle if already done
            if (lastBackupDate !== todayDate) {
                performBackup()
                lastBackupDate = todayDate
            }
        }
    }

    setupIPC()
    createWindow()

    // Start notification and backup checker
    startNotificationChecker()

    // Check backup every minute
    setInterval(() => {
        checkBackupSchedule()
    }, 60000)

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    // Stop notification checker when closing
    stopNotificationChecker()

    if (process.platform !== 'darwin') {
        app.quit()
    }
})
