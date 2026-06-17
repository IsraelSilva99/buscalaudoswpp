import React, { useState, useEffect } from "react";
import { Chat, Message, PaletteConfig } from "./types";
import Sidebar from "./components/Sidebar";
import ActiveChat from "./components/ActiveChat";
import EmptyState from "./components/EmptyState";
import { supabase } from "./supabase";
import { format } from "date-fns";

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

  // Carrega e assina o banco de dados
  useEffect(() => {
    fetchChats();

    const channel = supabase
      .channel('public:chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
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
            timestamp: format(new Date(newMsg.created_at), 'HH:mm'),
            status: 'read',
            type: msgType,
            rawRole: newMsg.role
          };

          if (chatIndex > -1) {
            // Imutabilidade profunda para forçar re-render do React (garante os ticks azuis na tela)
            const chat = { ...newChats.splice(chatIndex, 1)[0] };
            chat.messages = [...chat.messages];

            const optimisticIndex = chat.messages.findIndex(m => 
              m.status === 'sent' && 
              m.text === formattedMessage.text && 
              m.sender === formattedMessage.sender
            );
            
            if (optimisticIndex > -1) {
              // Substitui a mensagem otimista pela real do servidor
              chat.messages[optimisticIndex] = formattedMessage;
            } else {
              // Checagem agressiva para evitar duplicidade causada por React StrictMode e UUIDs perdidos
              const exists = chat.messages.some(m => 
                m.id === formattedMessage.id || 
                (m.text === formattedMessage.text && m.sender === formattedMessage.sender && m.timestamp === formattedMessage.timestamp)
              );
              
              if (!exists) {
                chat.messages.push(formattedMessage);
                chat.lastSeen = formattedMessage.timestamp;
                if (activeChatRef.current !== chat.id) {
                  chat.unreadCount += 1;
                }
              }
            }
            newChats.unshift(chat);
          } else {
            const formatPhoneNumber = (num: string) => {
              const cleaned = num.replace(/\D/g, '');
              if (cleaned.length === 13 && cleaned.startsWith('55')) {
                return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
              } else if (cleaned.length === 12 && cleaned.startsWith('55')) {
                return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
              }
              return num;
            };

            newChats.unshift({
              id: newMsg.numero,
              name: formatPhoneNumber(newMsg.numero),
              avatar: newMsg.numero.substring(0, 2),
              avatarBg: "#00a884",
              statusText: "online",
              unreadCount: activeChatId === newMsg.numero ? 0 : 1,
              isGroup: false,
              lastSeen: formattedMessage.timestamp,
              messages: [formattedMessage]
            });
          }
          return newChats;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Removemos activeChatId da dependência para evitar reset do banco de dados a cada clique

  const fetchChats = async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });

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
        timestamp: format(new Date(msg.created_at), 'HH:mm'),
        status: 'read',
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
        chatsMap.set(msg.numero, {
          id: msg.numero,
          name: formatPhoneNumber(msg.numero),
          avatar: msg.numero.substring(0, 2),
          avatarBg: "#00a884",
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

    // Sort by most recent
    const sortedChats = Array.from(chatsMap.values()).sort((a, b) => {
      const lastMsgA = a.messages[a.messages.length - 1];
      const lastMsgB = b.messages[b.messages.length - 1];
      if (!lastMsgA || !lastMsgB) return 0;
      // We'd need actual dates to sort properly, but for simplicity assuming the DB returned them ordered by created_at ascending
      return -1; // They are already constructed in chronological order, so just reverse the map insertion order conceptually
    });

    // Actually, reverse the array to have newest at top
    setChats(Array.from(chatsMap.values()).reverse());
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
          timestamp: format(new Date(), 'HH:mm'),
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
