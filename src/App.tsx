import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Copy, Check, Sparkles, Clock, Info, X, ChevronRight, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Setup SpeechRecognition interface
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const isIOS = typeof window !== 'undefined' && 
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

interface HistoryItem {
  id: string;
  rawText: string;
  refinedText: string;
  mode: string;
  timestamp: number;
}

const MODES = [
  { id: 'professional', label: 'Professional Writing', icon: '💼' },
  { id: 'email', label: 'Email Format', icon: '✉️' },
  { id: 'technical', label: 'Technical Writing', icon: '🔧' },
  { id: 'coding', label: 'Coding Prompt', icon: '💻' },
  { id: 'ai_prompt', label: 'AI Prompt', icon: '🤖' },
  { id: 'casual', label: 'Casual Chat', icon: '💬' },
  { id: 'diary', label: 'Journal', icon: '📔' },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);

  const [rawText, setRawText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [refinedText, setRefinedText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [selectedMode, setSelectedMode] = useState(MODES[0].id);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Splash screen timer
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('easytext_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false; 
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        if (final) {
          setRawText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + final.trim());
        }
        setInterimText(interim);
      };

      recognition.onerror = (event: any) => {
        console.error('Recognition error:', event.error);
        if (event.error === 'not-allowed') {
           setError('Microphone permission denied.');
           setRecordingState(false);
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
            try { recognition.start(); } 
            catch (e) {
               setTimeout(() => {
                 if (isRecordingRef.current) {
                   try { recognition.start(); } 
                   catch (err) { setRecordingState(false); }
                 }
               }, 1000);
            }
        }
      };
      recognitionRef.current = recognition;
    } else {
      setError('Speech recognition is not supported in this browser.');
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const setRecordingState = (state: boolean) => {
    setIsRecording(state);
    isRecordingRef.current = state;
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    setError(null);
    if (isRecording) {
      recognitionRef.current.stop();
      setRecordingState(false);
      setInterimText('');
    } else {
      setRecordingState(true);
      try { recognitionRef.current.start(); } 
      catch (err) { setRecordingState(false); }
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const refineText = async () => {
    if (!rawText.trim()) return;
    setIsRefining(true);
    setError(null);
    setRefinedText('');

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: rawText, mode: selectedMode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refine text');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream available');
      
      const decoder = new TextDecoder('utf-8');
      let finalOutput = '';
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr && dataStr !== '[DONE]') {
              try {
                const data = JSON.parse(dataStr);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  finalOutput += text;
                  setRefinedText(finalOutput);
                  
                  // Hide loading screen on first chunk received
                  if (isFirstChunk) {
                    setIsRefining(false);
                    isFirstChunk = false;
                  }
                }
              } catch (e) {
                // Ignore parse errors from incomplete chunks
              }
            }
          }
        }
      }
      
      // If the response finished and we somehow never set isRefining(false)
      setIsRefining(false);

      if (finalOutput) {
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          rawText,
          refinedText: finalOutput.trim(),
          mode: selectedMode,
          timestamp: Date.now()
        };
        setHistory(prev => {
          const updated = [newItem, ...prev].slice(0, 50);
          localStorage.setItem('easytext_history', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Error refining text.');
      setIsRefining(false);
    }
  };

  if (showSplash) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white relative overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center z-10"
        >
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 mb-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">EasyText</h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-blue-200/80 font-medium tracking-wide text-sm uppercase"
          >
            Turn thoughts into perfect text instantly
          </motion.p>
        </motion.div>
        
        {/* Abstract background waves */}
        <motion.div 
          animate={{ 
            rotate: [0, 5, -5, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
        />
        <div className="absolute bottom-6 text-[10px] text-white/30 uppercase tracking-widest font-bold">
          Powered by Takweyat
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] mx-auto w-full max-w-md bg-[#0F172A] text-white font-sans relative flex flex-col sm:shadow-2xl overflow-hidden">
      
      {/* Header */}
      <header className="flex-none px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">EasyText</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHistory(true)} 
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors relative"
          >
            <Clock className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowAbout(true)} 
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium relative backdrop-blur-sm">
          <button onClick={() => setError(null)} className="absolute top-3 right-3 text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
          {error}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col relative no-scrollbar">
        
        {/* Modes Selection Chips */}
        <div className="mb-4">
          <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 px-2">Transformation Mode</p>
          <div className="flex overflow-x-auto pb-2 -mx-4 px-4 gap-2 no-scrollbar snap-x">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMode(m.id)}
                className={`flex-none snap-start px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 border flex items-center gap-2 ${
                  selectedMode === m.id 
                    ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                }`}
              >
                <span>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Input / Output Area */}
        <div className="flex-1 flex flex-col relative">
          
          <AnimatePresence mode="wait">
            {!refinedText && !isRefining ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col relative shadow-inner shadow-white/5 focus-within:border-blue-500/50 transition-colors"
              >
                <textarea
                  ref={textareaRef}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Type or dictate your thoughts..."
                  className="flex-1 w-full bg-transparent resize-none outline-none text-white text-xl placeholder:text-white/20 leading-relaxed font-medium"
                />
                {interimText && (
                  <div className="absolute bottom-5 left-5 right-5 text-white/50 text-lg animate-pulse pointer-events-none">
                    {interimText}
                  </div>
                )}
                {rawText && (
                  <div className="absolute bottom-4 right-4 z-10 flex gap-2">
                    <button 
                      onClick={() => setRawText('')}
                      className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white/40 hover:text-white/80 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={refineText}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold tracking-wide shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                      <Sparkles className="w-4 h-4" /> Transform
                    </button>
                  </div>
                )}
              </motion.div>
            ) : isRefining ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                {/* Magical Animation for Processing */}
                <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-2 border-l-2 border-blue-400 opacity-50"
                  />
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-2 rounded-full border-b-2 border-r-2 border-cyan-300 opacity-50"
                  />
                  <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Enhancing your text</h3>
                <p className="text-sm text-white/50 animate-pulse">Applying {MODES.find(m=>m.id === selectedMode)?.label}...</p>
              </motion.div>
            ) : (
              <motion.div 
                key="output"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col relative"
              >
                <div className="flex-1 bg-gradient-to-br from-blue-500/10 to-cyan-400/5 border border-blue-500/30 rounded-3xl p-5 flex flex-col relative shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                      <Check className="w-3 h-3" /> Ready
                    </span>
                    <button 
                      onClick={() => setRefinedText('')}
                      className="text-white/40 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <p className="text-white text-lg leading-relaxed whitespace-pre-wrap font-medium">{refinedText}</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-center">
                    <button 
                      onClick={() => copyToClipboard(refinedText)}
                      className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-white text-[#0F172A] font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg active:scale-95"
                    >
                      {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                      {copied ? 'Copied!' : 'Copy Text'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Voice Interaction Button Footer (Only show when not refining and no final output) */}
      <AnimatePresence>
        {!isRefining && !refinedText && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="flex-none p-6 pt-2 relative z-20 pb-safe"
          >
            <div className="flex flex-col items-center justify-center relative">
              <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">
                {isRecording ? 'Listening...' : 'Speak your thoughts'}
              </span>
              
              <button
                onClick={toggleRecording}
                className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all outline-none z-10 ${
                  isRecording 
                    ? 'bg-red-500 text-white shadow-[0_0_40px_rgba(239,68,68,0.5)] scale-110' 
                    : 'bg-gradient-to-tr from-blue-500 to-cyan-400 text-white shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:scale-105'
                }`}
              >
                {isRecording && (
                  <>
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-red-500 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 bg-red-400 rounded-full" />
                  </>
                )}
                {isRecording ? <div className="w-6 h-6 bg-white rounded-sm" /> : <Mic className="w-8 h-8" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-50 bg-[#0F172A] flex flex-col"
          >
             <header className="flex-none px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#0F172A] z-10">
                <h2 className="text-xl font-bold">History</h2>
                <button onClick={() => setShowHistory(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
             </header>
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-50">
                    <Clock className="w-12 h-12 mb-4 text-white/30" />
                    <p className="text-white/60 font-medium">No history yet</p>
                  </div>
                ) : (
                  history.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => {
                        setRawText(item.rawText);
                        setRefinedText(item.refinedText);
                        setSelectedMode(item.mode);
                        setShowHistory(false);
                      }}
                      className="bg-white/5 border border-white/10 p-5 rounded-3xl cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                          {MODES.find(m => m.id === item.mode)?.label || item.mode}
                        </span>
                        <span className="text-[10px] text-white/30 font-bold tracking-widest">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-white/40 italic mb-3 line-clamp-2">"{item.rawText}"</p>
                      <p className="text-base text-white/90 font-medium line-clamp-3">{item.refinedText}</p>
                    </div>
                  ))
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Modal */}
      <AnimatePresence>
        {showAbout && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0F172A]/80 backdrop-blur-md flex items-center justify-center p-6"
          >
             <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#1E293B] border border-white/10 p-8 rounded-3xl w-full max-w-sm relative shadow-2xl"
             >
                <button onClick={() => setShowAbout(false)} className="absolute top-4 right-4 w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
                <div className="w-12 h-12 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-5">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">EasyText</h2>
                <p className="text-sm text-white/60 mb-6 leading-relaxed">
                  Built to support privacy-first communication and empower users to express freely without misuse of their content.
                </p>
                
                <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">Personalization (Beta)</span>
                    <div className="w-10 h-6 bg-blue-500 rounded-full relative cursor-pointer">
                      <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1" />
                    </div>
                  </div>
                  <p className="text-[10px] text-white/40 mt-2 uppercase tracking-widest font-bold">App learns writing style</p>
                </div>

                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-white/30">Powered by Takweyat</p>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
