
import React, { useState } from 'react';
import { Search, User, X } from 'lucide-react';
import { Node } from '../types';

interface SearchSidebarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  nodes: Node[];
  onSelectNode: (id: string) => void;
  t: any;
}

const SearchSidebar: React.FC<SearchSidebarProps> = ({ searchQuery, setSearchQuery, nodes, onSelectNode, t }) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleSelect = (id: string) => {
    onSelectNode(id);
    setSearchQuery(''); // 选中后清空搜索，优化移动端视觉
    setIsFocused(false);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className={`relative group transition-all duration-300 ${isFocused ? 'ring-2 ring-indigo-500/40 rounded-xl' : ''}`}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 pointer-events-none" size={18} />
        <input 
          type="text" 
          placeholder={t.searchPlaceholder}
          value={searchQuery}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)} // 延时关闭让点击事件生效
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-900/40 border border-gray-800/40 rounded-xl pl-12 pr-12 py-3 text-sm focus:outline-none transition-all placeholder:text-gray-600 backdrop-blur-2xl shadow-xl text-gray-100"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 搜索结果列表 - 悬浮层设计 */}
      {(searchQuery || isFocused) && nodes.length > 0 && (
        <div className="bg-gray-900/60 backdrop-blur-3xl border border-gray-800/40 rounded-2xl max-h-[50vh] overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 border-b border-gray-800/30 flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">{t.results} ({nodes.length})</p>
          </div>
          <div className="divide-y divide-gray-800/20">
            {nodes.map(node => (
              <button
                key={node.id}
                onClick={() => handleSelect(node.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-indigo-600/10 text-left transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-gray-800/40 border border-gray-700/40 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
                  <User size={18} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold truncate group-hover:text-indigo-300">{node.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {t.categories[node.category] || node.category} • W:{node.weight}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {searchQuery && nodes.length === 0 && (
        <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-8 text-center shadow-2xl animate-in fade-in backdrop-blur-2xl">
          <p className="text-sm text-gray-600">{t.noResults}</p>
        </div>
      )}
    </div>
  );
};

export default SearchSidebar;
