import { app } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import { logger } from './utils/logger'

export interface DatabaseSchema {
    orders: any[]
    tasks: any[]
    documents: any[]
    suppliers: any[]
    orderTemplates: any[]
    orderHistory: any[]
    settings: any
}

// Arquivo de configuração para armazenar o caminho customizado do DB
const CONFIG_FILE = 'orbit-config.json'

function getConfigPath(): string {
    return join(app.getPath('userData'), CONFIG_FILE)
}

export function getCustomDbPath(): string | null {
    try {
        const configPath = getConfigPath()
        if (existsSync(configPath)) {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'))
            return config.customDbPath || null
        }
    } catch (error) {
        logger.error('Failed to read config:', error)
    }
    return null
}

export function setCustomDbPath(newPath: string | null): boolean {
    try {
        const configPath = getConfigPath()
        const config = existsSync(configPath)
            ? JSON.parse(readFileSync(configPath, 'utf-8'))
            : {}

        config.customDbPath = newPath
        writeFileSync(configPath, JSON.stringify(config, null, 2))
        return true
    } catch (error) {
        logger.error('Failed to save config:', error)
        return false
    }
}

export function getCurrentDbPath(): string {
    const customPath = getCustomDbPath()
    if (customPath && existsSync(dirname(customPath))) {
        return customPath
    }
    return join(app.getPath('userData'), 'db.json')
}

export class DatabaseManager {
    private path: string
    private data: DatabaseSchema

    constructor(customPath?: string) {
        // Allow custom path to be passed, otherwise use the stored config
        if (customPath) {
            this.path = customPath
        } else {
            this.path = getCurrentDbPath()
        }

        logger.debug('Database path:', this.path)

        // Initialize default data structure
        this.data = {
            orders: [],
            tasks: [],
            documents: [],
            suppliers: [],
            orderTemplates: [],
            orderHistory: [],
            settings: {}
        }

        this.init()
    }

    public getPath(): string {
        return this.path
    }

    public changePath(newPath: string): boolean {
        try {
            // Ensure directory exists
            const dir = dirname(newPath)
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true })
            }

            // Copy current data to new location
            writeFileSync(newPath, JSON.stringify(this.data, null, 2))

            // Save config
            setCustomDbPath(newPath)

            // Update internal path
            this.path = newPath

            return true
        } catch (error) {
            logger.error('Failed to change database path:', error)
            return false
        }
    }

    public resetToDefault(): boolean {
        try {
            const defaultPath = join(app.getPath('userData'), 'db.json')

            // Copy current data to default location
            writeFileSync(defaultPath, JSON.stringify(this.data, null, 2))

            // Clear config
            setCustomDbPath(null)

            // Update internal path
            this.path = defaultPath

            return true
        } catch (error) {
            logger.error('Failed to reset database path:', error)
            return false
        }
    }

    private init() {
        try {
            // Ensure directory exists
            const dir = dirname(this.path)
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true })
            }

            if (!existsSync(this.path)) {
                // Create file if it doesn't exist
                this.save()
            } else {
                // Read existing file
                const fileContent = readFileSync(this.path, 'utf-8')
                const loadedData = JSON.parse(fileContent)

                // Merge loaded data with default structure to ensure all keys exist
                this.data = { ...this.data, ...loadedData }

                // Ensure array collections are actually arrays (fixing potential undefined issues)
                if (!Array.isArray(this.data.orders)) this.data.orders = []
                if (!Array.isArray(this.data.tasks)) this.data.tasks = []
                if (!Array.isArray(this.data.documents)) this.data.documents = []
                if (!Array.isArray(this.data.suppliers)) this.data.suppliers = []
                if (!Array.isArray(this.data.orderTemplates)) this.data.orderTemplates = []
                if (!Array.isArray(this.data.orderHistory)) this.data.orderHistory = []
                if (typeof this.data.settings !== 'object' || Array.isArray(this.data.settings)) this.data.settings = {}

                // Save back to ensure schema is updated on disk
                this.save()
            }
        } catch (error) {
            logger.error('Failed to initialize database:', error)
        }
    }

    private save() {
        try {
            writeFileSync(this.path, JSON.stringify(this.data, null, 2))
        } catch (error) {
            logger.error('Failed to save database:', error)
        }
    }

    // Generic Getters
    public get(collection: keyof DatabaseSchema) {
        return this.data[collection]
    }

    // Generic Set (replace entire collection)
    public set(collection: keyof DatabaseSchema, data: any) {
        this.data[collection] = data
        this.save()
        return data
    }

    // Generic Setter (Add)
    public add(collection: keyof DatabaseSchema, item: any) {
        if (!Array.isArray(this.data[collection])) {
            throw new Error(`Cannot add to non-array collection: ${collection}`)
        }
        if (!item.id) {
            item.id = randomUUID()
        }
        item.createdAt = new Date().toISOString()
        this.data[collection].push(item)
        this.save()
        return item
    }

    // Generic Update
    public update(collection: keyof DatabaseSchema, id: string, updates: any) {
        if (Array.isArray(this.data[collection])) {
            const index = this.data[collection].findIndex((item: any) => item.id === id)
            if (index !== -1) {
                this.data[collection][index] = { ...this.data[collection][index], ...updates, updatedAt: new Date().toISOString() }
                this.save()
                return this.data[collection][index]
            }
            return null
        } else {
            // Handle Object collections (like settings)
            this.data[collection] = { ...this.data[collection], ...updates }
            this.save()
            return this.data[collection]
        }
    }

    // Generic Delete
    public delete(collection: keyof DatabaseSchema, id: string) {
        if (Array.isArray(this.data[collection])) {
            this.data[collection] = this.data[collection].filter((item: any) => item.id !== id)
            this.save()
            return true
        }
        return false
    }
}
