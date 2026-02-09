import { useState, useEffect, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Tasks from './pages/Tasks'
import Documents from './pages/Documents'
import Suppliers from './pages/Suppliers'
import SapAutomation from './pages/SapAutomation'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import GlobalSearch from './components/GlobalSearch'
import { toast } from 'sonner'
import { checkDeadlines, sendDeadlineNotifications } from './services/deadlineService'

// Global Search Context
function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        const handleOpenSearch = () => setIsSearchOpen(true)
        window.addEventListener('orbit-open-search', handleOpenSearch)
        return () => window.removeEventListener('orbit-open-search', handleOpenSearch)
    }, [])

    return (
        <>
            {children}
            <GlobalSearch
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onNavigate={navigate}
            />
        </>
    )
}

// Keyboard shortcuts handler component
function KeyboardShortcuts(): null {
    const navigate = useNavigate()
    const location = useLocation()

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't trigger shortcuts when typing in inputs
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            // Allow Escape to close modals even in inputs
            if (e.key === 'Escape') {
                window.dispatchEvent(new CustomEvent('orbit-close-modal'))
            }
            return
        }

        // Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'k':
                    e.preventDefault()
                    // Open global search
                    window.dispatchEvent(new CustomEvent('orbit-open-search'))
                    break
                case '1':
                    e.preventDefault()
                    navigate('/dashboard')
                    break
                case '2':
                    e.preventDefault()
                    navigate('/orders')
                    break
                case '3':
                    e.preventDefault()
                    navigate('/tasks')
                    break
                case '4':
                    e.preventDefault()
                    navigate('/documents')
                    break
                case '5':
                    e.preventDefault()
                    navigate('/suppliers')
                    break
                case '6':
                    e.preventDefault()
                    navigate('/sap')
                    break
                case '7':
                    e.preventDefault()
                    navigate('/reports')
                    break
                case 'n':
                    e.preventDefault()
                    // Dispatch event for new order/task based on current route
                    if (location.pathname === '/tasks') {
                        window.dispatchEvent(new CustomEvent('orbit-new-task'))
                    } else {
                        window.dispatchEvent(new CustomEvent('orbit-new-order'))
                    }
                    break
                case 't':
                    e.preventDefault()
                    // Navigate to tasks and open new task modal
                    if (location.pathname !== '/tasks') {
                        navigate('/tasks')
                    }
                    setTimeout(() => window.dispatchEvent(new CustomEvent('orbit-new-task')), 100)
                    break
                case 'f':
                    e.preventDefault()
                    // Focus search input
                    window.dispatchEvent(new CustomEvent('orbit-focus-search'))
                    break
                case ',':
                    e.preventDefault()
                    navigate('/settings')
                    break
            }
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            window.dispatchEvent(new CustomEvent('orbit-close-modal'))
        }
    }, [navigate, location.pathname])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    return null
}

// Deadline Check on App Start
function DeadlineChecker(): null {
    useEffect(() => {
        async function checkAndNotify() {
            try {
                const alerts = await checkDeadlines()

                if (alerts.length > 0) {
                    // Send native notification
                    await sendDeadlineNotifications(alerts)

                    // Show toast for overdue/today
                    const urgent = alerts.filter(a => a.type === 'overdue' || a.type === 'today')
                    if (urgent.length > 0) {
                        const overdueCount = alerts.filter(a => a.type === 'overdue').length
                        const todayCount = alerts.filter(a => a.type === 'today').length

                        let message = ''
                        if (overdueCount > 0) message += `${overdueCount} atrasado(s)`
                        if (todayCount > 0) message += `${overdueCount > 0 ? ' | ' : ''}${todayCount} para hoje`

                        toast.warning('Alertas de Prazo', {
                            description: message,
                            duration: 8000,
                        })
                    }
                }
            } catch (error) {
                console.error('Failed to check deadlines:', error)
            }
        }

        // Check on startup after a small delay
        const timer = setTimeout(checkAndNotify, 2000)

        // Check every 30 minutes
        const interval = setInterval(checkAndNotify, 30 * 60 * 1000)

        return () => {
            clearTimeout(timer)
            clearInterval(interval)
        }
    }, [])

    return null
}

function AppContent(): JSX.Element {
    return (
        <GlobalSearchProvider>
            <KeyboardShortcuts />
            <DeadlineChecker />
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="documents" element={<Documents />} />
                    <Route path="suppliers" element={<Suppliers />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="sap" element={<SapAutomation />} />
                    <Route path="settings" element={<Settings />} />
                </Route>
            </Routes>
        </GlobalSearchProvider>
    )
}

function App(): JSX.Element {
    useEffect(() => {
        // Listen for notification events from main process
        const unsub = window.api.settings.onNotification((data) => {
            toast(data.title, {
                description: data.body,
                duration: 5000,
            })
        })
        return () => unsub()
    }, [])

    return (
        <HashRouter>
            <AppContent />
        </HashRouter>
    )
}

export default App
