
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"
type AccentColor = "purple" | "blue" | "green" | "orange" | "red" | "cyan"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    defaultAccent?: AccentColor
    storageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
    accentColor: AccentColor
    setAccentColor: (color: AccentColor) => void
    compactMode: boolean
    setCompactMode: (compact: boolean) => void
}

// Accent color HSL values
const accentColors: Record<AccentColor, { h: number; s: number; l: number }> = {
    purple: { h: 262, s: 83, l: 58 },
    blue: { h: 217, s: 91, l: 60 },
    green: { h: 142, s: 76, l: 36 },
    orange: { h: 25, s: 95, l: 53 },
    red: { h: 0, s: 84, l: 60 },
    cyan: { h: 187, s: 85, l: 43 },
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
    accentColor: "purple",
    setAccentColor: () => null,
    compactMode: false,
    setCompactMode: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "system",
    defaultAccent = "purple",
    storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    )
    const [accentColor, setAccentColor] = useState<AccentColor>(
        () => (localStorage.getItem("orbit-accent-color") as AccentColor) || defaultAccent
    )
    const [compactMode, setCompactMode] = useState<boolean>(
        () => localStorage.getItem("orbit-compact-mode") === "true"
    )

    useEffect(() => {
        const root = window.document.documentElement

        root.classList.remove("light", "dark")

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light"

            root.classList.add(systemTheme)
        } else {
            root.classList.add(theme)
        }
    }, [theme])

    // Apply accent color
    useEffect(() => {
        const root = window.document.documentElement
        const color = accentColors[accentColor]
        root.style.setProperty("--primary", `${color.h} ${color.s}% ${color.l}%`)
        root.style.setProperty("--ring", `${color.h} ${color.s}% ${color.l}%`)
    }, [accentColor])

    // Apply compact mode
    useEffect(() => {
        const root = window.document.documentElement
        if (compactMode) {
            root.classList.add("compact")
        } else {
            root.classList.remove("compact")
        }
    }, [compactMode])

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        },
        accentColor,
        setAccentColor: (color: AccentColor) => {
            localStorage.setItem("orbit-accent-color", color)
            setAccentColor(color)
        },
        compactMode,
        setCompactMode: (compact: boolean) => {
            localStorage.setItem("orbit-compact-mode", compact.toString())
            setCompactMode(compact)
        },
    }

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
