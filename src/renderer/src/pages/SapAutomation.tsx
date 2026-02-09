import { useState, useEffect, useRef } from 'react'
import { Play, RefreshCw, Terminal, Zap, CheckCircle, XCircle, Loader2, FileCode, Settings2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

interface Script {
    name: string
    displayName: string
    description: string
    params: { name: string; label: string; placeholder: string; type?: 'text' | 'orderSelect' }[]
}

interface Order {
    id: string
    orderNumber: string
    description?: string
    supplier?: string
}

const availableScripts: Script[] = [
    {
        name: 'me21n_criar_pedido',
        displayName: 'ME21N - Criar Pedido',
        description: 'Abre a transação ME21N para criar um novo pedido de compra',
        params: []
    },
    {
        name: 'me22n_modificar_pedido',
        displayName: 'ME22N - Modificar Pedido',
        description: 'Abre a transação ME22N para modificar um pedido existente',
        params: [{ name: 'orderNumber', label: 'Número do Pedido', placeholder: 'Digite ou selecione um pedido', type: 'orderSelect' }]
    },
    {
        name: 'me23n_exibir_pedido',
        displayName: 'ME23N - Exibir Pedido',
        description: 'Abre a transação ME23N para visualizar um pedido',
        params: [{ name: 'orderNumber', label: 'Número do Pedido', placeholder: 'Digite ou selecione um pedido', type: 'orderSelect' }]
    },
    {
        name: 'verificar_conexao',
        displayName: 'Verificar Conexão',
        description: 'Verifica se o SAP GUI está aberto e conectado',
        params: []
    }
]

// Order Select Combobox Component
function OrderSelectInput({
    value,
    onChange,
    placeholder,
    orders
}: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    orders: Order[]
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Filter orders based on search
    const filteredOrders = orders.filter(order =>
        order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        (order.description && order.description.toLowerCase().includes(search.toLowerCase())) ||
        (order.supplier && order.supplier.toLowerCase().includes(search.toLowerCase()))
    )

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Sync search with external value
    useEffect(() => {
        setSearch(value)
    }, [value])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setSearch(newValue)
        onChange(newValue)
        setIsOpen(true)
    }

    const handleSelectOrder = (order: Order) => {
        setSearch(order.orderNumber)
        onChange(order.orderNumber)
        setIsOpen(false)
    }

    return (
        <div className="relative">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={search}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    className="w-full mt-1 px-3 py-2 pr-8 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-white transition-colors"
                >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg bg-card border border-border shadow-xl"
                >
                    {filteredOrders.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                            {orders.length === 0 ? 'Nenhum pedido cadastrado' : 'Nenhum pedido encontrado'}
                        </div>
                    ) : (
                        filteredOrders.slice(0, 10).map((order) => (
                            <button
                                key={order.id}
                                type="button"
                                onClick={() => handleSelectOrder(order)}
                                className="w-full px-3 py-2 text-left hover:bg-primary/10 transition-colors flex items-center justify-between"
                            >
                                <div>
                                    <span className="text-sm font-medium text-white">{order.orderNumber}</span>
                                    {order.description && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {order.description.substring(0, 30)}{order.description.length > 30 ? '...' : ''}
                                        </span>
                                    )}
                                </div>
                                {order.supplier && (
                                    <span className="text-xs text-primary/70">{order.supplier}</span>
                                )}
                            </button>
                        ))
                    )}
                    {filteredOrders.length > 10 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                            +{filteredOrders.length - 10} mais resultados
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function SapAutomation() {
    const [isConnected, setIsConnected] = useState<boolean | null>(null)
    const [isChecking, setIsChecking] = useState(false)
    const [executingScript, setExecutingScript] = useState<string | null>(null)
    const [logs, setLogs] = useState<{ time: string; message: string; type: 'info' | 'success' | 'error' }[]>([])
    const [paramValues, setParamValues] = useState<Record<string, string>>({})
    const [orders, setOrders] = useState<Order[]>([])

    // Load orders from database
    useEffect(() => {
        const loadOrders = async () => {
            try {
                const ordersData = await window.api.db.get('orders')
                if (Array.isArray(ordersData)) {
                    setOrders(ordersData.map(o => ({
                        id: o.id,
                        orderNumber: o.orderNumber || o.number || '',
                        description: o.description || o.title || '',
                        supplier: o.supplier || o.supplierName || ''
                    })).filter(o => o.orderNumber))
                }
            } catch (error) {
                console.error('Error loading orders:', error)
            }
        }
        loadOrders()
    }, [])

    const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        const time = new Date().toLocaleTimeString('pt-BR')
        setLogs(prev => [...prev, { time, message, type }])
    }

    const checkConnection = async () => {
        setIsChecking(true)
        addLog('Verificando conexão com SAP GUI...', 'info')

        try {
            const result = await window.api.sap.checkConnection()
            setIsConnected(result.connected)

            if (result.connected) {
                addLog('✓ SAP GUI conectado com sucesso!', 'success')
                toast.success('SAP GUI conectado!')
            } else {
                addLog('✗ SAP GUI não encontrado ou não está logado', 'error')
                toast.error('SAP GUI não conectado')
            }
        } catch (error: any) {
            setIsConnected(false)
            addLog(`✗ Erro: ${error.message || 'Falha ao verificar conexão'}`, 'error')
            toast.error('Erro ao verificar conexão')
        } finally {
            setIsChecking(false)
        }
    }

    const executeScript = async (script: Script) => {
        const params = script.params.map(p => paramValues[`${script.name}_${p.name}`] || '')

        // Validate required params
        for (const param of script.params) {
            const value = paramValues[`${script.name}_${param.name}`]
            if (!value) {
                toast.error(`Preencha o campo: ${param.label}`)
                return
            }
        }

        setExecutingScript(script.name)
        addLog(`Executando: ${script.displayName}...`, 'info')

        try {
            const result = await window.api.sap.executeScript(script.name, params)

            if (result.error) {
                addLog(`✗ Erro: ${result.error}`, 'error')
                toast.error('Erro na execução')
            } else {
                addLog(`✓ ${script.displayName} executado com sucesso`, 'success')
                if (result.output) {
                    addLog(`Saída: ${result.output}`, 'info')
                }
                toast.success('Script executado!')
            }
        } catch (error: any) {
            addLog(`✗ Erro: ${error.message || 'Falha na execução'}`, 'error')
            toast.error('Erro ao executar script')
        } finally {
            setExecutingScript(null)
        }
    }

    const clearLogs = () => {
        setLogs([])
    }

    useEffect(() => {
        // Check connection on mount
        checkConnection()
    }, [])

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 ring-1 ring-amber-500/30">
                        <Zap className="h-8 w-8 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Automação SAP</h1>
                        <p className="text-muted-foreground mt-1">Execute scripts VBScript para controlar o SAP GUI</p>
                    </div>
                </div>

                {/* Connection Status */}
                <button
                    onClick={checkConnection}
                    disabled={isChecking}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
                >
                    {isChecking ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : isConnected === true ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : isConnected === false ? (
                        <XCircle className="h-5 w-5 text-red-400" />
                    ) : (
                        <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                        {isChecking ? 'Verificando...' : isConnected === true ? 'Conectado' : isConnected === false ? 'Desconectado' : 'Verificar'}
                    </span>
                </button>
            </div>

            {/* Warning Banner */}
            {isConnected === false && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-red-300 font-medium">SAP GUI não detectado</p>
                        <p className="text-red-300/70 text-sm mt-1">
                            Certifique-se de que o SAP GUI está aberto e você está logado.
                            Verifique também se o scripting está habilitado em: Opções → Acessibilidade → Habilitar scripting.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Scripts Panel */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <FileCode className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-white">Scripts Disponíveis</h2>
                    </div>

                    {availableScripts.map((script) => (
                        <div
                            key={script.name}
                            className="p-4 rounded-xl bg-card/50 border border-border hover:border-primary/30 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white">{script.displayName}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{script.description}</p>

                                    {/* Parameters */}
                                    {script.params.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {script.params.map((param) => (
                                                <div key={param.name}>
                                                    <label className="text-xs text-muted-foreground">{param.label}</label>
                                                    {param.type === 'orderSelect' ? (
                                                        <OrderSelectInput
                                                            value={paramValues[`${script.name}_${param.name}`] || ''}
                                                            onChange={(value) => setParamValues(prev => ({
                                                                ...prev,
                                                                [`${script.name}_${param.name}`]: value
                                                            }))}
                                                            placeholder={param.placeholder}
                                                            orders={orders}
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            placeholder={param.placeholder}
                                                            value={paramValues[`${script.name}_${param.name}`] || ''}
                                                            onChange={(e) => setParamValues(prev => ({
                                                                ...prev,
                                                                [`${script.name}_${param.name}`]: e.target.value
                                                            }))}
                                                            className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => executeScript(script)}
                                    disabled={executingScript !== null || isConnected === false}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {executingScript === script.name ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Play className="h-4 w-4" />
                                    )}
                                    <span className="text-sm font-medium">Executar</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Console Panel */}
                <div className="flex flex-col h-[500px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold text-white">Console</h2>
                        </div>
                        <button
                            onClick={clearLogs}
                            className="text-xs text-muted-foreground hover:text-white transition-colors"
                        >
                            Limpar
                        </button>
                    </div>

                    <div className="flex-1 rounded-xl bg-black/50 border border-border p-4 overflow-y-auto font-mono text-sm">
                        {logs.length === 0 ? (
                            <p className="text-muted-foreground">Aguardando execução...</p>
                        ) : (
                            logs.map((log, index) => (
                                <div
                                    key={index}
                                    className={`py-1 ${log.type === 'error' ? 'text-red-400' :
                                        log.type === 'success' ? 'text-green-400' :
                                            'text-gray-300'
                                        }`}
                                >
                                    <span className="text-muted-foreground">[{log.time}]</span> {log.message}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
                <Settings2 className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="text-blue-300 font-medium">Como usar</p>
                    <ul className="text-blue-300/70 text-sm mt-1 space-y-1 list-disc list-inside">
                        <li>Abra e faça login no SAP GUI antes de executar scripts</li>
                        <li>Não mova o mouse ou clique durante a execução</li>
                        <li>Scripts são executados na sessão SAP ativa</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
