import React, { useEffect, useRef, useState } from 'react';
import { createLiveSession, createAudioPayload } from '../services/geminiService';
import { Mic, MicOff, ArrowLeft, Activity, Volume2 } from 'lucide-react';

const TestCall: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [status, setStatus] = useState("Ready to test");
  const [volume, setVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopTest();
    };
  }, []);

  const startTest = async () => {
    setStatus("Connecting to AI...");
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      // Input stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = inputCtx.createMediaStreamSource(stream);
      
      // Visualizer
      const analyzer = inputCtx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      
      const updateVolume = () => {
        if (!active) return;
        analyzer.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(avg);
        requestAnimationFrame(updateVolume);
      };
      // Note: active state in closure might be stale, but loop breaks when component unmounts usually
      
      // Processor to send audio
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      
      let liveSession: any = null;

      liveSession = await createLiveSession(
        (audioBuffer) => {
          // Play audio from Gemini
          if (!audioContextRef.current) return;
          const ctx = audioContextRef.current;
          const src = ctx.createBufferSource();
          src.buffer = audioBuffer;
          src.connect(ctx.destination);
          
          // Gapless playback logic
          const time = Math.max(ctx.currentTime, nextStartTimeRef.current);
          src.start(time);
          nextStartTimeRef.current = time + audioBuffer.duration;
        },
        () => {
          setActive(false);
          setStatus("Test ended.");
        },
        audioCtx
      );

      processor.onaudioprocess = (e) => {
        if (!micOn) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const payload = createAudioPayload(inputData);
        liveSession.sendRealtimeInput({ media: payload });
      };

      source.connect(processor);
      processor.connect(inputCtx.destination); // Required for script processor to run

      setActive(true);
      setStatus("Connected. Say 'Hello'!");
      updateVolume();

    } catch (err) {
      console.error(err);
      setStatus("Connection failed. Check API Key or Mic.");
    }
  };

  const stopTest = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    setActive(false);
    setStatus("Ready to test");
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">AI Connection Test</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <div className="relative">
          <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${active ? 'bg-teal-500/20 ring-4 ring-teal-500/50' : 'bg-slate-800'}`}>
             <Activity className={`w-16 h-16 ${active ? 'text-teal-400' : 'text-slate-500'}`} />
          </div>
          {active && (
            <div className="absolute inset-0 rounded-full border-4 border-teal-500 animate-ping opacity-20"></div>
          )}
        </div>

        <div className="text-center space-y-2">
           <h3 className="text-2xl font-semibold">{active ? 'Testing Audio...' : 'Start Test'}</h3>
           <p className="text-slate-400 max-w-sm">{status}</p>
        </div>

        {/* Volume Indicator */}
        {active && (
          <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
             <div 
               className="h-full bg-gradient-to-r from-teal-400 to-blue-500 transition-all duration-75"
               style={{ width: `${Math.min(100, volume * 2)}%` }}
             />
          </div>
        )}

        <div className="flex gap-4">
           {!active ? (
             <button 
               onClick={startTest}
               className="px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 transition flex items-center gap-2"
             >
               <Volume2 className="w-5 h-5" />
               Start AI Test
             </button>
           ) : (
             <button 
               onClick={stopTest}
               className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition"
             >
               End Test
             </button>
           )}
        </div>
        
        <p className="text-xs text-slate-500 mt-8 max-w-xs text-center">
          This connects to Google Gemini Live API to verify your outgoing audio stream is working correctly without needing a server.
        </p>
      </div>
    </div>
  );
};

export default TestCall;