import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Bot, ChevronDown, ChevronUp, Clock, Circle, Volume2, VolumeX } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import type { Message } from '@/types';

const PREFERRED_VOICE_NAME = 'Microsoft HsiaoChen Online (Natural) - Chinese (Taiwan)';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = text.split(/\s+/).filter(w => /[a-zA-Z]/.test(w)).length;
  return Math.ceil(chineseChars * 1.5 + englishWords * 0.75);
}

function getCleanTextForSpeech(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function pickPreferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.name === PREFERRED_VOICE_NAME) ||
    voices.find((voice) => voice.name.includes('HsiaoChen')) ||
    voices.find((voice) => voice.lang.toLowerCase() === 'zh-tw') ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith('zh'))
  );
}

export default function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const tokenCount = message.tokens || estimateTokens(message.content);
  const generationTime = message.generationTime;
  const reasoning = message.reasoning;

  const stopSpeaking = useCallback(() => {
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const startSpeaking = useCallback((textOverride?: string) => {
    if (!window.speechSynthesis) return;

    stopSpeaking();

    const text = textOverride ? textOverride : getCleanTextForSpeech(message.content).trim();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 1;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = pickPreferredVoice(voices);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [message.content, stopSpeaking]);

  const toggleSpeaking = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      startSpeaking();
    }
  }, [isSpeaking, startSpeaking, stopSpeaking]);

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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

          {/* Speech Play Button */}
          {!isLoading && message.content && (
            <button
              onClick={toggleSpeaking}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors ${
                isSpeaking
                  ? 'bg-[#4a9eff]/20 text-[#4a9eff] border-[#4a9eff]/30'
                  : 'bg-[#1a1a1a] text-gray-500 border-[#333] hover:text-[#e8e4d9]'
              }`}
              title={isSpeaking ? '停止朗读' : '朗读回复'}
            >
              {isSpeaking ? <VolumeX size={10} /> : <Volume2 size={10} />}
              <span>{isSpeaking ? '停止' : '朗读'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
