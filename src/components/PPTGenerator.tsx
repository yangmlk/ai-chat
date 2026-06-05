import { useState, useCallback } from 'react';
import { FileText, Loader2, X, Download, Presentation } from 'lucide-react';
import { useStore } from '@/store/useStore';

interface PPTSlide {
  title: string;
  content: string[];
}

interface PPTGeneratorProps {
  onClose: () => void;
}

export default function PPTGenerator({ onClose }: PPTGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [slides, setSlides] = useState<PPTSlide[]>([]);
  const { settings } = useStore();

  const generatePPTContent = useCallback(async (pptTopic: string) => {
    const response = await fetch(settings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2.6',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的PPT制作助手。请根据用户提供的主题，生成一个结构清晰的PPT大纲。

要求：
1. 生成6-10页PPT内容
2. 每页包含标题和要点（3-5个要点）
3. 内容要专业、简洁、有条理
4. 使用中文输出

输出格式（严格按此格式）：
第1页
标题：[标题内容]
要点：
- [要点1]
- [要点2]
- [要点3]

第2页
标题：[标题内容]
要点：
- [要点1]
- [要点2]
- [要点3]

...以此类推`
          },
          {
            role: 'user',
            content: `请帮我制作一个关于"${pptTopic}"的PPT`
          }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error('生成失败');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }, [settings]);

  const parsePPTContent = (content: string): PPTSlide[] => {
    const slides: PPTSlide[] = [];
    const pageRegex = /第(\d+)页\s*标题：(.+?)\s*要点：((?:\s*- .+?)*)/gs;
    
    let match;
    while ((match = pageRegex.exec(content)) !== null) {
      const title = match[2].trim();
      const pointsText = match[3].trim();
      const points = pointsText
        .split('\n')
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0);
      
      slides.push({ title, content: points });
    }

    return slides;
  };

  const generatePPT = useCallback(async () => {
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);
    setProgress('正在生成PPT内容...');
    setSlides([]);

    try {
      // 1. 生成PPT内容
      const content = await generatePPTContent(topic.trim());
      
      // 2. 解析内容
      setProgress('正在解析内容...');
      const parsedSlides = parsePPTContent(content);
      
      if (parsedSlides.length === 0) {
        throw new Error('无法解析PPT内容');
      }

      setSlides(parsedSlides);
      setProgress('内容生成完成！');
    } catch (error) {
      console.error('PPT生成错误:', error);
      setProgress('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [topic, isGenerating, generatePPTContent]);

  const downloadPPT = useCallback(async () => {
    if (slides.length === 0) return;

    setProgress('正在生成PPT文件...');

    try {
      // 动态导入 pptxgenjs
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();

      // 设置PPT属性
      pptx.title = topic;
      pptx.author = 'AI助手';

      // 添加封面
      const slide1 = pptx.addSlide();
      slide1.background = { color: '1a1a1a' };
      slide1.addText(topic, {
        x: 1, y: 2, w: 8, h: 2,
        fontSize: 44,
        color: '4a9eff',
        bold: true,
        align: 'center',
      });
      slide1.addText('AI生成演示文稿', {
        x: 1, y: 4, w: 8, h: 0.5,
        fontSize: 18,
        color: '888888',
        align: 'center',
      });

      // 添加内容页
      slides.forEach((slide, index) => {
        const pptSlide = pptx.addSlide();
        pptSlide.background = { color: '0f0f0f' };

        // 标题
        pptSlide.addText(slide.title, {
          x: 0.5, y: 0.5, w: 9, h: 0.8,
          fontSize: 32,
          color: 'e8e4d9',
          bold: true,
        });

        // 分隔线
        pptSlide.addShape(pptx.ShapeType.rect, {
          x: 0.5, y: 1.3, w: 9, h: 0.02,
          fill: { color: '4a9eff' },
        });

        // 要点
        slide.content.forEach((point, i) => {
          pptSlide.addText(`• ${point}`, {
            x: 0.8, y: 1.6 + i * 0.8, w: 8.4, h: 0.6,
            fontSize: 18,
            color: 'cccccc',
            bullet: true,
          });
        });

        // 页码
        pptSlide.addText(`${index + 1}`, {
          x: 4.5, y: 5.2, w: 1, h: 0.3,
          fontSize: 12,
          color: '666666',
          align: 'center',
        });
      });

      // 保存文件
      await pptx.writeFile({ fileName: `${topic}.pptx` });
      setProgress('PPT下载完成！');
    } catch (error) {
      console.error('PPT文件生成错误:', error);
      setProgress('文件生成失败');
    }
  }, [slides, topic]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#333] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <div className="flex items-center gap-2">
            <Presentation size={20} className="text-[#4a9eff]" />
            <h2 className="text-lg font-semibold text-[#e8e4d9]">AI制作PPT</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#333] text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 主题输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              PPT主题
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="输入PPT主题，例如：人工智能发展趋势"
                className="flex-1 bg-[#0f0f0f] border border-[#333] rounded-lg px-4 py-2.5 text-sm text-[#e8e4d9] outline-none focus:border-[#4a9eff] focus:ring-1 focus:ring-[#4a9eff]/30 transition-all placeholder:text-gray-600"
                disabled={isGenerating}
              />
              <button
                onClick={generatePPT}
                disabled={isGenerating || !topic.trim()}
                className="px-4 py-2.5 rounded-lg bg-[#4a9eff] text-white text-sm font-medium hover:bg-[#3a8eef] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    生成中
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    生成
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 进度提示 */}
          {progress && (
            <div className="text-sm text-gray-400 bg-[#0f0f0f] rounded-lg px-4 py-3">
              {progress}
            </div>
          )}

          {/* 预览 */}
          {slides.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400">
                  预览（共 {slides.length} 页）
                </h3>
                <button
                  onClick={downloadPPT}
                  className="px-3 py-1.5 rounded-lg bg-[#4a9eff] text-white text-sm hover:bg-[#3a8eef] transition-colors flex items-center gap-1.5"
                >
                  <Download size={14} />
                  下载PPT
                </button>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {slides.map((slide, index) => (
                  <div
                    key={index}
                    className="bg-[#0f0f0f] rounded-lg border border-[#333] p-4"
                  >
                    <h4 className="text-sm font-semibold text-[#e8e4d9] mb-2">
                      {index + 1}. {slide.title}
                    </h4>
                    <ul className="space-y-1">
                      {slide.content.map((point, i) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                          <span className="text-[#4a9eff] mt-0.5">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
