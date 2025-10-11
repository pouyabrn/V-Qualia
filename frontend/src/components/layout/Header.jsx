import { User, LogOut, ChevronDown } from 'lucide-react';

const Header = ({ activeTab, setActiveTab }) => {
  const navTabs = ['home', 'analyze', 'compare', 'predict', 'live'];

  return (
    <header className="border-b border-white/10 bg-black/30 backdrop-blur-lg sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a 
            href="https://github.com/pouyabrn/V-Qualia" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-2xl font-bold text-cyan-400 hover:text-cyan-300 transition-colors tracking-wide"
          >
            V-QUALIA
          </a>
        </div>

        <nav className="flex-1 flex gap-2 justify-center items-center">
          {navTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm hidden md:flex items-center gap-2 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                  : 'bg-black/20 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab === 'live' && activeTab === 'live' && (
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}

          {/* Garage Dropdown */}
          <div className="relative group">
            <button
              className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm hidden md:block ${
                activeTab === 'cars' || activeTab === 'tracks'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                  : 'bg-black/20 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Garage
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-48 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto z-50">
              <div className="bg-black/50 border border-white/10 rounded-lg shadow-lg backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab('cars')}
                  className="w-full text-left px-4 py-2 text-gray-300 hover:bg-cyan-500/20 rounded-t-lg"
                >
                  Cars
                </button>
                <button
                  onClick={() => setActiveTab('tracks')}
                  className="w-full text-left px-4 py-2 text-gray-300 hover:bg-cyan-500/20 rounded-b-lg"
                >
                  Tracks
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex items-center">
          <button className="group bg-black/20 text-gray-400 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2">
            <span className="group-hover:hidden flex items-center gap-2">
              <User size={16} /> Guest
            </span>
            <span className="hidden group-hover:flex items-center gap-2">
              <LogOut size={16} /> Logout
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

