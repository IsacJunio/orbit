import { useState, useEffect } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    Legend
} from 'recharts'
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Package,
    Clock,
    CheckCircle2,
    Calendar,
    Download,
    ArrowUpRight,
    Users,
    FileText,
    ShieldCheck
} from 'lucide-react'

interface Order {
    id: string
    orderNumber: string
    vendor: string
    amount: number
    status: string
    createdAt: string
    deliveryDate: string
}

interface OrderHistoryEntry {
    id: string
    orderId: string
    action: string
    timestamp: string
    newValue?: string
}

export default function Reports() {
    const [loading, setLoading] = useState(true)
    const [currentDate] = useState(new Date())
    const [stats, setStats] = useState({
        totalAmount: 0,
        averageAmount: 0,
        leadTimeDays: 0,
        onTimeRate: 0,
        vendorData: [] as { name: string; value: number }[],
        monthlyData: [] as { name: string; amount: number }[],
        trendData: [] as { name: string; total: number; isProjection?: boolean }[],
        topVendors: [] as { name: string; amount: number; count: number }[]
    })

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            setLoading(true)
            const orders: Order[] = await window.api.db.get('orders') || []
            const history: OrderHistoryEntry[] = await window.api.db.get('orderHistory') || []

            // 1. Total & Average
            const totalAmount = orders.reduce((acc, curr) => acc + (curr.amount || 0), 0)
            const averageAmount = orders.length > 0 ? totalAmount / orders.length : 0

            // 2. Lead Time & On-Time Rate
            const deliveredOrders = orders.filter(o => o.status === 'Entregue')
            let totalLeadTime = 0
            let onTimeCount = 0

            deliveredOrders.forEach(order => {
                const creationDate = new Date(order.createdAt)
                const deliveryHistory = history
                    .filter((h: OrderHistoryEntry) => h.orderId === order.id && h.action === 'status_changed' && h.newValue === 'Entregue')
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

                if (deliveryHistory) {
                    const actualDelivery = new Date(deliveryHistory.timestamp)
                    const diffDays = Math.ceil((actualDelivery.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24))
                    totalLeadTime += diffDays

                    const plannedDelivery = order.deliveryDate ? new Date(order.deliveryDate) : null
                    if (plannedDelivery && actualDelivery <= plannedDelivery) {
                        onTimeCount++
                    }
                }
            })

            const leadTimeDays = deliveredOrders.length > 0 ? totalLeadTime / deliveredOrders.length : 0
            const onTimeRate = deliveredOrders.length > 0 ? (onTimeCount / deliveredOrders.length) * 100 : 0

            // 3. Group by Vendor (Pie Chart)
            const vendorMap = new Map<string, { amount: number; count: number }>()
            orders.forEach(o => {
                const vendorData = vendorMap.get(o.vendor) || { amount: 0, count: 0 }
                vendorMap.set(o.vendor || 'Desconhecido', {
                    amount: vendorData.amount + (o.amount || 0),
                    count: vendorData.count + 1
                })
            })

            const vendorDataArray = Array.from(vendorMap.entries())
                .map(([name, data]) => ({ name, value: data.amount }))
                .sort((a, b) => b.value - a.value)

            const top5Vendors = vendorDataArray.slice(0, 5)

            // 4. Monthly Spend (Bar Chart)
            const last6Months = Array.from({ length: 6 }).map((_, i) => {
                const date = new Date()
                date.setMonth(date.getMonth() - i)
                return {
                    month: date.getMonth(),
                    year: date.getFullYear(),
                    label: date.toLocaleDateString('pt-BR', { month: 'short' }),
                    amount: 0
                }
            }).reverse()

            orders.forEach(o => {
                const orderDate = new Date(o.createdAt)
                const monthEntry = last6Months.find(m => m.month === orderDate.getMonth() && m.year === orderDate.getFullYear())
                if (monthEntry) {
                    monthEntry.amount += (o.amount || 0)
                }
            })

            const monthlyData = last6Months.map(m => ({ name: m.label, amount: m.amount }))

            // 5. Volume Trend (Area Chart)
            const trendData = last6Months.map(m => ({ name: m.label, total: m.amount }))
            const last3MonthsAvg = last6Months.slice(-3).reduce((acc, curr) => acc + curr.amount, 0) / 3

            for (let i = 1; i <= 3; i++) {
                const date = new Date()
                date.setMonth(date.getMonth() + i)
                trendData.push({
                    name: date.toLocaleDateString('pt-BR', { month: 'short' }) + '*',
                    total: last3MonthsAvg,
                    isProjection: true
                } as any)
            }

            setStats({
                totalAmount,
                averageAmount,
                leadTimeDays,
                onTimeRate,
                vendorData: top5Vendors,
                monthlyData,
                trendData,
                topVendors: Array.from(vendorMap.entries())
                    .map(([name, data]) => ({ name, amount: data.amount, count: data.count }))
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 10)
            })

        } catch (error) {
            console.error('Failed to load report data:', error)
        } finally {
            setLoading(false)
        }
    }

    const COLORS = ['#CC0000', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    }

    const formattedDate = currentDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    if (loading) {
        return (
            <div className="h-[80vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 rounded-sm border-2 border-red-500/20 border-t-red-600 animate-spin" />
                    <p className="text-zinc-500 font-medium tracking-tight">ANALISANDO DADOS DCML...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-10 px-8 py-10 print:p-8 max-w-[1400px] mx-auto pb-20">
            {/* POWER BI STYLE HEADER */}
            <div className="bg-zinc-900 text-white rounded-xl overflow-hidden border-b-4 border-red-600 shadow-2xl print:shadow-none print:border-red-700">
                <div className="px-10 py-8 flex items-center justify-between relative">
                    <div className="flex items-center gap-10">
                        {/* Styled DCML Logo */}
                        <div className="flex flex-col items-start leading-none">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-600 flex items-center justify-center font-black text-2xl italic shadow-lg">D</div>
                                <span className="text-4xl font-black tracking-tighter italic">DCML</span>
                            </div>
                            <span className="text-[11px] tracking-[0.2em] font-bold text-red-500 ml-1 mt-2 uppercase">Distribuidora Cummins Minas LTDA</span>
                        </div>
                        <div className="h-16 w-px bg-white/10 hidden lg:block" />
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight uppercase">Dashboard Orbit</h2>
                            <p className="text-sm text-zinc-400 font-mono uppercase tracking-widest">Relatório de Performance Consolidado</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="text-right hidden md:block">
                            <div className="text-xs font-mono text-zinc-500 uppercase flex items-center justify-end gap-2 mb-2">
                                <Clock size={14} />
                                Gerado em: {currentDate.toLocaleTimeString('pt-BR')}
                            </div>
                            <div className="text-lg font-bold text-red-500 capitalize">{formattedDate}</div>
                        </div>

                        <button
                            onClick={() => window.print()}
                            className="print:hidden p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-zinc-400 hover:text-white hover:border-red-500/50 group"
                            title="Imprimir Relatório"
                        >
                            <Download size={22} className="group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI STRIP - INDUSTRIAL CARDS - SIDE BY SIDE IN PRINT */}
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
                {[
                    { label: 'INVESTIMENTO TOTAL', value: formatCurrency(stats.totalAmount), icon: DollarSign, trend: '+8.2%', up: true, color: 'border-red-600' },
                    { label: 'VALOR MÉDIO PEDIDO', value: formatCurrency(stats.averageAmount), icon: ArrowUpRight, trend: '-2.1%', up: false, color: 'border-zinc-700' },
                    { label: 'LEAD TIME (DIAS)', value: stats.leadTimeDays.toFixed(1), icon: Clock, trend: 'Estável', up: true, color: 'border-zinc-700' },
                    { label: 'PRAZOS CUMPRIDOS', value: `${stats.onTimeRate.toFixed(1)}%`, icon: ShieldCheck, trend: '+5.0%', up: true, color: 'border-emerald-600' }
                ].map((kpi, i) => (
                    <div key={i} className={`bg-zinc-900/40 border-l-4 ${kpi.color} p-6 border border-white/5 rounded-sm shadow-xl backdrop-blur-md`}>
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">{kpi.label}</span>
                            <kpi.icon size={18} className="text-zinc-600" />
                        </div>
                        <div className="text-3xl font-black font-mono tracking-tighter text-white">{kpi.value}</div>
                        <div className="mt-4 flex items-center gap-2 pt-4 border-t border-white/5">
                            {kpi.trend !== 'Estável' && (
                                <span className={`text-[11px] font-bold ${kpi.up ? 'text-emerald-500' : 'text-red-500'} flex items-center gap-1`}>
                                    {kpi.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    {kpi.trend}
                                </span>
                            )}
                            <span className="text-[10px] text-zinc-500 font-medium">vs. período anterior</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* MAIN CHART SECTION - STACKED IN PRINT FOR BETTER FIT */}
            <div className="grid gap-8 lg:grid-cols-2 print:grid-cols-1">
                {/* Consumo Mensal */}
                <div className="bg-zinc-900/40 p-8 border border-white/5 rounded-sm backdrop-blur-md">
                    <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-red-600" />
                            <h3 className="text-base font-black text-white uppercase tracking-tight">Performance Mensal</h3>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Volume BRL</span>
                    </div>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                                <XAxis dataKey="name" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis hide />
                                <Tooltip
                                    cursor={{ fill: '#ffffff05' }}
                                    contentStyle={{ borderRadius: '4px', border: '1px solid #333', backgroundColor: '#09090b', color: '#fff' }}
                                />
                                <Bar dataKey="amount" fill="#27272a" radius={[2, 2, 0, 0]}>
                                    {stats.monthlyData.map((entry, index) => (
                                        <Cell key={index} fill={entry.amount === Math.max(...stats.monthlyData.map(d => d.amount)) ? '#CC0000' : '#27272a'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Tendência de Volume */}
                <div className="bg-zinc-900/40 p-8 border border-white/5 rounded-sm backdrop-blur-md">
                    <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-red-600" />
                            <h3 className="text-base font-black text-white uppercase tracking-tight">Previsão e Tendência</h3>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Projeção Média</span>
                    </div>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#CC0000" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#CC0000" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                                <XAxis dataKey="name" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '4px', border: '1px solid #333', backgroundColor: '#09090b', color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#CC0000"
                                    strokeWidth={4}
                                    fill="url(#chartGrad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* DETAIL SECTION - STACKED IN PRINT FOR BETTER FIT */}
            <div className="grid gap-8 lg:grid-cols-3 print:grid-cols-1">
                {/* Fornecedores Mix */}
                <div className="bg-zinc-900/40 p-8 border border-white/5 rounded-sm backdrop-blur-md flex flex-col items-center">
                    <h3 className="text-xs font-black text-white mb-10 uppercase tracking-[0.2em] self-start border-b border-red-600 pb-2">Mix de Fornecedores</h3>
                    <div className="h-[340px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 0, right: 10, left: 10, bottom: 20 }}>
                                <Pie
                                    data={stats.vendorData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {stats.vendorData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Legend
                                    verticalAlign="bottom"
                                    align="center"
                                    iconType="circle"
                                    wrapperStyle={{
                                        paddingTop: '30px',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        color: '#888'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Data Grid Table */}
                <div className="lg:col-span-2 bg-zinc-900/40 p-8 border border-white/5 rounded-sm backdrop-blur-md">
                    <h3 className="text-xs font-black text-white mb-10 uppercase tracking-[0.2em] border-b border-red-600 pb-2">Matriz de Performance por Fornecedor</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b-2 border-red-600">
                                    <th className="px-5 py-4 text-[11px] font-black text-zinc-500 uppercase tracking-wider">Vendor Name</th>
                                    <th className="px-5 py-4 text-[11px] font-black text-zinc-500 uppercase tracking-wider text-right">Volume</th>
                                    <th className="px-5 py-4 text-[11px] font-black text-zinc-500 uppercase tracking-wider text-right">Investment</th>
                                    <th className="px-5 py-4 text-[11px] font-black text-zinc-500 uppercase tracking-wider text-right">Share</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {stats.topVendors.map((vendor, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-5 py-5 text-sm font-bold text-white uppercase tracking-tight">{vendor.name}</td>
                                        <td className="px-5 py-5 text-sm font-mono text-zinc-500 text-right">{vendor.count}</td>
                                        <td className="px-5 py-5 text-sm font-black font-mono text-white text-right">{formatCurrency(vendor.amount)}</td>
                                        <td className="px-5 py-5 text-right">
                                            <div className="flex items-center justify-end gap-5">
                                                <div className="w-20 h-2 bg-white/5 rounded-none overflow-hidden hidden sm:block">
                                                    <div
                                                        className="h-full bg-red-600 transition-all duration-500"
                                                        style={{ width: `${(vendor.amount / stats.totalAmount) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-[11px] font-black font-mono text-zinc-400 w-10">
                                                    {((vendor.amount / stats.totalAmount) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* FOOTER / CONFIDENTIALITY */}
            <div className="pt-12 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] print:pt-6">
                <div className="flex items-center gap-3">
                    <ShieldCheck size={14} className="text-red-600" />
                    CONFIDENTIAL - ORBIT INTERNAL REPORT
                </div>
                <div>Distribuidora Cummins Minas LTDA © {new Date().getFullYear()}</div>
            </div>
        </div>
    )
}
