import React, { useState, useRef, useEffect } from "react";
import { 
  Phone, 
  Video, 
  Search, 
  MoreVertical, 
  Smile, 
  Paperclip, 
  Mic, 
  Send, 
  X, 
  CheckCheck, 
  Check, 
  Play, 
  Pause, 
  ChevronDown, 
  FileText, 
  Image as ImageIcon, 
  Volume2, 
  MapPin, 
  User, 
  ArrowLeft,
  Bot
} from "lucide-react";
import { Chat, Message, PaletteConfig } from "../types";

interface ActiveChatProps {
  chat: Chat;
  currentMode: "light" | "dark";
  onSendMessage: (text: string, type?: "text" | "audio" | "image" | "tip") => void;
  isAITyping: boolean;
  onBackToMain: () => void;
  palette: PaletteConfig;
}

export default function ActiveChat({
  chat,
  currentMode,
  onSendMessage,
  isAITyping,
  onBackToMain,
  palette
}: ActiveChatProps) {
  const [inputText, setInputText] = useState("");
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  // Custom audio playback states
  const [activeAudioPlayingId, setActiveAudioPlayingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto scroll to message bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, isAITyping]);

  // Recording seconds counter
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingSeconds(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const handleSendText = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), "text");
    setInputText("");
    setIsEmojiOpen(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendText();
    }
  };

  const startVoiceSimulation = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
  };

  const stopSendVoiceSimulation = () => {
    setIsRecording(false);
    // Add simulated voice message
    const duration = recordingSeconds > 0 ? recordingSeconds : 5;
    onSendMessage(`Mensagem de Voz (${duration}s)`, "audio");
  };

  const cancelVoiceSimulation = () => {
    setIsRecording(false);
  };

  const handleSimulatedImageSend = () => {
    onSendMessage("https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=600&auto=format&fit=crop", "image");
    setIsAttachmentOpen(false);
  };

  const formatAudioTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  const mockEmojis = ["😀", "👍", "❤️", "🔥", "🚀", "👏", "💡", "🎯", "🤖", "🎨", "💻", "❓", "✅", "❌"];

  return (
    <div className={`flex flex-col h-full w-full relative transition-colors duration-200 select-none ${
      currentMode === "dark" ? "bg-[#0b141a]" : "bg-[#efeae2]"
    }`}>
      
      {/* Decorative WhatsApp Background Pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none select-none z-0"
        style={{
          backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`,
          backgroundSize: "400px"
        }}
      ></div>

      {/* 2. Top Chat Header */}
      <div className={`flex items-center justify-between px-4 py-2 h-[59px] border-b z-10 ${
        currentMode === "dark" ? "bg-[#202c33] border-[#2a3942] text-[#e9edef]" : "bg-[#f0f2f5] border-[#e9edef] text-[#111b21]"
      }`}>
        <div className="flex items-center gap-3">
          {/* Back button for smaller views */}
          <button 
            id="btn-chat-back"
            onClick={onBackToMain}
            className="md:hidden hover:bg-gray-200 dark:hover:bg-gray-700/50 p-1 rounded-full transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* User profile with initials */}
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white shadow-sm shrink-0"
            style={{ backgroundColor: chat.avatarBg }}
          >
            {chat.id === "ai-assistant" ? (
              <Bot className="w-5 h-5 text-sky-200" />
            ) : chat.avatar}
          </div>

          <div>
            <h2 className="text-xs font-semibold select-text flex items-center gap-1.5 {
              currentMode === 'dark' ? 'text-white' : 'text-[#111b21]'
            }">
              {chat.name}
            </h2>
            <p className="text-[10px] text-gray-400">
              {isAITyping ? (
                <span className="text-emerald-500 font-medium animate-pulse">digitando...</span>
              ) : chat.statusText}
            </p>
          </div>
        </div>

        {/* Action button triggers for header */}
        <div className="flex items-center gap-5 text-[#54656f] dark:text-[#aebac1]">
          <button title="Chamada de Vídeo (Módulo Beta)" className="hover:bg-gray-200 dark:hover:bg-gray-700/40 p-1.5 rounded-full transition-colors cursor-pointer">
            <Video className="w-5 h-5" />
          </button>
          
          <button title="Telefonar (Módulo Beta)" className="hover:bg-gray-200 dark:hover:bg-gray-700/40 p-1.5 rounded-full transition-colors cursor-pointer">
            <Phone className="w-4.5 h-4.5" />
          </button>
          
          <div className="w-[1px] h-5 bg-gray-300 dark:bg-gray-600/50"></div>

          <button title="Pesquisar Mensagem" className="hover:bg-gray-200 dark:hover:bg-gray-700/40 p-1.5 rounded-full transition-colors cursor-pointer">
            <Search className="w-4.5 h-4.5" />
          </button>

          <button title="Menu" className="hover:bg-gray-200 dark:hover:bg-gray-700/40 p-1.5 rounded-full transition-colors cursor-pointer">
            <MoreVertical className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* 3. Messages Stream Box */}
      <div className="flex-1 overflow-y-auto px-[5%] py-4 space-y-3 z-10 flex flex-col scrollbar-thin">
        {/* Soft date divider */}
        <div className="flex justify-center my-2">
          <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-md shadow-sm uppercase ${
            currentMode === "dark" ? "bg-[#182229] text-[#8696a0]" : "bg-white text-[#54656f]"
          }`}>
            Hoje
          </span>
        </div>

        {chat.messages.map((msg) => {
          const isMe = msg.sender === "me";
          const formattedText = msg.text.replace(/\n/g, '<br />');

          return (
            <div 
              key={msg.id}
              className={`flex w-full mb-1 ${isMe ? "justify-end" : "justify-start"}`}
            >
              {/* WhatsApp Styled Message Bubble */}
              <div 
                className={`relative max-w-[70%] px-3 py-1.5 rounded-xl shadow-sm text-xs border text-left ${
                  isMe 
                    ? currentMode === "dark" 
                      ? "bg-[#005c4b] border-[#005c4b] text-white rounded-tr-none" 
                      : "bg-[#d9fdd3] border-[#d9fdd3] text-[#111b21] rounded-tr-none"
                    : currentMode === "dark"
                      ? "bg-[#202c33] border-[#202c33] text-[#e9edef] rounded-tl-none"
                      : "bg-white border-white text-[#111b21] rounded-tl-none"
                }`}
              >
                {/* 1. If it's a standard text message */}
                {msg.type === "text" && (
                  <p 
                    className="leading-relaxed select-text pr-10 text-[12.5px]"
                    dangerouslySetInnerHTML={{ __html: formattedText }}
                  />
                )}

                {/* 2. If it is an image attachment */}
                {msg.type === "image" && (
                  <div className="rounded-lg overflow-hidden my-1 bg-gray-200">
                    <img 
                      src={msg.text.startsWith("http") ? msg.text : "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=600&auto=format&fit=crop"} 
                      alt="Enviado por Anexo"
                      className="max-h-[220px] max-w-full object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                    <span className="block mt-1 p-1 text-[11px] opacity-75 font-mono">Fundo WhatsApp.png</span>
                  </div>
                )}

                {/* 3. If it is an audio message */}
                {msg.type === "audio" && (
                  <div className="flex items-center gap-3.5 py-1 min-w-[220px] select-none">
                    <button
                      onClick={() => {
                        setActiveAudioPlayingId(activeAudioPlayingId === msg.id ? null : msg.id);
                      }}
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition-all transform hover:scale-105"
                    >
                      {activeAudioPlayingId === msg.id ? (
                        <Pause className="w-4 h-4 fill-white text-white" />
                      ) : (
                        <Play className="w-4 h-4 fill-white text-white pl-0.5" />
                      )}
                    </button>

                    {/* Faux Waveform indicator */}
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex gap-0.5 items-end h-6 max-w-full overflow-hidden">
                        {[4, 8, 12, 16, 12, 8, 14, 18, 15, 12, 6, 4, 10, 16, 20, 14, 8, 4, 10, 14, 6, 12, 18, 15, 8, 4].map((h, i) => (
                          <div 
                            key={i} 
                            style={{ height: `${h}px` }} 
                            className={`w-0.5 rounded-full transition-all ${
                              activeAudioPlayingId === msg.id 
                                ? "bg-emerald-500 animate-pulse" 
                                : "bg-gray-400 dark:bg-gray-600"
                            }`}
                          ></div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>{activeAudioPlayingId === msg.id ? "Reproduzindo..." : "Mensagem Gravada"}</span>
                        <span>0:05</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Message Timestamp & Checkmarks */}
                <span className={`absolute bottom-1 right-2 text-[9px] flex items-center gap-1 leading-none ${
                  isMe ? "text-emerald-200/90" : "text-gray-400"
                }`}>
                  {msg.timestamp}
                  {isMe && (
                    <span>
                      {msg.status === "read" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-300 stroke-[3px]" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-emerald-200 stroke-[3px]" />
                      )}
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}

        {/* Bottom target for scroll anchoring */}
        <div ref={messagesEndRef} />
      </div>

      {/* Simulated Typing Dots representation for active AI response */}
      {isAITyping && (
        <div className="px-[5%] py-2 flex justify-start z-10 animate-pulse">
          <div className={`px-4 py-2.5 rounded-xl text-xs rounded-tl-none border shadow-sm ${
            currentMode === "dark" ? "bg-[#202c33] border-[#202c33] text-gray-300" : "bg-white border-white text-gray-600"
          }`}>
            <span className="font-semibold text-[10px] text-emerald-500 block mb-1">Assistente de Código</span>
            <div className="flex items-center gap-1.5 py-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce duration-[1s]" style={{ animationDelay: "0ms" }}></div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce duration-[1s]" style={{ animationDelay: "200ms" }}></div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce duration-[1s]" style={{ animationDelay: "400ms" }}></div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Bottom Send Box Actions */}
      <div className={`relative px-4 py-3 flex items-center gap-3 w-full z-10 ${
        currentMode === "dark" ? "bg-[#202c33]" : "bg-[#f0f2f5]"
      }`}>
        
        {/* Attachment Options Popover */}
        {isAttachmentOpen && (
          <div className={`absolute bottom-16 left-4 p-2 rounded-xl flex flex-col gap-2 shadow-lg border animate-slideUp text-center ${
            currentMode === "dark" ? "bg-[#1f2c34] border-[#2d3b43] text-gray-200" : "bg-white border-gray-100 text-[#111b21]"
          }`}>
            <button 
              id="attachment-btn-image"
              onClick={handleSimulatedImageSend}
              className="flex items-center gap-3 p-2.5 hover:bg-emerald-500/10 text-xs text-left rounded-lg transition-colors cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-purple-500" />
              <span>Inserir Foto Wallpaper Mock</span>
            </button>
            <button 
              onClick={() => {
                onSendMessage("Documento_Esqueleto_DB.pdf (142 KB)", "text");
                setIsAttachmentOpen(false);
              }}
              className="flex items-center gap-3 p-2.5 hover:bg-emerald-500/10 text-xs text-left rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-500" />
              <span>Anexar Planejador PDF</span>
            </button>
            <button 
              onClick={() => {
                onSendMessage("Paleta_Hex_Oficial.json (1.2 KB)", "text");
                setIsAttachmentOpen(false);
              }}
              className="flex items-center gap-3 p-2.5 hover:bg-emerald-500/10 text-xs text-left rounded-lg transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-orange-500" />
              <span>Código Configs</span>
            </button>
          </div>
        )}

        {/* Emoji Selector Panel represent */}
        {isEmojiOpen && (
          <div className={`absolute bottom-16 left-4 p-3 rounded-xl shadow-lg border w-[280px] grid grid-cols-6 gap-2 animate-slideUp ${
            currentMode === "dark" ? "bg-[#1f2c34] border-[#2d3b43]" : "bg-white border-gray-100"
          }`}>
            {mockEmojis.map(em => (
              <button
                key={em}
                onClick={() => {
                  setInputText(prev => prev + em);
                }}
                className="text-lg p-1.5 hover:bg-emerald-500/15 rounded transition-all transform hover:scale-110 cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {/* Leftmost input controls */}
        <div className="flex items-center gap-3 text-[#54656f] dark:text-[#aebac1]">
          <button 
            id="btn-chat-emoji"
            onClick={() => setIsEmojiOpen(!isEmojiOpen)} 
            className={`hover:text-emerald-500 p-1 rounded-full transition-colors cursor-pointer ${isEmojiOpen ? "text-emerald-500" : ""}`}
          >
            <Smile className="w-5.5 h-5.5" />
          </button>
          <button 
            id="btn-chat-attach"
            onClick={() => setIsAttachmentOpen(!isAttachmentOpen)} 
            className={`hover:text-emerald-500 p-1 rounded-full transition-colors cursor-pointer ${isAttachmentOpen ? "text-emerald-500" : ""}`}
          >
            <Paperclip className="w-5.5 h-5.5" />
          </button>
        </div>

        {/* Microphone simulation banner overlays basic input box when active */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-4 py-2 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20 animate-pulse text-xs">
            <div className="flex items-center gap-2 font-mono font-medium">
              <span className="w-2.5 h-2.5 bg-red-600 rounded-full"></span>
              <span>Gravando: {formatAudioTime(recordingSeconds)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={cancelVoiceSimulation}
                className="px-2.5 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                id="btn-chat-audio-stop"
                onClick={stopSendVoiceSimulation}
                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded font-medium cursor-pointer"
              >
                Enviar Áudio
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-3">
            {/* Real Text Input Box */}
            <input
              id="input-chat-message"
              type="text"
              placeholder="Digite uma mensagem"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              className={`flex-1 px-4 py-2.5 rounded-lg text-xs leading-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-all ${
                currentMode === "dark" ? "bg-[#2a3942] text-[#e9edef]" : "bg-white text-[#111b21]"
              }`}
            />

            {/* Mic / Send toggle icon */}
            {inputText.trim() ? (
              <button 
                id="btn-chat-send"
                onClick={handleSendText}
                className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <Send className="w-4.5 h-4.5 pl-0.5" />
              </button>
            ) : (
              <button 
                id="btn-chat-mic"
                onClick={startVoiceSimulation}
                title="Gravar Mensagem de Voz"
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700/60 rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors shrink-0 cursor-pointer"
              >
                <Mic className="w-5.2 h-5.2" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
