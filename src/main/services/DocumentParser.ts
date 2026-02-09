import * as fs from 'fs'
import * as path from 'path'
import { createWorker } from 'tesseract.js'

// Polyfill DOMMatrix for pdf-parse in Node environment
if (typeof global.DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class DOMMatrix {
        constructor() { }
    }
}

const pdfParse = require('pdf-parse')

interface ExtractedInfo {
    type?: string
    number?: string
    supplier?: string
    rawText: string
}

export class DocumentParser {
    private suppliers: { name: string, company: string }[] = []

    constructor(suppliers: any[] = []) {
        this.suppliers = suppliers
    }

    public updateSuppliers(suppliers: any[]) {
        this.suppliers = suppliers
    }

    public async parse(filePath: string): Promise<ExtractedInfo> {
        const ext = path.extname(filePath).toLowerCase()
        let text = ''

        try {
            if (ext === '.pdf') {
                text = await this.parsePdf(filePath)
                // If text is very short, it might be an image-only PDF
                if (text.trim().length < 50) {
                    // Requires converting PDF to image first, which is complex without external tools like 'pdftocairo' or 'ghostscript'
                    // For now, we accept we can't OCR image-heavy PDFs easily in node without system dependencies
                    // or complex libs. 
                    // We could try tesseract on pdf if supported, but tesseract.js usually takes images.
                    console.warn('PDF text is empty, likely scanned. Skipping OCR for PDF to avoid complex dependencies.')
                }
            } else if (['.png', '.jpg', '.jpeg', '.bmp', '.webp'].includes(ext)) {
                text = await this.parseImage(filePath)
            }
        } catch (error) {
            console.error('Error parsing document:', error)
        }

        return this.extractInfo(text)
    }

    private async parsePdf(filePath: string): Promise<string> {
        const dataBuffer = fs.readFileSync(filePath)
        const data = await pdfParse(dataBuffer)
        return data.text
    }

    private async parseImage(filePath: string): Promise<string> {
        const worker = await createWorker('eng') // Defaulting to english/latin script. Multi-lang 'por' would be better if downloaded.
        // We really want Portuguese 'por' for accurate accents, but let's try 'eng' first or 'osd' (orientation script detection)
        // tesseract.js downloads lang data on the fly. 
        // Let's use 'por' assuming internet matches.

        await worker.reinitialize('por')
        const ret = await worker.recognize(filePath)
        const text = ret.data.text
        await worker.terminate()
        return text
    }

    private extractInfo(text: string): ExtractedInfo {
        const cleanText = text.replace(/\s+/g, ' ') // Normalize whitespace
        const lowerText = cleanText.toLowerCase()

        // Debug log (in memory or console)
        console.log('Analyzed Text Sample:', lowerText.substring(0, 500))

        let type = '' // Default empty to strict check
        let number = ''
        let supplier = ''

        // 1. Detect Type (Expanded patterns)
        if (/or[çc]amento|cota[çc][ãa]o|proposta|estimativa/i.test(lowerText)) {
            type = 'Orcamento'
        } else if (/nota\s*fiscal|danfe|nf-e|fatura|invoice/i.test(lowerText)) {
            type = 'NF'
        } else if (/pedido|compra|purchase\s*order|p\.?o\.?/i.test(lowerText)) {
            type = 'Pedido'
        } else if (/recibo|comprovante|pagamento/i.test(lowerText)) {
            type = 'Recibo'
        } else if (/boleto|titulo|bancario/i.test(lowerText)) {
            type = 'Boleto'
        }

        // 2. Detect Number (Improved heuristics)
        const numberPatterns = [
            /(?:n[ºo]|n\.|num[eé]ro|number|#)\s*[:.]?\s*(\d+)/i,
            /(?:or[çc]amento|pedido|nf|nf-e|fatura)\s*[:.]?\s*(\d+)/i,
            /([0-9]{3,}\.[0-9]{3,}\.[0-9]{3,})/i, // NF keys or long numbers often have dots
            /\b(\d{4,9})\b/ // Standalone 4-9 digit numbers (careful)
        ]

        for (const pattern of numberPatterns) {
            const match = text.match(pattern)
            if (match && match[1]) {
                // Filter out likely dates (YYYY) or small numbers if unsure
                const num = match[1].replace(/[^0-9]/g, '')
                // Avoid current year as ID if possible, unless explicit
                const currentYear = new Date().getFullYear().toString()
                if (num === currentYear && !/n[ºo]/.test(match[0].toLowerCase())) continue;

                number = num
                break
            }
        }

        // 3. Detect Supplier
        const sortedSuppliers = [...this.suppliers].sort((a, b) => b.name.length - a.name.length)

        for (const s of sortedSuppliers) {
            // Clean supplier name for matching
            const sName = s.name.toLowerCase().trim()
            const sCompany = s.company ? s.company.toLowerCase().trim() : ''

            if ((sName.length > 3 && lowerText.includes(sName)) ||
                (sCompany.length > 3 && lowerText.includes(sCompany))) {
                supplier = s.name
                break
            }
        }

        console.log(`Extracted: Type=${type}, Number=${number}, Supplier=${supplier}`)
        return { type, number, supplier, rawText: text }
    }

    public generateFilename(info: ExtractedInfo, originalExtension: string): string {
        const parts = []
        if (info.type) parts.push(info.type)
        if (info.number) parts.push(info.number)
        if (info.supplier) parts.push(info.supplier)

        if (parts.length === 0) return `Documento_${Date.now()}${originalExtension}`

        // Sanitize filename
        const filename = parts.join('_').replace(/[^a-z0-9_\-\.]/gi, '')
        return `${filename}${originalExtension}`
    }
}
