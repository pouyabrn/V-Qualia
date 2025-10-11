import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const CollapsibleSection = ({ title, children, defaultOpen = true, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-white/10 rounded-lg mb-4 bg-black/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="text-cyan-400" size={18} />}
          <h4 className="font-semibold text-cyan-400">{title}</h4>
        </div>
        <ChevronDown
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-white/10">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;


