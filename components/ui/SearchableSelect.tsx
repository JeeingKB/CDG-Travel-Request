
import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  options, value, onChange, placeholder = "Select...", icon: Icon, className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Update internal search term when external value changes
  useEffect(() => {
    const selected = options.find(o => o.value === value);
    if (selected) {
        // We don't necessarily want to change the search term to the label, 
        // but we might want to clear it if value is empty.
    }
  }, [value, options]);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    opt.subLabel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${className} ${isOpen ? 'z-50' : 'z-0'}`} ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between cursor-pointer hover:border-blue-400 transition-colors focus-within:ring-2 focus-within:ring-slate-900"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {Icon && <Icon size={18} className="text-slate-400 shrink-0" />}
          <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-900'}`}>
             {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 flex flex-col animate-fade-in-up">
           <div className="p-2 border-b border-slate-50 sticky top-0 bg-white rounded-t-xl">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                  autoFocus
                  type="text" 
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-lg text-sm border-none focus:ring-0 outline-none placeholder:text-slate-400"
                  placeholder="Type to search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
           </div>
           <div className="overflow-y-auto flex-1 p-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between group
                      ${value === opt.value ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      {opt.subLabel && <div className="text-[10px] text-slate-400">{opt.subLabel}</div>}
                    </div>
                    {value === opt.value && <Check size={14} />}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-xs text-slate-400 text-center">No results found.</div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};
