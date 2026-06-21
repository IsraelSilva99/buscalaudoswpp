import React, { useState, useEffect, useRef } from "react";
import { Chat, Message, PaletteConfig } from "./types";
import Sidebar from "./components/Sidebar";
import ActiveChat from "./components/ActiveChat";
import EmptyState from "./components/EmptyState";
import { supabase } from "./supabase";
import { format, isToday, isYesterday } from "date-fns";

export function formatTimestamp(dateInput: string | Date) {
  const d = new Date(dateInput);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return "Ontem";
  return format(d, 'dd/MM/yyyy');
}

const currentPalette: Record<"light" | "dark", PaletteConfig> = {
  light: {
    backgroundDefault: "#f0f2f5",
    backgroundActive: "#e9edef",
    headerBackground: "#f0f2f5",
    headerIconColor: "#54656f",
    tealHeader: "#008069",
    chatBackground: "#efeae2",
    searchBarBackground: "#f0f2f5",
    inputBackground: "#ffffff",
    textPrimary: "#111b21",
    textSecondary: "#667781",
    bubbleOutgoing: "#d9fdd3",
    bubbleIncoming: "#ffffff",
    borderDefault: "#e9edef",
    badgeUnread: "#25d366",
    greenPrimary: "#00a884"
  },
  dark: {
    backgroundDefault: "#111b21",
    backgroundActive: "#2a3942",
    headerBackground: "#202c33",
    headerIconColor: "#aebac1",
    tealHeader: "#005c4b",
    chatBackground: "#0b141a",
    searchBarBackground: "#202c33",
    inputBackground: "#2a3942",
    textPrimary: "#e9edef",
    textSecondary: "#8696a0",
    bubbleOutgoing: "#005c4b",
    bubbleIncoming: "#202c33",
    borderDefault: "#222e35",
    badgeUnread: "#00a884",
    greenPrimary: "#00a884"
  }
};

export default function App() {
  const [currentMode, setCurrentMode] = useState<"light" | "dark">("dark");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const activeChatRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatRef.current = activeChatId;
  }, [activeChatId]);

  // Fecha o chat ativo ao pressionar a tecla "ESC"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveChatId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Carrega e assina o banco de dados
  useEffect(() => {
    fetchChats();

    // Canal estático para não estourar o limite de canais do Supabase se o usuário der muito F5
    const channel = supabase
      .channel('painel-web-chat')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, payload => {
        const updatedMsg = payload.new;
        setChats(prevChats => {
          const newChats = [...prevChats];
          for (let i = 0; i < newChats.length; i++) {
            const msgIndex = newChats[i].messages.findIndex(m => m.id === updatedMsg.id);
            if (msgIndex > -1) {
              const chat = { ...newChats[i] };
              chat.messages = [...chat.messages];
              chat.messages[msgIndex] = { ...chat.messages[msgIndex], status: updatedMsg.status || chat.messages[msgIndex].status };
              newChats[i] = chat;
              break;
            }
          }
          return newChats;
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async payload => {
        const newMsg = payload.new;
        
        setChats(prevChats => {
          const chatIndex = prevChats.findIndex(c => c.id === newMsg.numero);
          let newChats = [...prevChats];

          let text = newMsg.mensagem;
          let msgType: "text" | "pdf" | "system" = "text";
          
          if (text.startsWith('[[PDF_FLAG]]')) {
            text = text.replace('[[PDF_FLAG]]', '');
            msgType = "pdf";
          } else if (text.startsWith('[[SYSTEM_FLAG]]')) {
            text = text.replace('[[SYSTEM_FLAG]]', '');
            msgType = "system";
          }

          const formattedMessage: Message = {
            id: newMsg.id,
            sender: (newMsg.role === 'assistant' || newMsg.role === 'supervisor') ? 'me' : 'them',
            text: text,
            timestamp: formatTimestamp(newMsg.created_at),
            status: newMsg.status || 'sent',
            type: msgType,
            rawRole: newMsg.role
          };

          if (chatIndex > -1) {
            // Chat já existe, atualizamos instantaneamente sem bloquear por await
            const chat = { ...newChats.splice(chatIndex, 1)[0] };
            chat.messages = [...chat.messages];

            const exists = chat.messages.some(m => m.id === formattedMessage.id);
            if (!exists) {
              chat.messages.push(formattedMessage);
              chat.lastSeen = formattedMessage.timestamp;
              if (activeChatRef.current !== chat.id && formattedMessage.sender === 'them') {
                chat.unreadCount += 1;
              }
            }
            newChats.unshift(chat);
            return newChats;
          } else {
            // Chat novo, precisamos buscar o nome do contato assincronamente (fora do loop síncrono principal)
            // Aqui despachamos uma rotina independente
            supabase.from('contacts').select('name').eq('numero', newMsg.numero).maybeSingle().then(({ data }) => {
              const contactName = data ? data.name : undefined;
              
              setChats(currentChats => {
                // Checa novamente para garantir
                if (currentChats.some(c => c.id === newMsg.numero)) return currentChats;
                
                let updatedChats = [...currentChats];
                const formatPhoneNumber = (num: string) => {
                  const cleaned = num.replace(/\D/g, '');
                  if (cleaned.length === 13 && cleaned.startsWith('55')) {
                    return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
                  } else if (cleaned.length === 12 && cleaned.startsWith('55')) {
                    return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
                  }
                  return num;
                };

                const colors = ["#00a884", "#25D366", "#34B7F1", "#FF7A00", "#E1306C", "#FCAF45", "#833AB4", "#405DE6"];
                const colorIndex = newMsg.numero.split('').reduce((a: number, b: string) => a + b.charCodeAt(0), 0) % colors.length;

                updatedChats.unshift({
                  id: newMsg.numero,
                  name: formatPhoneNumber(newMsg.numero),
                  profileName: contactName,
                  avatar: contactName ? contactName.charAt(0).toUpperCase() : newMsg.numero.substring(0, 2),
                  avatarBg: colors[colorIndex],
                  statusText: "online",
                  unreadCount: (activeChatId !== newMsg.numero && formattedMessage.sender === 'them') ? 1 : 0,
                  isGroup: false,
                  lastSeen: formattedMessage.timestamp,
                  messages: [formattedMessage]
                });
                return updatedChats;
              });
            });
            return newChats; // Retorna sem alterações até a query terminar
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Removemos activeChatId da dependência para evitar reset do banco de dados a cada clique

  const fetchChats = async () => {
    // 1. Busca nomes de contato
    const { data: contactsData } = await supabase.from('contacts').select('*');
    const contactsMapData = new Map<string, string>();
    if (contactsData) {
      contactsData.forEach((c: any) => contactsMapData.set(c.numero, c.name));
    }

    // 2. Busca mensagens
    const { data: rawData, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    const data = rawData ? rawData.reverse() : [];

    if (error) {
      console.error('Erro ao buscar histórico:', error);
      return;
    }

    const chatsMap = new Map<string, Chat>();

    data.forEach(msg => {
      const isBotOrSupervisor = msg.role === 'assistant' || msg.role === 'supervisor';
      let text = msg.mensagem;
      let msgType: "text" | "pdf" | "system" = "text";
      
      if (text.startsWith('[[PDF_FLAG]]')) {
        text = text.replace('[[PDF_FLAG]]', '');
        msgType = "pdf";
      } else if (text.startsWith('[[SYSTEM_FLAG]]')) {
        text = text.replace('[[SYSTEM_FLAG]]', '');
        msgType = "system";
      }

      const formattedMessage: Message = {
        id: msg.id,
        sender: isBotOrSupervisor ? 'me' : 'them',
        text: text,
        timestamp: formatTimestamp(msg.created_at),
        status: msg.status || 'sent',
        type: msgType,
        rawRole: msg.role
      };

      const formatPhoneNumber = (num: string) => {
        const cleaned = num.replace(/\D/g, '');
        if (cleaned.length === 13 && cleaned.startsWith('55')) {
          return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
        } else if (cleaned.length === 12 && cleaned.startsWith('55')) {
          return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
        }
        return num;
      };

      if (!chatsMap.has(msg.numero)) {
        const contactName = contactsMapData.get(msg.numero);
        const colors = ["#00a884", "#25D366", "#34B7F1", "#FF7A00", "#E1306C", "#FCAF45", "#833AB4", "#405DE6"];
        const colorIndex = msg.numero.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % colors.length;

        chatsMap.set(msg.numero, {
          id: msg.numero,
          name: formatPhoneNumber(msg.numero),
          profileName: contactName,
          avatar: contactName ? contactName.charAt(0).toUpperCase() : msg.numero.substring(0, 2),
          avatarBg: colors[colorIndex],
          statusText: "online",
          unreadCount: 0,
          isGroup: false,
          lastSeen: formattedMessage.timestamp,
          messages: [formattedMessage]
        });
      } else {
        const chat = chatsMap.get(msg.numero)!;
        const exists = chat.messages.some(m => m.id === formattedMessage.id);
        if (!exists) {
          chat.messages.push(formattedMessage);
          chat.lastSeen = formattedMessage.timestamp;
        }
      }
    });

    // Sort by absolute chronological order of the last message in `data` (which is already correctly sorted by DB)
    const sortedChats = Array.from(chatsMap.values()).sort((a, b) => {
      const lastMsgAId = a.messages[a.messages.length - 1]?.id;
      const lastMsgBId = b.messages[b.messages.length - 1]?.id;
      
      const indexA = data.findIndex(d => d.id === lastMsgAId);
      const indexB = data.findIndex(d => d.id === lastMsgBId);
      
      // We want descending order (newest top), so indexB - indexA
      return indexB - indexA;
    });

    setChats(sortedChats);
  };

  const handleToggleTheme = (theme: "light" | "dark") => {
    setCurrentMode(theme);
  };

  const palette = currentPalette[currentMode];

  const handleSendMessage = async (text: string, type: string = "text") => {
    if (!activeChatId || !text.trim()) return;

    const msgId = crypto.randomUUID(); // Gera um ID único para a mensagem otimista
    let mensagemFinal = text;
    if (type === 'pdf') mensagemFinal = '[[PDF_FLAG]]' + text;
    if (type === 'system') mensagemFinal = '[[SYSTEM_FLAG]]' + text;

    // --- Atualização Otimista da Interface (Melhora Fluidez) ---
    setChats(prevChats => {
      let newChats = [...prevChats];
      const chatIndex = newChats.findIndex(c => c.id === activeChatId);
      if (chatIndex > -1) {
        const chat = { ...newChats.splice(chatIndex, 1)[0] }; // Clona para evitar mutação no StrictMode
        const newMsg: Message = {
          id: msgId,
          sender: 'me',
          text: text,
          timestamp: formatTimestamp(new Date()),
          status: 'sent',
          type: type as any,
          rawRole: 'supervisor'
        };
        chat.messages = [...chat.messages, newMsg];
        newChats.unshift(chat); // Sobe o chat pro topo
      }
      return newChats;
    });
    // -------------------------------------------------------------

    try {
      const { error } = await supabase.from('chat_messages').insert([{
        id: msgId,
        numero: activeChatId,
        role: 'supervisor',
        mensagem: mensagemFinal,
        created_at: new Date().toISOString()
      }]);
      if (error) {
        console.error('Supabase Insert Error:', error);
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
    );
  };

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  return (
    <div className={`relative flex h-screen w-screen overflow-hidden font-sans select-none antialiased transition-colors duration-250 ${currentMode === "dark" ? "bg-[#0b141a] text-[#e9edef]" : "bg-[#f0f2f5] text-[#111b21]"
      }`}>
      {currentMode === "light" && (
        <div
          className="absolute top-0 left-0 right-0 h-[127px] pointer-events-none z-0 transition-colors duration-200"
          style={{ backgroundColor: palette.tealHeader }}
        ></div>
      )}

      <div className="absolute inset-0 max-w-[1600px] xl:w-[95%] xl:h-[95%] m-auto xl:rounded-xl shadow-2xl flex overflow-hidden z-10 border border-[#222d34]/20">

        <div className={`h-full shrink-0 ${activeChatId ? "hidden md:flex" : "flex w-full md:w-auto"}`}>
          <Sidebar
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            currentMode={currentMode}
            onToggleTheme={handleToggleTheme}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>

        <div className={`flex-1 h-full ${!activeChatId ? "hidden md:flex" : "flex"}`}>
          {activeChat ? (
            <ActiveChat
              chat={activeChat}
              currentMode={currentMode}
              onSendMessage={handleSendMessage}
              isAITyping={false}
              onBackToMain={() => setActiveChatId(null)}
              palette={palette}
            />
          ) : (
            <EmptyState
              currentMode={currentMode}
              onToggleTheme={handleToggleTheme}
            />
          )}
        </div>
      </div>
    </div>
  );
}
