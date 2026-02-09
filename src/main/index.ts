import { app, shell, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import { join, extname, basename } from 'path'
import * as fs from 'fs'
import { exec } from 'child_process'
import archiver from 'archiver'
import { DatabaseManager } from './db'
import { DocumentParser } from './services/DocumentParser'
import { CryptoEngine } from './security/crypto.engine'
import { AuthLocal } from './security/auth.local'
import { SessionManager } from './security/session.manager'
import { IntegrityChecker } from './security/integrity.checker'
import { SecurityConfig } from './security/security.config'


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

        // If window is focused, we might skip system notification to avoid double noise,
        // but for now let's keep both or check strict requirement.
        // User asked for "more beauty", so in-app is the key.
    }

    // 2. Show Native Notification (for background/minimized)
    if (!Notification.isSupported()) {
        console.log('Notifications not supported on this system')
        return
    }

    const notification = new Notification({
        title: 'Orbit', // Fixed title
        subtitle: 'Lembrete de Tarefa',
        body: `${task.title}\n${task.description || ''}`,
        icon: join(__dirname, '../../resources/icon.ico'),
        silent: false,
        urgency: 'normal'
    })

    notification.on('click', () => {
        // Focus the main window when clicking the notification
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
            // Navigate to tasks page if possible?
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
                    console.log(`[Notification] Task: ${task.title} at ${task.startTime}`)
                }
            }
        }

        // Clean old notification state (older than 24 hours)
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayKey = yesterday.toISOString().split('T')[0]

        for (const key of Object.keys(notificationState)) {
            if (key.includes(yesterdayKey) || !key.includes(todayKey)) {
                // Keep only today's entries
                if (!key.includes(todayKey)) {
                    delete notificationState[key]
                }
            }
        }
    } catch (error) {
        console.error('Error checking task notifications:', error)
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
            sandbox: false
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

// IPC Handlers
function setupIPC() {
    ipcMain.handle('db:get', (_, collection) => db.get(collection))
    ipcMain.handle('db:set', (_, collection, data) => db.set(collection, data))
    ipcMain.handle('db:add', (_, collection, item) => db.add(collection, item))
    ipcMain.handle('db:update', (_, collection, id, updates) => db.update(collection, id, updates))
    ipcMain.handle('db:delete', (_, collection, id) => db.delete(collection, id))

    // File management handlers
    ipcMain.handle('file:openOrderFolder', async (_, orderNumber: string) => {
        try {
            const folderPath = getOrderFolderPath(orderNumber)
            await shell.openPath(folderPath)
            return folderPath
        } catch (error) {
            console.error('Error opening folder:', error)
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
                    console.log(`Analyzing file: ${filePath}`)
                    const info = await docParser.parse(filePath)

                    // Only rename if we found useful info (type + number OR type + supplier)
                    // or if the user wants us to try our best.
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
                    console.error('OCR/Parsing failed, using original name', e)
                }

                const destPath = join(orderFolder, finalName)

                try {
                    fs.copyFileSync(filePath, destPath)
                    attachedFiles.push(finalName)
                } catch (err) {
                    console.error('Erro ao copiar arquivo:', err)
                }
            }

            return { success: true, files: attachedFiles }
        } catch (error) {
            console.error('Error attaching files:', error)
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
                // Parse document to get new name
                let finalName = filePath.split(/[\\/]/).pop() || ''

                try {
                    console.log(`Analyzing file: ${filePath}`)
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
                    console.error('OCR/Parsing failed, using original name', e)
                }

                const destPath = join(folderPath, finalName)

                try {
                    fs.copyFileSync(filePath, destPath)
                    attachedFiles.push({
                        name: finalName,
                        path: destPath
                    })
                } catch (err) {
                    console.error('Erro ao copiar arquivo:', err)
                }
            }

            return { success: true, files: attachedFiles }
        } catch (error) {
            console.error('Error attaching files:', error)
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

    ipcMain.handle('file:openFile', async (_, filePath: string) => {
        try {
            await shell.openPath(filePath)
        } catch (error) {
            console.error('Error opening file:', error)
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
                        console.error(`Error reading attachments for ${orderNumber}:`, e)
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
            console.error('Error exporting orders:', error)
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
            console.error('Error getting auto-start setting:', error)
            return false
        }
    })

    ipcMain.handle('settings:setAutoStart', (_, enabled: boolean) => {
        try {
            // Check if running in production mode
            if (!app.isPackaged) {
                console.log('Auto-start not available in development mode')
                return { success: false, reason: 'development' }
            }

            // Check if it's a portable version (no installation)
            const exePath = app.getPath('exe')
            const isPortable = exePath.toLowerCase().includes('portable') ||
                !exePath.toLowerCase().includes('program') &&
                !exePath.toLowerCase().includes('appdata')

            if (isPortable) {
                console.log('Auto-start may not work properly in portable mode')
            }

            app.setLoginItemSettings({
                openAtLogin: enabled,
                path: exePath,
                args: []
            })

            // Verify if it was actually set
            const settings = app.getLoginItemSettings({ path: exePath })
            const actuallySet = settings.openAtLogin === enabled

            console.log(`Auto-start ${enabled ? 'enabled' : 'disabled'}, verified: ${actuallySet}`)
            return { success: actuallySet, reason: actuallySet ? null : 'registry_failed' }
        } catch (error) {
            console.error('Error setting auto-start:', error)
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
            console.error('Error getting notifications setting:', error)
            return true
        }
    })

    ipcMain.handle('settings:setNotificationsEnabled', (_, enabled: boolean) => {
        try {
            const settings = db.get('settings') || {}
            settings.notificationsEnabled = enabled
            // Save as a special update to settings
            db.update('settings', 'config', { notificationsEnabled: enabled })
            console.log(`Notifications ${enabled ? 'enabled' : 'disabled'}`)
            return true
        } catch (error) {
            console.error('Error setting notifications:', error)
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
            console.error('Error testing notification:', error)
            return { success: false, message: 'Erro ao enviar notificação de teste' }
        }
    })
    // Backup Settings
    ipcMain.handle('settings:getBackupSchedule', () => {
        try {
            const settings = db.get('settings') || {}
            return settings.backupSchedule || '18:00'
        } catch (error) {
            console.error('Error getting backup schedule:', error)
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
            console.error('Error setting backup schedule:', error)
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
            console.error('Error getting version info:', error)
            return {
                appVersion: app.getVersion() || '1.3.0',
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
            console.error('Error getting weekly report schedule:', error)
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
            console.log(`Weekly report schedule updated: ${schedule.day} at ${schedule.time}, enabled: ${schedule.enabled}`)
            return true
        } catch (error) {
            console.error('Error setting weekly report schedule:', error)
            return false
        }
    })

    // Database Location Handlers
    ipcMain.handle('settings:getDbPath', () => {
        try {
            return db.getPath()
        } catch (error) {
            console.error('Error getting database path:', error)
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
            console.error('Error selecting database folder:', error)
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
            console.error('Error resetting database path:', error)
            return { success: false, error: String(error) }
        }
    })

    // Security IPC Handlers
    ipcMain.handle('security:encrypt', (_, plainText: string) => {
        try {
            return CryptoEngine.encrypt(plainText)
        } catch (error) {
            console.error('Encryption error:', error)
            throw error
        }
    })

    ipcMain.handle('security:decrypt', (_, payload: { iv: string; authTag: string; data: string }) => {
        try {
            return CryptoEngine.decrypt(payload)
        } catch (error) {
            console.error('Decryption error:', error)
            throw error
        }
    })

    ipcMain.handle('security:storeCredential', (_, username: string, password: string) => {
        try {
            AuthLocal.storeCredential(username, password)
        } catch (error) {
            console.error('Store credential error:', error)
            throw error
        }
    })

    ipcMain.handle('security:validateCredential', (_, username: string, password: string) => {
        try {
            return AuthLocal.validateCredential(username, password)
        } catch (error) {
            console.error('Validate credential error:', error)
            return false
        }
    })

    ipcMain.handle('security:createSession', (_, userId: string, ttlMs?: number) => {
        try {
            return SessionManager.createSession(userId, ttlMs)
        } catch (error) {
            console.error('Create session error:', error)
            throw error
        }
    })

    ipcMain.handle('security:validateSession', (_, userId: string, token: string) => {
        try {
            return SessionManager.validateSession(userId, token)
        } catch (error) {
            console.error('Validate session error:', error)
            return false
        }
    })

    ipcMain.handle('security:invalidateSession', (_, userId: string) => {
        try {
            SessionManager.invalidateSession(userId)
        } catch (error) {
            console.error('Invalidate session error:', error)
        }
    })

    ipcMain.handle('security:registerFile', (_, filePath: string) => {
        try {
            IntegrityChecker.registerFile(filePath)
        } catch (error) {
            console.error('Register file error:', error)
            throw error
        }
    })

    ipcMain.handle('security:validateFile', (_, filePath: string) => {
        try {
            return IntegrityChecker.validateFile(filePath)
        } catch (error) {
            console.error('Validate file error:', error)
            return false
        }
    })

    ipcMain.handle('security:validateAll', () => {
        try {
            return IntegrityChecker.validateAll()
        } catch (error) {
            console.error('Validate all error:', error)
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

    ipcMain.handle('sap:listScripts', async () => {
        try {
            const scriptsPath = getSapScriptsPath()
            if (!fs.existsSync(scriptsPath)) {
                return []
            }
            const files = fs.readdirSync(scriptsPath)
            return files.filter(f => f.endsWith('.vbs')).map(f => f.replace('.vbs', ''))
        } catch (error) {
            console.error('Error listing SAP scripts:', error)
            return []
        }
    })

    ipcMain.handle('sap:executeScript', async (_, scriptName: string, params: string[]) => {
        const scriptsPath = getSapScriptsPath()
        const scriptPath = join(scriptsPath, `${scriptName}.vbs`)

        if (!fs.existsSync(scriptPath)) {
            return { error: `Script não encontrado: ${scriptName}.vbs` }
        }

        const paramsStr = params.map(p => `"${p}"`).join(' ')
        const command = `cscript //nologo "${scriptPath}" ${paramsStr}`

        return new Promise((resolve) => {
            exec(command, { timeout: 60000 }, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    console.error('SAP script error:', error)
                    resolve({ error: stderr || error.message || 'Erro na execução do script' })
                } else {
                    resolve({ output: stdout || 'Script executado com sucesso' })
                }
            })
        })
    })

    ipcMain.handle('sap:checkConnection', async () => {
        // Create a temporary check script
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

        return new Promise((resolve) => {
            exec(`cscript //nologo "${tempScriptPath}"`, { timeout: 10000 }, (error: any, stdout: string) => {
                // Clean up temp script
                try { fs.unlinkSync(tempScriptPath) } catch { }

                if (error || !stdout.includes('CONNECTED')) {
                    resolve({ connected: false })
                } else {
                    resolve({ connected: true })
                }
            })
        })
    })
}

app.whenReady().then(() => {
    // Initialize documents path after app is ready
    documentsPath = app.getPath('documents')

    // Initialize security modules
    CryptoEngine.initialize(app.getPath('userData'))

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
            console.log(`Backup created: ${backupFile}`)

            // Notify user
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('notification:show', {
                    title: 'Backup Realizado',
                    body: 'Seus dados foram salvos com segurança.'
                })
            }

            return true
        } catch (error) {
            console.error('Backup failed:', error)
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
