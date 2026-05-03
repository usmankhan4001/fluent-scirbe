import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, ArrowRightLeft, Sparkles, Clock, Check, X, ChevronRight, ChevronLeft } from 'lucide-react';

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const STEPS: Step[] = [
  {
    title: "Capture Your Voice",
    description: "Tap the central microphone button to start recording. Speak naturally, and Fluent Scribe will transcribe your voice in real-time.",
    icon: <Mic className="w-8 h-8 text-white" />,
    color: "bg-[#D97757]"
  },
  {
    title: "Scribe or Translate",
    description: "Switch between 'Scribe' to polish your native speech, or 'Translate' to convert your words into another language instantly.",
    icon: <ArrowRightLeft className="w-8 h-8 text-white" />,
    color: "bg-[#5A5A40]"
  },
  {
    title: "Smart Formatting",
    description: "Choose from various formats like 'Smart Auto-Format' for structured notes, 'Professional Email' for work, or 'WhatsApp' for casual chats.",
    icon: <Check className="w-8 h-8 text-white" />,
    color: "bg-[#A5A296]"
  },
  {
    title: "Refine with AI",
    description: "Once recorded, tap the sparkles button. Our AI will analyze your intent, fix grammar, and apply your chosen format perfectly.",
    icon: <Sparkles className="w-8 h-8 text-white" />,
    color: "bg-[#5A5A40]"
  },
  {
    title: "Access History",
    description: "Your past transcriptions are never lost. Tap the clock icon in the header to view, reuse, or copy your previous refinements.",
    icon: <Clock className="w-8 h-8 text-white" />,
    color: "bg-[#2D2D2D]"
  }
];

export const AppWalkthrough = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#FDFBF7]/90 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.1)] border border-[#E5E2DA] overflow-hidden flex flex-col"
          >
            {/* Header / Progress */}
            <div className="px-8 pt-8 flex justify-between items-center">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-[#5A5A40]' : 'w-2 bg-[#E5E2DA]'}`}
                  />
                ))}
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-[#A5A296] hover:text-[#5A5A40] transition-colors bg-[#FDFBF7] rounded-full border border-[#F5F5F0]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="px-8 py-10 flex-1 flex flex-col items-center text-center">
              <motion.div
                key={currentStep}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div className={`w-20 h-20 ${STEPS[currentStep].color} rounded-[2rem] flex items-center justify-center mx-auto shadow-xl ring-8 ring-[#FDFBF7]`}>
                  {STEPS[currentStep].icon}
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-2xl font-serif italic font-semibold text-[#2D2D2D]">
                    {STEPS[currentStep].title}
                  </h2>
                  <p className="text-[#5A5A40] leading-relaxed">
                    {STEPS[currentStep].description}
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Footer Buttons */}
            <div className="px-8 pb-8 flex gap-3">
              {currentStep > 0 && (
                <button 
                  onClick={prevStep}
                  className="w-14 h-14 rounded-2xl border border-[#E5E2DA] flex items-center justify-center text-[#5A5A40] hover:bg-[#FDFBF7] transition-all active:scale-95"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              <button 
                onClick={nextStep}
                className="flex-1 h-14 bg-[#5A5A40] text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 hover:bg-[#4A4A35] transition-all shadow-lg shadow-[#5A5A40]/20 active:scale-95"
              >
                {currentStep === STEPS.length - 1 ? "Start Writing" : "Next Step"}
                {currentStep < STEPS.length - 1 && <ChevronRight size={16} />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
