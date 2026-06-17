export interface Message {
  id: string;
  sender: "me" | "them";
  text: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
  type: "text" | "image" | "audio" | "tip";
  fileDuration?: number; // duration in seconds for audio
  imageUrl?: string;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string; // Dynamic avatar letters or symbol
  avatarBg: string; // Tailwind hex or class color
  statusText: string;
  lastSeen?: string;
  unreadCount: number;
  isGroup: boolean;
  messages: Message[];
}

export interface PaletteConfig {
  backgroundDefault: string;
  backgroundActive: string;
  headerBackground: string;
  headerIconColor: string;
  tealHeader: string;
  chatBackground: string;
  searchBarBackground: string;
  inputBackground: string;
  textPrimary: string;
  textSecondary: string;
  bubbleOutgoing: string;
  bubbleIncoming: string;
  borderDefault: string;
  badgeUnread: string;
  greenPrimary: string;
}

