
import { useState, useEffect } from 'react'
import { X, Clock, Repeat, Check } from 'lucide-react'

interface TaskModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    editingTask?: any
    initialData?: {
        dayOfWeek?: number
        hour?: number
    }
}

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

export default function TaskModal({ isOpen, onClose, onSuccess, editingTask, initialData }: TaskModalProps) {
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

    useEffect(() => {
        if (isOpen) {
            if (editingTask) {
                setNewTask({
                    title: editingTask.title,
                    description: editingTask.description || '',
                    color: editingTask.color,
                    startTime: editingTask.startTime,
                    endTime: editingTask.endTime,
                    dayOfWeek: editingTask.dayOfWeek,
                    recurrence: editingTask.recurrence,
                    customDays: editingTask.customDays || []
                })
            } else {
                // New task with optional initial data
                setNewTask({
                    title: '',
                    description: '',
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    startTime: initialData?.hour !== undefined ? `${initialData.hour.toString().padStart(2, '0')}:00` : '09:00',
                    endTime: initialData?.hour !== undefined ? `${(initialData.hour + 1).toString().padStart(2, '0')}:00` : '10:00',
                    dayOfWeek: initialData?.dayOfWeek !== undefined ? initialData.dayOfWeek : 1,
                    recurrence: 'none',
                    customDays: []
                })
            }
        }
    }, [isOpen, editingTask, initialData])

    async function handleSaveTask(e: React.FormEvent) {
        e.preventDefault()
        if (!newTask.title) return

        try {
            const taskData = {
                ...newTask,
                createdAt: editingTask ? editingTask.createdAt : new Date().toISOString()
            }

            if (editingTask) {
                await window.api.db.update('tasks', editingTask.id, taskData)
            } else {
                await window.api.db.add('tasks', taskData)
            }

            onSuccess()
            onClose()
        } catch (error) {
            console.error('Failed to save task:', error)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
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
                            onClick={onClose}
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
    )
}
