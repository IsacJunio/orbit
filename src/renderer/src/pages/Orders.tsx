
import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Filter, Trash2, Package, Paperclip, FolderOpen, Edit2, ChevronDown, X, FileIcon, Check, XCircle, Download, Star, Copy, Bookmark, FileText, Upload, History, FileSpreadsheet, Calendar } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { exportOrdersToExcel } from '../utils/excelExport'

interface Order {
    id: string
    orderNumber: string
    quoteNumber?: string
    vendor: string
    requesters?: { name: string; items: string }[]
    // Legacy field support
    requester?: string
    amount: number
    deliveryDate?: string
    status: string
    createdAt: string
    attachedFiles?: string[]
    favorite?: boolean
}

interface AttachedFile {
    name: string
    path: string
}

interface OrderTemplate {
    id: string
    name: string
    vendor: string
    requesters: { name: string; items: string }[]
    amount: number
    createdAt: string
}

interface OrderHistoryEntry {
    id: string
    orderId: string
    orderNumber: string
    action: 'created' | 'updated' | 'status_changed' | 'deleted' | 'duplicated'
    changes?: { field: string; oldValue: string; newValue: string }[]
    timestamp: string
    description: string
}

export default function Orders() {
    const [orders, setOrders] = useState<Order[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingOrder, setEditingOrder] = useState<Order | null>(null)
    const [statusDropdown, setStatusDropdown] = useState<string | null>(null)
    const [filesModal, setFilesModal] = useState<{ orderNumber: string; files: AttachedFile[] } | null>(null)
    const [confirmModal, setConfirmModal] = useState<{ orderId: string; status: string; message: string } | null>(null)
    const [exportModal, setExportModal] = useState<{ type: 'pending' | 'delivered' } | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [newOrder, setNewOrder] = useState({
        orderNumber: '',
        quoteNumber: '',
        vendor: '',
        requesters: [] as { name: string; items: string }[],
        amount: '',
        status: 'Pendente'
    })
    const [tempRequester, setTempRequester] = useState({ name: '', items: '' })
    const [suppliers, setSuppliers] = useState<{ id: string, name: string, company: string }[]>([])
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
    const [showRequesterDropdown, setShowRequesterDropdown] = useState(false)
    const [copiedOrderNumber, setCopiedOrderNumber] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('Todos')
    const [dateFilter, setDateFilter] = useState<string>('Todos') // 'Todos', '7dias', '30dias', 'mes'
    const [showFilterMenu, setShowFilterMenu] = useState(false)
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
    const filterRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // Templates
    const [templates, setTemplates] = useState<OrderTemplate[]>([])
    const [showTemplatesModal, setShowTemplatesModal] = useState(false)
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<Order | null>(null)
    const [templateName, setTemplateName] = useState('')
    const [showNewOrderMenu, setShowNewOrderMenu] = useState(false)
    const newOrderMenuRef = useRef<HTMLDivElement>(null)

    // Import CSV
    const [showImportModal, setShowImportModal] = useState(false)
    const [importPreview, setImportPreview] = useState<Partial<Order>[]>([])
    const [importErrors, setImportErrors] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // History
    const [orderHistory, setOrderHistory] = useState<OrderHistoryEntry[]>([])
    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const [selectedOrderHistory, setSelectedOrderHistory] = useState<string | null>(null)

    // Export Excel
    async function handleExportExcel(type: 'all' | 'pending' | 'delivered' | 'filtered') {
        let ordersToExport: Order[] = []
        let title = ''
        let filename = ''
        let colorScheme: 'purple' | 'green' | 'blue' = 'purple'

        switch (type) {
            case 'all':
                ordersToExport = orders
                title = 'Todos os Pedidos'
                filename = 'pedidos_todos'
                break
            case 'pending':
                ordersToExport = orders.filter(o => o.status === 'Pendente')
                title = 'Pedidos Pendentes'
                filename = 'pedidos_pendentes'
                colorScheme = 'purple'
                break
            case 'delivered':
                ordersToExport = orders.filter(o => o.status === 'Entregue')
                title = 'Pedidos Entregues'
                filename = 'pedidos_entregues'
                colorScheme = 'green'
                break
            case 'filtered':
                ordersToExport = filteredOrders
                title = 'Pedidos Filtrados'
                filename = 'pedidos_filtrados'
                colorScheme = 'blue'
                break
        }

        if (ordersToExport.length === 0) {
            alert('Nenhum pedido para exportar.')
            return
        }

        try {
            await exportOrdersToExcel(ordersToExport, {
                title,
                filename,
                colorScheme,
                includeFilters: true
            })
        } catch (error) {
            console.error('Failed to export to Excel:', error)
            alert('Erro ao exportar para Excel.')
        }
    }

    // Get unique requesters from existing orders (scanning both legacy requester and new requesters list)
    const uniqueRequesters = Array.from(new Set(
        orders.flatMap(o => {
            const list: string[] = []
            if (o.requester) list.push(o.requester)
            if (o.requesters) list.push(...o.requesters.map(r => r.name))
            return list
        }).filter(Boolean)
    )) as string[]

    useEffect(() => {
        loadOrders()
        loadSuppliers()
        loadTemplates()
        loadOrderHistory()
    }, [])

    // Listen for keyboard shortcut events
    useEffect(() => {
        const handleNewOrder = () => setIsModalOpen(true)
        const handleCloseModal = () => {
            closeModal()
            setFilesModal(null)
            setConfirmModal(null)
            setExportModal(null)
        }
        const handleFocusSearch = () => searchInputRef.current?.focus()

        window.addEventListener('orbit-new-order', handleNewOrder)
        window.addEventListener('orbit-close-modal', handleCloseModal)
        window.addEventListener('orbit-focus-search', handleFocusSearch)

        return () => {
            window.removeEventListener('orbit-new-order', handleNewOrder)
            window.removeEventListener('orbit-close-modal', handleCloseModal)
            window.removeEventListener('orbit-focus-search', handleFocusSearch)
        }
    }, [])

    async function loadSuppliers() {
        try {
            const data = await window.api.db.get('suppliers')
            if (data) setSuppliers(data)
        } catch (error) {
            console.error('Failed to load suppliers:', error)
        }
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setStatusDropdown(null)
            }
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setShowFilterMenu(false)
            }
            if (newOrderMenuRef.current && !newOrderMenuRef.current.contains(event.target as Node)) {
                setShowNewOrderMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function loadOrders() {
        try {
            const data: Order[] = await window.api.db.get('orders') || []

            // Migração automática: corrige orderNumber com espaços
            const ordersToFix = data.filter(order =>
                order.orderNumber && order.orderNumber !== order.orderNumber.trim()
            )

            if (ordersToFix.length > 0) {
                console.log(`Corrigindo ${ordersToFix.length} pedido(s) com espaços no número...`)
                for (const order of ordersToFix) {
                    const trimmedNumber = order.orderNumber.trim()
                    await window.api.db.update('orders', order.id, { orderNumber: trimmedNumber })
                    order.orderNumber = trimmedNumber
                }
            }

            setOrders(data)
        } catch (error) {
            console.error('Failed to load orders:', error)
        }
    }

    async function loadTemplates() {
        try {
            const data = await window.api.db.get('orderTemplates')
            setTemplates(data || [])
        } catch (error) {
            console.error('Failed to load templates:', error)
        }
    }

    async function loadOrderHistory() {
        try {
            const data = await window.api.db.get('orderHistory')
            setOrderHistory(data || [])
        } catch (error) {
            console.error('Failed to load order history:', error)
        }
    }

    // Add history entry
    async function addHistoryEntry(
        orderId: string,
        orderNumber: string,
        action: OrderHistoryEntry['action'],
        description: string,
        changes?: { field: string; oldValue: string; newValue: string }[]
    ) {
        try {
            const entry: Omit<OrderHistoryEntry, 'id'> = {
                orderId,
                orderNumber,
                action,
                description,
                changes,
                timestamp: new Date().toISOString()
            }
            await window.api.db.add('orderHistory', entry)
            loadOrderHistory()
        } catch (error) {
            console.error('Failed to add history entry:', error)
        }
    }

    async function handleAddOrder(e: React.FormEvent) {
        e.preventDefault()
        if (!newOrder.orderNumber) return

        try {
            const orderData = {
                ...newOrder,
                amount: parseFloat(newOrder.amount) || 0,
                createdAt: new Date().toISOString()
            }

            if (editingOrder) {
                // Track changes for history
                const changes: { field: string; oldValue: string; newValue: string }[] = []
                if (editingOrder.orderNumber !== newOrder.orderNumber) {
                    changes.push({ field: 'Nº Pedido', oldValue: editingOrder.orderNumber, newValue: newOrder.orderNumber })
                }
                if (editingOrder.vendor !== newOrder.vendor) {
                    changes.push({ field: 'Fornecedor', oldValue: editingOrder.vendor, newValue: newOrder.vendor })
                }
                if (editingOrder.amount !== parseFloat(newOrder.amount)) {
                    changes.push({ field: 'Valor', oldValue: `R$ ${editingOrder.amount}`, newValue: `R$ ${newOrder.amount}` })
                }

                await window.api.db.update('orders', editingOrder.id, orderData)

                if (changes.length > 0) {
                    addHistoryEntry(editingOrder.id, newOrder.orderNumber, 'updated', `Pedido atualizado`, changes)
                }
            } else {
                const result = await window.api.db.add('orders', orderData)
                // Create folder for documents
                await window.api.db.add('documents', {
                    name: `Pedido ${newOrder.orderNumber}`,
                    type: 'folder',
                    category: 'Pedidos',
                    orderNumber: newOrder.orderNumber,
                    files: [],
                    createdAt: new Date().toISOString()
                })
                addHistoryEntry(result.id, newOrder.orderNumber, 'created', `Pedido criado - ${newOrder.vendor}`)
            }

            closeModal()
            loadOrders()
        } catch (error) {
            console.error('Failed to save order:', error)
        }
    }

    function closeModal() {
        setIsModalOpen(false)
        setEditingOrder(null)
        setNewOrder({
            orderNumber: '',
            quoteNumber: '',
            vendor: '',
            requesters: [],
            amount: '',
            status: 'Pendente'
        })
        setTempRequester({ name: '', items: '' })
    }

    function openEditModal(order: Order) {
        setEditingOrder(order)

        // Migrate legacy requester to new structure if needed
        let initialRequesters = order.requesters || []
        if (initialRequesters.length === 0 && order.requester) {
            initialRequesters = [{ name: order.requester, items: 'Itens diversos' }]
        }

        setNewOrder({
            orderNumber: order.orderNumber,
            quoteNumber: order.quoteNumber || '',
            vendor: order.vendor || '',
            requesters: initialRequesters,
            amount: order.amount?.toString() || '',
            status: order.status
        })
        setTempRequester({ name: '', items: '' })
        setIsModalOpen(true)
    }

    function handleAddRequester() {
        if (!tempRequester.name.trim()) return

        setNewOrder(prev => ({
            ...prev,
            requesters: [...prev.requesters, { name: tempRequester.name, items: tempRequester.items }]
        }))
        setTempRequester({ name: '', items: '' })
        setShowRequesterDropdown(false)
    }

    function handleRemoveRequester(index: number) {
        setNewOrder(prev => ({
            ...prev,
            requesters: prev.requesters.filter((_, i) => i !== index)
        }))
    }

    async function deleteOrder(id: string) {
        try {
            const order = orders.find(o => o.id === id)
            await window.api.db.delete('orders', id)
            if (order) {
                addHistoryEntry(id, order.orderNumber, 'deleted', `Pedido excluído - ${order.vendor}`)
            }
            loadOrders()
        } catch (error) {
            console.error('Failed to delete order:', error)
        }
    }

    // Duplicate an order with a new order number
    async function duplicateOrder(order: Order) {
        try {
            const duplicatedOrder = {
                orderNumber: `${order.orderNumber}-COPIA`,
                quoteNumber: order.quoteNumber || '',
                vendor: order.vendor,
                requesters: order.requesters || [],
                amount: order.amount,
                status: 'Pendente',
                createdAt: new Date().toISOString(),
                favorite: false
            }
            const result = await window.api.db.add('orders', duplicatedOrder)
            addHistoryEntry(result.id, duplicatedOrder.orderNumber, 'duplicated', `Duplicado de ${order.orderNumber}`)
            loadOrders()
        } catch (error) {
            console.error('Failed to duplicate order:', error)
        }
    }

    // Toggle favorite status
    async function toggleFavorite(id: string, currentFavorite: boolean) {
        try {
            await window.api.db.update('orders', id, { favorite: !currentFavorite })
            loadOrders()
        } catch (error) {
            console.error('Failed to toggle favorite:', error)
        }
    }

    // Save order as template
    async function saveAsTemplate(order: Order, name: string) {
        try {
            const template: Omit<OrderTemplate, 'id'> = {
                name: name || `Template - ${order.vendor}`,
                vendor: order.vendor,
                requesters: order.requesters || [],
                amount: order.amount,
                createdAt: new Date().toISOString()
            }
            await window.api.db.add('orderTemplates', template)
            loadTemplates()
            setShowSaveTemplateModal(null)
            setTemplateName('')
        } catch (error) {
            console.error('Failed to save template:', error)
        }
    }

    // Create order from template
    function useTemplate(template: OrderTemplate) {
        setNewOrder({
            orderNumber: '',
            quoteNumber: '',
            vendor: template.vendor,
            requesters: [...template.requesters],
            amount: template.amount.toString(),
            status: 'Pendente'
        })
        setShowTemplatesModal(false)
        setIsModalOpen(true)
    }

    // Delete template
    async function deleteTemplate(id: string) {
        try {
            await window.api.db.delete('orderTemplates', id)
            loadTemplates()
        } catch (error) {
            console.error('Failed to delete template:', error)
        }
    }

    // CSV Import functions
    function parseCSV(csvText: string): { headers: string[], rows: string[][] } {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim())
        if (lines.length === 0) return { headers: [], rows: [] }

        const headers = lines[0].split(';').map(h => h.trim().toLowerCase())
        const rows = lines.slice(1).map(line => line.split(';').map(cell => cell.trim()))

        return { headers, rows }
    }

    function mapCSVToOrders(headers: string[], rows: string[][]): { orders: Partial<Order>[], errors: string[] } {
        const mappedOrders: Partial<Order>[] = []
        const errors: string[] = []

        // Find column indexes
        const orderNumIdx = headers.findIndex(h => h.includes('pedido') || h.includes('numero') || h.includes('order'))
        const vendorIdx = headers.findIndex(h => h.includes('fornecedor') || h.includes('vendor') || h.includes('supplier'))
        const amountIdx = headers.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('total'))
        const statusIdx = headers.findIndex(h => h.includes('status'))
        const requesterIdx = headers.findIndex(h => h.includes('solicitante') || h.includes('requester'))
        const quoteIdx = headers.findIndex(h => h.includes('orcamento') || h.includes('orçamento') || h.includes('quote'))

        if (orderNumIdx === -1) {
            errors.push('Coluna "Pedido" ou "Numero" não encontrada')
            return { orders: [], errors }
        }

        rows.forEach((row, idx) => {
            if (row.length === 0 || !row[orderNumIdx]) return

            const orderNumber = row[orderNumIdx]
            if (!orderNumber) {
                errors.push(`Linha ${idx + 2}: Número do pedido vazio`)
                return
            }

            const amount = amountIdx !== -1
                ? parseFloat(row[amountIdx]?.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
                : 0

            mappedOrders.push({
                orderNumber,
                vendor: vendorIdx !== -1 ? row[vendorIdx] || '' : '',
                amount,
                status: statusIdx !== -1 ? row[statusIdx] || 'Pendente' : 'Pendente',
                quoteNumber: quoteIdx !== -1 ? row[quoteIdx] || '' : '',
                requesters: requesterIdx !== -1 && row[requesterIdx]
                    ? [{ name: row[requesterIdx], items: '' }]
                    : []
            })
        })

        return { orders: mappedOrders, errors }
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            const { headers, rows } = parseCSV(text)
            const { orders: mapped, errors } = mapCSVToOrders(headers, rows)

            setImportPreview(mapped)
            setImportErrors(errors)
            setShowImportModal(true)
        }
        reader.readAsText(file, 'UTF-8')

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    async function handleImportConfirm() {
        try {
            let imported = 0
            for (const order of importPreview) {
                if (order.orderNumber) {
                    const orderData = {
                        ...order,
                        createdAt: new Date().toISOString(),
                        favorite: false
                    }
                    const result = await window.api.db.add('orders', orderData)
                    addHistoryEntry(result.id, order.orderNumber, 'created', `Importado via CSV`)
                    imported++
                }
            }

            setShowImportModal(false)
            setImportPreview([])
            setImportErrors([])
            loadOrders()

            // Show success message via custom event
            window.dispatchEvent(new CustomEvent('orbit-notification', {
                detail: { title: 'Importação Concluída', body: `${imported} pedidos importados com sucesso!` }
            }))
        } catch (error) {
            console.error('Failed to import orders:', error)
        }
    }

    // Get history for a specific order
    function getOrderHistoryEntries(orderId: string) {
        return orderHistory
            .filter(h => h.orderId === orderId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }


    function handleStatusClick(orderId: string, currentStatus: string, newStatus: string) {
        // If changing to Entregue or Cancelado, show confirmation
        if (newStatus === 'Entregue' || newStatus === 'Cancelado') {
            const message = newStatus === 'Entregue'
                ? 'Confirmar que o pedido foi entregue?'
                : 'Confirmar cancelamento do pedido?'
            setConfirmModal({ orderId, status: newStatus, message })
            setStatusDropdown(null)
        } else {
            updateOrderStatus(orderId, newStatus)
        }
    }

    async function updateOrderStatus(id: string, status: string) {
        try {
            const order = orders.find(o => o.id === id)
            const updates: any = { status }
            if (status === 'Entregue') {
                updates.deliveryDate = new Date().toISOString()
            }
            await window.api.db.update('orders', id, updates)
            if (order) {
                addHistoryEntry(id, order.orderNumber, 'status_changed', `Status: ${order.status} → ${status}`)
            }
            setStatusDropdown(null)
            setConfirmModal(null)
            loadOrders()
        } catch (error) {
            console.error('Failed to update order:', error)
        }
    }

    async function handleOpenFolder(orderNumber: string) {
        try {
            await window.api.file.openOrderFolder(orderNumber)
        } catch (error) {
            console.error('Failed to open folder:', error)
        }
    }

    async function handleAttachFiles(orderNumber: string) {
        try {
            const result = await window.api.file.attachFiles(orderNumber)
            if (result.success && result.files.length > 0) {
                // Update the order with attached files
                const order = orders.find(o => o.orderNumber === orderNumber)
                if (order) {
                    const existingFiles = order.attachedFiles || []
                    await window.api.db.update('orders', order.id, {
                        attachedFiles: [...existingFiles, ...result.files]
                    })
                    loadOrders()
                }
                // Show success message or open files modal
                const files = await window.api.file.getOrderFiles(orderNumber)
                setFilesModal({ orderNumber, files })
            }
        } catch (error) {
            console.error('Failed to attach files:', error)
        }
    }

    async function handleViewFiles(orderNumber: string) {
        try {
            const files = await window.api.file.getOrderFiles(orderNumber)
            setFilesModal({ orderNumber, files })
        } catch (error) {
            console.error('Failed to get files:', error)
        }
    }

    async function handleOpenFile(filePath: string) {
        try {
            await window.api.file.openFile(filePath)
        } catch (error) {
            console.error('Failed to open file:', error)
        }
    }

    async function copyOrderNumber(orderNumber: string) {
        try {
            await navigator.clipboard.writeText(orderNumber)
            setCopiedOrderNumber(orderNumber)
            // Clear the "copied" state after 2 seconds
            setTimeout(() => setCopiedOrderNumber(null), 2000)
        } catch (error) {
            console.error('Failed to copy:', error)
        }
    }

    async function exportPendingOrders(includeAttachments: boolean = true) {
        // Close the export modal
        setExportModal(null)

        // Filter strictly pending orders
        const pendingOrders = orders.filter(o => o.status === 'Pendente')

        if (pendingOrders.length === 0) {
            alert('Não há pedidos pendentes para exportar.')
            return
        }

        try {
            // Create PDF
            const doc = new jsPDF()

            // Header
            doc.setFontSize(20)
            doc.setTextColor(139, 92, 246) // Purple
            doc.text('Orbit - Relatório de Pedidos Pendentes', 14, 22)

            doc.setFontSize(10)
            doc.setTextColor(100)
            doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30)
            doc.text(`Total de pedidos pendentes: ${pendingOrders.length}`, 14, 36)

            // Table data
            const tableData = pendingOrders.map(order => {
                // Format requesters text
                let requestersText = '-'
                if (order.requesters && order.requesters.length > 0) {
                    requestersText = order.requesters.map(r => `${r.name} (${r.items || 'Div.'})`).join('\n')
                } else if (order.requester) {
                    requestersText = order.requester
                }

                return [
                    order.orderNumber,
                    order.quoteNumber || '-',
                    order.vendor || '-',
                    requestersText,
                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.amount || 0),
                    order.status || 'Pendente',
                    order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('pt-BR') : '-'
                ]
            })

            // Add table using autoTable
            autoTable(doc, {
                startY: 45,
                head: [['Nº Pedido', 'Nº Orç.', 'Fornecedor', 'Solicitante', 'Valor', 'Status', 'Previsão']],
                body: tableData,
                headStyles: {
                    fillColor: [139, 92, 246],
                    textColor: 255,
                    fontSize: 9,
                    fontStyle: 'bold'
                },
                bodyStyles: {
                    fontSize: 8,
                    textColor: 50
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 250]
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 25 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 40 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 25, halign: 'right' },
                    5: { cellWidth: 22 },
                    6: { cellWidth: 22 }
                },
                margin: { left: 10, right: 10 }
            })

            // Add summary by status
            const finalY = (doc as any).lastAutoTable.finalY + 15
            doc.setFontSize(12)
            doc.setTextColor(50)
            doc.text('Resumo por Status:', 14, finalY)

            const statusCounts = pendingOrders.reduce((acc, order) => {
                const status = order.status || 'Pendente'
                acc[status] = (acc[status] || 0) + 1
                return acc
            }, {} as Record<string, number>)

            let yPos = finalY + 8
            Object.entries(statusCounts).forEach(([status, count]) => {
                doc.setFontSize(10)
                doc.text(`• ${status}: ${count} pedido(s)`, 20, yPos)
                yPos += 6
            })

            // Add note about attachments (only if including)
            if (includeAttachments) {
                doc.setFontSize(9)
                doc.setTextColor(100)
                doc.text('Nota: Os anexos dos pedidos estão disponíveis na pasta "Anexos".', 14, yPos + 10)
            }

            // Get PDF as base64
            const pdfBase64 = doc.output('datauristring').split(',')[1]

            // Get order numbers for attachments (only if including attachments)
            const orderNumbers = includeAttachments ? pendingOrders.map(o => o.orderNumber) : []

            // Export PDF and attachments
            const result = await window.api.file.exportOrders(pdfBase64, orderNumbers, 'Relatorio_Pedidos_Pendentes')

            if (result.success) {
                // Success - folder will be opened automatically
            } else {
                alert('Exportação cancelada.')
            }
        } catch (error) {
            console.error('Failed to export orders:', error)
            alert('Erro ao exportar pedidos. Verifique o console para mais detalhes.')
        }
    }

    async function exportDeliveredOrders() {
        // Filter strictly delivered orders
        const deliveredOrders = orders.filter(o => o.status === 'Entregue')

        if (deliveredOrders.length === 0) {
            alert('Não há pedidos entregues para exportar.')
            return
        }

        try {
            // Create PDF
            const doc = new jsPDF()

            // Header
            doc.setFontSize(20)
            doc.setTextColor(16, 185, 129) // Green
            doc.text('Orbit - Relatório de Pedidos Entregues', 14, 22)

            doc.setFontSize(10)
            doc.setTextColor(100)
            doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30)
            doc.text(`Total de pedidos entregues: ${deliveredOrders.length}`, 14, 36)

            // Table data
            const tableData = deliveredOrders.map(order => {
                // Format requesters text
                let requestersText = '-'
                if (order.requesters && order.requesters.length > 0) {
                    requestersText = order.requesters.map(r => `${r.name} (${r.items || 'Div.'})`).join('\n')
                } else if (order.requester) {
                    requestersText = order.requester
                }

                return [
                    order.orderNumber,
                    order.quoteNumber || '-',
                    order.vendor || '-',
                    requestersText,
                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.amount || 0),
                    order.status || 'Entregue',
                    order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('pt-BR') : '-'
                ]
            })

            // Add table using autoTable
            autoTable(doc, {
                startY: 45,
                head: [['Nº Pedido', 'Nº Orç.', 'Fornecedor', 'Solicitante', 'Valor', 'Status', 'Entregue em']],
                body: tableData,
                headStyles: {
                    fillColor: [16, 185, 129],
                    textColor: 255,
                    fontSize: 9,
                    fontStyle: 'bold'
                },
                bodyStyles: {
                    fontSize: 8,
                    textColor: 50
                },
                alternateRowStyles: {
                    fillColor: [245, 250, 245]
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 25 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 40 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 25, halign: 'right' },
                    5: { cellWidth: 22 },
                    6: { cellWidth: 22 }
                },
                margin: { left: 10, right: 10 }
            })

            // Add note about attachments
            const finalY = (doc as any).lastAutoTable.finalY + 15
            doc.setFontSize(9)
            doc.setTextColor(100)
            doc.text('Nota: Os anexos dos pedidos estão disponíveis na pasta "Anexos".', 14, finalY)

            // Get PDF as base64
            const pdfBase64 = doc.output('datauristring').split(',')[1]

            // Get order numbers for attachments
            const orderNumbers = deliveredOrders.map(o => o.orderNumber)

            // Export PDF and attachments
            const result = await window.api.file.exportOrders(pdfBase64, orderNumbers, 'Relatorio_Pedidos_Entregues')

            if (result.success) {
                // Success
            } else {
                alert('Exportação cancelada.')
            }
        } catch (error) {
            console.error('Failed to export orders:', error)
            alert('Erro ao exportar pedidos.')
        }
    }

    const statusColors: Record<string, string> = {
        'Pendente': 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/20',
        'Liberado': 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
        'Em Trânsito': 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
        'Entrega Parcial': 'bg-orange-500/10 text-orange-400 ring-orange-500/20',
        'Entregue': 'bg-green-500/10 text-green-400 ring-green-500/20',
        'Cancelado': 'bg-red-500/10 text-red-400 ring-red-500/20'
    }

    const allStatuses = ['Pendente', 'Liberado', 'Em Trânsito', 'Entrega Parcial', 'Entregue', 'Cancelado']

    const filteredOrders = orders
        .filter(order => {
            const query = searchQuery.toLowerCase()
            const matchesSearch =
                order.orderNumber.toLowerCase().includes(query) ||
                (order.vendor && order.vendor.toLowerCase().includes(query)) ||
                (order.quoteNumber && order.quoteNumber.toLowerCase().includes(query))

            const matchesStatus = statusFilter === 'Todos' ? true : order.status === statusFilter
            const matchesFavorite = showFavoritesOnly ? order.favorite === true : true

            // Filtro por data
            let matchesDate = true
            if (dateFilter !== 'Todos' && order.createdAt) {
                const orderDate = new Date(order.createdAt)
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                switch (dateFilter) {
                    case '7dias':
                        const sevenDaysAgo = new Date(today)
                        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
                        matchesDate = orderDate >= sevenDaysAgo
                        break
                    case '30dias':
                        const thirtyDaysAgo = new Date(today)
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                        matchesDate = orderDate >= thirtyDaysAgo
                        break
                    case 'mes':
                        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
                        matchesDate = orderDate >= firstOfMonth
                        break
                }
            }

            return matchesSearch && matchesStatus && matchesFavorite && matchesDate
        })
        // Sort favorites first, then by date
        .sort((a, b) => {
            if (a.favorite && !b.favorite) return -1
            if (!a.favorite && b.favorite) return 1
            // Then sort by creation date (newest first)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Pedidos de Compra</h2>
                    <p className="text-muted-foreground text-sm">Gerenciar ordens de compra (SAP ME21N).</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Export Dropdown */}
                    <div className="relative group">
                        <button
                            className="h-10 px-4 rounded-full font-medium transition-all border border-border hover:bg-white/5 flex items-center gap-2 text-sm"
                        >
                            <Download size={16} />
                            Exportar
                            <ChevronDown size={14} />
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                            <div className="p-2 border-b border-border/50">
                                <p className="text-xs font-medium text-muted-foreground px-2">PDF com Anexos</p>
                            </div>
                            <div className="p-1">
                                <button
                                    onClick={() => setExportModal({ type: 'pending' })}
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 flex items-center gap-3"
                                >
                                    <Download size={14} className="text-amber-500" />
                                    Pendentes (PDF)
                                </button>
                                <button
                                    onClick={exportDeliveredOrders}
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 flex items-center gap-3"
                                >
                                    <Download size={14} className="text-green-500" />
                                    Entregues (PDF)
                                </button>
                            </div>
                            <div className="p-2 border-t border-border/50">
                                <p className="text-xs font-medium text-muted-foreground px-2">Excel Formatado</p>
                            </div>
                            <div className="p-1">
                                <button
                                    onClick={() => handleExportExcel('all')}
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 flex items-center gap-3"
                                >
                                    <FileSpreadsheet size={14} className="text-emerald-500" />
                                    Todos os Pedidos
                                </button>
                                <button
                                    onClick={() => handleExportExcel('pending')}
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 flex items-center gap-3"
                                >
                                    <FileSpreadsheet size={14} className="text-amber-500" />
                                    Apenas Pendentes
                                </button>
                                <button
                                    onClick={() => handleExportExcel('delivered')}
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 flex items-center gap-3"
                                >
                                    <FileSpreadsheet size={14} className="text-green-500" />
                                    Apenas Entregues
                                </button>
                                {(searchQuery || statusFilter !== 'Todos' || dateFilter !== 'Todos') && (
                                    <button
                                        onClick={() => handleExportExcel('filtered')}
                                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 flex items-center gap-3 text-blue-400"
                                    >
                                        <FileSpreadsheet size={14} className="text-blue-500" />
                                        Filtrados ({filteredOrders.length})
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Novo Pedido com Dropdown */}
                    <div className="relative" ref={newOrderMenuRef}>
                        <button
                            onClick={() => setShowNewOrderMenu(!showNewOrderMenu)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 rounded-full font-medium transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 flex items-center gap-2 text-sm"
                        >
                            <Plus size={16} />
                            Novo Pedido
                            <ChevronDown size={14} className={`transition-transform ${showNewOrderMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {showNewOrderMenu && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-1">
                                    <button
                                        onClick={() => {
                                            setIsModalOpen(true)
                                            setShowNewOrderMenu(false)
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors text-foreground hover:bg-white/5 flex items-center gap-3"
                                    >
                                        <Plus size={16} className="text-primary" />
                                        <div>
                                            <p className="font-medium">Novo Pedido</p>
                                            <p className="text-xs text-muted-foreground">Criar do zero</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowTemplatesModal(true)
                                            setShowNewOrderMenu(false)
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors text-foreground hover:bg-white/5 flex items-center gap-3"
                                    >
                                        <FileText size={16} className="text-amber-500" />
                                        <div>
                                            <p className="font-medium">Usar Template</p>
                                            <p className="text-xs text-muted-foreground">{templates.length} template{templates.length !== 1 ? 's' : ''} salvo{templates.length !== 1 ? 's' : ''}</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            fileInputRef.current?.click()
                                            setShowNewOrderMenu(false)
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors text-foreground hover:bg-white/5 flex items-center gap-3"
                                    >
                                        <Upload size={16} className="text-blue-500" />
                                        <div>
                                            <p className="font-medium">Importar CSV</p>
                                            <p className="text-xs text-muted-foreground">Importar lista em massa</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* Hidden File Input for CSV Import */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".csv,.txt"
                    className="hidden"
                />
            </div>


            {/* Toolbar */}
            <div className="flex items-center gap-4 bg-card/50 p-2 rounded-xl border border-border/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Buscar por número ou fornecedor... (Ctrl+F)"
                        className="w-full bg-transparent border-none focus:ring-0 pl-10 text-sm h-10 placeholder:text-muted-foreground/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                {/* Favorites Toggle */}
                <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`p-2 rounded-lg transition-colors ${showFavoritesOnly ? 'bg-yellow-500/20 text-yellow-400' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                    title={showFavoritesOnly ? "Mostrar todos" : "Mostrar apenas favoritos"}
                >
                    <Star size={18} fill={showFavoritesOnly ? "currentColor" : "none"} />
                </button>
                <div className="relative" ref={filterRef}>
                    <button
                        onClick={() => setShowFilterMenu(!showFilterMenu)}
                        className={`p-2 rounded-lg transition-colors ${statusFilter !== 'Todos' || dateFilter !== 'Todos' || showFilterMenu ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                        title="Filtrar"
                    >
                        <Filter size={18} />
                    </button>

                    {showFilterMenu && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                            {/* Status Filter */}
                            <div className="p-2 border-b border-border/50">
                                <span className="text-xs font-medium text-muted-foreground px-2">Status</span>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto p-1">
                                <button
                                    onClick={() => {
                                        setStatusFilter('Todos')
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center justify-between ${statusFilter === 'Todos' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-white/5'}`}
                                >
                                    Todos
                                    {statusFilter === 'Todos' && <Check size={14} />}
                                </button>
                                {allStatuses.map(status => (
                                    <button
                                        key={status}
                                        onClick={() => {
                                            setStatusFilter(status)
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center justify-between ${statusFilter === status ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-white/5'}`}
                                    >
                                        {status}
                                        {statusFilter === status && <Check size={14} />}
                                    </button>
                                ))}
                            </div>

                            {/* Date Filter */}
                            <div className="p-2 border-t border-border/50">
                                <span className="text-xs font-medium text-muted-foreground px-2">Período</span>
                            </div>
                            <div className="p-1">
                                {[
                                    { value: 'Todos', label: 'Qualquer data' },
                                    { value: '7dias', label: 'Últimos 7 dias' },
                                    { value: '30dias', label: 'Últimos 30 dias' },
                                    { value: 'mes', label: 'Este mês' }
                                ].map(option => (
                                    <button
                                        key={option.value}
                                        onClick={() => setDateFilter(option.value)}
                                        className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center justify-between ${dateFilter === option.value ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-white/5'}`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <Calendar size={12} />
                                            {option.label}
                                        </span>
                                        {dateFilter === option.value && <Check size={14} />}
                                    </button>
                                ))}
                            </div>

                            {/* Clear Filters */}
                            {(statusFilter !== 'Todos' || dateFilter !== 'Todos') && (
                                <div className="p-2 border-t border-border/50">
                                    <button
                                        onClick={() => {
                                            setStatusFilter('Todos')
                                            setDateFilter('Todos')
                                            setShowFilterMenu(false)
                                        }}
                                        className="w-full px-3 py-2 text-sm rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <X size={14} />
                                        Limpar Filtros
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Orders Table */}
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-visible">
                <table className="w-full text-sm text-left table-fixed">
                    <thead className="bg-white/5 text-muted-foreground font-medium uppercase text-xs">
                        <tr>
                            <th className="px-4 py-4 whitespace-nowrap w-[130px]">Nº Pedido</th>
                            <th className="px-4 py-4 whitespace-nowrap w-[110px]">Nº Orçamento</th>
                            <th className="px-4 py-4 w-[180px]">Fornecedor</th>
                            <th className="px-4 py-4 w-[150px]">Solicitante</th>
                            <th className="px-4 py-4 whitespace-nowrap w-[120px]">Valor</th>
                            <th className="px-4 py-4 whitespace-nowrap w-[100px]">Entrega</th>
                            <th className="px-4 py-4 whitespace-nowrap w-[150px]">Status</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap w-[260px]">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center bg-white/5">
                                    <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                                    <p className="text-muted-foreground">
                                        {searchQuery || statusFilter !== 'Todos'
                                            ? 'Nenhum pedido encontrado com os filtros atuais.'
                                            : 'Nenhum pedido encontrado.'}
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map((order, index) => (
                                <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-4">
                                        <button
                                            onClick={() => copyOrderNumber(order.orderNumber)}
                                            className="font-mono font-medium text-primary text-sm hover:text-primary/80 hover:underline cursor-pointer transition-all relative group"
                                            title="Clique para copiar"
                                        >
                                            {order.orderNumber}
                                            {copiedOrderNumber === order.orderNumber && (
                                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap animate-in fade-in zoom-in duration-200">
                                                    Copiado!
                                                </span>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-4 py-4 font-mono text-muted-foreground text-sm">{order.quoteNumber || '-'}</td>
                                    <td className="px-4 py-4 text-foreground text-sm max-w-[180px] truncate" title={order.vendor || '-'}>{order.vendor || '-'}</td>
                                    <td className="px-4 py-4 text-muted-foreground text-sm">
                                        {(order.requesters && order.requesters.length > 0) ? (
                                            <div className="flex flex-col gap-0.5">
                                                {order.requesters.slice(0, 2).map((r, i) => (
                                                    <span key={i} className="truncate" title={`${r.name}: ${r.items}`}>{r.name}</span>
                                                ))}
                                                {order.requesters.length > 2 && <span className="text-xs opacity-50">+{order.requesters.length - 2} mais</span>}
                                            </div>
                                        ) : (
                                            <span className="truncate" title={order.requester || '-'}>{order.requester || '-'}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 font-mono text-sm">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.amount || 0)}
                                    </td>
                                    <td className="px-4 py-4 text-muted-foreground text-sm">
                                        {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('pt-BR') : '-'}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="relative">
                                            <button
                                                onClick={() => {
                                                    if (statusDropdown === order.id) {
                                                        setStatusDropdown(null)
                                                    } else {
                                                        setStatusDropdown(order.id)
                                                    }
                                                }}
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${statusColors[order.status] || statusColors['Pendente']} hover:opacity-80 transition-opacity cursor-pointer`}
                                            >
                                                {order.status || 'Pendente'}
                                                <ChevronDown size={12} className="flex-shrink-0" />
                                            </button>

                                            {/* Status Dropdown */}
                                            {statusDropdown === order.id && (
                                                <div
                                                    ref={dropdownRef}
                                                    className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-2xl py-1 min-w-[140px] z-[9999]"
                                                >
                                                    {allStatuses.map((status) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleStatusClick(order.id, order.status, status)}
                                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${order.status === status ? 'text-primary' : 'text-foreground'}`}
                                                        >
                                                            {status === 'Entregue' && <Check size={14} className="text-green-400 flex-shrink-0" />}
                                                            {status === 'Cancelado' && <XCircle size={14} className="text-red-400 flex-shrink-0" />}
                                                            {status}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => toggleFavorite(order.id, order.favorite || false)}
                                                className={`p-1.5 rounded-lg transition-all ${order.favorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10'}`}
                                                title={order.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                                                aria-label="Favoritar pedido"
                                            >
                                                <Star size={14} fill={order.favorite ? "currentColor" : "none"} />
                                            </button>
                                            <button
                                                onClick={() => duplicateOrder(order)}
                                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                title="Duplicar Pedido"
                                                aria-label="Duplicar pedido"
                                            >
                                                <Copy size={14} />
                                            </button>
                                            <button
                                                onClick={() => setShowSaveTemplateModal(order)}
                                                className="p-1.5 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"
                                                title="Salvar como Template"
                                                aria-label="Salvar como template"
                                            >
                                                <Bookmark size={14} />
                                            </button>
                                            <button
                                                onClick={() => openEditModal(order)}
                                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                title="Editar"
                                                aria-label="Editar pedido"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenFolder(order.orderNumber)}
                                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                title="Abrir Pasta do Pedido"
                                                aria-label="Abrir pasta"
                                            >
                                                <FolderOpen size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleAttachFiles(order.orderNumber)}
                                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                title="Anexar Arquivo"
                                                aria-label="Anexar arquivo"
                                            >
                                                <Paperclip size={14} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedOrderHistory(order.id)
                                                    setShowHistoryModal(true)
                                                }}
                                                className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                                title="Ver Histórico"
                                                aria-label="Ver histórico"
                                            >
                                                <History size={14} />
                                            </button>
                                            <button
                                                onClick={() => deleteOrder(order.id)}
                                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                                                title="Excluir"
                                                aria-label="Excluir pedido"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={closeModal}>
                        <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-xl font-bold mb-4">{editingOrder ? 'Editar Pedido' : 'Novo Pedido de Compra'}</h3>
                            <form onSubmit={handleAddOrder} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Nº do Pedido (SAP)</label>
                                        <input
                                            type="text"
                                            className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all font-mono"
                                            placeholder="Ex: 4500012345"
                                            value={newOrder.orderNumber}
                                            onChange={(e) => setNewOrder({ ...newOrder, orderNumber: e.target.value })}
                                            required
                                            disabled={!!editingOrder}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Nº do Orçamento</label>
                                        <input
                                            type="text"
                                            className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all font-mono"
                                            placeholder="Ex: 50011412"
                                            value={newOrder.quoteNumber}
                                            onChange={(e) => setNewOrder({ ...newOrder, quoteNumber: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 relative">
                                    <label className="text-sm font-medium">Fornecedor</label>
                                    <input
                                        type="text"
                                        className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                        placeholder="Nome do fornecedor ou empresa"
                                        value={newOrder.vendor}
                                        onChange={(e) => {
                                            setNewOrder({ ...newOrder, vendor: e.target.value })
                                            setShowSupplierDropdown(true)
                                        }}
                                        onFocus={() => setShowSupplierDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                                    />
                                    {showSupplierDropdown && (
                                        <div className="absolute z-10 w-full bg-card border border-border rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                                            {suppliers
                                                .filter(s =>
                                                    !newOrder.vendor ||
                                                    s.name.toLowerCase().includes(newOrder.vendor.toLowerCase()) ||
                                                    s.company.toLowerCase().includes(newOrder.vendor.toLowerCase())
                                                )
                                                .map((s) => (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex flex-col"
                                                        onClick={() => {
                                                            setNewOrder({ ...newOrder, vendor: `${s.name} - ${s.company}` })
                                                            setShowSupplierDropdown(false)
                                                        }}
                                                    >
                                                        <span className="font-medium text-foreground">{s.name}</span>
                                                        <span className="text-xs text-muted-foreground">{s.company}</span>
                                                    </button>
                                                ))}
                                            {suppliers.length === 0 && (
                                                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Requesters Section */}
                                <div className="space-y-3 pt-2 border-t border-border/50">
                                    <label className="text-sm font-medium">Solicitantes & Itens</label>

                                    {/* List of added requesters */}
                                    {newOrder.requesters.length > 0 && (
                                        <div className="space-y-2 mb-3">
                                            {newOrder.requesters.map((req, index) => (
                                                <div key={index} className="flex items-start justify-between bg-secondary/30 p-2 rounded-lg text-sm group">
                                                    <div>
                                                        <div className="font-medium text-primary">{req.name}</div>
                                                        <div className="text-muted-foreground text-xs">{req.items || 'Nenhum item especificado'}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRequester(index)}
                                                        className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add New Requester Form */}
                                    <div className="flex gap-2 items-start relative">
                                        <div className="flex-1 space-y-2">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-9 px-3 text-sm transition-all"
                                                    placeholder="Nome do solicitante"
                                                    value={tempRequester.name}
                                                    onChange={(e) => {
                                                        setTempRequester(prev => ({ ...prev, name: e.target.value }))
                                                        setShowRequesterDropdown(true)
                                                    }}
                                                    onFocus={() => setShowRequesterDropdown(true)}
                                                    onBlur={() => setTimeout(() => setShowRequesterDropdown(false), 200)}
                                                />
                                                {showRequesterDropdown && uniqueRequesters.length > 0 && (
                                                    <div className="absolute z-10 w-full bg-card border border-border rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto">
                                                        {uniqueRequesters
                                                            .filter(r => !tempRequester.name || r.toLowerCase().includes(tempRequester.name.toLowerCase()))
                                                            .map((requester, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                                                                    onClick={() => {
                                                                        setTempRequester(prev => ({ ...prev, name: requester }))
                                                                        setShowRequesterDropdown(false)
                                                                    }}
                                                                >
                                                                    {requester}
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-9 px-3 text-sm transition-all"
                                                placeholder="Itens (ex: Bota, Luva...)"
                                                value={tempRequester.items}
                                                onChange={(e) => setTempRequester(prev => ({ ...prev, items: e.target.value }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        handleAddRequester()
                                                    }
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddRequester}
                                            className="h-9 px-3 bg-primary/20 text-primary hover:bg-primary/30 rounded-lg transition-colors flex items-center justify-center"
                                            title="Adicionar Solicitante"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Valor Total (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                        placeholder="0,00"
                                        value={newOrder.amount}
                                        onChange={(e) => setNewOrder({ ...newOrder, amount: e.target.value })}
                                    />
                                </div>

                                {editingOrder && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Status</label>
                                        <select
                                            className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                            value={newOrder.status}
                                            onChange={(e) => setNewOrder({ ...newOrder, status: e.target.value })}
                                        >
                                            {allStatuses.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="flex-1 h-10 rounded-lg font-medium hover:bg-white/5 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        Salvar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Files Modal */}
            {
                filesModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setFilesModal(null)}>
                        <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold">Arquivos do Pedido {filesModal.orderNumber}</h3>
                                <button onClick={() => setFilesModal(null)} className="p-1 hover:bg-white/10 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>

                            {filesModal.files.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <FileIcon size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>Nenhum arquivo anexado.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {filesModal.files.map((file, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleOpenFile(file.path)}
                                            className="w-full flex items-center gap-3 p-3 bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-colors text-left"
                                        >
                                            <FileIcon size={18} className="text-primary flex-shrink-0" />
                                            <span className="truncate">{file.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-3 mt-4 pt-4 border-t border-border">
                                <button
                                    onClick={() => handleAttachFiles(filesModal.orderNumber)}
                                    className="flex-1 h-10 bg-primary/20 text-primary rounded-lg font-medium hover:bg-primary/30 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Paperclip size={16} />
                                    Anexar Mais
                                </button>
                                <button
                                    onClick={() => handleOpenFolder(filesModal.orderNumber)}
                                    className="flex-1 h-10 bg-secondary/50 rounded-lg font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                                >
                                    <FolderOpen size={16} />
                                    Abrir Pasta
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Confirm Status Change Modal */}
            {
                confirmModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setConfirmModal(null)}>
                        <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                            <div className="text-center mb-6">
                                {confirmModal.status === 'Entregue' ? (
                                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Check size={32} className="text-green-400" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <XCircle size={32} className="text-red-400" />
                                    </div>
                                )}
                                <h3 className="text-xl font-bold mb-2">{confirmModal.message}</h3>
                                <p className="text-muted-foreground text-sm">
                                    {confirmModal.status === 'Entregue'
                                        ? 'A data de entrega será registrada automaticamente.'
                                        : 'Esta ação pode ser desfeita alterando o status novamente.'}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmModal(null)}
                                    className="flex-1 h-10 rounded-lg font-medium hover:bg-white/5 transition-colors border border-border"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => updateOrderStatus(confirmModal.orderId, confirmModal.status)}
                                    className={`flex-1 h-10 rounded-lg font-medium transition-colors ${confirmModal.status === 'Entregue'
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                        }`}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Export Options Modal */}
            {
                exportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setExportModal(null)}>
                        <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Download size={32} className="text-primary" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Exportar Pedidos Pendentes</h3>
                                <p className="text-muted-foreground text-sm">
                                    Escolha o formato de exportação:
                                </p>
                            </div>

                            <div className="space-y-3 mb-6">
                                <button
                                    onClick={() => exportPendingOrders(false)}
                                    className="w-full p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                            <FileIcon size={24} className="text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground">Apenas PDF</h4>
                                            <p className="text-sm text-muted-foreground">Exporta somente o relatório em PDF</p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => exportPendingOrders(true)}
                                    className="w-full p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                            <Package size={24} className="text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground">PDF + Anexos</h4>
                                            <p className="text-sm text-muted-foreground">Exporta o PDF junto com todos os anexos dos pedidos</p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <button
                                onClick={() => setExportModal(null)}
                                className="w-full h-10 rounded-lg font-medium hover:bg-white/5 transition-colors border border-border"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Templates Modal */}
            {
                showTemplatesModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowTemplatesModal(false)}>
                        <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-amber-500/20">
                                        <FileText size={24} className="text-amber-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Templates de Pedido</h3>
                                        <p className="text-sm text-muted-foreground">Selecione um template para criar novo pedido</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowTemplatesModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {templates.length === 0 ? (
                                <div className="text-center py-12">
                                    <Bookmark size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                                    <p className="text-muted-foreground mb-2">Nenhum template salvo</p>
                                    <p className="text-sm text-muted-foreground/70">Salve um pedido como template clicando no ícone <Bookmark size={14} className="inline" /> na tabela</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {templates.map(template => (
                                        <div
                                            key={template.id}
                                            className="p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer"
                                            onClick={() => useTemplate(template)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-foreground truncate">{template.name}</h4>
                                                    <p className="text-sm text-muted-foreground truncate">{template.vendor}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {template.requesters.length} solicitante{template.requesters.length !== 1 ? 's' : ''} • R$ {template.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            deleteTemplate(template.id)
                                                        }}
                                                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                                                        title="Excluir template"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={() => setShowTemplatesModal(false)}
                                className="w-full h-10 mt-4 rounded-lg font-medium hover:bg-white/5 transition-colors border border-border"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Save Template Modal */}
            {
                showSaveTemplateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowSaveTemplateModal(null)}>
                        <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-amber-500/20">
                                        <Bookmark size={24} className="text-amber-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Salvar como Template</h3>
                                        <p className="text-sm text-muted-foreground">Dê um nome para este template</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowSaveTemplateModal(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                                    <p className="text-sm text-muted-foreground">Baseado no pedido</p>
                                    <p className="font-medium">{showSaveTemplateModal.orderNumber}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{showSaveTemplateModal.vendor}</p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Nome do Template</label>
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder={`Template - ${showSaveTemplateModal.vendor}`}
                                        className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => {
                                            setShowSaveTemplateModal(null)
                                            setTemplateName('')
                                        }}
                                        className="flex-1 h-10 rounded-lg font-medium hover:bg-white/5 transition-colors border border-border"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => saveAsTemplate(showSaveTemplateModal, templateName)}
                                        className="flex-1 h-10 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                                    >
                                        Salvar Template
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CSV Import Preview Modal */}
            {
                showImportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowImportModal(false)}>
                        <div className="bg-card border border-border w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/20">
                                        <Upload size={24} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Importar Pedidos (CSV)</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {importPreview.length} pedidos encontrados • {importErrors.length} erros
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-6">
                                {importErrors.length > 0 && (
                                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                                            <XCircle size={16} /> Erros encontrados
                                        </h4>
                                        <ul className="list-disc list-inside text-sm space-y-1 opacity-80">
                                            {importErrors.map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="rounded-xl border border-border overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary/50 text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Pedido</th>
                                                <th className="px-4 py-3 text-left">Fornecedor</th>
                                                <th className="px-4 py-3 text-left">Valor</th>
                                                <th className="px-4 py-3 text-left">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {importPreview.map((order, i) => (
                                                <tr key={i} className="hover:bg-white/5">
                                                    <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{order.vendor}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">
                                                        {order.amount ? `R$ ${order.amount.toFixed(2)}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 rounded-full text-xs bg-white/10">
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="p-6 border-t border-border flex justify-end gap-3 bg-secondary/20 rounded-b-2xl">
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    className="px-4 py-2 rounded-lg font-medium hover:bg-white/5 transition-colors border border-border"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleImportConfirm}
                                    disabled={importPreview.length === 0}
                                    className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Check size={16} />
                                    Confirmar Importação
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* History Modal */}
            {
                showHistoryModal && selectedOrderHistory && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowHistoryModal(false)}>
                        <div className="bg-card border border-border w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-purple-500/20">
                                        <History size={24} className="text-purple-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Histórico do Pedido</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {orders.find(o => o.id === selectedOrderHistory)?.orderNumber}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-6 space-y-6">
                                {getOrderHistoryEntries(selectedOrderHistory).length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        Nenhum histórico encontrado para este pedido.
                                    </div>
                                ) : (
                                    <div className="relative border-l border-border ml-3 space-y-8">
                                        {getOrderHistoryEntries(selectedOrderHistory).map((entry, i) => (
                                            <div key={entry.id || i} className="relative pl-8">
                                                <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-border ring-4 ring-card" />
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                                        <span className="font-mono">{new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
                                                        <span>•</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider 
                                                        ${entry.action === 'created' ? 'bg-green-500/10 text-green-500' :
                                                                entry.action === 'updated' ? 'bg-blue-500/10 text-blue-500' :
                                                                    entry.action === 'status_changed' ? 'bg-amber-500/10 text-amber-500' :
                                                                        entry.action === 'deleted' ? 'bg-red-500/10 text-red-500' :
                                                                            'bg-secondary text-muted-foreground'}`}>
                                                            {entry.action === 'created' && 'Criado'}
                                                            {entry.action === 'updated' && 'Editado'}
                                                            {entry.action === 'status_changed' && 'Status'}
                                                            {entry.action === 'deleted' && 'Excluído'}
                                                            {entry.action === 'duplicated' && 'Duplicado'}
                                                        </span>
                                                    </div>
                                                    <p className="font-medium text-foreground">{entry.description}</p>

                                                    {entry.changes && entry.changes.length > 0 && (
                                                        <div className="mt-2 text-sm bg-secondary/30 rounded-lg p-3 space-y-1">
                                                            {entry.changes.map((change, idx) => (
                                                                <div key={idx} className="flex gap-2">
                                                                    <span className="text-muted-foreground">{change.field}:</span>
                                                                    <span className="line-through text-red-400/70">{change.oldValue}</span>
                                                                    <span className="text-muted-foreground">→</span>
                                                                    <span className="text-green-400">{change.newValue}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

