import type { ChatRequestMessage } from '@/types';

// Cloudflare Pages 环境检测
const isCloudflarePages = typeof window !== 'undefined' && 
  window.location.hostname.includes('pages.dev');

export async function* streamChatCompletion(
  messages: ChatRequestMessage[],
  apiKey: string,
  apiUrl: string,
  temperature: number,
  maxTokens: number
): AsyncGenerator<string, void, unknown> {
  // Cloudflare Pages 直接调用 API，其他环境使用代理
  const targetUrl = isCloudflarePages ? apiUrl : '/api/chat';
  
  const requestInit: RequestInit = isCloudflarePages
    ? {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'moonshotai/kimi-k2.6',
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      }
    : {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          temperature,
          max_tokens: maxTokens,
          apiKey,
          apiUrl,
        }),
      };

  const response = await fetch(targetUrl, requestInit);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

        const data = trimmedLine.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Ignore parse errors for malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
