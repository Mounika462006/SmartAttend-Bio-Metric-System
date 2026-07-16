import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);

  return (
    <div className="min-h-screen bg-surface-50 flex">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main content area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-250 ${
          collapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        <Topbar collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
