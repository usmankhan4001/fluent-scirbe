import React, { useState, useEffect, useRef } from 'react';
import { Mic, Clock, X, Keyboard, Briefcase, Mail, FileText, Code, Cpu, MessageSquare, Book, Trash2, Pin, Sparkles, Globe, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

type ViewState = 'launch' | 'listening' | 'refining' | 'result';

interface HistoryItem {
  id: string;
  rawText: string;
  refinedText: string;
  format: string;
  pinned: boolean;
  timestamp: number;
}

const FORMATS = [
  { id: 'professional', label: 'Professional Writing', desc: 'Clean, authoritative tone.', icon: Briefcase },
  { id: 'email', label: 'Email Format', desc: 'Structured with Subject/Body/Sign-off.', icon: Mail },
  { id: 'technical', label: 'Technical Writing', desc: 'Focus on clarity and jargon accuracy.', icon: FileText },
  { id: 'coding', label: 'Coding / Developer Prompt', desc: 'Structured for documentation or logic.', icon: Code },
  { id: 'prompt', label: 'AI Prompt Generator', desc: 'Optimized for LLM instructions.', icon: Cpu },
  { id: 'casual', label: 'Casual Chat', desc: 'Gen-Z slang and relaxed grammar.', icon: MessageSquare },
  { id: 'diary', label: 'Diary / Personal Journal', desc: 'Reflective and narrative style.', icon: Book }
];

const LANGUAGES = [
  { code: 'en-US', label: 'EN' },
  { code: 'ur-PK', label: 'UR' },
  { code: 'ar-SA', label: 'AR' }
];

export default function App() {
  const [viewState, setViewState] = useState<ViewState>('launch');
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  
  const [language, setLanguage] = useState(LANGUAGES[0].code);
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[1].code);
  
  const [rawText, setRawText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [refinedText, setRefinedText] = useState('');
  const [selectedFormat, setSelectedFormat] = useState(FORMATS[0].id);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('fluent_scribe_v2_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false; 
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          else interimTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) {
          setRawText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript.trim());
        }
        setInterimText(interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Recognition error:', event.error);
        if (event.error === 'not-allowed') {
           setError('Microphone access denied.');
           stopRecording();
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          try { recognition.start(); } catch (e) {
            setTimeout(() => {
              if (isRecordingRef.current) {
                try { recognition.start(); } catch (err) { stopRecording(); }
              }
            }, 1000);
          }
        }
      };

      recognitionRef.current = recognition;
    } else {
      setError('Speech recognition not supported.');
    }
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, [language]);

  const startRecording = (initialFormat?: string) => {
    if (!recognitionRef.current) return;
    if (initialFormat) setSelectedFormat(initialFormat);
    setError(null);
    setRawText('');
    setInterimText('');
    setRefinedText('');
    setIsRecording(true);
    isRecordingRef.current = true;
    setViewState('listening');
    try { recognitionRef.current.start(); } catch (err) { stopRecording(); }
  };

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const handleFinishListening = () => {
    stopRecording();
    let finalRaw = rawText;
    if (interimText && !rawText.includes(interimText.trim())) {
      finalRaw = rawText + (rawText ? ' ' : '') + interimText.trim();
      setRawText(finalRaw);
    }
    setInterimText('');
    
    if (!finalRaw.trim()) {
      setViewState('launch');
      return;
    }
    
    processText(finalRaw, selectedFormat);
  };

  const processText = async (textToProcess: string, formatId: string) => {
    setViewState('refining');
    
    try {
      const formatObj = FORMATS.find(f => f.id === formatId);
      const prompt = `You are an expert text editor. I am giving you a raw speech-to-text transcript.
Task: Fix grammatical errors and format the text according to this style: ${formatObj?.label} - ${formatObj?.desc}
Respond ONLY with the finalized, refined text.
Raw Transcript:
"""
${textToProcess}
"""`;

      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error('Failed to refine text');
      const data = await response.json();
      const newRefined = data.text?.trim() || '';
      setRefinedText(newRefined);
      
      // Save history
      if (newRefined) {
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          rawText: textToProcess,
          refinedText: newRefined,
          format: formatId,
          pinned: false,
          timestamp: Date.now()
        };
        setHistory(prev => {
          const updated = [newItem, ...prev].slice(0, 50);
          localStorage.setItem('fluent_scribe_v2_history', JSON.stringify(updated));
          return updated;
        });
      }
      setViewState('result');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error refining text.');
      // Keep it in result state so they can see raw text even if failed
      setRefinedText('Error: ' + (err?.message || 'Failed to refine.'));
      setViewState('result');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const renderLaunchScreen = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full w-full px-6 pt-12 pb-6 space-y-6"
    >
      <header className="flex justify-between items-center w-full">
        <h1 className="text-3xl font-display font-semibold text-white tracking-tight">Hi, Usman <span className="text-2xl">👋</span></h1>
        <button onClick={() => setIsHistoryOpen(true)} className="p-2 bg-[#1C1C1E] rounded-full text-gray-400 hover:text-white transition">
          <Clock className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col gap-4 mt-4">
        {/* Primary Card */}
        <motion.button 
          whileHover={{ scale: 0.98 }} whileTap={{ scale: 0.95 }}
          onClick={() => startRecording('professional')}
          className="relative overflow-hidden w-full h-48 rounded-[32px] bg-gradient-to-br from-[#FF5A00] to-[#E64000] p-6 flex flex-col items-start justify-end shadow-[0_8px_32px_rgba(255,90,0,0.3)] group"
        >
          <div className="absolute top-6 right-6 p-3 bg-white/20 rounded-full backdrop-blur-md">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white text-left">🎙️ Capture Thought.</h2>
          <p className="text-white/80 mt-1 font-medium text-sm">Tap to start recording</p>
          
          <motion.div 
             animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }} 
             transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
             className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 blur-[50px] rounded-full pointer-events-none"
          />
        </motion.button>

        {/* Secondary Card */}
        <motion.button 
          whileHover={{ scale: 0.98 }} whileTap={{ scale: 0.95 }}
          className="w-full h-24 rounded-[28px] bg-[#1C1C1E] border border-white/5 p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                <Globe className="w-6 h-6 text-[#77C535]" />
             </div>
             <div className="text-left">
               <h3 className="font-display font-semibold text-white">🌍 Instant Translation</h3>
               <p className="text-xs text-gray-400 mt-0.5">{LANGUAGES.find(l=>l.code===language)?.label} → {LANGUAGES.find(l=>l.code===targetLanguage)?.label}</p>
             </div>
          </div>
        </motion.button>

        {/* Feature Grid */}
        <div className="grid grid-cols-2 gap-4 mt-2">
           {FORMATS.slice(0,4).map((f) => (
             <motion.button
               key={f.id}
               whileHover={{ scale: 0.96 }} whileTap={{ scale: 0.92 }}
               onClick={() => startRecording(f.id)}
               className="bg-[#1C1C1E] border border-white/5 rounded-[24px] p-5 flex flex-col items-start gap-3"
             >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-gray-300" />
                </div>
                <h4 className="font-display font-medium text-sm text-left text-white">{f.label.split(' ')[0]}</h4>
             </motion.button>
           ))}
        </div>
      </div>
    </motion.div>
  );

  const renderListeningScreen = () => {
    const particles = Array.from({ length: 48 }).map((_, i) => i);
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
        className="flex flex-col h-full w-full bg-black relative overflow-hidden"
      >
        <div className="flex-1 flex flex-col items-center justify-center relative">
           {/* Particle Ring Visualizer */}
           <div className="relative w-64 h-64 flex items-center justify-center">
              {particles.map((i) => {
                const angle = (i / particles.length) * Math.PI * 2;
                const radius = 100;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                return (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, Math.random() * 1.5 + 0.5, 1],
                      opacity: [0.3, Math.random() * 0.8 + 0.2, 0.3],
                    }}
                    transition={{
                      duration: Math.random() * 0.5 + 0.5,
                      repeat: Infinity,
                      repeatType: 'mirror'
                    }}
                    className="absolute w-1.5 h-1.5 bg-[#FF5A00] rounded-full shadow-[0_0_10px_#FF5A00]"
                    style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
                  />
                );
              })}
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute w-40 h-40 bg-[#FF5A00] rounded-full blur-[40px]"
              />
           </div>

           {/* Live Transcript */}
           <div className="absolute bottom-32 w-full px-8 text-center">
             <p className="text-gray-500 font-display text-lg italic tracking-wide min-h-[60px]">
               {interimText || rawText.slice(-50) || "Listening..."}
             </p>
           </div>
        </div>

        {/* Action Dock */}
        <div className="h-32 bg-gradient-to-t from-black to-transparent flex items-center justify-center gap-12 pb-8">
           <button className="w-12 h-12 rounded-full bg-[#1C1C1E] flex items-center justify-center text-gray-400 hover:text-white transition">
             <Keyboard className="w-5 h-5" />
           </button>
           
           <motion.button 
             whileTap={{ scale: 0.9 }}
             onClick={handleFinishListening}
             className="w-20 h-20 rounded-full bg-[#FF5A00] flex items-center justify-center shadow-[0_0_30px_rgba(255,90,0,0.5)]"
           >
             <div className="w-6 h-6 bg-white rounded-sm" />
           </motion.button>
           
           <button 
             onClick={() => { stopRecording(); setViewState('launch'); }}
             className="w-12 h-12 rounded-full bg-[#1C1C1E] flex items-center justify-center text-gray-400 hover:text-white transition"
           >
             <X className="w-5 h-5" />
           </button>
        </div>
      </motion.div>
    );
  };

  const renderRefiningScreen = () => (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-full w-full bg-black relative overflow-hidden"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="w-24 h-24 border-t-2 border-r-2 border-[#FF5A00] rounded-full z-10"
      />
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="absolute mt-40 z-10"
      >
        <p className="text-[#FF5A00] font-display font-medium tracking-widest uppercase text-sm animate-pulse">
          Polishing your thoughts...
        </p>
      </motion.div>
      
      <div className="absolute inset-0 pointer-events-none flex flex-wrap content-start gap-2 p-8 opacity-20 blur-[1px]">
         {(rawText || interimText || "Processing").split(' ').map((word, i) => (
           <motion.span 
             key={i}
             initial={{ y: 0, opacity: 1 }}
             animate={{ y: -50 - Math.random() * 100, opacity: 0, x: (Math.random() - 0.5) * 50 }}
             transition={{ duration: 1.5, repeat: Infinity, delay: Math.random() * 2 }}
             className="text-white text-xl font-sans inline-block"
           >
             {word}
           </motion.span>
         ))}
      </div>
    </motion.div>
  );

  const renderResultScreen = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full w-full bg-[#0A0A0A]"
    >
       <header className="flex-none px-6 py-4 flex items-center justify-between border-b border-white/5">
          <button onClick={() => setViewState('launch')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-medium">
             <X className="w-5 h-5" /> Close
          </button>
          <div className="bg-[#1C1C1E] px-3 py-1.5 rounded-full flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-[#FF5A00]" />
             <span className="text-xs font-display font-medium text-white">Result</span>
          </div>
          <div className="w-16" />
       </header>

       <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">
          <div className="w-full flex justify-end">
             <div className="bg-[#1C1C1E] p-4 rounded-2xl rounded-tr-sm max-w-[85%] border border-white/5">
                <p className="text-gray-400 text-sm font-sans leading-relaxed">
                   {rawText}
                </p>
             </div>
          </div>

          <div className="w-full flex justify-start">
             <motion.div 
                key={refinedText}
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }} 
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                className="bg-white p-5 rounded-3xl rounded-tl-sm max-w-[95%] shadow-[0_10px_40px_rgba(255,255,255,0.05)] cursor-pointer relative group"
                onClick={() => copyToClipboard(refinedText)}
             >
                <p className="text-black text-[17px] font-medium leading-relaxed font-sans">
                   {refinedText}
                </p>
                <div className="absolute -bottom-3 -right-3">
                   <AnimatePresence>
                     {copied && (
                       <motion.div 
                         initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                         className="bg-[#77C535] text-white p-2 rounded-full shadow-lg flex items-center justify-center"
                       >
                         <Check className="w-4 h-4" />
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>
             </motion.div>
          </div>
       </div>

       <div className="flex-none bg-[#141415] border-t border-white/5 pb-safe">
          <div className="px-6 py-4 flex gap-3 overflow-x-auto scrollbar-hide snap-x">
             {FORMATS.map(f => (
                <button
                   key={f.id}
                   onClick={() => {
                     setSelectedFormat(f.id);
                     processText(rawText, f.id);
                   }}
                   className={`snap-start shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl w-24 transition-all ${selectedFormat === f.id ? 'bg-[#2C2C2E]' : 'hover:bg-[#1C1C1E]'}`}
                >
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedFormat === f.id ? 'bg-[#FF5A00] text-white' : 'bg-[#2C2C2E] text-gray-400'}`}>
                     <f.icon className="w-5 h-5" />
                   </div>
                   <span className={`text-[10px] font-display font-medium text-center leading-tight ${selectedFormat === f.id ? 'text-white' : 'text-gray-500'}`}>
                     {f.label}
                   </span>
                </button>
             ))}
          </div>
       </div>
    </motion.div>
  );

  const renderHistoryModal = () => (
    <AnimatePresence>
      {isHistoryOpen && (
        <motion.div 
           initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
           transition={{ type: 'spring', damping: 25, stiffness: 200 }}
           className="absolute inset-0 z-50 bg-[#0A0A0A] flex flex-col"
        >
           <header className="flex-none px-6 py-5 border-b border-white/5 flex items-center justify-between bg-[#141415]">
              <h2 className="text-xl font-display font-semibold text-white">Archive</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-white">
                <X className="w-4 h-4" />
              </button>
           </header>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe scrollbar-hide">
              {history.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-50">
                    <Clock className="w-12 h-12 mb-4 text-gray-600" />
                    <p className="font-display font-medium text-gray-400">No history yet</p>
                 </div>
              ) : (
                 history.map(item => {
                   const formatObj = FORMATS.find(f => f.id === item.format) || FORMATS[0];
                   const Icon = formatObj.icon;
                   return (
                     <motion.div 
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="w-full bg-[#1C1C1E] rounded-3xl p-5 border border-white/5"
                     >
                        <div className="flex justify-between items-start mb-3">
                           <div className="flex items-center gap-2 text-[#FF5A00] bg-[#FF5A00]/10 px-3 py-1 rounded-full">
                              <Icon className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">{formatObj.label}</span>
                           </div>
                           <div className="flex gap-2">
                              <button className="text-gray-500 hover:text-white p-1"><Pin className="w-4 h-4" /></button>
                              <button 
                                onClick={() => {
                                  const updated = history.filter(h => h.id !== item.id);
                                  setHistory(updated);
                                  localStorage.setItem('fluent_scribe_v2_history', JSON.stringify(updated));
                                }}
                                className="text-gray-500 hover:text-red-500 p-1"
                              ><Trash2 className="w-4 h-4" /></button>
                           </div>
                        </div>
                        <p className="text-[15px] font-medium text-white line-clamp-3 mb-2 font-sans">{item.refinedText}</p>
                        <p className="text-xs text-gray-500 line-clamp-1 italic">"{item.rawText}"</p>
                     </motion.div>
                   )
                 })
              )}
           </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="h-[100dvh] mx-auto w-full max-w-md bg-[#0A0A0A] text-white font-sans relative flex flex-col sm:border-x sm:border-white/10 sm:shadow-2xl overflow-hidden">
      
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-900/90 text-white p-4 rounded-2xl z-50 backdrop-blur-md shadow-2xl border border-red-500/50 flex items-center justify-between">
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)}><X className="w-5 h-5 text-white/70 hover:text-white" /></button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {viewState === 'launch' && <motion.div key="launch" className="absolute inset-0">{renderLaunchScreen()}</motion.div>}
        {viewState === 'listening' && <motion.div key="listening" className="absolute inset-0">{renderListeningScreen()}</motion.div>}
        {viewState === 'refining' && <motion.div key="refining" className="absolute inset-0">{renderRefiningScreen()}</motion.div>}
        {viewState === 'result' && <motion.div key="result" className="absolute inset-0">{renderResultScreen()}</motion.div>}
      </AnimatePresence>

      {renderHistoryModal()}

    </div>
  );
}
