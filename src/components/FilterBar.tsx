import React from 'react';
import { Filter, Search, X } from 'lucide-react';
import { FilterOptions } from '../types';

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  showECategory?: boolean;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange, showECategory = false }) => {
  const handleCategoryChange = (category: string) => {
    onFilterChange({ ...filters, category: category === filters.category ? '' : category });
  };

  const handleUnitChange = (unit: string) => {
    onFilterChange({ ...filters, archiveUnit: unit === filters.archiveUnit ? '' : unit });
  };

  const handleSearchChange = (searchKeyword: string) => {
    onFilterChange({ ...filters, searchKeyword });
  };

  const clearFilters = () => {
    onFilterChange({ category: '', archiveUnit: '', searchKeyword: '' });
  };

  const hasActiveFilters = filters.category || filters.archiveUnit || filters.searchKeyword;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* 搜索框 */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.searchKeyword}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索资料名称、表格编号..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* 类别筛选 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 flex items-center gap-1">
            <Filter className="w-4 h-4" />
            类别:
          </span>
          {(showECategory ? ['A类', 'B类', 'C类', 'D类', 'E类'] : ['A类', 'B类', 'C类', 'D类']).map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filters.category === cat
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 归档单位筛选 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">归档:</span>
          {['施工', '监理', '建设', '档案馆'].map((unit) => (
            <button
              key={unit}
              onClick={() => handleUnitChange(unit)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filters.archiveUnit === unit
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {unit}
            </button>
          ))}
        </div>

        {/* 清除筛选 */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
          >
            <X className="w-4 h-4" />
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
