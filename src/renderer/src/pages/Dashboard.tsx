import { useState, useEffect } from 'react'
import {
    Package,
    CheckSquare,
    FolderOpen,
    TrendingUp,
    Clock,
    FileText,
    AlertCircle,
    Plus,
    ArrowUpRight,
    DollarSign,
    Wallet,
    PieChart,
    ArrowRight,
    Users,
    AlertTriangle,
    CalendarDays
} from 'lucide-react'
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    CartesianGrid
} from 'recharts'
import { useNavigate } from 'react-router-dom'

import OrderModal from '../components/modals/OrderModal'
import TaskModal from '../components/modals/TaskModal'
import { checkDeadlines, type DeadlineAlert } from '../services/deadlineService'

interface Order {
    id: string
    orderNumber: string
    status: string
    createdAt: string
    amount?: number
    vendor?: string
}

interface Task {
    id: string
    title: string
    recurrence: string
    createdAt: string
    startTime?: string
}

interface Document {
    id: string
    name: string
    orderNumber?: string
    files?: any[]
}

interface OrderHistoryEntry {
    id: string
    orderId: string
    action: string
    timestamp: string
    newValue?: string
}

export default function Dashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingOrders: 0,
        deliveredOrders: 0,
        totalValue: 0,
        pendingValue: 0,
        averageTicket: 0,
        totalTasks: 0,
        totalDocuments: 0,
        recentOrders: [] as Order[],
        recentTasks: [] as Task[],
        statusDistribution: {
            pendente: 0,
            emTransito: 0,
            entregaParcial: 0,
            entregue: 0,
            cancelado: 0
        },
        leadTime: 0,
        onTimeRate: 0,
        trendData: [] as { name: string; total: number }[]
    })
    const [loading, setLoading] = useState(true)
    const [deadlineAlerts, setDeadlineAlerts] = useState<DeadlineAlert[]>([])
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)

    useEffect(() => {
        loadStats()
        loadAlerts()
    }, [])

    async function loadAlerts() {
        try {
            const alerts = await checkDeadlines()
            setDeadlineAlerts(alerts)
        } catch (error) {
            console.error('Failed to load deadline alerts:', error)
        }
    }

    async function loadStats() {
        try {
            // Load orders
            const orders: Order[] = await window.api.db.get('orders') || []

            // Financial calculations
            const totalValue = orders.reduce((acc, order) => acc + (Number(order.amount) || 0), 0)
            const pendingOrdersList = orders.filter(o => !['Entregue', 'Cancelado'].includes(o.status))
            const pendingValue = pendingOrdersList.reduce((acc, order) => acc + (Number(order.amount) || 0), 0)
            const averageTicket = orders.length > 0 ? totalValue / orders.length : 0

            // Status distribution
            const dist = {
                pendente: orders.filter(o => o.status === 'Pendente').length,
                emTransito: orders.filter(o => o.status === 'Em Trânsito').length,
                entregaParcial: orders.filter(o => o.status === 'Entrega Parcial').length,
                entregue: orders.filter(o => o.status === 'Entregue').length,
                cancelado: orders.filter(o => o.status === 'Cancelado').length
            }

            // Load tasks
            const tasks: Task[] = await window.api.db.get('tasks') || []

            // Load documents
            const documents: Document[] = await window.api.db.get('documents') || []

            // Count total files across all documents
            let totalFiles = 0
            for (const doc of documents) {
                if (doc.orderNumber) {
                    try {
                        const files = await window.api.file.getOrderFiles(doc.orderNumber)
                        totalFiles += files?.length || 0
                    } catch {
                        // ignore
                    }
                } else {
                    totalFiles += doc.files?.length || 0
                }
            }

            // Get recent items (last 5)
            const recentOrders = [...orders]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5)

            const recentTasks = [...tasks]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5)

            setStats({
                totalOrders: orders.length,
                pendingOrders: pendingOrdersList.length,
                deliveredOrders: orders.filter(o => o.status === 'Entregue').length,
                totalValue,
                pendingValue,
                averageTicket,
                totalTasks: tasks.length,
                totalDocuments: totalFiles,
                recentOrders,
                recentTasks,
                statusDistribution: dist,
                leadTime: 0, // Simplified for dashboard, full calculation in Reports
                onTimeRate: 0,
                trendData: [] as any
            })

            // Secondary load for advanced metrics (optional to keep dashboard fast)
            const history = await window.api.db.get('orderHistory') || []
            const deliveredOrders = orders.filter(o => o.status === 'Entregue')
            let totalLeadTime = 0
            deliveredOrders.forEach(order => {
                const creationDate = new Date(order.createdAt)
                const deliveryHistory = history
                    .filter((h: OrderHistoryEntry) => h.orderId === order.id && h.action === 'status_changed' && h.newValue === 'Entregue')
                    .sort((a: OrderHistoryEntry, b: OrderHistoryEntry) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

                if (deliveryHistory) {
                    const actualDelivery = new Date(deliveryHistory.timestamp)
                    const diffDays = Math.ceil((actualDelivery.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24))
                    totalLeadTime += diffDays
                }
            })

            const leadTime = deliveredOrders.length > 0 ? (totalLeadTime / deliveredOrders.length) : 0

            // trend data for small chart
            const last6Months = Array.from({ length: 6 }).map((_, i) => {
                const date = new Date()
                date.setMonth(date.getMonth() - i)
                return {
                    month: date.getMonth(),
                    year: date.getFullYear(),
                    label: date.toLocaleDateString('pt-BR', { month: 'short' }),
                    total: 0
                }
            }).reverse()

            orders.forEach(o => {
                const orderDate = new Date(o.createdAt)
                const monthEntry = last6Months.find(m => m.month === orderDate.getMonth() && m.year === orderDate.getFullYear())
                if (monthEntry) {
                    monthEntry.total += (o.amount || 0)
                }
            })

            setStats(prev => ({
                ...prev,
                leadTime,
                trendData: last6Months.map(m => ({ name: m.label, total: m.total }))
            }))
        } catch (error) {
            console.error('Failed to load stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    }

    const statusColors: Record<string, string> = {
        'Pendente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'Liberado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Em Trânsito': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        'Entrega Parcial': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'Entregue': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        'Cancelado': 'bg-red-500/20 text-red-400 border-red-500/30'
    }

    // Calculate progress percentages
    const maxOrders = Math.max(stats.totalOrders, 1)
    const pendingPercent = (stats.statusDistribution.pendente / maxOrders) * 100
    const transitPercent = (stats.statusDistribution.emTransito / maxOrders) * 100
    const partialPercent = (stats.statusDistribution.entregaParcial / maxOrders) * 100
    const deliveredPercent = (stats.statusDistribution.entregue / maxOrders) * 100

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
                    <p className="text-zinc-400">Visão geral financeira e operacional.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsTaskModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 text-sm font-medium transition-colors border border-white/10"
                    >
                        <CheckSquare size={16} />
                        Nova Tarefa
                    </button>
                    <button
                        onClick={() => setIsOrderModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors shadow-lg shadow-primary/20"
                    >
                        <Plus size={16} />
                        Novo Pedido
                    </button>
                </div>
            </div>

            {/* Main Financial Stats Row */}
            <div className="grid gap-4 md:grid-cols-3">
                {/* Total Value Card */}
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-6 group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                <Wallet size={20} />
                            </div>
                            <span className="text-sm font-medium text-emerald-400">Volume Total</span>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">
                            {loading ? '-' : formatCurrency(stats.totalValue)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className="text-emerald-400 flex items-center gap-0.5">
                                <TrendingUp size={12} />
                                +12%
                            </span>
                            <span>em relação ao mês anterior</span>
                        </div>
                    </div>
                </div>

                {/* Pending Value Card */}
                <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-950/20 p-6 group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                                <Clock size={20} />
                            </div>
                            <span className="text-sm font-medium text-amber-400">Em Aberto</span>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">
                            {loading ? '-' : formatCurrency(stats.pendingValue)}
                        </div>
                        <div className="text-xs text-zinc-400">
                            {stats.pendingOrders} pedidos aguardando entrega
                        </div>
                    </div>
                </div>

                {/* KPI Card */}
                <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-blue-950/20 p-6 group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <PieChart size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                <TrendingUp size={20} />
                            </div>
                            <span className="text-sm font-medium text-blue-400">Lead Time Médio</span>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">
                            {loading ? '-' : `${stats.leadTime.toFixed(1)} dias`}
                        </div>
                        <div className="text-xs text-zinc-400">
                            Média de ciclo de entrega
                        </div>
                    </div>
                </div>
            </div>

            {/* Deadline Alerts Section */}
            {deadlineAlerts.length > 0 && (
                <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-400" />
                            <h3 className="font-semibold text-red-400">Alertas de Prazo ({deadlineAlerts.length})</h3>
                        </div>
                        <button
                            onClick={() => navigate('/orders')}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                            Ver Pedidos <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                        {deadlineAlerts.slice(0, 4).map(alert => {
                            const alertColors = {
                                overdue: 'border-red-500/50 bg-red-500/10 text-red-400',
                                today: 'border-orange-500/50 bg-orange-500/10 text-orange-400',
                                tomorrow: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
                                soon: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
                            }
                            const alertLabels = {
                                overdue: `Atrasado ${Math.abs(alert.daysUntilDeadline)}d`,
                                today: 'Entrega Hoje',
                                tomorrow: 'Amanhã',
                                soon: `Em ${alert.daysUntilDeadline}d`
                            }
                            return (
                                <div
                                    key={alert.orderId}
                                    className={`p-3 rounded-lg border ${alertColors[alert.type]} transition-all hover:scale-[1.02] cursor-pointer`}
                                    onClick={() => navigate('/orders')}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-mono font-bold text-sm">{alert.orderNumber}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-medium">
                                            {alertLabels[alert.type]}
                                        </span>
                                    </div>
                                    <p className="text-xs truncate opacity-80">{alert.vendor}</p>
                                    <p className="text-[10px] mt-1 opacity-60">
                                        <CalendarDays size={10} className="inline mr-1" />
                                        {new Date(alert.deliveryDate).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                    {deadlineAlerts.length > 4 && (
                        <p className="text-xs text-zinc-500 mt-2 text-center">
                            +{deadlineAlerts.length - 4} outros alertas
                        </p>
                    )}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Chart Section */}
                <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-zinc-900/50 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={18} className="text-primary" />
                            <h3 className="font-semibold text-white">Tendência de Gastos</h3>
                        </div>
                        <div className="text-xs text-zinc-500">Últimos 6 meses</div>
                    </div>

                    <div className="h-[200px] w-full mt-auto">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.trendData}>
                                <defs>
                                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                                <XAxis
                                    dataKey="name"
                                    stroke="#555"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '12px' }}
                                    formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Total']}
                                />
                                <Area type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorTrend)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Card */}
                <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-6">
                    <h3 className="text-sm font-medium text-zinc-400 mb-6 flex items-center gap-2">
                        <PieChart size={16} />
                        Distribuição
                    </h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Pendentes', value: stats.statusDistribution.pendente, percent: pendingPercent, color: 'bg-yellow-500' },
                            { label: 'Trânsito', value: stats.statusDistribution.emTransito, percent: transitPercent, color: 'bg-cyan-500' },
                            { label: 'Parcial', value: stats.statusDistribution.entregaParcial, percent: partialPercent, color: 'bg-orange-500' },
                            { label: 'Entregues', value: stats.statusDistribution.entregue, percent: deliveredPercent, color: 'bg-emerald-500' }
                        ].map((item) => (
                            <div key={item.label} className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="text-zinc-400">{item.label}</span>
                                    <span className="text-white font-medium">{item.value}</span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${item.color} transition-all duration-1000`}
                                        style={{ width: `${item.percent}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content Area (Orders List) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-5">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Package size={18} className="text-zinc-400" />
                                <h3 className="font-semibold text-white">Pedidos Recentes</h3>
                            </div>
                            <button
                                onClick={() => navigate('/orders')}
                                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                            >
                                Ver todos <ArrowRight size={12} />
                            </button>
                        </div>

                        {stats.recentOrders.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
                                <AlertCircle size={32} className="mx-auto mb-2 text-zinc-600" />
                                <p className="text-sm text-zinc-500">Nenhum pedido registrado</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {stats.recentOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="group flex items-center justify-between p-4 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-white/10 hover:bg-zinc-900/60 transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 rounded-xl bg-zinc-800/50 text-zinc-400 group-hover:text-white transition-colors">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="font-mono text-sm font-medium text-white group-hover:text-primary transition-colors">
                                                    {order.orderNumber}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                                                    <span>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</span>
                                                    <span>•</span>
                                                    <span className="truncate max-w-[150px]">{order.vendor || 'Sem fornecedor'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-white">
                                                {order.amount ? formatCurrency(order.amount) : 'R$ -'}
                                            </p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${statusColors[order.status] || statusColors['Pendente']}`}>
                                                {order.status || 'Pendente'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar (Tasks & Documents) */}
                <div className="space-y-6">
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
                            <div className="text-zinc-500 text-xs font-medium mb-1">Tarefas</div>
                            <div className="text-2xl font-bold text-white">{stats.totalTasks}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
                            <div className="text-zinc-500 text-xs font-medium mb-1">Docs</div>
                            <div className="text-2xl font-bold text-white">{stats.totalDocuments}</div>
                        </div>
                    </div>

                    {/* Tasks List */}
                    <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-5 h-fit">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <CheckSquare size={18} className="text-zinc-400" />
                                <h3 className="font-semibold text-white">Próximas Tarefas</h3>
                            </div>
                        </div>
                        {stats.recentTasks.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm text-zinc-600">Sem tarefas pendentes</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {stats.recentTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="p-3 rounded-lg bg-zinc-800/30 border border-white/5 hover:bg-zinc-800/50 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-sm font-medium text-zinc-200 line-clamp-1">{task.title}</p>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-zinc-500">
                                            <div className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {task.startTime || 'Dia todo'}
                                            </div>
                                            <span className={task.recurrence !== 'none' ? 'text-purple-400' : ''}>
                                                {task.recurrence !== 'none' ? 'Recorrente' : 'Única'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => navigate('/tasks')}
                            className="w-full mt-4 py-2 text-xs font-medium text-zinc-400 hover:text-white border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg transition-all"
                        >
                            Ver agenda completa
                        </button>
                    </div>

                    {/* System Status / Info */}
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-400">
                                <FolderOpen size={16} />
                            </div>
                            <span className="text-sm font-medium text-indigo-400">Banco de Dados</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Seus dados estão sendo armazenados localmente e criptografados. O backup automático está programado para as 18:00.
                        </p>
                    </div>
                </div>
            </div>

            <OrderModal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
                onSuccess={() => {
                    loadStats()
                }}
            />

            <TaskModal
                isOpen={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                onSuccess={() => {
                    loadStats()
                }}
            />
        </div>
    )
}
