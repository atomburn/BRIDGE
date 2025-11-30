import React, { useState } from 'react';
import { translateText } from '../services/geminiService';
import { ArrowLeft, ArrowRightLeft, Loader2, MessageSquare } from 'lucide-react';

const Translator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<'toRu' | 'toEn'>('toRu');

  const handleTranslate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await translateText(input, direction === 'toRu' ? 'Russian' : 'English');
      setOutput(res);
    } catch (e) {
      setOutput("Error translating. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">Smart Translator</h2>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col gap-6">
        
        {/* Direction Toggle */}
        <div className="flex items-center justify-center gap-4 bg-slate-800 p-2 rounded-xl w-fit mx-auto">
          <button 
            onClick={() => setDirection('toRu')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${direction === 'toRu' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            English → Russian
          </button>
          <ArrowRightLeft className="w-4 h-4 text-slate-500" />
           <button 
            onClick={() => setDirection('toEn')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${direction === 'toEn' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Russian → English
          </button>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Original Text</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={direction === 'toRu' ? "Type what you want to say..." : "Вставьте русский текст..."}
            className="w-full h-32 bg-slate-800 border border-slate-700 rounded-2xl p-4 text-lg focus:outline-none focus:border-teal-500 transition resize-none"
          />
        </div>

        <button 
          onClick={handleTranslate}
          disabled={loading || !input}
          className="w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 transition flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
          Translate
        </button>

        {/* Output */}
        {output && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Translation</label>
            <div className="w-full min-h-32 bg-gradient-to-br from-slate-800 to-slate-800/50 border border-slate-700 rounded-2xl p-6 text-lg">
               {output.split('\n').map((line, i) => (
                 <p key={i} className="mb-2">{line}</p>
               ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Translator;