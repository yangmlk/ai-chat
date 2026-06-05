import { useEffect, useRef, useCallback, useState } from 'react';
import { Menu, Sparkles, Loader2, Bot, Presentation } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { streamChatCompletion } from '@/services/api';
import Sidebar from '@/components/Sidebar';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import PPTGenerator from '@/components/PPTGenerator';
import type { ChatRequestMessage, Message, OutgoingMessagePayload } from '@/types';

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

const IMAGE_ANALYSIS_PROMPT = '请分析这张图片，并结合我的问题回答。';

function buildImageContent(text: string, imageUrl: string): ChatRequestMessage['content'] {
  const trimmedText = text.trim();
  const parts: ChatRequestMessage['content'] = [];

  if (Array.isArray(parts)) {
    if (trimmedText) {
      parts.push({ type: 'text', text: trimmedText });
    }

    parts.push({
      type: 'image_url',
      image_url: { url: imageUrl },
    });
  }

  return parts;
}

function toApiMessage(message: Message): ChatRequestMessage {
  if (message.role === 'user' && message.image) {
    return {
      role: 'user',
      content: buildImageContent(message.content || IMAGE_ANALYSIS_PROMPT, message.image.dataUrl),
    };
  }

  return {
    role: message.role as 'user' | 'assistant',
    content: message.content,
  };
}

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
  const [showWaiting, setShowWaiting] = useState(false);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPPTGenerator, setShowPPTGenerator] = useState(false);

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
    async ({ content, image }: OutgoingMessagePayload) => {
      if (!currentConversationId) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        image,
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

      // 3秒后显示等待提示
      setShowWaiting(false);
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current);
      }
      waitingTimerRef.current = setTimeout(() => {
        setShowWaiting(true);
      }, 3000);

      try {
        // Build messages with system prompt at the beginning
        // 只保留最近 10 条历史消息，避免请求体过大
        const MAX_HISTORY = 10;
        const recentMessages = currentConversation!.messages.slice(-MAX_HISTORY);
        const historyMessages = recentMessages.map(toApiMessage);
        const currentPrompt = `${USER_PREFIX}\n\n${content.trim() || IMAGE_ANALYSIS_PROMPT}`;
        const currentUserMessage: ChatRequestMessage = image
          ? {
              role: 'user',
              content: buildImageContent(currentPrompt, image.dataUrl),
            }
          : {
              role: 'user',
              content: currentPrompt,
            };

        const apiMessages = [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          ...historyMessages,
          currentUserMessage,
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
        // 清除等待提示
        if (waitingTimerRef.current) {
          clearTimeout(waitingTimerRef.current);
        }
        setShowWaiting(false);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        let displayMessage = `抱歉，发生了错误：${errorMessage}`;

        // 处理 429 速率限制错误
        if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
          displayMessage = '请求太频繁了，请等待 1-2 分钟后再试。';
        }

        // 处理 413 请求体过大错误
        if (errorMessage.includes('413') || errorMessage.includes('Payload Too Large')) {
          displayMessage = '图片太大，无法发送。系统已自动压缩，如仍失败请尝试拍摄更小尺寸的照片。';
        }

        updateMessage(
          currentConversationId,
          assistantMessageId,
          displayMessage
        );
      } finally {
        // 清除等待提示
        if (waitingTimerRef.current) {
          clearTimeout(waitingTimerRef.current);
        }
        setShowWaiting(false);
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
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm font-medium text-gray-400 truncate">
              {currentConversation?.title || 'AI 助手'}
            </h2>
          </div>
          <button
            onClick={() => setShowPPTGenerator(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 hover:text-[#e8e4d9] transition-colors text-sm border border-[#333]"
            title="AI制作PPT"
          >
            <Presentation size={14} />
            <span>制作PPT</span>
          </button>
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

              {/* 等待中提示 */}
              {showWaiting && isLoading && (
                <div className="flex gap-3 flex-row animate-fadeIn">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[#2a2a2a] text-[#4a9eff]">
                    <Bot size={16} />
                  </div>
                  <div className="bg-[#1a1a1a] text-[#e8e4d9] rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 size={16} className="animate-spin text-[#4a9eff]" />
                      <span>等待中，正在排队...</span>
                    </div>
                  </div>
                </div>
              )}

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

        {/* PPT生成器弹窗 */}
        {showPPTGenerator && (
          <PPTGenerator onClose={() => setShowPPTGenerator(false)} />
        )}
      </main>
    </div>
  );
}
