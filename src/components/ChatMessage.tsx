import { useState } from 'react';
import { User, Bot, ChevronDown, ChevronUp, Clock, Circle } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import type { Message } from '@/types';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = text.split(/\s+/).filter(w => /[a-zA-Z]/.test(w)).length;
  return Math.ceil(chineseChars * 1.5 + englishWords * 0.75);
}

export default function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(true);

  const tokenCount = message.tokens || estimateTokens(message.content);
  const generationTime = message.generationTime;
  const reasoning = message.reasoning;

  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse animate-fadeIn">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[#4a9eff] text-white">
          <User size={16} />
        </div>
        <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-[#4a9eff] text-white rounded-br-md">
          {message.image && (
            <img
              src={message.image.dataUrl}
              alt="用户上传图片"
              className="mb-3 max-h-72 w-full rounded-xl object-cover border border-white/20"
            />
          )}
          {message.content && (
            <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 flex-row animate-fadeIn">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[#2a2a2a] text-[#4a9eff]">
        <Bot size={16} />
      </div>

      <div className="max-w-[85%] space-y-2">
        {/* Reasoning Section - Real thinking process */}
        {reasoning && (
          <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-[#e8e4d9] transition-colors"
            >
              {showReasoning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>思考过程</span>
            </button>
            {showReasoning && (
              <div className="px-4 pb-3 text-sm text-gray-500 leading-relaxed border-t border-[#222] pt-2 whitespace-pre-line">
                {reasoning}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="bg-[#1a1a1a] text-[#e8e4d9] rounded-2xl rounded-bl-md px-4 py-3">
          <div className="prose prose-invert max-w-none">
            <MarkdownRenderer content={message.content || '\u00A0'} />
            {isLoading && (
              <div className="flex gap-1 mt-2">
                <span className="w-2 h-2 bg-[#4a9eff] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#4a9eff] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#4a9eff] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        </div>

        {/* Meta Info Row */}
        <div className="flex items-center gap-4 px-2">
          {/* Token Count - Circle area */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Circle size={10} className="text-[#4a9eff]" />
            <span>{tokenCount} tokens</span>
          </div>

          {/* Generation Time - Rectangle area */}
          {generationTime !== undefined && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-[#1a1a1a] px-2.5 py-1 rounded-md border border-[#333]">
              <Clock size={10} className="text-[#4a9eff]" />
              <span>{(generationTime / 1000).toFixed(2)}s</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
