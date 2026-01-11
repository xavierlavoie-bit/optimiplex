import React, { useState, useEffect } from 'react';

function LoadingSpinner({ isLoading, messages = [] }) {
  const [currentMessage, setCurrentMessage] = useState(0);

  useEffect(() => {
    if (!isLoading || messages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length);
    }, 2500); // Change message every 2.5 seconds

    return () => clearInterval(interval);
  }, [isLoading, messages.length]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-white/95 rounded-3xl shadow-2xl p-12 text-center max-w-lg">
        {/* Spinner Animation */}
        <div className="mb-8">
          <div className="relative w-24 h-24 mx-auto">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            
            {/* Rotating Ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 border-r-indigo-400 animate-spin"></div>
            
            {/* Inner Pulsing Circle */}
            <div className="absolute inset-3 rounded-full bg-indigo-100 animate-pulse"></div>
            
            {/* Center Icon */}
            <div className="absolute inset-0 flex items-center justify-center text-3xl">
              🤖
            </div>
          </div>
        </div>

        {/* Dynamic Text */}
        <div className="h-16 flex flex-col items-center justify-center">
          <p className="text-sm text-gray-500 mb-2">OptimiPlex IA en cours...</p>
          <h3 className="text-xl font-black text-gray-900 mb-2">
            {messages[currentMessage] || 'Analyse en cours...'}
          </h3>
          
          {/* Loading Dots Animation */}
          <div className="flex gap-2 justify-center mt-3">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>

        {/* Progress Bar */}
        

        <p className="text-xs text-gray-500 mt-4">Ne fermez pas cette page...</p>
      </div>
    </div>
  );
}

export default LoadingSpinner;
