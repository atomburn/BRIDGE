import React, { useState } from 'react';
import { AppMode } from './types';
import VideoCall from './components/VideoCall';
import TestCall from './components/TestCall';
import Translator from './components/Translator';
import { Video, Globe, Zap, Heart } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);

  const renderContent = () => {
    switch (mode) {
      case AppMode.CALL:
        return <VideoCall onBack={() => setMode(AppMode.HOME)} />;
      case AppMode.TEST_CALL:
        return <TestCall onBack={() => setMode(AppMode.HOME)} />;
      case AppMode.TRANSLATOR:
        return <Translator onBack={() => setMode(AppMode.HOME)} />;
      default:
        return (
          <div className="flex flex-col min-h-screen bg-slate-900 text-white font-sans">
            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
              
              {/* Background Accents */}
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 -right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
              </div>

              <div className="z-10 space-y-8 max-w-2xl w-full">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold tracking-wider uppercase border border-teal-500/20">
                     <Heart className="w-3 h-3 fill-current" />
                     Family First
                  </div>
                  <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                    Bridge
                  </h1>
                  <p className="text-lg md:text-xl text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Connect with your loved ones securely. No servers. No tracking. Just a direct link home.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <button 
                    onClick={() => setMode(AppMode.CALL)}
                    className="p-6 bg-gradient-to-r from-teal-600 to-teal-500 rounded-2xl shadow-xl shadow-teal-500/20 hover:scale-[1.02] transition-transform duration-200 text-left group"
                  >
                    <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/30 transition">
                      <Video className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">Start Video Call</h3>
                    <p className="text-teal-100 text-sm mt-1">Manual P2P connection setup.</p>
                  </button>

                  <div className="space-y-4">
                    <button 
                       onClick={() => setMode(AppMode.TEST_CALL)}
                       className="w-full p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl flex items-center gap-4 transition hover:border-slate-600"
                    >
                      <div className="bg-blue-500/10 p-3 rounded-lg text-blue-400">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold">Test Connection</h4>
                        <p className="text-xs text-slate-400">Check AV with Gemini AI</p>
                      </div>
                    </button>

                    <button 
                       onClick={() => setMode(AppMode.TRANSLATOR)}
                       className="w-full p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl flex items-center gap-4 transition hover:border-slate-600"
                    >
                      <div className="bg-purple-500/10 p-3 rounded-lg text-purple-400">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold">Translator</h4>
                        <p className="text-xs text-slate-400">English / Russian Helper</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </main>
            
            <footer className="p-6 text-center text-slate-600 text-xs">
              <p>Built with ❤️ using WebRTC & Google Gemini</p>
            </footer>
          </div>
        );
    }
  };

  return renderContent();
};

export default App;