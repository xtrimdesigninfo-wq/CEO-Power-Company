import React from 'react';
import { Category } from '../../types';

export interface CategoryChipsProps {
  categories: Category[];
  selectedSlug?: string;
  onSelect: (slug: string) => void;
}

export function CategoryChips({ categories, selectedSlug = 'all', onSelect }: CategoryChipsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1.5 no-scrollbar scroll-smooth">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
          selectedSlug === 'all'
            ? 'bg-[#187004] text-white border-[#187004] shadow-xs ring-2 ring-[#187004]/15'
            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        All Products
      </button>

      {categories.map(cat => {
        const isSelected = selectedSlug === cat.slug;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.slug)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
              isSelected
                ? 'bg-[#187004] text-white border-[#187004] shadow-xs ring-2 ring-[#187004]/15'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
