import { ArrowLeft, Key, Globe, Thermometer, Hash } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function Settings() {
  const { settings, setSettings } = useStore();

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e8e4d9]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-[#222]">
        <a
          href="#/"
          className="p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 transition-colors"
        >
          <ArrowLeft size={20} />
        </a>
        <h1 className="text-lg font-semibold">设置</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* API Configuration */}
        <section className="bg-[#1a1a1a] rounded-xl border border-[#222] p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            API 配置
          </h2>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Key size={14} className="text-[#4a9eff]" />
                API 密钥
              </label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ apiKey: e.target.value })}
                className="w-full bg-[#0f0f0f] border border-[#333] rounded-lg px-4 py-2.5 text-sm text-[#e8e4d9] outline-none focus:border-[#4a9eff] focus:ring-1 focus:ring-[#4a9eff]/30 transition-all"
                placeholder="输入 API 密钥"
              />
              <p className="text-xs text-gray-500 mt-1">
                您的 API 密钥仅存储在本地浏览器中
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Globe size={14} className="text-[#4a9eff]" />
                API 地址
              </label>
              <input
                type="text"
                value={settings.apiUrl}
                onChange={(e) => setSettings({ apiUrl: e.target.value })}
                className="w-full bg-[#0f0f0f] border border-[#333] rounded-lg px-4 py-2.5 text-sm text-[#e8e4d9] outline-none focus:border-[#4a9eff] focus:ring-1 focus:ring-[#4a9eff]/30 transition-all"
                placeholder="https://..."
              />
            </div>
          </div>
        </section>

        {/* Model Parameters */}
        <section className="bg-[#1a1a1a] rounded-xl border border-[#222] p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            模型参数
          </h2>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Thermometer size={14} className="text-[#4a9eff]" />
                  温度 (Temperature)
                </label>
                <span className="text-sm text-[#4a9eff] font-mono">
                  {settings.temperature}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={(e) =>
                  setSettings({ temperature: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#4a9eff]"
              />
              <p className="text-xs text-gray-500 mt-1">
                较低的值使输出更确定，较高的值使输出更随机
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Hash size={14} className="text-[#4a9eff]" />
                  最大 Token 数
                </label>
                <span className="text-sm text-[#4a9eff] font-mono">
                  {settings.maxTokens}
                </span>
              </div>
              <input
                type="range"
                min="256"
                max="8192"
                step="256"
                value={settings.maxTokens}
                onChange={(e) =>
                  setSettings({ maxTokens: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#4a9eff]"
              />
              <p className="text-xs text-gray-500 mt-1">
                控制生成回复的最大长度
              </p>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="bg-[#1a1a1a] rounded-xl border border-[#222] p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            关于
          </h2>
          <p className="text-sm text-gray-400">
            AI 对话助手 - 基于 NVIDIA API 构建
          </p>
          <p className="text-xs text-gray-500 mt-1">
            所有数据仅存储在本地浏览器中
          </p>
        </section>
      </div>
    </div>
  );
}
