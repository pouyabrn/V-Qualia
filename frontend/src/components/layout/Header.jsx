import { User, LogOut, ChevronDown, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const Header = ({ activeTab, setActiveTab }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navTabs = ['home', 'analyze', 'compare', 'predict', 'live'];

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) { // md breakpoint
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-lg bg-black/20 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

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

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-30"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Menu */}
            <div className="md:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-lg border-b border-white/10 shadow-xl z-40">
              <div className="container mx-auto px-6 py-4 space-y-2">
              {/* Main Navigation Tabs */}
              {navTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {tab === 'live' && activeTab === 'live' && (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}

              {/* Garage Section */}
              <div className="border-t border-white/10 pt-2 mt-4">
                <div className="text-gray-400 text-sm font-semibold mb-2 px-4">GARAGE</div>
                <button
                  onClick={() => {
                    setActiveTab('cars');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all ${
                    activeTab === 'cars'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Cars
                </button>
                <button
                  onClick={() => {
                    setActiveTab('tracks');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all ${
                    activeTab === 'tracks'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Tracks
                </button>
              </div>
            </div>
          </div>
          </>
        )}

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

