import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_TEXT_MODEL = process.env.TEXT_MODEL || 'moonshotai/kimi-k2.6';
const DEFAULT_VISION_MODEL = process.env.VISION_MODEL || 'meta/llama-3.2-90b-vision-instruct';

function hasImageContent(messages = []) {
  return messages.some(
    (message) =>
      Array.isArray(message?.content) &&
      message.content.some((part) => part?.type === 'image_url' && part?.image_url?.url)
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from dist folder
app.use(express.static(path.join(__dirname, '../dist')));

// API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, temperature, max_tokens, apiKey, apiUrl } = req.body;
    const model = hasImageContent(messages) ? DEFAULT_VISION_MODEL : DEFAULT_TEXT_MODEL;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: errorText || `HTTP error! status: ${response.status}`,
      });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'No response body' });
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
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }

          res.write(`data: ${data}\n\n`);
        }
      }

      if (buffer.trim()) {
        const trimmedLine = buffer.trim();
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6);
          if (data !== '[DONE]') {
            res.write(`data: ${data}\n\n`);
          }
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (streamError) {
      console.error('Stream error:', streamError);
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
      res.end();
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('API error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' })}\n\n`);
      res.end();
    }
  }
});

// Serve index.html for all other routes (SPA)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
