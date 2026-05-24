import { useEffect, useRef, useCallback } from 'react';
import { Menu, Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { streamChatCompletion } from '@/services/api';
import Sidebar from '@/components/Sidebar';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import type { Message } from '@/types';

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = text.split(/\s+/).filter(w => /[a-zA-Z]/.test(w)).length;
  return Math.ceil(chineseChars * 1.5 + englishWords * 0.75);
}

const SYSTEM_PROMPT = `You must follow this exact output format. No exceptions.`;

const USER_PREFIX = `Before answering, think step by step. Write your COMPLETE thinking first, then a separator line, then your COMPLETE answer.

Format:
[Your detailed step-by-step reasoning process here - at least 2-3 sentences analyzing the user's message]

---

[Your complete final answer here - ALL of your response to the user]

CRITICAL RULES:
1. Write your FULL reasoning BEFORE the --- separator
2. Write your FULL answer AFTER the --- separator
3. NEVER split your answer across both sections
4. The --- line must have nothing else on it
5. Write reasoning in Chinese if the user writes in Chinese

Now respond to: `;

export default function Home() {
  const {
    conversations,
    currentConversationId,
    settings,
    isLoading,
    currentTokens,
    addConversation,
    addMessage,
    updateMessage,
    updateMessageMeta,
    addTokens,
    setCurrentTokens,
    setIsLoading,
    toggleSidebar,
  } = useStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages]);

  // Auto-create first conversation if none exists
  useEffect(() => {
    if (conversations.length === 0) {
      addConversation();
    }
  }, []);

  // Update current tokens in real-time during streaming
  useEffect(() => {
    if (isLoading && currentConversation) {
      const lastMessage = currentConversation.messages[currentConversation.messages.length - 1];
      if (lastMessage?.role === 'assistant') {
        const tokens = estimateTokens(lastMessage.content);
        setCurrentTokens(tokens);
      }
    }
  }, [currentConversation?.messages, isLoading]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!currentConversationId) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      addMessage(currentConversationId, userMessage);
      setIsLoading(true);
      startTimeRef.current = Date.now();
      setCurrentTokens(0);

      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        reasoning: '',
        timestamp: Date.now(),
      };

      addMessage(currentConversationId, assistantMessage);

      try {
        // Build messages with system prompt at the beginning
        const historyMessages = currentConversation!.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const apiMessages = [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          ...historyMessages,
          { role: 'user' as const, content: `${USER_PREFIX}\n\n${content}` },
        ];

        const stream = streamChatCompletion(
          apiMessages,
          settings.apiKey,
          settings.apiUrl,
          settings.temperature,
          settings.maxTokens
        );

        let fullText = '';

        for await (const chunk of stream) {
          fullText += chunk;

          // Split by separator ---
          const separatorIndex = fullText.indexOf('\n---\n');
          if (separatorIndex !== -1) {
            const reasoning = fullText.slice(0, separatorIndex).trim();
            const content = fullText.slice(separatorIndex + 5).trim();
            updateMessage(
              currentConversationId,
              assistantMessageId,
              content,
              reasoning || undefined
            );
          } else {
            // No separator yet, show everything as reasoning
            updateMessage(
              currentConversationId,
              assistantMessageId,
              '',
              fullText.trim() || undefined
            );
          }
        }

        // Final split
        const finalSeparatorIndex = fullText.indexOf('\n---\n');
        let fullReasoning = '';
        let fullContent = '';

        if (finalSeparatorIndex !== -1) {
          fullReasoning = fullText.slice(0, finalSeparatorIndex).trim();
          fullContent = fullText.slice(finalSeparatorIndex + 5).trim();
        } else {
          // No separator found, treat all as reasoning and also as content
          fullReasoning = fullText.trim();
          fullContent = fullText.trim();
        }

        // Finalize message
        const generationTime = Date.now() - startTimeRef.current;
        const finalTokens = estimateTokens(fullContent || fullReasoning);

        updateMessageMeta(currentConversationId, assistantMessageId, {
          tokens: finalTokens,
          generationTime,
          reasoning: fullReasoning || undefined,
        });

        addTokens(currentConversationId, finalTokens);
        setCurrentTokens(finalTokens);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        let displayMessage = `抱歉，发生了错误：${errorMessage}`;

        // 处理 429 速率限制错误
        if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
          displayMessage = '请求太频繁了，请等待 1-2 分钟后再试。NVIDIA API 对免费用户有速率限制。';
        }

        updateMessage(
          currentConversationId,
          assistantMessageId,
          displayMessage
        );
      } finally {
        setIsLoading(false);
      }
    },
    [currentConversationId, currentConversation, settings, addMessage, updateMessage, updateMessageMeta, addTokens, setCurrentTokens, setIsLoading]
  );

  const totalTokens = currentConversation?.totalTokens || 0;

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-[#e8e4d9]">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-[#222]">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 transition-colors"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-sm font-medium text-gray-400 truncate">
            {currentConversation?.title || 'AI 助手'}
          </h2>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {currentConversation?.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-6">
                <Sparkles size={28} className="text-[#4a9eff]" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">有什么可以帮你的？</h2>
              <p className="text-gray-500 max-w-md">
                开始一个新的对话，或者从左侧选择已有的对话记录。
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {currentConversation?.messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLoading={isLoading && message.role === 'assistant' && message.content === ''}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Token Stats Bar */}
        <div className="border-t border-[#222] bg-[#0a0a0a] px-4 py-2 flex justify-center">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>总token数</span>
            <span className="text-[#4a9eff] font-mono">{totalTokens.toLocaleString()}</span>
            <span className="text-gray-600">|</span>
            <span>已用token</span>
            <span className="text-[#4a9eff] font-mono">
              {isLoading ? currentTokens.toLocaleString() : (currentConversation?.messages[currentConversation.messages.length - 1]?.tokens || 0).toLocaleString()}
            </span>
            {isLoading && (
              <span className="w-1.5 h-1.5 bg-[#4a9eff] rounded-full animate-pulse ml-1" />
            )}
          </div>
        </div>

        {/* Input Area */}
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </main>
    </div>
  );
}
