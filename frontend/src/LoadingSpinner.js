import React, { useState, useEffect } from 'react';

function LoadingSpinner({ isLoading, messages = [], estimatedTime = 30 }) {
  const [currentMessage, setCurrentMessage] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isLoading || messages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [isLoading, messages.length]);

  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  // Calcul du pourcentage de progression (0-100%)
  const progressPercent = Math.min(
    ((elapsedTime / (estimatedTime || 30)) * 100).toFixed(0),
    95 // Max 95% jusqu'à completion
  );

  // Formatage du temps écoulé
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Déterminer si c'est une analyse commerciale longue
  const isLongAnalysis = estimatedTime > 40;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white/95 rounded-3xl shadow-2xl p-8 md:p-12 text-center max-w-lg w-full">
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
            <div className="absolute inset-0 flex items-center justify-center text-4xl">
              {isLongAnalysis ? '🏢' : '🤖'}
            </div>
          </div>
        </div>

        {/* Dynamic Text */}
        <div className="min-h-20 flex flex-col items-center justify-center mb-6">
          <p className="text-xs md:text-sm text-gray-500 mb-2">OptimiPlex IA en cours...</p>
          <h3 className="text-lg md:text-xl font-black text-gray-900 mb-3 line-clamp-2">
            {messages[currentMessage] || 'Analyse en cours...'}
          </h3>

          {/* Loading Dots Animation */}
          <div className="flex gap-2 justify-center">
            <div
              className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
              style={{ animationDelay: '0s' }}
            ></div>
            <div
              className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
              style={{ animationDelay: '0.2s' }}
            ></div>
            <div
              className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
              style={{ animationDelay: '0.4s' }}
            ></div>
          </div>
        </div>

        {/* PROGRESS BAR WITH TIME */}
        <div className="mb-6">
          {/* Time Display */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs md:text-sm font-semibold text-gray-700">
              Temps écoulé: <span className="text-indigo-600">{formatTime(elapsedTime)}</span>
            </div>
            <div className="text-xs md:text-sm font-semibold text-gray-700">
              <span className="text-indigo-600">{progressPercent}%</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-300 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* LONG ANALYSIS WARNING */}
        {isLongAnalysis && (
          <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-lg">
            <div className="flex gap-3 items-start">
              <span className="text-xl flex-shrink-0">⏱️</span>
              <div className="text-left">
                <p className="text-sm font-bold text-amber-900">Analyse bâtiment commercial</p>
                <p className="text-xs text-amber-800 mt-1">
                  Cette analyse peut prendre jusqu'à <span className="font-bold">{estimatedTime}s</span> (~1 minute). 
                  Nous calculons les métriques commerciales avancées (Cap Rate, NOI, multiplicateurs, etc.). 
                  Veuillez patienter...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STANDARD MESSAGE */}
        {!isLongAnalysis && (
          <p className="text-xs md:text-sm text-gray-500 mb-2">
            Temps estimé: <span className="font-bold">~{estimatedTime}s</span>
          </p>
        )}

        {/* FOOTER MESSAGE */}
        <p className="text-xs text-gray-500 font-medium">
          ✓ Ne fermez pas cette page • ✓ Ne rechargez pas • ✓ Connexion sécurisée
        </p>

        {/* DETAILED TIPS FOR LONG ANALYSIS */}
        {isLongAnalysis && (
          <div className="mt-4 pt-4 border-t border-gray-200 text-left">
            <p className="text-xs font-semibold text-gray-700 mb-2">💡 Pendant ce temps:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>✓ Nous analysons les revenus & dépenses</li>
              <li>✓ Nous calculons le Cap Rate & NOI</li>
              <li>✓ Nous évaluons les comparables</li>
              <li>✓ Nous générons les recommandations</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoadingSpinner;