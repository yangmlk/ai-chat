import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation, Message, Settings } from '@/types';

interface AppState {
  conversations: Conversation[];
  currentConversationId: string | null;
  settings: Settings;
  isSidebarOpen: boolean;
  isLoading: boolean;
  currentTokens: number;

  addConversation: () => string;
  deleteConversation: (id: string) => void;
  setCurrentConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, content: string, reasoning?: string) => void;
  updateMessageMeta: (conversationId: string, messageId: string, meta: Partial<Message>) => void;
  addTokens: (conversationId: string, tokens: number) => void;
  setCurrentTokens: (tokens: number) => void;
  setSettings: (settings: Partial<Settings>) => void;
  toggleSidebar: () => void;
  setIsLoading: (loading: boolean) => void;
  clearConversations: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  apiKey: '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',
  apiUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
  temperature: 0.7,
  maxTokens: 4096,
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function estimateTokens(text: string): number {
  // Rough estimate: ~1.5 tokens per Chinese char, ~0.75 per English word
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = text.split(/\s+/).filter(w => /[a-zA-Z]/.test(w)).length;
  return Math.ceil(chineseChars * 1.5 + englishWords * 0.75);
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      settings: DEFAULT_SETTINGS,
      isSidebarOpen: true,
      isLoading: false,
      currentTokens: 0,

      addConversation: () => {
        const newConversation: Conversation = {
          id: generateId(),
          title: '新对话',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          totalTokens: 0,
        };
        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversationId: newConversation.id,
        }));
        return newConversation.id;
      },

      deleteConversation: (id: string) => {
        set((state) => {
          const newConversations = state.conversations.filter((c) => c.id !== id);
          let newCurrentId = state.currentConversationId;
          if (state.currentConversationId === id) {
            newCurrentId = newConversations.length > 0 ? newConversations[0].id : null;
          }
          return {
            conversations: newConversations,
            currentConversationId: newCurrentId,
          };
        });
      },

      setCurrentConversation: (id: string) => {
        set({ currentConversationId: id });
      },

      addMessage: (conversationId: string, message: Message) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, message],
                  updatedAt: Date.now(),
                  title:
                    conv.messages.length === 0 && message.role === 'user'
                      ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
                      : conv.title,
                }
              : conv
          ),
        }));
      },

      updateMessage: (conversationId: string, messageId: string, content: string, reasoning?: string) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === messageId
                      ? { ...msg, content, ...(reasoning !== undefined && { reasoning }) }
                      : msg
                  ),
                  updatedAt: Date.now(),
                }
              : conv
          ),
        }));
      },

      updateMessageMeta: (conversationId: string, messageId: string, meta: Partial<Message>) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...meta } : msg
                  ),
                  updatedAt: Date.now(),
                }
              : conv
          ),
        }));
      },

      addTokens: (conversationId: string, tokens: number) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? { ...conv, totalTokens: conv.totalTokens + tokens }
              : conv
          ),
        }));
      },

      setCurrentTokens: (tokens: number) => {
        set({ currentTokens: tokens });
      },

      setSettings: (newSettings: Partial<Settings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      toggleSidebar: () => {
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
      },

      setIsLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      clearConversations: () => {
        set({ conversations: [], currentConversationId: null });
      },
    }),
    {
      name: 'ai-chat-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
        settings: state.settings,
      }),
    }
  )
);
