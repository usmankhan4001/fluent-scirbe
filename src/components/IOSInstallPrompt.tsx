import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const IOSInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // Check if it's NOT already in standalone mode (installed)
    const isStandalone = window.navigator.hasOwnProperty('standalone') && (window.navigator as any).standalone;
    
    // Check if user has dismissed it before
    const hasDismissed = localStorage.getItem('ios-prompt-dismissed');

    if (isIOS && !isStandalone && !hasDismissed) {
      setShowPrompt(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('ios-prompt-dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-4 right-4 z-[100] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#E5E2DA] p-6"
        >
          <button 
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1 text-[#A5A296] hover:text-[#5A5A40] transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#5A5A40] rounded-2xl flex items-center justify-center shadow-lg">
                <PlusSquare className="text-white w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif italic font-semibold text-lg text-[#2D2D2D]">Install Fluent Scribe</h3>
                <p className="text-xs text-[#A5A296] font-bold uppercase tracking-widest">Add to your home screen</p>
              </div>
            </div>

            <p className="text-sm text-[#5A5A40] leading-relaxed">
              Install this app on your iPhone for a better experience and quick access from your home screen.
            </p>

            <div className="bg-[#FDFBF7] rounded-2xl p-4 border border-[#F5F5F0] space-y-3">
              <div className="flex items-center gap-3 text-sm text-[#5A5A40]">
                <div className="w-8 h-8 rounded-full bg-white border border-[#E5E2DA] flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold">1</span>
                </div>
                <p>Tap the <Share size={16} className="inline mx-1 text-blue-500" /> <span className="font-bold text-blue-500">Share</span> button in Safari.</p>
              </div>
              <div className="flex items-center gap-3 text-sm text-[#5A5A40]">
                <div className="w-8 h-8 rounded-full bg-white border border-[#E5E2DA] flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold">2</span>
                </div>
                <p>Scroll down and tap <span className="font-bold">"Add to Home Screen"</span>.</p>
              </div>
            </div>

            <button 
              onClick={handleDismiss}
              className="w-full py-3 bg-[#5A5A40] text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A35] transition-all shadow-md active:scale-95"
            >
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
