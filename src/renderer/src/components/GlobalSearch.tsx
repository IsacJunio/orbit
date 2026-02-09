import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Package, Users, FileText, CheckSquare, ArrowRight, Hash, Building2, X } from 'lucide-react'

interface SearchResult {
    id: string
    type: 'order' | 'supplier' | 'document' | 'task'
    title: string
    subtitle: string
    icon: typeof Package
    action: () => void
    sapCode?: string
}

interface GlobalSearchProps {
    isOpen: boolean
    onClose: () => void
    onNavigate: (path: string) => void
}

export default function GlobalSearch({ isOpen, onClose, onNavigate }: GlobalSearchProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setQuery('')
            setResults([])
            setSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isOpen])

    useEffect(() => {
        if (!query.trim()) {
            setResults([])
            return
        }

        const searchTimeout = setTimeout(async () => {
            setIsLoading(true)
            try {
                const searchResults: SearchResult[] = []
                const lowerQuery = query.toLowerCase()

                // Buscar pedidos
                const orders = await window.api.db.get('orders') || []
                orders.forEach((order: any) => {
                    if (
                        order.orderNumber?.toLowerCase().includes(lowerQuery) ||
                        order.vendor?.toLowerCase().includes(lowerQuery) ||
                        order.quoteNumber?.toLowerCase().includes(lowerQuery)
                    ) {
                        searchResults.push({
                            id: order.id,
                            type: 'order',
                            title: `Pedido ${order.orderNumber}`,
                            subtitle: order.vendor || 'Sem fornecedor',
                            icon: Package,
                            action: () => {
                                onNavigate('/orders')
                                onClose()
                            }
                        })
                    }
                })

                // Buscar fornecedores
                const suppliers = await window.api.db.get('suppliers') || []
                suppliers.forEach((supplier: any) => {
                    if (
                        supplier.name?.toLowerCase().includes(lowerQuery) ||
                        supplier.company?.toLowerCase().includes(lowerQuery) ||
                        supplier.sapCode?.toLowerCase().includes(lowerQuery)
                    ) {
                        searchResults.push({
                            id: supplier.id,
                            type: 'supplier',
                            title: supplier.name,
                            subtitle: supplier.company,
                            icon: Users,
                            sapCode: supplier.sapCode,
                            action: () => {
                                onNavigate('/suppliers')
                                onClose()
                            }
                        })
                    }
                })

                // Buscar tarefas
                const tasks = await window.api.db.get('tasks') || []
                tasks.forEach((task: any) => {
                    if (task.title?.toLowerCase().includes(lowerQuery)) {
                        searchResults.push({
                            id: task.id,
                            type: 'task',
                            title: task.title,
                            subtitle: task.completed ? 'Concluída' : 'Pendente',
                            icon: CheckSquare,
                            action: () => {
                                onNavigate('/tasks')
                                onClose()
                            }
                        })
                    }
                })

                // Buscar documentos
                const documents = await window.api.db.get('documents') || []
                documents.forEach((doc: any) => {
                    if (doc.name?.toLowerCase().includes(lowerQuery)) {
                        searchResults.push({
                            id: doc.id,
                            type: 'document',
                            title: doc.name,
                            subtitle: doc.category || 'Documento',
                            icon: FileText,
                            action: () => {
                                onNavigate('/documents')
                                onClose()
                            }
                        })
                    }
                })

                setResults(searchResults.slice(0, 10)) // Limitar a 10 resultados
            } catch (error) {
                console.error('Search error:', error)
            } finally {
                setIsLoading(false)
            }
        }, 200) // Debounce de 200ms

        return () => clearTimeout(searchTimeout)
    }, [query, onNavigate, onClose])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
                break
            case 'Enter':
                e.preventDefault()
                if (results[selectedIndex]) {
                    results[selectedIndex].action()
                }
                break
            case 'Escape':
                e.preventDefault()
                onClose()
                break
        }
    }, [results, selectedIndex, onClose])

    const copyToClipboard = useCallback((text: string, e: React.MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text)
    }, [])

    if (!isOpen) return null

    const typeLabels = {
        order: 'Pedido',
        supplier: 'Fornecedor',
        document: 'Documento',
        task: 'Tarefa'
    }

    const typeColors = {
        order: 'bg-blue-500/20 text-blue-400',
        supplier: 'bg-purple-500/20 text-purple-400',
        document: 'bg-amber-500/20 text-amber-400',
        task: 'bg-green-500/20 text-green-400'
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Input de busca */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
                    <Search size={20} className="text-muted-foreground shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Buscar pedidos, fornecedores, documentos, tarefas..."
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value)
                            setSelectedIndex(0)
                        }}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                        autoFocus
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-muted-foreground bg-secondary rounded">
                        ESC
                    </kbd>
                </div>

                {/* Resultados */}
                <div className="max-h-[50vh] overflow-y-auto">
                    {isLoading && (
                        <div className="p-4 text-center text-muted-foreground">
                            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                        </div>
                    )}

                    {!isLoading && query && results.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            <Search size={32} className="mx-auto mb-2 opacity-50" />
                            <p>Nenhum resultado para "{query}"</p>
                        </div>
                    )}

                    {!isLoading && results.length > 0 && (
                        <div className="py-2">
                            {results.map((result, index) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={result.action}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${index === selectedIndex
                                            ? 'bg-primary/10'
                                            : 'hover:bg-white/5'
                                        }`}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div className={`p-2 rounded-lg ${typeColors[result.type]}`}>
                                        <result.icon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-foreground truncate">
                                                {result.title}
                                            </span>
                                            {result.sapCode && (
                                                <button
                                                    onClick={(e) => copyToClipboard(result.sapCode!, e)}
                                                    className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
                                                    title="Clique para copiar"
                                                >
                                                    <Hash size={10} />
                                                    {result.sapCode}
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span className="truncate">{result.subtitle}</span>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${typeColors[result.type]}`}>
                                        {typeLabels[result.type]}
                                    </span>
                                    <ArrowRight size={16} className="text-muted-foreground shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Dicas quando vazio */}
                    {!query && (
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground text-center">
                                Digite para buscar em todos os módulos
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
                                    <Package size={12} /> Pedidos
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
                                    <Users size={12} /> Fornecedores
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
                                    <FileText size={12} /> Documentos
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
                                    <CheckSquare size={12} /> Tarefas
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rodapé com dicas de navegação */}
                {results.length > 0 && (
                    <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-secondary rounded">↑↓</kbd>
                            Navegar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-secondary rounded">Enter</kbd>
                            Abrir
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-secondary rounded">Esc</kbd>
                            Fechar
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}
