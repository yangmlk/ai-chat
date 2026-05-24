import { Plus, MessageSquare, Trash2, Settings, Menu, X } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function Sidebar() {
  const {
    conversations,
    currentConversationId,
    isSidebarOpen,
    addConversation,
    deleteConversation,
    setCurrentConversation,
    toggleSidebar,
  } = useStore();

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-[#0a0a0a] border-r border-[#222] flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:opacity-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#222]">
          <h1 className="text-lg font-semibold text-[#e8e4d9]">AI 助手</h1>
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-1.5 rounded-lg hover:bg-[#1a1a1a] text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={addConversation}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] text-[#e8e4d9] transition-colors border border-[#333]"
          >
            <Plus size={16} />
            <span>新建对话</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              暂无对话记录
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  currentConversationId === conv.id
                    ? 'bg-[#1a1a1a] text-[#e8e4d9]'
                    : 'text-gray-400 hover:bg-[#111] hover:text-[#e8e4d9]'
                }`}
                onClick={() => setCurrentConversation(conv.id)}
              >
                <MessageSquare size={14} className="flex-shrink-0" />
                <span className="flex-1 truncate text-sm">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#333] text-gray-500 hover:text-red-400 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#222]">
          <a
            href="#/settings"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-[#1a1a1a] hover:text-[#e8e4d9] transition-colors"
          >
            <Settings size={16} />
            <span className="text-sm">设置</span>
          </a>
        </div>
      </aside>
    </>
  );
}
