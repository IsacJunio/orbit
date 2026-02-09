import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, FolderOpen, FileText, ChevronLeft, Upload, Folder, Image, File, ExternalLink } from 'lucide-react'

interface Document {
    id: string
    name: string
    type: string
    category: string
    orderNumber?: string
    files?: DocumentFile[]
    notes?: string
    createdAt: string
}

interface DocumentFile {
    id: string
    name: string
    path?: string
    addedAt: string
}

interface RealFile {
    name: string
    path: string
}

export default function Documents() {
    const [documents, setDocuments] = useState<Document[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [currentFolder, setCurrentFolder] = useState<Document | null>(null)
    const [currentFolderFiles, setCurrentFolderFiles] = useState<RealFile[]>([])
    // Removed isAddFileModalOpen, newDoc is used for Folder creation, newFileName removed
    const [newDoc, setNewDoc] = useState({ name: '', category: 'Geral' })
    const [searchTerm, setSearchTerm] = useState('')
    const [realFileCounts, setRealFileCounts] = useState<Record<string, number>>({})

    useEffect(() => {
        loadDocuments()
    }, [])

    useEffect(() => {
        if (currentFolder) {
            loadFolderFiles()
        }
    }, [currentFolder])

    async function loadDocuments() {
        try {
            const data = await window.api.db.get('documents')
            setDocuments(data || [])

            // Load real file counts for order folders
            const counts: Record<string, number> = {}
            for (const doc of (data || [])) {
                if (doc.orderNumber) {
                    try {
                        const files = await window.api.file.getOrderFiles(doc.orderNumber)
                        counts[doc.id] = files?.length || 0
                    } catch {
                        counts[doc.id] = 0
                    }
                } else {
                    counts[doc.id] = doc.files?.length || 0
                }
            }
            setRealFileCounts(counts)
        } catch (error) {
            console.error('Failed to load documents:', error)
        }
    }

    async function loadFolderFiles() {
        if (!currentFolder) return

        if (currentFolder.orderNumber) {
            // Load real files from filesystem
            try {
                const files = await window.api.file.getOrderFiles(currentFolder.orderNumber)
                setCurrentFolderFiles(files || [])
            } catch {
                setCurrentFolderFiles([])
            }
        } else {
            // Use files from database
            setCurrentFolderFiles(
                (currentFolder.files || []).map(f => ({
                    name: f.name,
                    path: f.path || ''
                }))
            )
        }
    }

    async function handleAddFolder(e: React.FormEvent) {
        e.preventDefault()
        if (!newDoc.name) return

        try {
            await window.api.db.add('documents', {
                name: newDoc.name,
                type: 'folder',
                category: newDoc.category,
                files: [],
                createdAt: new Date().toISOString()
            })
            setIsModalOpen(false)
            setNewDoc({ name: '', category: 'Geral' })
            loadDocuments()
        } catch (error) {
            console.error('Failed to add folder:', error)
        }
    }

    async function handleAttachGeneralFile() {
        if (!currentFolder) return

        try {
            const result = await window.api.file.attachGeneralFiles(currentFolder.id)
            if (result.success && result.files.length > 0) {
                const newFiles = result.files.map((f: { name: string, path: string }) => ({
                    id: crypto.randomUUID(),
                    name: f.name,
                    path: f.path,
                    addedAt: new Date().toISOString()
                }))

                const updatedFiles = [...(currentFolder.files || []), ...newFiles]
                await window.api.db.update('documents', currentFolder.id, { files: updatedFiles })

                loadDocuments()

                // Refresh current folder
                const docs = await window.api.db.get('documents')
                const updated = docs.find((d: Document) => d.id === currentFolder.id)
                if (updated) {
                    setCurrentFolder(updated)
                }
            }
        } catch (error) {
            console.error('Failed to attach general file:', error)
        }
    }

    async function handleAttachRealFile() {
        if (!currentFolder?.orderNumber) return

        try {
            const result = await window.api.file.attachFiles(currentFolder.orderNumber)
            if (result.success) {
                loadFolderFiles()
                loadDocuments()
            }
        } catch (error) {
            console.error('Failed to attach file:', error)
        }
    }

    async function deleteDocument(id: string) {
        try {
            await window.api.db.delete('documents', id)
            loadDocuments()
            if (currentFolder?.id === id) {
                setCurrentFolder(null)
            }
        } catch (error) {
            console.error('Failed to delete document:', error)
        }
    }

    async function deleteFile(fileId: string) {
        if (!currentFolder) return
        try {
            const updatedFiles = (currentFolder.files || []).filter(f => f.id !== fileId)
            await window.api.db.update('documents', currentFolder.id, { files: updatedFiles })
            loadDocuments()
            setCurrentFolder({ ...currentFolder, files: updatedFiles })
            loadFolderFiles()
        } catch (error) {
            console.error('Failed to delete file:', error)
        }
    }

    async function openFile(path: string) {
        try {
            await window.api.file.openFile(path)
        } catch (error) {
            console.error('Failed to open file:', error)
        }
    }

    async function openOrderFolder() {
        if (!currentFolder?.orderNumber) return
        try {
            await window.api.file.openOrderFolder(currentFolder.orderNumber)
        } catch (error) {
            console.error('Failed to open folder:', error)
        }
    }

    function getFileIcon(fileName: string) {
        const ext = fileName.split('.').pop()?.toLowerCase()
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']

        if (imageExts.includes(ext || '')) {
            return <Image size={20} className="text-green-400" />
        }
        if (ext === 'pdf') {
            return <FileText size={20} className="text-red-400" />
        }
        if (['doc', 'docx'].includes(ext || '')) {
            return <FileText size={20} className="text-blue-400" />
        }
        if (['xls', 'xlsx'].includes(ext || '')) {
            return <FileText size={20} className="text-emerald-400" />
        }
        return <File size={20} className="text-primary" />
    }

    const categories = ['Geral', 'Financeiro', 'Contratos', 'Pessoal', 'Projetos']

    const filteredDocs = documents.filter(doc =>
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Group folders by category
    const groupedDocs = filteredDocs.reduce((acc, doc) => {
        const cat = doc.category || 'Geral'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(doc)
        return acc
    }, {} as Record<string, Document[]>)

    // Folder view
    if (currentFolder) {
        const isOrderFolder = !!currentFolder.orderNumber

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => { setCurrentFolder(null); setCurrentFolderFiles([]); }}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                <FolderOpen size={24} className="text-primary" />
                                {currentFolder.name}
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                {currentFolder.orderNumber ? `Pedido SAP: ${currentFolder.orderNumber}` : currentFolder.category}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isOrderFolder && (
                            <button
                                onClick={openOrderFolder}
                                className="h-10 px-4 rounded-full font-medium transition-all border border-border hover:bg-white/5 flex items-center gap-2 text-sm"
                            >
                                <ExternalLink size={16} />
                                Abrir Pasta
                            </button>
                        )}
                        <button
                            onClick={isOrderFolder ? handleAttachRealFile : handleAttachGeneralFile}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 rounded-full font-medium transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 flex items-center gap-2 text-sm"
                        >
                            <Plus size={16} />
                            {isOrderFolder ? 'Anexar Arquivo' : 'Adicionar Arquivo'}
                        </button>
                    </div>
                </div>

                {/* Files Grid */}
                <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
                    {currentFolderFiles.length === 0 ? (
                        <div className="text-center py-12">
                            <Upload size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground">Nenhum arquivo nesta pasta.</p>
                            <p className="text-sm text-muted-foreground/60 mt-1">
                                {isOrderFolder
                                    ? 'Clique em "Anexar Arquivo" para adicionar documentos ou imagens.'
                                    : 'Clique em "Adicionar Arquivo" para começar.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {currentFolderFiles.map((file, index) => (
                                <div
                                    key={index}
                                    onClick={() => file.path && openFile(file.path)}
                                    className="group rounded-xl border border-border/50 bg-card/50 p-4 hover:border-primary/30 transition-all cursor-pointer"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-white/5">
                                            {getFileIcon(file.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-foreground text-sm truncate" title={file.name}>
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Clique para abrir
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>


            </div>
        )
    }

    // Main folder list view
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Documentos</h2>
                    <p className="text-muted-foreground text-sm">Organize e gerencie seus arquivos.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 rounded-full font-medium transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 flex items-center gap-2 text-sm"
                >
                    <Plus size={16} />
                    Nova Pasta
                </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4 bg-card/50 p-2 rounded-xl border border-border/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar pastas..."
                        className="w-full bg-transparent border-none focus:ring-0 pl-10 text-sm h-10 placeholder:text-muted-foreground/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Folders by Category */}
            {Object.keys(groupedDocs).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
                    <Folder size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Nenhuma pasta encontrada.</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Crie uma pasta ou adicione um pedido de compra.</p>
                </div>
            ) : (
                Object.entries(groupedDocs).map(([category, docs]) => (
                    <div key={category} className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <FolderOpen size={16} />
                            {category} ({docs.length})
                        </h3>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {docs.map((doc) => (
                                <div
                                    key={doc.id}
                                    onClick={() => setCurrentFolder(doc)}
                                    className="group rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 hover:border-primary/30 transition-all cursor-pointer"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                            <Folder size={20} className="text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-foreground truncate">{doc.name}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {realFileCounts[doc.id] ?? (doc.files?.length || 0)} arquivo(s)
                                            </p>
                                            {doc.orderNumber && (
                                                <p className="text-xs text-primary/70 mt-1">SAP: {doc.orderNumber}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {/* Create Folder Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Nova Pasta</h3>
                        <form onSubmit={handleAddFolder} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nome da Pasta</label>
                                <input
                                    type="text"
                                    className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                    placeholder="Ex: Contratos 2024"
                                    value={newDoc.name}
                                    onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Categoria</label>
                                <select
                                    className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                    value={newDoc.category}
                                    onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                                >
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 h-10 rounded-lg font-medium hover:bg-white/5 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    Criar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
