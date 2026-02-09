import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import AppTutorial from './AppTutorial'

export default function MainLayout() {
    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8">
                <Outlet />
                <AppTutorial />
            </main>
        </div>
    )
}
