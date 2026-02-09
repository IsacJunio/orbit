import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Monitor, Moon, Sun, Info, Bell, Power, BellRing, CheckCircle, XCircle, AlertTriangle, Palette, Minimize2, PieChart, FileText, FolderOpen, Database, RotateCcw } from 'lucide-react'
import { useTheme } from '../components/ThemeProvider'

interface AppVersionInfo {
    appVersion: string
    electronVersion: string
    chromeVersion: string
    nodeVersion: string
}

// Accent color options
const accentColorOptions = [
    { id: 'purple', name: 'Roxo', class: 'bg-purple-500' },
    { id: 'blue', name: 'Azul', class: 'bg-blue-500' },
    { id: 'green', name: 'Verde', class: 'bg-green-500' },
    { id: 'orange', name: 'Laranja', class: 'bg-orange-500' },
    { id: 'red', name: 'Vermelho', class: 'bg-red-500' },
    { id: 'cyan', name: 'Ciano', class: 'bg-cyan-500' },
] as const

export default function Settings() {
    const { theme, setTheme, accentColor, setAccentColor, compactMode, setCompactMode } = useTheme()
    const [versionInfo, setVersionInfo] = useState<AppVersionInfo>({
        appVersion: '-',
        electronVersion: '-',
        chromeVersion: '-',
        nodeVersion: '-'
    })
    const [autoStartEnabled, setAutoStartEnabled] = useState(false)
    const [autoStartError, setAutoStartError] = useState<string | null>(null)
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)
    const [loading, setLoading] = useState(true)
    const [testingNotification, setTestingNotification] = useState(false)
    const [notificationResult, setNotificationResult] = useState<{ success: boolean; message: string } | null>(null)
    const [backupTime, setBackupTime] = useState('18:00')

    // Database Location
    const [dbPath, setDbPath] = useState<string>('')
    const [changingDbPath, setChangingDbPath] = useState(false)

    // Relatórios Programados
    const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(false)
    const [weeklyReportDay, setWeeklyReportDay] = useState('1') // 1 = Segunda-feira
    const [weeklyReportTime, setWeeklyReportTime] = useState('08:00')

    const daysOfWeek = [
        { value: '0', label: 'Domingo' },
        { value: '1', label: 'Segunda-feira' },
        { value: '2', label: 'Terça-feira' },
        { value: '3', label: 'Quarta-feira' },
        { value: '4', label: 'Quinta-feira' },
        { value: '5', label: 'Sexta-feira' },
        { value: '6', label: 'Sábado' },
    ]

    useEffect(() => {
        loadSettings()
        loadVersionInfo()
        loadDbPath()
    }, [])

    async function loadDbPath() {
        try {
            const path = await window.api.settings.getDbPath()
            setDbPath(path || '')
        } catch (error) {
            console.error('Error loading database path:', error)
        }
    }

    async function handleSelectDbFolder() {
        setChangingDbPath(true)
        try {
            const result = await window.api.settings.selectDbFolder()
            if (result.success && result.path) {
                setDbPath(result.path)
                alert('Local do banco de dados alterado com sucesso!\n\nNovo local: ' + result.path)
            } else if (result.error) {
                alert('Erro ao alterar local: ' + result.error)
            }
        } catch (error) {
            console.error('Error selecting database folder:', error)
            alert('Erro ao selecionar pasta')
        } finally {
            setChangingDbPath(false)
        }
    }

    async function handleResetDbPath() {
        if (!confirm('Deseja resetar o banco de dados para o local padrão?\n\nO banco de dados será movido para a pasta local do aplicativo.')) {
            return
        }
        setChangingDbPath(true)
        try {
            const result = await window.api.settings.resetDbToDefault()
            if (result.success && result.path) {
                setDbPath(result.path)
                alert('Local do banco de dados resetado para o padrão!\n\nNovo local: ' + result.path)
            } else if (result.error) {
                alert('Erro ao resetar: ' + result.error)
            }
        } catch (error) {
            console.error('Error resetting database path:', error)
            alert('Erro ao resetar local')
        } finally {
            setChangingDbPath(false)
        }
    }

    async function loadVersionInfo() {
        try {
            // Get versions from main process via IPC
            const info = await window.api.settings.getVersionInfo()
            setVersionInfo(info)
        } catch (error) {
            console.error('Error loading version info:', error)
        }
    }

    async function loadSettings() {
        try {
            const [autoStart, notifications, schedule, weeklyReport] = await Promise.all([
                window.api.settings.getAutoStart(),
                window.api.settings.getNotificationsEnabled(),
                window.api.settings.getBackupSchedule(),
                window.api.settings.getWeeklyReportSchedule ? window.api.settings.getWeeklyReportSchedule() : null
            ])
            setAutoStartEnabled(autoStart)
            setNotificationsEnabled(notifications)
            setBackupTime(schedule)
            if (weeklyReport) {
                setWeeklyReportEnabled(weeklyReport.enabled || false)
                setWeeklyReportDay(weeklyReport.day || '1')
                setWeeklyReportTime(weeklyReport.time || '08:00')
            }
        } catch (error) {
            console.error('Error loading settings:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleBackupTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newTime = e.target.value
        setBackupTime(newTime)
        try {
            await window.api.settings.setBackupSchedule(newTime)
        } catch (error) {
            console.error('Error setting backup schedule:', error)
        }
    }

    // Weekly Report Schedule handlers
    async function handleWeeklyReportToggle() {
        const newValue = !weeklyReportEnabled
        setWeeklyReportEnabled(newValue)
        try {
            await window.api.settings.setWeeklyReportSchedule({
                enabled: newValue,
                day: weeklyReportDay,
                time: weeklyReportTime
            })
        } catch (error) {
            console.error('Error setting weekly report schedule:', error)
        }
    }

    async function handleWeeklyReportDayChange(day: string) {
        setWeeklyReportDay(day)
        try {
            await window.api.settings.setWeeklyReportSchedule({
                enabled: weeklyReportEnabled,
                day: day,
                time: weeklyReportTime
            })
        } catch (error) {
            console.error('Error setting weekly report day:', error)
        }
    }

    async function handleWeeklyReportTimeChange(time: string) {
        setWeeklyReportTime(time)
        try {
            await window.api.settings.setWeeklyReportSchedule({
                enabled: weeklyReportEnabled,
                day: weeklyReportDay,
                time: time
            })
        } catch (error) {
            console.error('Error setting weekly report time:', error)
        }
    }

    async function handleAutoStartToggle() {
        setAutoStartError(null)
        try {
            const newValue = !autoStartEnabled
            const result = await window.api.settings.setAutoStart(newValue)

            if (result.success) {
                setAutoStartEnabled(newValue)
            } else {
                // Show specific error message based on reason
                switch (result.reason) {
                    case 'development':
                        setAutoStartError('Não disponível em modo desenvolvimento')
                        break
                    case 'registry_failed':
                        setAutoStartError('Falha ao gravar no registro. Execute como Administrador.')
                        break
                    default:
                        setAutoStartError('Funciona apenas na versão instalada (não portátil)')
                }
            }
        } catch (error) {
            console.error('Error toggling auto-start:', error)
            setAutoStartError('Erro ao configurar. Tente executar como administrador.')
        }
    }

    async function handleNotificationsToggle() {
        try {
            const newValue = !notificationsEnabled
            const success = await window.api.settings.setNotificationsEnabled(newValue)
            if (success) {
                setNotificationsEnabled(newValue)
            }
        } catch (error) {
            console.error('Error toggling notifications:', error)
        }
    }

    async function handleTestNotification() {
        setTestingNotification(true)
        setNotificationResult(null)
        try {
            const result = await window.api.settings.testNotification()
            setNotificationResult(result)
            // Clear result after 5 seconds
            setTimeout(() => setNotificationResult(null), 5000)
        } catch (error) {
            console.error('Error testing notification:', error)
            setNotificationResult({ success: false, message: 'Erro ao testar notificação' })
        } finally {
            setTestingNotification(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    <SettingsIcon size={28} className="text-primary" />
                    Configurações
                </h2>
                <p className="text-muted-foreground">Gerencie suas preferências e veja informações sobre o aplicativo.</p>
            </div>

            {/* Sistema */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                    <Power size={20} className="text-primary" />
                    Sistema
                </h3>

                <div className="grid gap-4">
                    {/* Iniciar com Windows */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                <Power size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="font-medium">Iniciar com Windows</p>
                                <p className="text-sm text-muted-foreground">
                                    Abrir o Orbit automaticamente ao ligar o computador
                                </p>
                                {autoStartError && (
                                    <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                                        <AlertTriangle size={12} />
                                        {autoStartError}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={handleAutoStartToggle}
                            disabled={loading}
                            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${autoStartEnabled
                                ? 'bg-primary shadow-lg shadow-primary/30'
                                : 'bg-secondary/70'
                                } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            aria-label={autoStartEnabled ? 'Desativar inicialização automática' : 'Ativar inicialização automática'}
                        >
                            <span
                                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${autoStartEnabled ? 'left-8' : 'left-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </section>

            {/* Notificações */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                    <Bell size={20} className="text-primary" />
                    Notificações
                </h3>

                <div className="grid gap-4">
                    {/* Toggle de Notificações */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                                <BellRing size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="font-medium">Alertas de Tarefas</p>
                                <p className="text-sm text-muted-foreground">
                                    Receber notificações quando chegar a hora de uma tarefa
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleNotificationsToggle}
                            disabled={loading}
                            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${notificationsEnabled
                                ? 'bg-primary shadow-lg shadow-primary/30'
                                : 'bg-secondary/70'
                                } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            aria-label={notificationsEnabled ? 'Desativar notificações' : 'Ativar notificações'}
                        >
                            <span
                                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${notificationsEnabled ? 'left-8' : 'left-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Testar Notificação */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                <Bell size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="font-medium">Testar Notificação</p>
                                <p className="text-sm text-muted-foreground">
                                    Enviar uma notificação de teste para verificar se está funcionando
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {notificationResult && (
                                <div className={`flex items-center gap-1.5 text-sm ${notificationResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {notificationResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                    <span>{notificationResult.message}</span>
                                </div>
                            )}
                            <button
                                onClick={handleTestNotification}
                                disabled={testingNotification || !notificationsEnabled}
                                className={`px-4 py-2 rounded-lg font-medium transition-all ${notificationsEnabled
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    : 'bg-secondary text-muted-foreground cursor-not-allowed'
                                    } ${testingNotification ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {testingNotification ? 'Enviando...' : 'Testar'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Backup e Armazenamento */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                    <Database size={20} className="text-primary" />
                    Backup e Armazenamento
                </h3>

                <div className="grid gap-4">
                    {/* Horário de Backup */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                                <SettingsIcon size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="font-medium">Backup Automático</p>
                                <p className="text-sm text-muted-foreground max-w-lg">
                                    Backup automático programado para as {backupTime}.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="time"
                                value={backupTime}
                                onChange={handleBackupTimeChange}
                                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    {/* Local do Banco de Dados */}
                    <div className="p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                                <FolderOpen size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium">Local do Banco de Dados</p>
                                <p className="text-sm text-muted-foreground">
                                    Escolha onde armazenar seus dados. Use OneDrive, Dropbox ou pasta local.
                                </p>
                            </div>
                        </div>

                        {/* Current Path Display */}
                        <div className="mb-4 p-3 rounded-lg bg-black/20 border border-border/30">
                            <p className="text-xs text-muted-foreground mb-1">Local atual:</p>
                            <p className="text-sm font-mono break-all text-foreground/80">
                                {dbPath || 'Carregando...'}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleSelectDbFolder}
                                disabled={changingDbPath}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                <FolderOpen size={16} />
                                {changingDbPath ? 'Alterando...' : 'Escolher Pasta'}
                            </button>
                            <button
                                onClick={handleResetDbPath}
                                disabled={changingDbPath}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                <RotateCcw size={16} />
                                Resetar Padrão
                            </button>
                        </div>

                        {/* Tips */}
                        <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <p className="text-xs text-blue-400">
                                💡 <strong>Dica:</strong> Salve em uma pasta do OneDrive ou Dropbox para sincronizar automaticamente entre dispositivos.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Relatórios */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                    <PieChart size={20} className="text-primary" />
                    Relatórios Programados
                </h3>

                <div className="grid gap-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                                <FileText size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="font-medium">Exportação Semanal</p>
                                <p className="text-sm text-muted-foreground">
                                    Gerar relatório consolidado automaticamente
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleWeeklyReportToggle}
                            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${weeklyReportEnabled
                                ? 'bg-primary shadow-lg shadow-primary/30'
                                : 'bg-secondary/70'
                                } cursor-pointer`}
                            aria-label={weeklyReportEnabled ? 'Desativar exportação semanal' : 'Ativar exportação semanal'}
                        >
                            <span
                                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${weeklyReportEnabled ? 'left-8' : 'left-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Configurações de dia e hora - só aparece se ativado */}
                    {weeklyReportEnabled && (
                        <div className="ml-4 p-4 rounded-xl border border-border/30 bg-card/30 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Dia da Semana</label>
                                    <select
                                        value={weeklyReportDay}
                                        onChange={(e) => handleWeeklyReportDayChange(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        {daysOfWeek.map(day => (
                                            <option key={day.value} value={day.value}>{day.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Horário</label>
                                    <input
                                        type="time"
                                        value={weeklyReportTime}
                                        onChange={(e) => handleWeeklyReportTimeChange(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                O relatório será gerado toda <span className="text-primary font-medium">{daysOfWeek.find(d => d.value === weeklyReportDay)?.label}</span> às <span className="text-primary font-medium">{weeklyReportTime}</span>
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Personalização */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                    <Monitor size={20} className="text-primary" />
                    Personalização
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                    <button
                        onClick={() => setTheme('dark')}
                        className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all ${theme === 'dark' ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-card/50 hover:border-primary/50 text-muted-foreground'}`}
                    >
                        <Moon size={24} />
                        <span className="font-medium">Modo Escuro</span>
                    </button>

                    <button
                        onClick={() => setTheme('light')}
                        className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all ${theme === 'light' ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-card/50 hover:border-primary/50 text-muted-foreground'}`}
                    >
                        <Sun size={24} />
                        <span className="font-medium">Modo Claro</span>
                    </button>

                    <button
                        onClick={() => setTheme('system')}
                        className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all ${theme === 'system' ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-card/50 hover:border-primary/50 text-muted-foreground'}`}
                    >
                        <Monitor size={24} />
                        <span className="font-medium">Sistema</span>
                    </button>
                </div>

                {/* Accent Color */}
                <div className="mt-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Palette size={16} />
                        Cor de Destaque
                    </h4>
                    <div className="flex gap-3 flex-wrap">
                        {accentColorOptions.map(color => (
                            <button
                                key={color.id}
                                onClick={() => setAccentColor(color.id)}
                                className={`w-10 h-10 rounded-full ${color.class} transition-all hover:scale-110 ${accentColor === color.id ? 'ring-2 ring-white ring-offset-2 ring-offset-background' : ''}`}
                                title={color.name}
                                aria-label={`Cor ${color.name}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Compact Mode */}
                <div className="mt-6 flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
                            <Minimize2 size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="font-medium">Modo Compacto</p>
                            <p className="text-sm text-muted-foreground">
                                Reduz espaçamento para mais informação na tela
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setCompactMode(!compactMode)}
                        className={`relative w-14 h-7 rounded-full transition-all duration-300 ${compactMode
                            ? 'bg-primary shadow-lg shadow-primary/30'
                            : 'bg-secondary/70'
                            } cursor-pointer`}
                        aria-label={compactMode ? 'Desativar modo compacto' : 'Ativar modo compacto'}
                    >
                        <span
                            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${compactMode ? 'left-8' : 'left-1'
                                }`}
                        />
                    </button>
                </div>
            </section>

            {/* Atalhos de Teclado */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                    <span className="w-5 h-5 rounded bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">⌘</span>
                    Atalhos de Teclado
                </h3>

                <div className="grid gap-3 md:grid-cols-2">
                    {/* Navegação */}
                    <div className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Navegação</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Dashboard</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + 1</kbd>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Pedidos</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + 2</kbd>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Tarefas</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + 3</kbd>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Documentos</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + 4</kbd>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Automação SAP</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + 5</kbd>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Relatórios</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + 6</kbd>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Configurações</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + ,</kbd>
                            </div>
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Ações Rápidas</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Novo Pedido</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + N</kbd>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Nova Tarefa</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + T</kbd>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Buscar</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Ctrl + F</kbd>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Fechar Modal</span>
                                <kbd className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono">Esc</kbd>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Sobre o Aplicativo */}
            <section className="space-y-4 pt-4">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                    <Info size={20} className="text-primary" />
                    Sobre o Aplicativo
                </h3>

                <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="text-xl font-bold">Orbit</h4>
                            <p className="text-sm text-muted-foreground">Sistema de Gerenciamento de Pedidos e Tarefas</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                            v{versionInfo.appVersion}
                        </span>
                    </div>

                    <div className="grid gap-4 pt-4 text-sm">
                        <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                            <span className="text-muted-foreground">Versão do Electron</span>
                            <span className="font-mono">v{versionInfo.electronVersion}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                            <span className="text-muted-foreground">Versão do Chrome</span>
                            <span className="font-mono">v{versionInfo.chromeVersion}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                            <span className="text-muted-foreground">Versão do Node.js</span>
                            <span className="font-mono">v{versionInfo.nodeVersion}</span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border/30">
                        <p className="text-xs text-center text-muted-foreground">
                            Desenvolvido por Isac Junio &copy; {new Date().getFullYear()}
                        </p>
                    </div>
                </div>
            </section>
        </div>
    )
}

