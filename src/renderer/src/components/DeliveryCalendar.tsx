import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Package, Clock, AlertTriangle } from 'lucide-react'

interface Order {
    id: string
    orderNumber: string
    vendor: string
    deliveryDate?: string
    status: string
    amount?: number
}

interface DeliveryCalendarProps {
    orders: Order[]
    onOrderClick?: (order: Order) => void
}

export default function DeliveryCalendar({ orders, onOrderClick }: DeliveryCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [view, setView] = useState<'month' | 'week'>('month')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Filtrar pedidos com data de entrega
    const ordersWithDelivery = orders.filter(o =>
        o.deliveryDate && o.status !== 'Entregue' && o.status !== 'Cancelado'
    )

    // Agrupar pedidos por data
    const ordersByDate: Record<string, Order[]> = {}
    ordersWithDelivery.forEach(order => {
        const date = order.deliveryDate!.split('T')[0]
        if (!ordersByDate[date]) ordersByDate[date] = []
        ordersByDate[date].push(order)
    })

    // Navegação
    function previousMonth() {
        setCurrentDate(prev => {
            const d = new Date(prev)
            d.setMonth(d.getMonth() - 1)
            return d
        })
    }

    function nextMonth() {
        setCurrentDate(prev => {
            const d = new Date(prev)
            d.setMonth(d.getMonth() + 1)
            return d
        })
    }

    function goToToday() {
        setCurrentDate(new Date())
    }

    // Gerar dias do mês
    function getDaysInMonth() {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()

        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)

        const days: (Date | null)[] = []

        // Dias vazios antes do primeiro dia
        const startDayOfWeek = firstDay.getDay()
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null)
        }

        // Dias do mês
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i))
        }

        return days
    }

    // Verificar se uma data é hoje
    function isToday(date: Date): boolean {
        return date.toDateString() === today.toDateString()
    }

    // Verificar se uma data está no passado
    function isPast(date: Date): boolean {
        return date < today
    }

    // Obter pedidos de uma data
    function getOrdersForDate(date: Date): Order[] {
        const dateStr = date.toISOString().split('T')[0]
        return ordersByDate[dateStr] || []
    }

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    const days = getDaysInMonth()

    // Estatísticas
    const overdueOrders = ordersWithDelivery.filter(o => {
        const d = new Date(o.deliveryDate!)
        d.setHours(0, 0, 0, 0)
        return d < today
    })

    const todayOrders = ordersWithDelivery.filter(o => {
        const d = new Date(o.deliveryDate!)
        return d.toDateString() === today.toDateString()
    })

    const thisWeekOrders = ordersWithDelivery.filter(o => {
        const d = new Date(o.deliveryDate!)
        const weekFromNow = new Date(today)
        weekFromNow.setDate(weekFromNow.getDate() + 7)
        return d >= today && d <= weekFromNow
    })

    return (
        <div className="space-y-6">
            {/* Estatísticas Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border ${overdueOrders.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-card/50 border-border/50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${overdueOrders.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}`}>
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{overdueOrders.length}</p>
                            <p className="text-sm text-muted-foreground">Atrasados</p>
                        </div>
                    </div>
                </div>

                <div className={`p-4 rounded-xl border ${todayOrders.length > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card/50 border-border/50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${todayOrders.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{todayOrders.length}</p>
                            <p className="text-sm text-muted-foreground">Hoje</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/20 text-primary">
                            <Package size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{thisWeekOrders.length}</p>
                            <p className="text-sm text-muted-foreground">Esta Semana</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendário */}
            <div className="bg-card/50 border border-border/50 rounded-xl p-4">
                {/* Header do Calendário */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={previousMonth}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h3 className="text-lg font-semibold min-w-[180px] text-center">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </h3>
                        <button
                            onClick={nextMonth}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    <button
                        onClick={goToToday}
                        className="px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                    >
                        Hoje
                    </button>
                </div>

                {/* Dias da Semana */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayNames.map(day => (
                        <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid do Calendário */}
                <div className="grid grid-cols-7 gap-1">
                    {days.map((date, index) => {
                        if (!date) {
                            return <div key={`empty-${index}`} className="h-24" />
                        }

                        const dayOrders = getOrdersForDate(date)
                        const isCurrentDay = isToday(date)
                        const isPastDay = isPast(date)

                        return (
                            <div
                                key={date.toISOString()}
                                className={`h-24 p-1 rounded-lg border transition-colors ${isCurrentDay
                                        ? 'bg-primary/10 border-primary/50'
                                        : isPastDay
                                            ? 'bg-card/30 border-border/30'
                                            : 'bg-card/50 border-border/50 hover:border-primary/30'
                                    }`}
                            >
                                <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-primary' : isPastDay ? 'text-muted-foreground' : 'text-foreground'
                                    }`}>
                                    {date.getDate()}
                                </div>

                                <div className="space-y-0.5 overflow-hidden">
                                    {dayOrders.slice(0, 2).map(order => (
                                        <button
                                            key={order.id}
                                            onClick={() => onOrderClick?.(order)}
                                            className={`w-full text-left text-xs px-1 py-0.5 rounded truncate transition-colors ${isPastDay && !isCurrentDay
                                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                                    : isCurrentDay
                                                        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                                        : 'bg-primary/20 text-primary hover:bg-primary/30'
                                                }`}
                                            title={`${order.orderNumber} - ${order.vendor}`}
                                        >
                                            {order.orderNumber}
                                        </button>
                                    ))}
                                    {dayOrders.length > 2 && (
                                        <div className="text-xs text-muted-foreground px-1">
                                            +{dayOrders.length - 2} mais
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Lista de Entregas Próximas */}
            {thisWeekOrders.length > 0 && (
                <div className="bg-card/50 border border-border/50 rounded-xl p-4">
                    <h4 className="font-semibold mb-3">Próximas Entregas (7 dias)</h4>
                    <div className="space-y-2">
                        {thisWeekOrders
                            .sort((a, b) => new Date(a.deliveryDate!).getTime() - new Date(b.deliveryDate!).getTime())
                            .map(order => {
                                const deliveryDate = new Date(order.deliveryDate!)
                                const isToday = deliveryDate.toDateString() === today.toDateString()

                                return (
                                    <button
                                        key={order.id}
                                        onClick={() => onOrderClick?.(order)}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${isToday
                                                ? 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                                                : 'bg-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${isToday ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'}`}>
                                                <Package size={16} />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-medium">{order.orderNumber}</p>
                                                <p className="text-sm text-muted-foreground">{order.vendor}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-medium ${isToday ? 'text-amber-400' : 'text-foreground'}`}>
                                                {isToday ? 'HOJE' : deliveryDate.toLocaleDateString('pt-BR')}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{order.status}</p>
                                        </div>
                                    </button>
                                )
                            })}
                    </div>
                </div>
            )}
        </div>
    )
}
