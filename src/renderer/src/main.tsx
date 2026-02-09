import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/index.css'

import { ThemeProvider } from './components/ThemeProvider'
import { Toaster } from 'sonner'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="orbit-theme">
            <App />
            <Toaster richColors theme="dark" position="top-right" closeButton />
        </ThemeProvider>
    </React.StrictMode>
)
