import React, { useState } from "react";
import { 
  Search, 
  MessageSquare, 
  CircleDot, 
  MoreVertical, 
  Moon, 
  Sun, 
  Users, 
  Bot, 
  MessageCircle, 
  CheckCheck, 
  Check, 
  Sparkles,
  Info
} from "lucide-react";
import { Chat } from "../types";

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  currentMode: "light" | "dark";
  onToggleTheme: (theme: "light" | "dark") => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  currentMode,
  onToggleTheme,
  searchTerm,
  onSearchChange
}: SidebarProps) {
  const [filter, setFilter] = useState<"all" | "unread" | "groups" | "ai">("all");

  const toggleThemeLocal = () => {
    onToggleTheme(currentMode === "dark" ? "light" : "dark");
  };

  // Filter logic
  const filteredChats = chats.filter(chat => {
    // 1. Text Search Filter
    const matchesSearch = chat.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      chat.messages.some(m => m.text.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    // 2. Tab Filter
    switch (filter) {
      case "unread":
        return chat.unreadCount > 0;
      case "groups":
        return chat.isGroup;
      default:
        return true;
    }
  });

  return (
    <div className={`flex flex-col h-full w-[400px] border-r transition-colors duration-200 select-none ${
      currentMode === "dark" 
        ? "bg-[#111b21] border-[#222e35] text-[#e9edef]" 
        : "bg-white border-[#e9edef] text-[#111b21]"
    }`}>
      {/* Sidebar Header */}
      <div className={`flex items-center justify-between px-4 py-3 h-[59px] ${
        currentMode === "dark" ? "bg-[#202c33]" : "bg-[#f0f2f5]"
      }`}>
        {/* Profile Avatar / Logo representation */}
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm border border-gray-200 dark:border-gray-700">
            <img src="https://i.imgur.com/zN4LUCC.png" alt="Logo" className="w-full h-full object-cover rounded-full" />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#202c33] rounded-full z-10"></span>
          </div>
          <span className="font-semibold text-xs text-emerald-500 tracking-wider">EnviaLaudos HMASP</span>
        </div>

        {/* Header action icons */}
        <div className="flex items-center gap-4 text-[#54656f] dark:text-[#aebac1]">
          {/* Theme Switcher Button */}
          <button 
            id="btn-sidebar-theme-toggle"
            onClick={toggleThemeLocal} 
            title={currentMode === "dark" ? "Modo Claro" : "Modo Escuro"}
            className="hover:bg-emerald-500/10 p-1.5 rounded-full transition-colors cursor-pointer"
          >
            {currentMode === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          <button title="Status" className="hover:bg-gray-200 dark:hover:bg-gray-700/40 p-1.5 rounded-full transition-colors cursor-pointer">
            <CircleDot className="w-5 h-5" />
          </button>
          
          <button title="Nova Conversa" className="hover:bg-gray-200 dark:hover:bg-gray-700/40 p-1.5 rounded-full transition-colors cursor-pointer">
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Input Box Section */}
      <div className="p-2 flex items-center gap-2">
        <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg flex-1 transition-all ${
          currentMode === "dark" ? "bg-[#202c33]" : "bg-[#f0f2f5]"
        }`}>
          <Search className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
          <input
            id="input-sidebar-search"
            type="text"
            placeholder="Pesquisar ou começar uma nova conversa"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-transparent border-none text-xs w-full focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Navigation filter tabs (All, Unread, Groups, AI) */}
      <div className="px-3 pb-2 pt-1 flex items-center gap-1.5 border-b border-[#e9edef] dark:border-[#222e35] overflow-x-auto text-[11px] font-medium">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
            filter === "all"
              ? "bg-[#00a884] text-white"
              : currentMode === "dark" ? "bg-[#202c33] text-gray-300 hover:bg-[#2a3942]" : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
          }`}
        >
          Tudo
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
            filter === "unread"
              ? "bg-[#00a884] text-white"
              : currentMode === "dark" ? "bg-[#202c33] text-gray-300 hover:bg-[#2a3942]" : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
          }`}
        >
          Não lidas
          {chats.some(c => c.unreadCount > 0) && (
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse"></span>
          )}
        </button>
      </div>

      {/* 4. Chat List / Contacts Stream */}
      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-gray-100 dark:divide-[#222e35]">
        {filteredChats.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-gray-400">
            Nenhuma conversa correspondente encontrada.
          </div>
        ) : (
          filteredChats.map((chat) => {
            const lastMsg = chat.messages[chat.messages.length - 1];
            const isActive = activeChatId === chat.id;

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b transition-all border-[#e9edef] dark:border-[#222e35]/40 ${
                  isActive 
                    ? currentMode === "dark" ? "bg-[#2a3942]" : "bg-[#e9edef]" 
                    : currentMode === "dark" ? "hover:bg-[#202c33]" : "hover:bg-[#f5f6f6]"
                }`}
              >
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white shrink-0 shadow-sm relative`}
                  style={{ backgroundColor: chat.avatarBg }}
                >
                  {chat.avatar}

                  {/* Online dot indicators */}
                  {chat.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4 p-1 h-4 flex items-center justify-center text-[9px] bg-emerald-500 text-white rounded-full font-bold">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>

                {/* Info and Preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-xs truncate flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
                      {chat.name}
                    </h3>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {lastMsg ? lastMsg.timestamp : ""}
                    </span>
                  </div>

                  {/* Message body preview with delivery tick */}
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-400">
                    {lastMsg && lastMsg.sender === "me" && (
                      <span>
                        {lastMsg.status === "read" ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[3px]" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-gray-400 stroke-[3px]" />
                        )}
                      </span>
                    )}

                    <p className="truncate flex-1">
                      {lastMsg ? lastMsg.text : chat.statusText}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`p-2.5 text-center text-[10px] opacity-75 border-t ${
        currentMode === "dark" ? "bg-[#111b21] border-[#2a3942]" : "bg-[#f0f2f5] border-gray-200"
      }`}>
        {searchTerm ? "Resultados da Pesquisa local" : "Supabase Realtime Conectado"}
      </div>
    </div>
  );
}
