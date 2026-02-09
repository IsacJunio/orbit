// Serviço de verificação de prazos e notificações

interface Order {
    id: string
    orderNumber: string
    vendor: string
    deliveryDate?: string
    status: string
}

export interface DeadlineAlert {
    orderId: string
    orderNumber: string
    vendor: string
    daysUntilDeadline: number
    type: 'overdue' | 'today' | 'tomorrow' | 'soon' // soon = 3 dias
    deliveryDate: string
}

export async function checkDeadlines(): Promise<DeadlineAlert[]> {
    try {
        const orders: Order[] = await window.api.db.get('orders') || []
        const alerts: DeadlineAlert[] = []
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        for (const order of orders) {
            // Ignorar pedidos entregues ou cancelados
            if (order.status === 'Entregue' || order.status === 'Cancelado') continue
            if (!order.deliveryDate) continue

            const deadline = new Date(order.deliveryDate)
            deadline.setHours(0, 0, 0, 0)

            const diffTime = deadline.getTime() - today.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            let type: DeadlineAlert['type'] | null = null

            if (diffDays < 0) {
                type = 'overdue'
            } else if (diffDays === 0) {
                type = 'today'
            } else if (diffDays === 1) {
                type = 'tomorrow'
            } else if (diffDays <= 3) {
                type = 'soon'
            }

            if (type) {
                alerts.push({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    vendor: order.vendor,
                    daysUntilDeadline: diffDays,
                    type,
                    deliveryDate: order.deliveryDate
                })
            }
        }

        // Ordenar por urgência (atrasados primeiro)
        return alerts.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline)
    } catch (error) {
        console.error('Failed to check deadlines:', error)
        return []
    }
}

export function formatAlertMessage(alert: DeadlineAlert): string {
    const date = new Date(alert.deliveryDate).toLocaleDateString('pt-BR')

    switch (alert.type) {
        case 'overdue':
            const daysLate = Math.abs(alert.daysUntilDeadline)
            return `⚠️ ATRASADO há ${daysLate} dia(s) | Entrega era ${date}`
        case 'today':
            return `🔴 Entrega HOJE (${date})`
        case 'tomorrow':
            return `🟠 Entrega AMANHÃ (${date})`
        case 'soon':
            return `🟡 Entrega em ${alert.daysUntilDeadline} dias (${date})`
        default:
            return `Entrega: ${date}`
    }
}

export function getAlertColor(type: DeadlineAlert['type']): string {
    switch (type) {
        case 'overdue': return 'text-red-500 bg-red-500/10 border-red-500/30'
        case 'today': return 'text-orange-500 bg-orange-500/10 border-orange-500/30'
        case 'tomorrow': return 'text-amber-500 bg-amber-500/10 border-amber-500/30'
        case 'soon': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30'
        default: return 'text-muted-foreground bg-card'
    }
}

export function getAlertBadgeColor(type: DeadlineAlert['type']): string {
    switch (type) {
        case 'overdue': return 'bg-red-500'
        case 'today': return 'bg-orange-500'
        case 'tomorrow': return 'bg-amber-500'
        case 'soon': return 'bg-yellow-500'
        default: return 'bg-muted'
    }
}

// Envia notificação nativa do Windows
export async function sendDeadlineNotifications(alerts: DeadlineAlert[]): Promise<void> {
    if (alerts.length === 0) return

    const overdueCount = alerts.filter(a => a.type === 'overdue').length
    const todayCount = alerts.filter(a => a.type === 'today').length
    const tomorrowCount = alerts.filter(a => a.type === 'tomorrow').length

    let title = '📦 Orbit - Alertas de Prazo'
    let body = ''

    if (overdueCount > 0) {
        body += `⚠️ ${overdueCount} pedido(s) atrasado(s)\n`
    }
    if (todayCount > 0) {
        body += `🔴 ${todayCount} entrega(s) para hoje\n`
    }
    if (tomorrowCount > 0) {
        body += `🟠 ${tomorrowCount} entrega(s) para amanhã`
    }

    if (body) {
        try {
            // Usa a API de notificações do navegador (fallback)
            if (typeof Notification !== 'undefined') {
                if (Notification.permission === 'granted') {
                    new Notification(title, { body: body.trim() })
                } else if (Notification.permission !== 'denied') {
                    const permission = await Notification.requestPermission()
                    if (permission === 'granted') {
                        new Notification(title, { body: body.trim() })
                    }
                }
            }
        } catch (error) {
            console.error('Failed to send notification:', error)
        }
    }
}

// Contagem de alertas para badge no sidebar
export async function getAlertCounts(): Promise<{ overdue: number; today: number; total: number }> {
    const alerts = await checkDeadlines()
    return {
        overdue: alerts.filter(a => a.type === 'overdue').length,
        today: alerts.filter(a => a.type === 'today').length,
        total: alerts.length
    }
}
