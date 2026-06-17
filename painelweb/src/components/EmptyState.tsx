import React from "react";
import { Laptop, Lock } from "lucide-react";

interface EmptyStateProps {
  currentMode: "light" | "dark";
  onToggleTheme: (theme: "light" | "dark") => void;
}

export default function EmptyState({
  currentMode,
  onToggleTheme
}: EmptyStateProps) {

  return (
    <div className={`flex flex-col h-full w-full justify-between items-center text-center p-8 transition-colors duration-200 select-none overflow-y-auto ${currentMode === "dark" ? "bg-[#222e35] text-[#e9edef]" : "bg-[#f8f9fa] text-[#41525d]"
      }`}>
      <div className="my-auto max-w-[550px] flex flex-col items-center animate-fadeIn">
        <div className={`relative flex items-center justify-center w-40 h-40 rounded-full mb-8 ${currentMode === "dark" ? "bg-[#111b21]" : "bg-[#ffffff] shadow-sm border border-[#e9edef]"
          }`}>
          <div className="absolute w-28 h-28 border border-dashed rounded-full animate-spin duration-[20s] border-emerald-500/40"></div>
          <Laptop className="w-16 h-16 text-emerald-500" />
        </div>

        <h1 className="text-3xl font-light text-emerald-500 mb-4 tracking-tight">
          HMASP Atendimento Web
        </h1>

        <p className={`text-sm leading-relaxed mb-6 ${currentMode === "dark" ? "text-[#8696a0]" : "text-[#667781]"
          }`}>
          Selecione um paciente na lista à esquerda para acompanhar o fluxo de atendimento da Inteligência Artificial em tempo real.
        </p>

        <div className="flex gap-4">
          <button
            onClick={() => onToggleTheme("light")}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${currentMode === "light"
                ? "bg-[#008069] border-[#008069] text-white"
                : "bg-transparent border-gray-500 text-gray-400 hover:text-white"
              }`}
          >
            Modo Claro
          </button>
          <button
            onClick={() => onToggleTheme("dark")}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${currentMode === "dark"
                ? "bg-[#00a884] border-[#00a884] text-white"
                : "bg-transparent border-gray-300 text-gray-600 hover:text-black"
              }`}
          >
            Modo Escuro
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] select-none opacity-60">
        <Lock className="w-3 h-3" />
        <span>Modo de Supervisão Ativo (Apenas Leitura)</span>
      </div>
    </div>
  );
}
