import { useEffect, useCallback } from 'react'

interface KeyboardShortcut {
    key: string
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    action: () => void
    description: string
}

const shortcuts: KeyboardShortcut[] = []

export function useKeyboardShortcuts(customShortcuts?: KeyboardShortcut[]) {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Ignorar se estiver em um input/textarea
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            // Permitir Escape mesmo em inputs
            if (event.key !== 'Escape') return
        }

        const allShortcuts = [...shortcuts, ...(customShortcuts || [])]

        for (const shortcut of allShortcuts) {
            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
            const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey)
            const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
            const altMatch = shortcut.alt ? event.altKey : !event.altKey

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault()
                shortcut.action()
                return
            }
        }
    }, [customShortcuts])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}

// Registro global de atalhos
export function registerShortcut(shortcut: KeyboardShortcut) {
    const exists = shortcuts.find(s =>
        s.key === shortcut.key &&
        s.ctrl === shortcut.ctrl &&
        s.shift === shortcut.shift
    )
    if (!exists) {
        shortcuts.push(shortcut)
    }
}

export function unregisterShortcut(key: string, ctrl?: boolean) {
    const index = shortcuts.findIndex(s => s.key === key && s.ctrl === ctrl)
    if (index !== -1) {
        shortcuts.splice(index, 1)
    }
}

export function getRegisteredShortcuts(): KeyboardShortcut[] {
    return [...shortcuts]
}

// Formatador de atalhos para exibição
export function formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = []
    if (shortcut.ctrl) parts.push('Ctrl')
    if (shortcut.shift) parts.push('Shift')
    if (shortcut.alt) parts.push('Alt')
    parts.push(shortcut.key.toUpperCase())
    return parts.join('+')
}
