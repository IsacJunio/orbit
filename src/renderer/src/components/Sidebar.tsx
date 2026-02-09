import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, CheckSquare, FileText, Settings, Users, Zap, BarChart3, Search, Command, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getAlertCounts } from '../services/deadlineService'

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs))
}

const navItems = [
    { path: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { path: '/orders', label: 'Pedidos', icon: ShoppingCart, showBadge: true },
    { path: '/tasks', label: 'Tarefas', icon: CheckSquare },
    { path: '/documents', label: 'Documentos', icon: FileText },
    { path: '/suppliers', label: 'Fornecedores', icon: Users },
    { path: '/reports', label: 'Relatórios', icon: BarChart3 },
    { path: '/sap', label: 'Automação SAP', icon: Zap },
]

export default function Sidebar() {
    const [alertCount, setAlertCount] = useState(0)

    useEffect(() => {
        loadAlertCount()
        // Refresh every 5 minutes
        const interval = setInterval(loadAlertCount, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    async function loadAlertCount() {
        try {
            const counts = await getAlertCounts()
            setAlertCount(counts.overdue + counts.today)
        } catch (error) {
            console.error('Failed to load alert counts:', error)
        }
    }

    function openGlobalSearch() {
        window.dispatchEvent(new CustomEvent('orbit-open-search'))
    }

    return (
        <div id="sidebar" className="w-72 bg-card/50 backdrop-blur-xl border-r border-border h-screen flex flex-col p-6 transition-all duration-300">
            <div className="mb-6 px-2 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="h-4 w-4 rounded-full bg-primary shadow-lg shadow-primary/50 animate-pulse" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    Orbit
                </h1>
            </div>

            {/* Global Search Button */}
            <button
                id="global-search"
                onClick={openGlobalSearch}
                className="flex items-center gap-3 px-4 py-2.5 mb-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
            >
                <Search size={16} className="text-muted-foreground group-hover:text-foreground" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground flex-1 text-left">Buscar...</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-white/5 rounded border border-white/10">
                    <Command size={10} />K
                </kbd>
            </button>

            <nav id="sidebar-nav" className="space-y-2 flex-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ease-in-out",
                                isActive
                                    ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon size={20} className={cn("transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
                                <span className="font-medium tracking-wide text-sm flex-1">{item.label}</span>
                                {item.showBadge && alertCount > 0 && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse">
                                        <AlertCircle size={10} />
                                        {alertCount}
                                    </span>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Keyboard Shortcuts Hint */}
            <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-muted-foreground mb-2 font-medium">Atalhos Rápidos</p>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span className="text-muted-foreground">Ctrl+K</span>
                    <span className="text-foreground/60">Buscar</span>
                    <span className="text-muted-foreground">Ctrl+N</span>
                    <span className="text-foreground/60">Novo Pedido</span>
                    <span className="text-muted-foreground">Ctrl+1-7</span>
                    <span className="text-foreground/60">Navegar</span>
                </div>
            </div>

            <div className="pt-4 border-t border-border/50">
                <NavLink
                    id="sidebar-settings"
                    to="/settings"
                    className={({ isActive }) =>
                        cn(
                            "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ease-in-out w-full",
                            isActive
                                ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )
                    }
                >
                    <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                    <span className="font-medium text-sm">Configurações</span>
                </NavLink>
            </div>
        </div>
    )
}
