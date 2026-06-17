import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini client to prevent crashes if key is initially empty
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("⚠️ Warning: GEMINI_API_KEY is not configured or has default value.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Get WhatsApp Web technical tips & suggestions (colors, db, features)
app.get("/api/configs", (req, res) => {
  res.json({
    themeColors: {
      light: {
        backgroundDefault: "#f0f2f5", // Light gray background
        backgroundActive: "#e9edef",  // Chat hover / active state
        headerBackground: "#f0f2f5",  // Sidebar/chat header
        headerIconColor: "#54656f",   // Icons like status, search
        tealHeader: "#008069",        // WhatsApp header bar (classic)
        chatBackground: "#efeae2",    // Chat panel beige wall
        searchBarBackground: "#f0f2f5", // Search inputs
        inputBackground: "#ffffff",   // Text box
        textPrimary: "#111b21",       // Dark text
        textSecondary: "#667781",     // Muted gray text
        bubbleOutgoing: "#d9fdd3",    // Sent message bubble (light green)
        bubbleIncoming: "#ffffff",    // Received message bubble (white)
        borderDefault: "#e9edef",     // Borders and lines
        badgeUnread: "#25d366",       // WhatsApp notification green
        greenPrimary: "#00a884",      // Logo and highlight teal-green
      },
      dark: {
        backgroundDefault: "#111b21", // Very dark blue/gray
        backgroundActive: "#2a3942",  // Hover/active state
        headerBackground: "#202c33",  // Sidebar/chat header dark
        headerIconColor: "#aebac1",   // Light gray icons
        tealHeader: "#005c4b",        // Dark teal accent
        chatBackground: "#0b141a",    // Very dark blue/black background
        searchBarBackground: "#202c33", // Dark search
        inputBackground: "#2a3942",   // Dark message bar
        textPrimary: "#e9edef",       // Near white
        textSecondary: "#8696a0",     // Medium gray
        bubbleOutgoing: "#005c4b",    // Dark teal bubble for outgoing
        bubbleIncoming: "#202c33",    // Dark gray bubble for incoming
        borderDefault: "#222e35",     // Border dividers
        badgeUnread: "#00a884",       // Message count green badge
        greenPrimary: "#00a884",      // Primary brand green
      }
    },
    databaseDesign: {
      relational: {
        description: "Recomendado para estruturas clássicas SQL (PostgreSQL, SQLite, MySQL)",
        tables: [
          {
            name: "users",
            columns: [
              "id VARCHAR PRIMARY KEY",
              "phone_number VARCHAR UNIQUE NOT NULL",
              "display_name VARCHAR NOT NULL",
              "profile_avatar VARCHAR",
              "status_message VARCHAR DEFAULT 'Olá! Estou usando o WhatsApp'",
              "last_seen_at TIMESTAMP WITH TIME ZONE",
              "created_at TIMESTAMP DEFAULT NOW()"
            ]
          },
          {
            name: "chats (conversas)",
            columns: [
              "id VARCHAR PRIMARY KEY",
              "type VARCHAR NOT NULL -- 'direct' ou 'group'",
              "name VARCHAR -- Nulo para direto, preenchido para grupos",
              "avatar_url VARCHAR",
              "created_by_user_id VARCHAR REFERENCES users(id)",
              "created_at TIMESTAMP DEFAULT NOW()"
            ]
          },
          {
            name: "chat_members",
            columns: [
              "chat_id VARCHAR REFERENCES chats(id) ON DELETE CASCADE",
              "user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE",
              "joined_at TIMESTAMP DEFAULT NOW()",
              "role VARCHAR DEFAULT 'member' -- 'admin', 'member'",
              "PRIMARY KEY (chat_id, user_id)"
            ]
          },
          {
            name: "messages",
            columns: [
              "id VARCHAR PRIMARY KEY",
              "chat_id VARCHAR REFERENCES chats(id) ON DELETE CASCADE",
              "sender_id VARCHAR REFERENCES users(id)",
              "content_type VARCHAR NOT NULL -- 'text', 'image', 'audio', 'document'",
              "content TEXT NOT NULL -- Texto plano ou URL do arquivo",
              "file_size INTEGER -- Para mídias",
              "file_duration INTEGER -- Para mensagens de voz",
              "status VARCHAR DEFAULT 'sent' -- 'sent', 'delivered', 'read'",
              "created_at TIMESTAMP DEFAULT NOW()"
            ]
          }
        ]
      },
      nosql: {
        description: "Recomendado para Firebase Cloud Firestore (NoSQL orientado a Documentos/Coleções)",
        collections: [
          {
            name: "users",
            fields: {
              uid: "String (ID do Auth)",
              phoneNumber: "String",
              displayName: "String",
              avatarUrl: "String",
              statusText: "String",
              lastSeen: "Timestamp",
              isOnline: "Boolean"
            }
          },
          {
            name: "chats",
            fields: {
              chatId: "String",
              type: "String ('direct' | 'group')",
              memberIds: "Array<String> (IDs dos participantes)",
              lastMessage: {
                content: "String",
                senderId: "String",
                timestamp: "Timestamp",
                type: "String"
              },
              unreadCounts: "Map<String, Number> (Chaves dão os uids dos membros e valores as quantias)"
            },
            subcollections: [
              {
                name: "messages",
                fields: {
                  messageId: "String",
                  senderId: "String",
                  content: "String",
                  type: "String ('text'|'image'|'audio')",
                  timestamp: "Timestamp",
                  status: "String ('sent' | 'delivered' | 'read')",
                  reactions: "Array<{userId, emoji}>"
                }
              }
            ]
          }
        ]
      }
    },
    developmentTips: [
      {
        id: "websockets",
        title: "Comunicação em Tempo Real",
        tip: "Para mensagens instantâneas e estado 'digitando...', use Socket.IO ou WebSockets puros no Node.js. Se estiver usando o Firebase, aproveite os listeners nativos onSnapshot() que sincronizam automaticamente em tempo real.",
      },
      {
        id: "media_handling",
        title: "Formatos de Mensagem de Voz",
        tip: "Para áudios gravados no navegador, utilize a MediaRecorder API gerando arquivos .ogg ou .webm (Opus codec). Eles são extremamente leves e super compatíveis com celulares e navegadores.",
      },
      {
        id: "avatar_avatars",
        title: "Avatar Dinâmico",
        tip: "Se o usuário ainda não tiver foto de perfil, faça como o WhatsApp: gere um avatar padrão com as iniciais do nome sobre um fundo com cor pastel aleatória calculada a partir do hash do ID do usuário.",
      },
      {
        id: "indexing",
        title: "Performance de Lista de Mensagens",
        tip: "Ao carregar conversas com milhares de mensagens, utilize scroll virtual (virtual list windowing) com bibliotecas como @tanstack/react-virtual para renderizar apenas os balões visíveis na tela, economizando memória.",
      }
    ]
  });
});

// 2. Chat with AI Project Assistant for customized dev recommendations
app.post("/api/chat/assistant", async (req, res) => {
  const { messages, userMessage } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: "Parâmetro userMessage é obrigatório." });
  }

  try {
    const ai = getGeminiClient();

    if (!ai) {
      // Return a simulated high-quality offline technical response if Gemini API key isn't provided or set
      return res.json({
        text: `Olá! Sou o seu Assistente de Projeto Inteligente (modo de compatibilidade). 😊

Identifiquei que sua chave **GEMINI_API_KEY** não está configurada nos Secrets da lateral ou do painel, mas preparei uma ótima resposta técnica para te ajudar!

Você perguntou algo relacionado ao WhatsApp Web. Deixe-me dar as melhores dicas práticas para essa sua dúvida:

1. **Estrutura de Estado**: No React, para as mensagens e chats, mantenha um estado centralizado indexado por ID de chat \`Record<string, Message[]>\`. Assim, ao receber uma mensagem em tempo real, você atualiza apenas a sub-lista correspondente de forma instantânea.
2. **Tempo Real**: Implemente conexões persistentes para controle de presença:
   - Evento 'presence': atualiza o cabeçalho para "Online" ou "Digitando...".
   - Evento 'message': envia e recebe conteúdo estruturado em JSON com as chaves \`{ id, chatId, senderId, content, timestamp, status }\`.
3. **Persistência Local (Offline First)**: Para tornar a experiência de rastejamento de chats imediata como no WhatsApp Web oficial, use **IndexedDB** (via biblioteca \`idb\` ou \`localforage\`) para guardar as últimas 50 mensagens de cada conversa cacheada no navegador.

*Para respostas completas, generativas e personalizadas à sua pergunta, adicione sua chave de API nos Secrets (*\`GEMINI_API_KEY\`*) no menu superior ou lateral!*`
      });
    }

    // Build chat context using previous history if supplied
    const chatHistory = Array.isArray(messages)
      ? messages.map((m: any) => ({
          role: m.sender === "me" ? "user" as const : "model" as const,
          parts: [{ text: m.text }],
        }))
      : [];

    const systemInstruction = 
      "Você é um engenheiro de software sênior brilhante especialista em engenharia de sistemas de mensagens instantâneas e interfaces de alta performance (como WhatsApp Web e Telegram). " +
      "Seu papel é responder às perguntas do desenvolvedor que está construindo um clone do WhatsApp Web. " +
      "As dúvidas podem ser de CSS, design system, paleta de cores (Verde WhatsApp, cinzas de fundo), WebSockets, WebRTC para chamadas, banco de dados (SQL, NoSQL, Firebase), otimização de renderização de listas, gravação de áudio, segurança, criptografia de ponta a ponta, etc. " +
      "Forneça respostas em português de forma clara, amigável, acolhedora e extremamente prestativa. " +
      "Sempre que adequado, inclua pequenos exemplos de código explicativos, esquemas de tabelas ou snippets Tailwind CSS impecáveis. Seja super objetivo e foque no sucesso do projeto dele.";

    // Call Gemini API using modern SDK pattern
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...chatHistory,
        { role: "user", parts: [{ text: userMessage }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({
      error: "Ocorreu um erro ao processar sua requisição com o Assistente de Inteligência Artificial.",
      details: error.message
    });
  }
});

// -------------------------------------------------------------
// Vite and Static Assets & Server Bootstrap
// -------------------------------------------------------------
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

bootstrap();
