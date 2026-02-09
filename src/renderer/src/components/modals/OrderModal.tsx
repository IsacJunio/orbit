
import { useState, useEffect } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

interface OrderModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    editingOrder?: any // Type strictly if possible, but any for flexibility with legacy
}

export default function OrderModal({ isOpen, onClose, onSuccess, editingOrder }: OrderModalProps) {
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
    const [uniqueRequesters, setUniqueRequesters] = useState<string[]>([])

    const allStatuses = ['Pendente', 'Liberado', 'Em Trânsito', 'Entrega Parcial', 'Entregue', 'Cancelado']

    useEffect(() => {
        if (isOpen) {
            loadSuppliers()
            loadRequesters()
            if (editingOrder) {
                // Populate form
                let initialRequesters = editingOrder.requesters || []
                if (initialRequesters.length === 0 && editingOrder.requester) {
                    initialRequesters = [{ name: editingOrder.requester, items: 'Itens diversos' }]
                }

                setNewOrder({
                    orderNumber: editingOrder.orderNumber,
                    quoteNumber: editingOrder.quoteNumber || '',
                    vendor: editingOrder.vendor || '',
                    requesters: initialRequesters,
                    amount: editingOrder.amount?.toString() || '',
                    status: editingOrder.status
                })
            } else {
                // Reset form
                setNewOrder({
                    orderNumber: '',
                    quoteNumber: '',
                    vendor: '',
                    requesters: [],
                    amount: '',
                    status: 'Pendente'
                })
            }
            setTempRequester({ name: '', items: '' })
        }
    }, [isOpen, editingOrder])

    async function loadSuppliers() {
        try {
            const data = await window.api.db.get('suppliers')
            if (data) setSuppliers(data)
        } catch (error) {
            console.error('Failed to load suppliers:', error)
        }
    }

    async function loadRequesters() {
        try {
            const orders: any[] = await window.api.db.get('orders') || []
            const requesters = Array.from(new Set(
                orders.flatMap(o => {
                    const list: string[] = []
                    if (o.requester) list.push(o.requester)
                    if (o.requesters) list.push(...o.requesters.map((r: any) => r.name))
                    return list
                }).filter(Boolean)
            )) as string[]
            setUniqueRequesters(requesters)
        } catch (error) {
            console.error('Failed to load requesters:', error)
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()

        // Remove espaços antes e depois do número do pedido
        const trimmedOrderNumber = newOrder.orderNumber.trim()
        if (!trimmedOrderNumber) return

        try {
            const orderData = {
                ...newOrder,
                orderNumber: trimmedOrderNumber,
                amount: parseFloat(newOrder.amount) || 0,
                createdAt: editingOrder ? editingOrder.createdAt : new Date().toISOString()
            }

            if (editingOrder) {
                await window.api.db.update('orders', editingOrder.id, orderData)
            } else {
                await window.api.db.add('orders', orderData)
                // Create folder for documents
                try {
                    await window.api.db.add('documents', {
                        name: `Pedido ${newOrder.orderNumber}`,
                        type: 'folder',
                        category: 'Pedidos',
                        orderNumber: newOrder.orderNumber,
                        files: [],
                        createdAt: new Date().toISOString()
                    })
                } catch (err) {
                    console.warn('Folder might already exist or failed:', err)
                }
            }

            onSuccess()
            onClose()
        } catch (error) {
            console.error('Failed to save order:', error)
            alert('Erro ao salvar pedido.')
        }
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

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">{editingOrder ? 'Editar Pedido' : 'Novo Pedido de Compra'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nº do Pedido (SAP)</label>
                            <input
                                type="text"
                                className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all font-mono"
                                placeholder="Ex: 4500012345"
                                value={newOrder.orderNumber}
                                onChange={(e) => setNewOrder({ ...newOrder, orderNumber: e.target.value.replace(/\s/g, '') })}
                                onBlur={(e) => setNewOrder({ ...newOrder, orderNumber: e.target.value.trim() })}
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
                            onClick={onClose}
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
