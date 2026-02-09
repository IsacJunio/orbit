import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Trash2, Users, Building2, User, Download, Pencil, Copy, Check, Hash, ChevronDown, X, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'

interface Supplier {
    id: string
    name: string
    company: string
    sapCode: string
    email?: string
    phone?: string
}

interface SelectedColumn {
    id: string
    supplierId: string
}

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [copiedCode, setCopiedCode] = useState<string | null>(null)
    const [newSupplier, setNewSupplier] = useState({ name: '', company: '', sapCode: '', email: '', phone: '' })
    const [editingId, setEditingId] = useState<string | null>(null)

    // Colunas selecionadas para a tabela
    const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([])

    useEffect(() => {
        loadSuppliers()
        loadSelectedColumns()
    }, [])

    async function loadSuppliers() {
        try {
            const data = await window.api.db.get('suppliers')
            if (data) {
                const migrated = data.map((s: Supplier) => ({
                    ...s,
                    sapCode: s.sapCode || '',
                    email: s.email || '',
                    phone: s.phone || ''
                }))
                setSuppliers(migrated)
            }
        } catch (error) {
            console.error('Failed to load suppliers:', error)
            toast.error('Erro ao carregar fornecedores')
        }
    }

    async function loadSelectedColumns() {
        try {
            const data = await window.api.db.get('supplierColumns')
            if (data) setSelectedColumns(data)
        } catch (error) {
            console.error('Failed to load columns:', error)
        }
    }

    async function saveSelectedColumns(columns: SelectedColumn[]) {
        try {
            await window.api.db.set('supplierColumns', columns)
        } catch (error) {
            console.error('Failed to save columns:', error)
        }
    }

    async function handleAddSupplier() {
        if (!newSupplier.name || !newSupplier.company) {
            toast.error('Preencha nome e empresa')
            return
        }

        try {
            const supplier: Supplier = {
                id: crypto.randomUUID(),
                name: newSupplier.name,
                company: newSupplier.company,
                sapCode: newSupplier.sapCode,
                email: newSupplier.email,
                phone: newSupplier.phone
            }
            await window.api.db.add('suppliers', supplier)
            setNewSupplier({ name: '', company: '', sapCode: '', email: '', phone: '' })
            setIsModalOpen(false)
            loadSuppliers()
            toast.success('Fornecedor adicionado com sucesso')
        } catch (error) {
            console.error('Failed to add supplier:', error)
            toast.error('Erro ao adicionar fornecedor')
        }
    }

    async function handleUpdateSupplier() {
        if (!editingId || !newSupplier.name || !newSupplier.company) {
            toast.error('Preencha nome e empresa')
            return
        }

        try {
            const supplier: Supplier = {
                id: editingId,
                name: newSupplier.name,
                company: newSupplier.company,
                sapCode: newSupplier.sapCode,
                email: newSupplier.email,
                phone: newSupplier.phone
            }
            await window.api.db.update('suppliers', editingId, supplier)
            setNewSupplier({ name: '', company: '', sapCode: '', email: '', phone: '' })
            setEditingId(null)
            setIsEditing(false)
            setIsModalOpen(false)
            loadSuppliers()
            toast.success('Fornecedor atualizado com sucesso')
        } catch (error) {
            console.error('Failed to update supplier:', error)
            toast.error('Erro ao atualizar fornecedor')
        }
    }

    async function handleDeleteSupplier(id: string) {
        if (!confirm('Tem certeza que deseja remover este fornecedor?')) return
        try {
            await window.api.db.delete('suppliers', id)
            // Remove das colunas selecionadas também
            const updatedColumns = selectedColumns.filter(c => c.supplierId !== id)
            setSelectedColumns(updatedColumns)
            saveSelectedColumns(updatedColumns)
            loadSuppliers()
            toast.success('Fornecedor removido')
        } catch (error) {
            console.error('Failed to delete supplier:', error)
            toast.error('Erro ao remover fornecedor')
        }
    }

    function handleOpenEditModal(supplier: Supplier) {
        setNewSupplier({
            name: supplier.name,
            company: supplier.company,
            sapCode: supplier.sapCode || '',
            email: supplier.email || '',
            phone: supplier.phone || ''
        })
        setEditingId(supplier.id)
        setIsEditing(true)
        setIsModalOpen(true)
    }

    function closeModal() {
        setIsModalOpen(false)
        setIsEditing(false)
        setEditingId(null)
        setNewSupplier({ name: '', company: '', sapCode: '', email: '', phone: '' })
    }

    // Funções para gerenciar colunas
    function addColumn() {
        const newColumn: SelectedColumn = {
            id: crypto.randomUUID(),
            supplierId: ''
        }
        const updated = [...selectedColumns, newColumn]
        setSelectedColumns(updated)
        saveSelectedColumns(updated)
    }

    function addAllColumns() {
        // Filtrar fornecedores que já estão na lista
        const existingSupplierIds = selectedColumns.map(c => c.supplierId)
        const newSuppliers = suppliers.filter(s => !existingSupplierIds.includes(s.id))

        if (newSuppliers.length === 0) {
            toast.info('Todos os fornecedores já estão na lista')
            return
        }

        const newColumns: SelectedColumn[] = newSuppliers.map(s => ({
            id: crypto.randomUUID(),
            supplierId: s.id
        }))

        const updated = [...selectedColumns, ...newColumns]
        setSelectedColumns(updated)
        saveSelectedColumns(updated)
        toast.success(`${newSuppliers.length} fornecedor(es) adicionado(s) à lista`)
    }

    function removeColumn(columnId: string) {
        const updated = selectedColumns.filter(c => c.id !== columnId)
        setSelectedColumns(updated)
        saveSelectedColumns(updated)
    }

    function updateColumnSupplier(columnId: string, supplierId: string) {
        const updated = selectedColumns.map(c =>
            c.id === columnId ? { ...c, supplierId } : c
        )
        setSelectedColumns(updated)
        saveSelectedColumns(updated)
    }

    function getSupplierById(id: string): Supplier | undefined {
        return suppliers.find(s => s.id === id)
    }

    const copySapCode = useCallback((sapCode: string) => {
        if (!sapCode) {
            toast.error('Código SAP não definido')
            return
        }
        navigator.clipboard.writeText(sapCode)
        setCopiedCode(sapCode)
        toast.success('Código SAP copiado!')
        setTimeout(() => setCopiedCode(null), 2000)
    }, [])

    function downloadColumnsList() {
        const columnsWithSuppliers = selectedColumns
            .map(col => getSupplierById(col.supplierId))
            .filter(Boolean) as Supplier[]

        if (columnsWithSuppliers.length === 0) {
            toast.error('Nenhum fornecedor selecionado para exportar')
            return
        }

        // CSV format with BOM for Excel compatibility
        const headers = ['Código SAP', 'Nome', 'Empresa', 'Email', 'Telefone']
        const rows = columnsWithSuppliers.map(s => [
            s.sapCode || '',
            s.name,
            s.company,
            s.email || '',
            s.phone || ''
        ])

        const csvContent = '\uFEFF' + [
            headers.join(';'),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
        ].join('\r\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `fornecedores_selecionados_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success(`${columnsWithSuppliers.length} fornecedor(es) exportado(s)`)
    }

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.sapCode && s.sapCode.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Fornecedores</h2>
                    <p className="text-muted-foreground text-sm">Gerencie sua lista de contatos e empresas parceiras.</p>
                </div>
                <button
                    onClick={() => {
                        setIsEditing(false)
                        setEditingId(null)
                        setNewSupplier({ name: '', company: '', sapCode: '', email: '', phone: '' })
                        setIsModalOpen(true)
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 rounded-full font-medium transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 flex items-center gap-2 text-sm"
                >
                    <Plus size={16} />
                    Novo Fornecedor
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                    type="text"
                    placeholder="Buscar fornecedores ou empresas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-card/50 border border-border/50 rounded-xl pl-10 h-12 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
            </div>

            {/* Grid de Fornecedores */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredSuppliers.map(supplier => (
                    <div key={supplier.id} className="group bg-card/50 border border-border/50 hover:border-primary/50 p-4 rounded-xl transition-all relative">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <User size={20} />
                                </div>
                                <div>
                                    {/* SAP Code Badge - Clicável para copiar */}
                                    {supplier.sapCode && (
                                        <button
                                            onClick={() => copySapCode(supplier.sapCode)}
                                            className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded mb-1 transition-all cursor-pointer ${copiedCode === supplier.sapCode
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                                }`}
                                            title="Clique para copiar código SAP"
                                        >
                                            {copiedCode === supplier.sapCode ? (
                                                <>
                                                    <Check size={10} />
                                                    Copiado!
                                                </>
                                            ) : (
                                                <>
                                                    <Hash size={10} />
                                                    {supplier.sapCode}
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <h3 className="font-medium text-foreground">{supplier.name}</h3>
                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                                        <Building2 size={12} />
                                        <span>{supplier.company}</span>
                                    </div>
                                    {/* Email and Phone */}
                                    {(supplier.email || supplier.phone) && (
                                        <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                                            {supplier.email && (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Mail size={11} className="text-blue-400" />
                                                    <span className="truncate">{supplier.email}</span>
                                                </div>
                                            )}
                                            {supplier.phone && (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Phone size={11} className="text-green-400" />
                                                    <span>{supplier.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleOpenEditModal(supplier)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-blue-400 transition-all rounded-lg hover:bg-blue-500/10"
                                    title="Editar fornecedor"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteSupplier(supplier.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-red-400 transition-all rounded-lg hover:bg-red-500/10"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredSuppliers.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-card/30 rounded-xl border border-border/30 border-dashed">
                        <Users size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Nenhum fornecedor encontrado.</p>
                    </div>
                )}
            </div>

            {/* Seção de Lista de Códigos SAP */}
            <div className="bg-card/50 border border-border/50 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Lista de Códigos SAP</h3>
                        <p className="text-sm text-muted-foreground">Selecione fornecedores para montar sua lista. Clique no código para copiar.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={addColumn}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all text-sm font-medium"
                        >
                            <Plus size={16} />
                            Adicionar
                        </button>
                        <button
                            onClick={addAllColumns}
                            disabled={suppliers.length === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Adicionar todos os fornecedores à lista"
                        >
                            <Users size={16} />
                            Adicionar Todos
                        </button>
                        <button
                            onClick={downloadColumnsList}
                            disabled={selectedColumns.length === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Download size={16} />
                            Download
                        </button>
                    </div>
                </div>

                {/* Lista de Colunas */}
                {selectedColumns.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border/50">
                                    <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Código SAP</th>
                                    <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Fornecedor</th>
                                    <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Empresa</th>
                                    <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Email</th>
                                    <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Telefone</th>
                                    <th className="w-16"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedColumns.map((column) => {
                                    const selectedSupplier = getSupplierById(column.supplierId)
                                    return (
                                        <tr key={column.id} className="border-b border-border/30 hover:bg-white/5 transition-colors">
                                            {/* Código SAP - Clicável */}
                                            <td className="py-3 px-4">
                                                {selectedSupplier?.sapCode ? (
                                                    <button
                                                        onClick={() => copySapCode(selectedSupplier.sapCode)}
                                                        className={`flex items-center gap-2 font-mono text-sm px-3 py-1.5 rounded-lg transition-all ${copiedCode === selectedSupplier.sapCode
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 cursor-pointer'
                                                            }`}
                                                        title="Clique para copiar"
                                                    >
                                                        {copiedCode === selectedSupplier.sapCode ? (
                                                            <>
                                                                <Check size={14} />
                                                                Copiado!
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Hash size={14} />
                                                                {selectedSupplier.sapCode}
                                                                <Copy size={12} className="opacity-60" />
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </td>

                                            {/* Seletor de Fornecedor */}
                                            <td className="py-3 px-4">
                                                <div className="relative">
                                                    <select
                                                        value={column.supplierId}
                                                        onChange={(e) => updateColumnSupplier(column.id, e.target.value)}
                                                        className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 pr-10 text-sm appearance-none cursor-pointer focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                                    >
                                                        <option value="">Selecione um fornecedor...</option>
                                                        {suppliers.map(s => (
                                                            <option key={s.id} value={s.id}>
                                                                {s.sapCode ? `[${s.sapCode}] ` : ''}{s.name} - {s.company}{s.email ? ` (${s.email})` : ''}{s.phone ? ` | ${s.phone}` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                                </div>
                                            </td>

                                            {/* Empresa */}
                                            <td className="py-3 px-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {selectedSupplier?.company || '-'}
                                                </span>
                                            </td>

                                            {/* Email */}
                                            <td className="py-3 px-4">
                                                {selectedSupplier?.email ? (
                                                    <div className="flex items-center gap-1.5 text-sm text-blue-400">
                                                        <Mail size={12} />
                                                        <span className="truncate max-w-[150px]">{selectedSupplier.email}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </td>

                                            {/* Telefone */}
                                            <td className="py-3 px-4">
                                                {selectedSupplier?.phone ? (
                                                    <div className="flex items-center gap-1.5 text-sm text-green-400">
                                                        <Phone size={12} />
                                                        <span>{selectedSupplier.phone}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </td>

                                            {/* Botão Remover */}
                                            <td className="py-3 px-4">
                                                <button
                                                    onClick={() => removeColumn(column.id)}
                                                    className="p-2 text-muted-foreground hover:text-red-400 transition-all rounded-lg hover:bg-red-500/10"
                                                    title="Remover coluna"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-8 text-center text-muted-foreground border border-border/30 border-dashed rounded-lg">
                        <Hash size={32} className="mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Nenhum item na lista.</p>
                        <p className="text-xs mt-1">Clique em "Adicionar" para começar.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold">
                                {isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                            </h3>
                            <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* SAP Code Field */}
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Código SAP</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Ex: 100001"
                                        value={newSupplier.sapCode}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, sapCode: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg pl-9 h-10 text-sm focus:ring-1 focus:ring-primary font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Nome do Contato</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Ex: Eduardo"
                                        value={newSupplier.name}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg pl-9 h-10 text-sm focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Nome da Empresa</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Ex: Cofermeta"
                                        value={newSupplier.company}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, company: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg pl-9 h-10 text-sm focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Email de Contato</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="email"
                                        placeholder="Ex: contato@empresa.com"
                                        value={newSupplier.email}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg pl-9 h-10 text-sm focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            {/* Telefone */}
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Telefone de Contato</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="tel"
                                        placeholder="Ex: (31) 99999-9999"
                                        value={newSupplier.phone}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg pl-9 h-10 text-sm focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={isEditing ? handleUpdateSupplier : handleAddSupplier}
                                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-lg shadow-primary/20 transition-all"
                            >
                                {isEditing ? 'Salvar Alterações' : 'Salvar Fornecedor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
