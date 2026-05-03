import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, MicOff, RefreshCw, Copy, Check, Sparkles, ArrowRightLeft, Clock, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IOSInstallPrompt } from './components/IOSInstallPrompt';
import { AppWalkthrough } from './components/AppWalkthrough';

const VITE_GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Setup SpeechRecognition interface
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface HistoryItem {
  id: string;
  rawText: string;
  refinedText: string;
  mode: 'transcribe' | 'translate';
  language: string;
  outputLanguage?: string;
  format?: string;
  timestamp: number;
}

const LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'ur-PK', label: 'Urdu (اردو)' },
  { code: 'ar-SA', label: 'Arabic (العربية)' }
];

const FORMATS = [
  { id: 'smart', label: 'Smart Auto-Format', desc: 'Understands intent and structures output automatically.' },
  { id: 'standard', label: 'Standard text', desc: 'Grammar and punctuation fixes only.' },
  { id: 'email', label: 'Professional Email', desc: 'Formats as a professional email.' },
  { id: 'whatsapp', label: 'WhatsApp Message', desc: 'Casual but clear text.' },
  { id: 'prompt', label: 'AI Prompt', desc: 'Optimizes text as an instruction for AI.' }
];

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  
  const setRecordingState = (state: boolean) => {
    setIsRecording(state);
    isRecordingRef.current = state;
  };

  const [language, setLanguage] = useState(LANGUAGES[0].code);
  const [outputLanguage, setOutputLanguage] = useState(LANGUAGES[1]?.code || LANGUAGES[0].code);
  const [format, setFormat] = useState(FORMATS[0].id);
  const [mode, setMode] = useState<'transcribe' | 'translate'>('transcribe');
  
  const [rawText, setRawText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [refinedText, setRefinedText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedRefined, setCopiedRefined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);

  useEffect(() => {
    const hasSeenWalkthrough = localStorage.getItem('fluent_scribe_walkthrough_seen');
    if (!hasSeenWalkthrough) {
      setIsWalkthroughOpen(true);
      localStorage.setItem('fluent_scribe_walkthrough_seen', 'true');
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('fluent_scribe_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  const recognitionRef = useRef<any>(null);

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
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setRawText(prev => {
            const trimmedPrev = prev.trim();
            const trimmedFinal = finalTranscript.trim();
            if (trimmedPrev.endsWith(trimmedFinal)) return prev;
            return prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript;
          });
        }
        setInterimText(interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Recognition error:', event.error);
        if (event.error === 'not-allowed') {
           setError('Microphone permission denied. Please allow microphone access.');
           setRecordingState(false);
        } else if (event.error === 'network') {
           setError('Network error in speech recognition. Please check your connection.');
           setRecordingState(false);
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
            try {
               recognition.start();
            } catch (e) {
               console.error('Failed to auto-restart:', e);
            }
        }
      };

      recognitionRef.current = recognition;
    } else {
      setError('Speech recognition is not supported in this browser.');
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language]);

  useEffect(() => {
    if (isRecording && recognitionRef.current) {
       recognitionRef.current.stop();
       recognitionRef.current.lang = language;
       setTimeout(() => {
         try { recognitionRef.current.start(); } catch (e) {}
       }, 100);
    }
  }, [language]);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    
    setError(null);
    if (isRecording) {
      recognitionRef.current.stop();
      setRecordingState(false);
      setInterimText('');
    } else {
      setRawText('');
      setInterimText('');
      setRefinedText('');
      setRecordingState(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error(err);
        setRecordingState(false);
      }
    }
  };

  const copyToClipboard = async (text: string, isRaw: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isRaw) {
        setCopiedRaw(true);
        setTimeout(() => setCopiedRaw(false), 2000);
      } else {
        setCopiedRefined(true);
        setTimeout(() => setCopiedRefined(false), 2000);
      }
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const refineText = async () => {
    if (!rawText.trim()) return;
    
    if (!VITE_GEMINI_API_KEY || VITE_GEMINI_API_KEY === 'undefined') {
      setError('Gemini API Key is missing. Please add VITE_GEMINI_API_KEY to your .env file.');
      return;
    }

    setIsRefining(true);
    setError(null);
    
    try {
      const genAI = new GoogleGenAI(VITE_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const selectedLang = LANGUAGES.find(l => l.code === language)?.label || 'the specified language';
      const targetLang = mode === 'translate' ? (LANGUAGES.find(l => l.code === outputLanguage)?.label || selectedLang) : selectedLang;
      const isTranslation = mode === 'translate' && language !== outputLanguage;
      
      let formatInstruction = "";
      switch (format) {
        case 'smart':
          formatInstruction = "Analyze the transcript to determine the speaker's core intent. If the text resembles an email, letter, or message, format it appropriately. If there are lists or distinct points, structure them using bullet points (using - or •). Use ALL CAPS for section headings where it makes sense to create a formalized, highly legible structured layout. Provide a smart, finalized structure rather than a raw transcription.";
          break;
        case 'email':
          formatInstruction = "Format the text as a professional email. Add placeholders for greetings/sign-offs if appropriate.";
          break;
        case 'whatsapp':
          formatInstruction = "Format the text as a clear, polite, and well-spaced WhatsApp message.";
          break;
        case 'prompt':
          formatInstruction = "Format and structure the text as a high-quality instructional prompt for an AI.";
          break;
        case 'standard':
        default:
          formatInstruction = "Ensure perfect grammar, spelling, and punctuation without changing the core meaning.";
          break;
      }

      const prompt = `You are an expert text editor and translator. I am giving you a raw speech-to-text transcript spoken primarily in ${selectedLang}.
      
Your task:
1. ${isTranslation ? `Translate the meaning accurately and naturally into ${targetLang}.` : `Fix any grammatical, spelling, and punctuation errors.`}
2. ${formatInstruction}

Constraints:
- Respond ONLY with the finalized, refined text.
- Do not add any conversational filler like "Here is the parsed text."
- Language constraints: The final text MUST be in ${targetLang}. For translations, ensure local idioms map naturally.

Raw Transcript:
"""
${rawText}
"""`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const newRefined = response.text()?.trim() || '';
      setRefinedText(newRefined);
      
      if (newRefined) {
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          rawText,
          refinedText: newRefined,
          mode,
          language,
          outputLanguage: mode === 'translate' ? outputLanguage : undefined,
          format: mode === 'transcribe' ? format : undefined,
          timestamp: Date.now()
        };
        setHistory(prev => {
          const updated = [newItem, ...prev].slice(0, 50);
          localStorage.setItem('fluent_scribe_history', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Refinement error:', err);
      const errorMessage = err?.message || err?.toString() || '';
      setError(`API Error: ${errorMessage.includes('API key') ? 'Invalid API Key' : errorMessage || 'An error occurred while refining the text.'}`);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="h-[100dvh] mx-auto w-full max-w-md bg-[#FDFBF7] text-[#3D3D3D] font-sans relative flex flex-col sm:border-x sm:border-[#E5E2DA] sm:shadow-2xl overflow-hidden">
      
      {/* Header */}
      <header className="flex-none px-5 py-3 bg-[#FDFBF7] border-b border-[#E5E2DA] flex flex-row items-center justify-between z-10 shrink-0 relative">
        <div className="flex items-center justify-start max-w-[30%]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight font-serif italic text-[#2D2D2D] md:block hidden">
              Fluent
            </h1>
          </div>
        </div>
        <div className="flex justify-center shrink-0 absolute left-1/2 -translate-x-1/2">
          <div className="flex bg-[#E8E6DF] p-1 rounded-full w-[180px]">
            <button 
              onClick={() => setMode('transcribe')} 
              className={`flex-1 text-[10px] uppercase tracking-widest font-bold py-1.5 rounded-full transition-all ${mode === 'transcribe' ? 'bg-white shadow-sm text-[#5A5A40]' : 'text-[#A5A296] hover:text-[#5A5A40]'}`}
            >
              Scribe
            </button>
            <button 
              onClick={() => setMode('translate')} 
              className={`flex-1 text-[10px] uppercase tracking-widest font-bold py-1.5 rounded-full transition-all ${mode === 'translate' ? 'bg-white shadow-sm text-[#5A5A40]' : 'text-[#A5A296] hover:text-[#5A5A40]'}`}
            >
              Translate
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end max-w-[30%] gap-2">
          <button 
            onClick={() => setIsWalkthroughOpen(true)} 
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-[#E5E2DA] text-[#A5A296] hover:text-[#5A5A40] transition-colors"
            title="How to use"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsHistoryOpen(true)} 
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-[#E5E2DA] text-[#A5A296] hover:text-[#5A5A40] transition-colors relative"
          >
            <Clock className="w-4 h-4" />
            {history.length > 0 && (
              <span className="absolute max-w-[20px] -top-1 -right-1 bg-[#5A5A40] text-white text-[8px] font-bold w-3 h-3 rounded-full flex items-center justify-center">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {error && (
        <div className="m-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium z-10 shadow-sm relative">
          <button 
            onClick={() => setError(null)} 
            className="absolute top-2.5 right-2.5 text-red-500 hover:text-red-700 bg-red-100 hover:bg-red-200 rounded-full p-1"
          >
            <div className="w-4 h-4" />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold font-sans">×</span>
          </button>
          {error}
        </div>
      )}

      {/* Main scrollable area */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 relative">
        
        {/* Input Card */}
        <div className="flex flex-col bg-white rounded-3xl shadow-sm border border-[#E5E2DA] overflow-hidden min-h-[220px] shrink-0">
          <div className="px-5 py-3 border-b border-[#F5F5F0] flex items-center justify-between bg-white">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#A5A296] flex items-center gap-2">
               <Mic className="w-3 h-3"/> Input
            </span>
            <div className="flex gap-3">
              {isRecording && <span className="text-[9px] bg-[#F27D26]/10 text-[#F27D26] px-2 py-0.5 rounded-md font-bold animate-pulse">RECORDING</span>}
              <button onClick={() => copyToClipboard(rawText, true)} disabled={!rawText} className="text-[#A5A296] hover:text-[#5A5A40] disabled:opacity-30">
                 {copiedRaw ? <Check className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="relative flex-1 w-full flex flex-col">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Tap the mic to speak, or type here..."
              className="flex-1 w-full px-5 py-4 resize-none focus:outline-none text-[#7D7D7D] font-serif italic leading-relaxed text-[17px] placeholder:text-[#E5E2DA] bg-transparent pb-10"
            />
            {interimText && (
               <div className="absolute left-5 bottom-4 text-[#A5A296] bg-[#FDFBF7] px-2 py-1 rounded text-sm animate-pulse border border-[#E5E2DA] max-w-[90%] truncate">
                 {interimText}
               </div>
            )}
          </div>
        </div>

        {/* Output Card */}
        <div className="flex flex-col bg-white rounded-3xl shadow-md border border-[#E5E2DA] overflow-hidden min-h-[250px] shrink-0 relative">
          <div className="px-5 py-3 border-b border-[#F5F5F0] flex items-center justify-between bg-[#FDFBF7]/30">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#5A5A40] flex items-center gap-2">
              <Sparkles className="w-3 h-3"/> Output
            </span>
            {mode === 'transcribe' ? (
              <div className="relative inline-block">
                <select 
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="appearance-none text-[9px] pl-2 pr-6 py-1 bg-white border border-[#E5E2DA] rounded text-[#5A5A40] font-bold uppercase shadow-sm outline-none focus:border-[#A5A296] w-full"
                >
                  {FORMATS.map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-[#5A5A40]">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
                  </svg>
                </div>
              </div>
            ) : (
              <span className="text-[9px] px-2 py-0.5 bg-white border border-[#E5E2DA] rounded text-[#5A5A40] font-bold uppercase shadow-sm">
                Translation
              </span>
            )}
          </div>
          <div className="flex-1 flex flex-col relative bg-white">
            <textarea
              value={refinedText}
              readOnly
              placeholder="Refined translation will appear here..."
              className="flex-1 w-full px-5 py-4 pb-14 resize-none focus:outline-none text-[#2D2D2D] font-serif leading-relaxed text-lg bg-transparent placeholder:text-[#E5E2DA]"
            />
            {/* Action Bar on Output */}
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-4">
               <button 
                 onClick={() => setRefinedText('')} 
                 className={`text-[10px] font-bold text-[#A5A296] hover:text-[#D97757] uppercase tracking-widest transition-colors ${!refinedText ? 'opacity-0 pointer-events-none' : ''}`}
               >
                 Clear
               </button>
               <button 
                 onClick={() => copyToClipboard(refinedText, false)} 
                 disabled={!refinedText} 
                 className="flex items-center gap-2 bg-[#5A5A40] text-white hover:bg-[#4A4A35] px-5 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition-all shadow-sm disabled:opacity-50 disabled:hidden"
               >
                 {copiedRefined ? <Check className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                 Copy
               </button>
            </div>
          </div>
          
          <AnimatePresence>
            {isRefining && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#FDFBF7]/80 backdrop-blur-[2px] flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-white rounded-full shadow-lg border border-[#E5E2DA]">
                       <RefreshCw className="w-6 h-6 text-[#5A5A40] animate-spin" />
                    </div>
                    <span className="text-xs font-bold text-[#A5A296] uppercase tracking-widest bg-white/50 px-3 py-1 rounded-full">Processing...</span>
                  </div>
               </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Segment */}
      <div className="flex-none bg-[#FDFBF7] border-t border-[#E5E2DA] pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-30 flex flex-col">
         {/* Language Selectors Floating-like Bar */}
         <div className="px-5 pt-3 pb-2">
           <div className={`flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-[#E5E2DA] shadow-sm ${mode === 'transcribe' ? 'justify-center max-w-[200px] mx-auto' : 'justify-between'}`}>
             <div className="relative flex-1">
               <select
                 value={language}
                 onChange={(e) => setLanguage(e.target.value)}
                 className="appearance-none w-full text-xs font-bold text-[#5A5A40] bg-transparent pl-4 pr-8 py-2 outline-none text-center rounded-xl focus:bg-[#F5F5F0] transition-colors"
               >
                 {LANGUAGES.map(lang => (
                   <option key={lang.code} value={lang.code}>{lang.label.split(' ')[0]}</option>
                 ))}
               </select>
               <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#A5A296]">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" /></svg>
               </div>
             </div>
             
             {mode === 'translate' && (
               <>
                 <button 
                   onClick={() => {
                     const temp = language;
                     setLanguage(outputLanguage);
                     setOutputLanguage(temp);
                   }}
                   className="w-8 h-8 rounded-full bg-[#FDFBF7] hover:bg-[#F5F5F0] flex items-center justify-center shrink-0 border border-[#E5E2DA] transition-colors text-[#A5A296] hover:text-[#5A5A40]"
                 >
                   <ArrowRightLeft className="w-3.5 h-3.5" />
                 </button>

                 <div className="relative flex-1">
                   <select
                     value={outputLanguage}
                     onChange={(e) => setOutputLanguage(e.target.value)}
                     className="appearance-none w-full text-xs font-bold text-[#5A5A40] bg-transparent pl-4 pr-8 py-2 outline-none text-center rounded-xl focus:bg-[#F5F5F0] transition-colors"
                   >
                     {LANGUAGES.map(lang => (
                       <option key={lang.code} value={lang.code}>{lang.label.split(' ')[0]}</option>
                     ))}
                   </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#A5A296]">
                      <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" /></svg>
                   </div>
                 </div>
               </>
             )}
           </div>
         </div>

         <div className="flex items-center justify-between px-6 pb-6 pt-2 relative">
            {/* Left Action / Info */}
            <div className="flex justify-start w-1/3">
               <button 
                 onClick={() => { setRawText(''); setInterimText(''); }} 
                 className={`text-[10px] font-bold text-[#A5A296] hover:text-[#D97757] uppercase tracking-widest transition-colors flex items-center gap-1 ${(!rawText && !interimText) ? 'opacity-0 pointer-events-none' : ''}`}
               >
                 Clear
               </button>
            </div>

            {/* Center FAB */}
            <div className="flex items-center justify-center relative z-10 w-1/3">
               <button
                  onClick={toggleRecording}
                  disabled={!SpeechRecognitionAPI}
                  className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-transform outline-none ${
                    isRecording 
                      ? 'bg-[#D97757] text-white shadow-[0_8px_30px_rgba(217,119,87,0.4)] border-4 border-[#FDFBF7] scale-110' 
                      : 'bg-white text-[#5A5A40] border-4 border-[#FDFBF7] shadow-sm hover:scale-105'
                  } ${!SpeechRecognitionAPI ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isRecording && (
                     <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 bg-[#D97757] rounded-full opacity-30" />
                  )}
                  {isRecording ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
                </button>
            </div>

            {/* Right Action */}
            <div className="flex justify-end w-1/3">
               <button
                 onClick={refineText}
                 disabled={!rawText.trim() || isRefining || isRecording}
                 className="flex items-center justify-center gap-2 bg-[#5A5A40] hover:bg-[#4A4A35] disabled:bg-[#F5F5F0] disabled:text-[#A5A296] text-white px-4 py-3 rounded-2xl shadow-sm font-medium text-sm transition-colors"
               >
                 {isRefining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
               </button>
            </div>
         </div>
      </div>

      {/* History Full-Screen Modal */}
      <AnimatePresence>
        {isHistoryOpen && (
          <motion.div 
             initial={{ y: '100%' }}
             animate={{ y: 0 }}
             exit={{ y: '100%' }}
             transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             className="absolute inset-0 z-50 bg-[#FDFBF7] flex flex-col"
          >
             <header className="flex-none px-5 py-4 border-b border-[#E5E2DA] flex items-center justify-between bg-white shadow-sm z-10">
                <h2 className="text-xl font-semibold font-serif italic text-[#2D2D2D]">History</h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                       if (window.confirm('Clear all history?')) {
                          setHistory([]);
                          localStorage.removeItem('fluent_scribe_history');
                       }
                    }} 
                    className="text-[10px] text-red-500 font-bold uppercase tracking-widest px-2 hover:opacity-70 transition-opacity"
                  >
                    Clear All
                  </button>
                  <button onClick={() => setIsHistoryOpen(false)} className="px-5 py-2 bg-[#5A5A40] text-white text-[10px] font-bold uppercase rounded-full tracking-widest shadow-sm">
                    Done
                  </button>
                </div>
             </header>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe">
                {history.length === 0 ? (
                   <div className="text-center py-12 flex flex-col items-center justify-center opacity-50">
                      <Clock className="w-10 h-10 mb-3 text-[#5A5A40]" />
                      <p className="text-sm font-semibold text-[#5A5A40]">No history yet.</p>
                      <p className="text-[11px] text-[#A5A296] mt-2 max-w-[200px]">Your refined transcriptions and translations will appear here.</p>
                   </div>
                ) : (
                   history.map(item => (
                      <div 
                         key={item.id} 
                         role="button"
                         tabIndex={0}
                         onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                               e.preventDefault();
                               setRawText(item.rawText);
                               setRefinedText(item.refinedText);
                               setMode(item.mode);
                               setLanguage(item.language);
                               if (item.outputLanguage) setOutputLanguage(item.outputLanguage);
                               if (item.format) setFormat(item.format);
                               setIsHistoryOpen(false);
                            }
                         }}
                         onClick={() => {
                            setRawText(item.rawText);
                            setRefinedText(item.refinedText);
                            setMode(item.mode);
                            setLanguage(item.language);
                            if (item.outputLanguage) setOutputLanguage(item.outputLanguage);
                            if (item.format) setFormat(item.format);
                            setIsHistoryOpen(false);
                         }}
                         className="w-full text-left p-4 bg-white border border-[#E5E2DA] rounded-2xl hover:border-[#A5A296] hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 cursor-pointer block"
                      >
                         <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] px-2 py-0.5 bg-[#FDFBF7] border border-[#E5E2DA] rounded">
                               {item.mode === 'translate' ? `Translate: ${LANGUAGES.find(l=>l.code===item.outputLanguage)?.label.split(' ')[0] || item.outputLanguage}` : `Scribe: ${FORMATS.find(f=>f.id===item.format)?.label || 'Standard'}`}
                            </span>
                            <div className="flex items-center gap-3">
                               <span className="text-[10px] text-[#A5A296] font-bold tracking-widest">
                                  {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                               </span>
                               <button 
                                  onClick={(e) => {
                                     e.stopPropagation();
                                     const updated = history.filter(h => h.id !== item.id);
                                     setHistory(updated);
                                     localStorage.setItem('fluent_scribe_history', JSON.stringify(updated));
                                  }}
                                  className="text-red-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                               >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                               </button>
                            </div>
                         </div>
                         <p className="text-xs text-[#A5A296] font-serif italic truncate mb-2">"{item.rawText}"</p>
                         <p className="text-[15px] font-semibold text-[#2D2D2D] line-clamp-3">{item.refinedText}</p>
                      </div>
                   ))
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <IOSInstallPrompt />
      <AppWalkthrough isOpen={isWalkthroughOpen} onClose={() => setIsWalkthroughOpen(false)} />
    </div>
  );
}
