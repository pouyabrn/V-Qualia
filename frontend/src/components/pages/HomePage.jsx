import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

const HomePage = ({ setActiveTab }) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div className="relative -mx-6 -my-8 min-h-screen flex flex-col overflow-hidden bg-black">
      {/* Minimal solid background with subtle grid */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(#06b6d4 1px, transparent 1px),
              linear-gradient(90deg, #06b6d4 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }}
        />
      </div>

      {/* Content */}
      <div className={`relative z-10 flex-1 flex flex-col items-center justify-center px-6 transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-16 relative">
          <h1 className="text-8xl md:text-9xl font-bold mb-8 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent leading-none tracking-tight">
            V-Qualia
          </h1>
          
          <p className="text-gray-400 text-xl md:text-2xl mb-12 max-w-2xl mx-auto leading-relaxed">
            Professional telemetry analysis platform
          </p>

          {/* CTA */}
          <button
            onClick={() => setActiveTab('analyze')}
            className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-2xl shadow-cyan-500/40"
          >
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Floating feature badges */}
        <div className="flex flex-wrap justify-center gap-3 opacity-50">
          {[
            { icon: '📊', text: 'Advanced Analytics' },
            { icon: '⚡', text: 'Real-time Processing' },
            { icon: '🎯', text: 'Precision Data' }
          ].map((badge, i) => (
            <div
              key={i}
              className="px-4 py-2 bg-white/[0.03] border border-cyan-500/20 rounded-full text-sm text-gray-400 hover:border-cyan-500/40 hover:text-cyan-400 transition-all"
              style={{
                animation: `floatBadge ${10 + i * 2}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`
              }}
            >
              <span className="mr-2">{badge.icon}</span>
              {badge.text}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes floatBadge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default HomePage;
