import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export function MainLayout() {
    return (
        <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8 relative">
                <Outlet />
            </main>
        </div>
    )
}
