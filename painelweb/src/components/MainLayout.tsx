import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, Settings } from 'lucide-react';

export default function MainLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] dark:bg-[#0b141a] text-slate-800 dark:text-slate-200 transition-colors duration-300">
      
      {/* Global Sidebar (Premium Minimalist) */}
      <aside className="w-20 shrink-0 border-r border-slate-200 dark:border-slate-800/50 flex flex-col items-center py-6 bg-white dark:bg-[#111b21] z-50 shadow-sm relative">
        {/* Logo/Brand Icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-10">
          <span className="text-white font-bold text-lg leading-none">H</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-4 w-full px-3">
          <NavLink 
            to="/" 
            end
            className={({ isActive }) => `
              relative flex items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 group
              ${isActive 
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }
            `}
            title="Dashboard"
          >
            <LayoutDashboard className="w-6 h-6 stroke-[1.5]" />
            {/* Tooltip */}
            <span className="absolute left-16 bg-slate-800 text-white text-[10px] font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl">
              Dashboard
            </span>
          </NavLink>

          <NavLink 
            to="/chat" 
            className={({ isActive }) => `
              relative flex items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 group
              ${isActive 
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }
            `}
            title="Atendimentos"
          >
            <MessageSquareText className="w-6 h-6 stroke-[1.5]" />
            <span className="absolute left-16 bg-slate-800 text-white text-[10px] font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl">
              Atendimentos
            </span>
          </NavLink>
        </nav>

        {/* Bottom Actions */}
        <div className="mt-auto flex flex-col gap-4 w-full px-3">
          <button className="flex items-center justify-center w-full aspect-square rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-300">
            <Settings className="w-6 h-6 stroke-[1.5]" />
          </button>
          
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-2 mx-auto cursor-pointer border border-slate-300 dark:border-slate-700">
            <img src="https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff" alt="User Profile" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Outlet />
      </main>

    </div>
  );
}
