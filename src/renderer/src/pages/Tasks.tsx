import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, ChevronLeft, ChevronRight, GripVertical, X, Clock, Repeat, Trash2, Edit2, Check } from 'lucide-react'

interface Task {
    id: string
    title: string
    description?: string
    color: string
    startTime: string // HH:MM format
    endTime: string   // HH:MM format
    dayOfWeek: number // 0-6 (Sunday-Saturday)
    date?: string     // ISO date string for specific dates
    recurrence: 'none' | 'daily' | 'weekly' | 'weekdays' | 'custom'
    customDays?: number[] // For custom recurrence [0,1,2,3,4,5,6]
    createdAt: string
}

interface DragState {
    taskId: string
    originalDay: number
    originalTime: string
    offsetY: number
}

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0-23
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const COLORS = [
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#84CC16', // Lime
]

export default function Tasks() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date()
        const day = today.getDay()
        const diff = today.getDate() - day
        return new Date(today.setDate(diff))
    })
    const [dragState, setDragState] = useState<DragState | null>(null)
    const [newTask, setNewTask] = useState<{
        title: string
        description: string
        color: string
        startTime: string
        endTime: string
        dayOfWeek: number
        recurrence: 'none' | 'daily' | 'weekly' | 'weekdays' | 'custom'
        customDays: number[]
    }>({
        title: '',
        description: '',
        color: COLORS[0],
        startTime: '09:00',
        endTime: '10:00',
        dayOfWeek: 1,
        recurrence: 'none',
        customDays: []
    })

    const calendarRef = useRef<HTMLDivElement>(null)
    const hourHeight = 60 // pixels per hour

    useEffect(() => {
        loadTasks()
    }, [])

    // Listen for keyboard shortcut events
    useEffect(() => {
        const handleNewTask = () => openNewTaskModal()
        const handleCloseModal = () => closeModal()

        window.addEventListener('orbit-new-task', handleNewTask)
        window.addEventListener('orbit-close-modal', handleCloseModal)

        return () => {
            window.removeEventListener('orbit-new-task', handleNewTask)
            window.removeEventListener('orbit-close-modal', handleCloseModal)
        }
    }, [])

    async function loadTasks() {
        try {
            const data = await window.api.db.get('tasks')
            setTasks(data || [])
        } catch (error) {
            console.error('Failed to load tasks:', error)
        }
    }

    async function handleSaveTask(e: React.FormEvent) {
        e.preventDefault()
        if (!newTask.title) return

        try {
            const taskData = {
                ...newTask,
                createdAt: new Date().toISOString()
            }

            if (editingTask) {
                await window.api.db.update('tasks', editingTask.id, taskData)
            } else {
                await window.api.db.add('tasks', taskData)
            }

            closeModal()
            loadTasks()
        } catch (error) {
            console.error('Failed to save task:', error)
        }
    }

    function closeModal() {
        setIsModalOpen(false)
        setEditingTask(null)
        setNewTask({
            title: '',
            description: '',
            color: COLORS[0],
            startTime: '09:00',
            endTime: '10:00',
            dayOfWeek: 1,
            recurrence: 'none',
            customDays: []
        })
    }

    function openEditModal(task: Task) {
        setEditingTask(task)
        setNewTask({
            title: task.title,
            description: task.description || '',
            color: task.color,
            startTime: task.startTime,
            endTime: task.endTime,
            dayOfWeek: task.dayOfWeek,
            recurrence: task.recurrence,
            customDays: task.customDays || []
        })
        setIsModalOpen(true)
    }

    async function deleteTask(id: string) {
        try {
            await window.api.db.delete('tasks', id)
            loadTasks()
        } catch (error) {
            console.error('Failed to delete task:', error)
        }
    }

    function navigateWeek(direction: number) {
        setCurrentWeekStart(prev => {
            const newDate = new Date(prev)
            newDate.setDate(newDate.getDate() + (direction * 7))
            return newDate
        })
    }

    function goToToday() {
        const today = new Date()
        const day = today.getDay()
        const diff = today.getDate() - day
        setCurrentWeekStart(new Date(today.setDate(diff)))
    }

    function getWeekDates() {
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(currentWeekStart)
            date.setDate(date.getDate() + i)
            return date
        })
    }

    function timeToPosition(time: string): number {
        const [hours, minutes] = time.split(':').map(Number)
        return (hours * hourHeight) + (minutes / 60 * hourHeight)
    }

    function positionToTime(position: number): string {
        const totalMinutes = Math.round((position / hourHeight) * 60)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = Math.round((totalMinutes % 60) / 15) * 15 // Snap to 15 min
        return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`
    }

    function getTaskDuration(task: Task): number {
        const start = timeToPosition(task.startTime)
        const end = timeToPosition(task.endTime)
        return end - start
    }

    function shouldShowTask(task: Task, dayIndex: number): boolean {
        if (task.recurrence === 'none') {
            return task.dayOfWeek === dayIndex
        }
        if (task.recurrence === 'daily') {
            return true
        }
        if (task.recurrence === 'weekly') {
            return task.dayOfWeek === dayIndex
        }
        if (task.recurrence === 'weekdays') {
            return dayIndex >= 1 && dayIndex <= 5
        }
        if (task.recurrence === 'custom' && task.customDays) {
            return task.customDays.includes(dayIndex)
        }
        return false
    }

    // Drag handlers
    const handleDragStart = useCallback((e: React.MouseEvent, task: Task) => {
        e.preventDefault()
        const rect = (e.target as HTMLElement).getBoundingClientRect()
        setDragState({
            taskId: task.id,
            originalDay: task.dayOfWeek,
            originalTime: task.startTime,
            offsetY: e.clientY - rect.top
        })
    }, [])

    const handleDragMove = useCallback((e: React.MouseEvent) => {
        if (!dragState || !calendarRef.current) return

        const calendarRect = calendarRef.current.getBoundingClientRect()
        const columnWidth = (calendarRect.width - 50) / 7 // 50px for time column

        // Calculate new day
        const relativeX = e.clientX - calendarRect.left - 50
        let newDay = Math.floor(relativeX / columnWidth)
        newDay = Math.max(0, Math.min(6, newDay))

        // Calculate new time
        const scrollTop = calendarRef.current.scrollTop
        const relativeY = e.clientY - calendarRect.top + scrollTop - dragState.offsetY
        const newTime = positionToTime(Math.max(0, relativeY))

        // Update task position visually
        setTasks(prev => prev.map(t => {
            if (t.id === dragState.taskId) {
                const duration = getTaskDuration(t)
                const [newHours, newMins] = newTime.split(':').map(Number)
                const endMinutes = newHours * 60 + newMins + (duration / hourHeight * 60)
                const endHours = Math.floor(endMinutes / 60)
                const endMins = Math.round(endMinutes % 60)

                return {
                    ...t,
                    dayOfWeek: newDay,
                    startTime: newTime,
                    endTime: `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
                }
            }
            return t
        }))
    }, [dragState, hourHeight])

    const handleDragEnd = useCallback(async () => {
        if (!dragState) return

        const task = tasks.find(t => t.id === dragState.taskId)
        if (task) {
            try {
                await window.api.db.update('tasks', task.id, {
                    dayOfWeek: task.dayOfWeek,
                    startTime: task.startTime,
                    endTime: task.endTime
                })
            } catch (error) {
                console.error('Failed to update task:', error)
                loadTasks() // Reload on error
            }
        }

        setDragState(null)
    }, [dragState, tasks])

    useEffect(() => {
        if (dragState) {
            const handleMouseMove = (e: MouseEvent) => handleDragMove(e as any)
            const handleMouseUp = () => handleDragEnd()

            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)

            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [dragState, handleDragMove, handleDragEnd])

    const weekDates = getWeekDates()
    const today = new Date()
    const todayIndex = weekDates.findIndex(d =>
        d.toDateString() === today.toDateString()
    )

    function openNewTaskModal(dayIndex?: number, hour?: number) {
        setNewTask({
            title: '',
            description: '',
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            startTime: hour !== undefined ? `${hour.toString().padStart(2, '0')}:00` : '09:00',
            endTime: hour !== undefined ? `${(hour + 1).toString().padStart(2, '0')}:00` : '10:00',
            dayOfWeek: dayIndex !== undefined ? dayIndex : 1,
            recurrence: 'none',
            customDays: []
        })
        setIsModalOpen(true)
    }

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 flex-shrink-0">
                <div className="min-w-0">
                    <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Tarefas</h2>
                    <p className="text-muted-foreground text-sm">Calendário semanal - Arraste para reorganizar.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div id="tasks-week-nav" className="flex items-center gap-1 bg-card/50 rounded-lg border border-border/50 p-1">
                        <button
                            onClick={() => navigateWeek(-1)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            aria-label="Semana anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={goToToday}
                            className="px-2 py-1 text-xs font-medium hover:bg-white/10 rounded-lg transition-colors"
                        >
                            Hoje
                        </button>
                        <button
                            onClick={() => navigateWeek(1)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            aria-label="Próxima semana"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                        {weekDates[0].toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button
                        id="tasks-new-btn"
                        onClick={() => openNewTaskModal()}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 rounded-full font-medium transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 flex items-center gap-1.5 text-sm"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">Nova Tarefa</span>
                        <span className="sm:hidden">Nova</span>
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div id="tasks-grid" className="flex-1 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col min-h-0">
                {/* Wrapper para scroll */}
                <div className="flex-1 overflow-auto" ref={calendarRef} style={{ cursor: dragState ? 'grabbing' : 'default' }}>
                    <div className="min-w-[600px]">
                        {/* Days Header */}
                        <div className="flex border-b border-border/50 bg-white/5 sticky top-0 z-20">
                            <div className="w-12 flex-shrink-0 border-r border-border/50" />
                            {weekDates.map((date, i) => (
                                <div
                                    key={i}
                                    className={`flex-1 py-2 px-1 text-center border-r border-border/50 last:border-r-0 ${i === todayIndex ? 'bg-primary/10' : ''}`}
                                >
                                    <div className={`text-[10px] font-medium uppercase tracking-wide ${i === todayIndex ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {DAYS[i]}
                                    </div>
                                    <div className={`text-sm font-semibold mt-0.5 ${i === todayIndex
                                        ? 'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs'
                                        : 'text-foreground'}`}>
                                        {date.getDate()}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Time Grid */}
                        <div className="relative flex" style={{ minHeight: `${HOURS.length * hourHeight}px` }}>
                            {/* Time Labels */}
                            <div className="w-12 flex-shrink-0 relative border-r border-border/50">
                                {HOURS.map((hour) => (
                                    <div
                                        key={hour}
                                        className="absolute right-1 text-[10px] text-muted-foreground"
                                        style={{ top: `${hour * hourHeight - 6}px` }}
                                    >
                                        {hour.toString().padStart(2, '0')}:00
                                    </div>
                                ))}
                            </div>

                            {/* Day Columns */}
                            {weekDates.map((_, dayIndex) => (
                                <div
                                    key={dayIndex}
                                    className={`flex-1 relative border-r border-border/50 last:border-r-0 ${dayIndex === todayIndex ? 'bg-primary/5' : ''}`}
                                >
                                    {/* Hour Lines */}
                                    {HOURS.map((hour) => (
                                        <div
                                            key={hour}
                                            className="absolute left-0 right-0 border-t border-border/30 hover:bg-white/5 transition-colors cursor-pointer"
                                            style={{
                                                top: `${hour * hourHeight}px`,
                                                height: `${hourHeight}px`
                                            }}
                                            onClick={() => openNewTaskModal(dayIndex, hour)}
                                        />
                                    ))}

                                    {/* Tasks */}
                                    {tasks.filter(task => shouldShowTask(task, dayIndex)).map((task) => (
                                        <div
                                            key={`${task.id}-${dayIndex}`}
                                            className={`absolute left-0.5 right-0.5 rounded-md p-1.5 cursor-grab active:cursor-grabbing group overflow-hidden ${dragState?.taskId === task.id ? 'opacity-80 shadow-2xl z-50' : 'hover:shadow-lg'}`}
                                            style={{
                                                top: `${timeToPosition(task.startTime)}px`,
                                                height: `${Math.max(getTaskDuration(task), 25)}px`,
                                                backgroundColor: task.color,
                                                zIndex: dragState?.taskId === task.id ? 50 : 10
                                            }}
                                            onMouseDown={(e) => handleDragStart(e, task)}
                                            title={`${task.title}\n${task.startTime} - ${task.endTime}`}
                                        >
                                            <div className="flex items-start gap-0.5 h-full">
                                                <GripVertical size={10} className="text-white/50 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1 min-w-0 overflow-hidden">
                                                    <p className="text-white text-[11px] font-medium truncate leading-tight">
                                                        {task.title}
                                                    </p>
                                                    {getTaskDuration(task) >= 40 && (
                                                        <p className="text-white/70 text-[9px] mt-0.5">
                                                            {task.startTime} - {task.endTime}
                                                        </p>
                                                    )}
                                                    {task.recurrence !== 'none' && getTaskDuration(task) >= 50 && (
                                                        <Repeat size={8} className="text-white/60 mt-0.5" />
                                                    )}
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-0.5 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                                                        className="p-0.5 hover:bg-white/20 rounded"
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    >
                                                        <Edit2 size={10} className="text-white" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                                        className="p-0.5 hover:bg-white/20 rounded"
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    >
                                                        <Trash2 size={10} className="text-white" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={closeModal}>
                    <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
                            <button onClick={closeModal} className="p-1 hover:bg-white/10 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTask} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Título</label>
                                <input
                                    type="text"
                                    className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                    placeholder="Nome da tarefa"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Descrição</label>
                                <textarea
                                    className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg p-3 transition-all resize-none"
                                    rows={2}
                                    placeholder="Detalhes (opcional)"
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                />
                            </div>

                            {/* Color Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Cor</label>
                                <div className="flex gap-2 flex-wrap">
                                    {COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`w-7 h-7 rounded-full transition-all ${newTask.color === color
                                                ? 'ring-2 ring-white ring-offset-2 ring-offset-card scale-110'
                                                : 'hover:scale-110'}`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setNewTask({ ...newTask, color })}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1">
                                        <Clock size={14} />
                                        Início
                                    </label>
                                    <input
                                        type="time"
                                        className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                        value={newTask.startTime}
                                        onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1">
                                        <Clock size={14} />
                                        Fim
                                    </label>
                                    <input
                                        type="time"
                                        className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                        value={newTask.endTime}
                                        onChange={(e) => setNewTask({ ...newTask, endTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Dia da Semana</label>
                                <div className="flex gap-1">
                                    {DAYS.map((day, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${newTask.dayOfWeek === i
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-secondary/50 hover:bg-secondary'}`}
                                            onClick={() => setNewTask({ ...newTask, dayOfWeek: i })}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-1">
                                    <Repeat size={14} />
                                    Recorrência
                                </label>
                                <select
                                    className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 focus:ring-0 rounded-lg h-10 px-3 transition-all"
                                    value={newTask.recurrence}
                                    onChange={(e) => setNewTask({ ...newTask, recurrence: e.target.value as any })}
                                >
                                    <option value="none">Não repetir</option>
                                    <option value="daily">Todos os dias</option>
                                    <option value="weekly">Toda semana (mesmo dia)</option>
                                    <option value="weekdays">Dias úteis (Seg-Sex)</option>
                                    <option value="custom">Dias personalizados</option>
                                </select>
                            </div>

                            {/* Custom Days Selection */}
                            {newTask.recurrence === 'custom' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Selecione os dias</label>
                                    <div className="flex gap-1">
                                        {DAYS.map((day, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center ${newTask.customDays.includes(i)
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-secondary/50 hover:bg-secondary'}`}
                                                onClick={() => {
                                                    const days = newTask.customDays.includes(i)
                                                        ? newTask.customDays.filter(d => d !== i)
                                                        : [...newTask.customDays, i]
                                                    setNewTask({ ...newTask, customDays: days })
                                                }}
                                            >
                                                {newTask.customDays.includes(i) && <Check size={12} className="mr-0.5" />}
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 h-10 rounded-lg font-medium hover:bg-white/5 transition-colors border border-border"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
