import ExcelJS from 'exceljs'

interface Order {
    id: string
    orderNumber: string
    quoteNumber?: string
    vendor: string
    requesters?: { name: string; items: string }[]
    requester?: string
    amount: number
    deliveryDate?: string
    status: string
    createdAt: string
    favorite?: boolean
}

interface ExportOptions {
    title: string
    filename: string
    includeFilters?: boolean
    colorScheme?: 'purple' | 'green' | 'blue' | 'red'
}

const colorSchemes = {
    purple: { header: 'FF8B5CF6', light: 'FFF3F0FF', dark: 'FFE9E3FF' },
    green: { header: 'FF10B981', light: 'FFF0FDF4', dark: 'FFDCFCE7' },
    blue: { header: 'FF3B82F6', light: 'FFEFF6FF', dark: 'FFDBEAFE' },
    red: { header: 'FFEF4444', light: 'FFFEF2F2', dark: 'FFFEE2E2' }
}

export async function exportOrdersToExcel(orders: Order[], options: ExportOptions): Promise<void> {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Orbit'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet(options.title, {
        views: [{ state: 'frozen', ySplit: 3 }] // Congela cabeçalho
    })

    const colors = colorSchemes[options.colorScheme || 'purple']

    // Título
    sheet.mergeCells('A1:H1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = options.title
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(1).height = 30

    // Subtítulo com data
    sheet.mergeCells('A2:H2')
    const subtitleCell = sheet.getCell('A2')
    subtitleCell.value = `Exportado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} | Total: ${orders.length} pedidos`
    subtitleCell.font = { size: 10, color: { argb: 'FF6B7280' } }
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(2).height = 20

    // Cabeçalhos
    const headers = ['Nº Pedido', 'Nº Orçamento', 'Fornecedor', 'Solicitante(s)', 'Itens', 'Valor (R$)', 'Status', 'Data Criação']
    const headerRow = sheet.getRow(3)
    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1)
        cell.value = header
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colors.header }
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        }
    })
    headerRow.height = 25

    // Dados
    orders.forEach((order, rowIndex) => {
        const row = sheet.getRow(rowIndex + 4) // Começa na linha 4

        // Formatar solicitantes
        let requestersText = '-'
        let itemsText = '-'
        if (order.requesters && order.requesters.length > 0) {
            requestersText = order.requesters.map(r => r.name).join('\n')
            itemsText = order.requesters.map(r => r.items || 'Diversos').join('\n')
        } else if (order.requester) {
            requestersText = order.requester
            itemsText = 'Diversos'
        }

        const rowData = [
            order.orderNumber,
            order.quoteNumber || '-',
            order.vendor || '-',
            requestersText,
            itemsText,
            order.amount || 0,
            order.status || 'Pendente',
            order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : '-'
        ]

        rowData.forEach((value, colIndex) => {
            const cell = row.getCell(colIndex + 1)
            cell.value = value

            // Formatação de moeda para coluna de valor
            if (colIndex === 5 && typeof value === 'number') {
                cell.numFmt = 'R$ #,##0.00'
            }

            // Zebra striping
            const isEvenRow = rowIndex % 2 === 0
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEvenRow ? colors.light : 'FFFFFFFF' }
            }

            // Bordas
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            }

            // Alinhamento
            cell.alignment = {
                vertical: 'middle',
                horizontal: colIndex === 5 ? 'right' : (colIndex === 0 ? 'center' : 'left'),
                wrapText: colIndex === 3 || colIndex === 4 // Wrap para solicitantes e itens
            }

            // Font do número do pedido
            if (colIndex === 0) {
                cell.font = { bold: true, color: { argb: 'FF1F2937' } }
            }

            // Cor do status
            if (colIndex === 6) {
                const statusColors: Record<string, string> = {
                    'Pendente': 'FFFBBF24',
                    'Liberado': 'FF3B82F6',
                    'Em Trânsito': 'FF8B5CF6',
                    'Entrega Parcial': 'FFF97316',
                    'Entregue': 'FF10B981',
                    'Cancelado': 'FFEF4444'
                }
                cell.font = { bold: true, color: { argb: statusColors[value as string] || 'FF6B7280' } }
            }
        })

        row.height = requestersText.includes('\n') ? 35 : 22
    })

    // Largura das colunas
    sheet.columns = [
        { width: 15 },  // Nº Pedido
        { width: 14 },  // Nº Orçamento
        { width: 30 },  // Fornecedor
        { width: 25 },  // Solicitante(s)
        { width: 30 },  // Itens
        { width: 15 },  // Valor
        { width: 14 },  // Status
        { width: 14 }   // Data
    ]

    // Linha de resumo
    const summaryRow = sheet.getRow(orders.length + 5)
    sheet.mergeCells(`A${orders.length + 5}:E${orders.length + 5}`)
    const summaryLabelCell = summaryRow.getCell(1)
    summaryLabelCell.value = 'TOTAL'
    summaryLabelCell.font = { bold: true, size: 11 }
    summaryLabelCell.alignment = { horizontal: 'right', vertical: 'middle' }

    const totalValue = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
    const summaryValueCell = summaryRow.getCell(6)
    summaryValueCell.value = totalValue
    summaryValueCell.numFmt = 'R$ #,##0.00'
    summaryValueCell.font = { bold: true, size: 11 }
    summaryValueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colors.dark }
    }
    summaryValueCell.border = {
        top: { style: 'medium', color: { argb: colors.header } },
        bottom: { style: 'medium', color: { argb: colors.header } }
    }

    // Adicionar filtros automáticos
    if (options.includeFilters !== false) {
        sheet.autoFilter = {
            from: { row: 3, column: 1 },
            to: { row: orders.length + 3, column: 8 }
        }
    }

    // Gerar e baixar
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${options.filename}_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

// Exportar fornecedores para Excel
interface Supplier {
    id: string
    name: string
    company: string
    sapCode?: string
    category?: string
}

export async function exportSuppliersToExcel(suppliers: Supplier[], filename: string = 'fornecedores'): Promise<void> {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Orbit'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Fornecedores', {
        views: [{ state: 'frozen', ySplit: 2 }]
    })

    // Título
    sheet.mergeCells('A1:D1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = 'Lista de Fornecedores'
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(1).height = 30

    // Cabeçalhos
    const headers = ['Código SAP', 'Nome do Contato', 'Empresa', 'Categoria']
    const headerRow = sheet.getRow(2)
    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1)
        cell.value = header
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF8B5CF6' }
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
        }
    })
    headerRow.height = 25

    // Dados
    suppliers.forEach((supplier, rowIndex) => {
        const row = sheet.getRow(rowIndex + 3)
        const rowData = [
            supplier.sapCode || '-',
            supplier.name,
            supplier.company,
            supplier.category || '-'
        ]

        rowData.forEach((value, colIndex) => {
            const cell = row.getCell(colIndex + 1)
            cell.value = value

            const isEvenRow = rowIndex % 2 === 0
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEvenRow ? 'FFF3F0FF' : 'FFFFFFFF' }
            }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            }
            cell.alignment = { vertical: 'middle', horizontal: colIndex === 0 ? 'center' : 'left' }

            if (colIndex === 0 && value !== '-') {
                cell.font = { bold: true, color: { argb: 'FFD97706' } }
            }
        })
        row.height = 22
    })

    // Largura das colunas
    sheet.columns = [
        { width: 15 },
        { width: 25 },
        { width: 35 },
        { width: 20 }
    ]

    // Filtros
    sheet.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: suppliers.length + 2, column: 4 }
    }

    // Download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
