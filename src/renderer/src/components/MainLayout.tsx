import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function MainLayout() {
    return (
        <div className="flex h-screen bg-background print:bg-white">
            <div className="print:hidden">
                <Sidebar />
            </div>
            <main className="flex-1 overflow-auto p-8 print:p-0 print:overflow-visible">
                <Outlet />
            </main>
        </div>
    )
}
