import React, { useState, useEffect } from 'react';

function LoadingSpinner({ isLoading, messages = [], estimatedTime = 30, type = 'default' }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Définition des icônes selon le type d'évaluation
  const getIcon = () => {
    switch (type) {
      case 'residential': return '🏠';
      case 'commercial': return '🏢';
      case 'optimization': return '⚡';
      default: return '🤖';
    }
  };

  // Formatage du temps (ex: 90s -> 1m 30s)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;
  };

  // Gestion de l'avancement des étapes (Checklist IA)
  useEffect(() => {
    if (!isLoading || messages.length === 0) return;

    // Calculer un temps dynamique par étape pour étaler les messages sur la durée estimée
    const idealInterval = (estimatedTime * 1000) / messages.length;
    // Minimum 2s, Maximum 15s par étape pour que ça paraisse naturel
    const safeInterval = Math.min(Math.max(idealInterval, 2000), 15000);

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        // Bloquer à l'avant-dernière étape (la dernière c'est la génération finale)
        if (prev >= messages.length - 2) return prev; 
        return prev + 1;
      });
    }, safeInterval);

    return () => clearInterval(interval);
  }, [isLoading, messages.length, estimatedTime]);

  // Chronomètre global
  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      setCurrentStep(0);
      return;
    }
    const interval = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  // Calcul du pourcentage (bloqué à 98% en attendant la fin de la requête)
  const progressPercent = Math.min(((elapsedTime / estimatedTime) * 100), 98);
  const isLongTask = estimatedTime > 60;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 font-sans animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md w-full border border-indigo-50/50">
        
        {/* Ligne de progression en haut */}
        <div className="h-1.5 w-full bg-gray-100">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-1000 ease-out" 
            style={{ width: `${progressPercent}%` }} 
          />
        </div>

        <div className="p-8 md:p-10">
          
          {/* En-tête de l'animation avec icône 3D/Glow */}
          <div className="flex justify-center mb-8 relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative w-20 h-20 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl shadow-[0_8px_30px_rgb(99,102,241,0.4)] flex items-center justify-center transform rotate-3 animate-pulse">
              <span className="text-4xl filter drop-shadow-md text-white">{getIcon()}</span>
            </div>
            {/* Petit badge d'activité */}
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md animate-bounce border-2 border-indigo-50">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>

          {/* Titre & Compteur de temps adaptatif */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Analyse IA en cours</h3>
            
            <div className="inline-flex flex-col items-center">
              <p className="text-sm text-gray-600 font-medium bg-gray-50 px-5 py-2 rounded-full border border-gray-100 shadow-sm flex items-center gap-2">
                <span className="text-indigo-600 font-black tabular-nums">{formatTime(elapsedTime)}</span> 
                <span className="text-gray-400">/</span>
                <span className="tabular-nums">{formatTime(estimatedTime)} estimé</span>
              </p>
              {isLongTask && elapsedTime > 30 && (
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-2 bg-amber-50 px-3 py-1 rounded-full">
                  Recherche approfondie en cours...
                </span>
              )}
            </div>
          </div>

          {/* Console des tâches (Tracking Temps Réel) */}
          <div className="bg-slate-50/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/60 shadow-inner space-y-4 relative overflow-hidden">
            {/* Petit gradient pour l'effet de défilement */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-slate-50 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-slate-50 to-transparent z-10 pointer-events-none"></div>

            {messages.map((msg, idx) => {
              // Afficher un contexte glissant (1 terminée, l'actuelle, 1 à venir)
              if (idx > currentStep + 1 || idx < currentStep - 1) return null; 
              
              const isCompleted = idx < currentStep;
              const isCurrent = idx === currentStep;
              const isNext = idx > currentStep;

              return (
                <div 
                  key={idx} 
                  className={`flex items-start gap-3 text-sm transition-all duration-700 ease-in-out
                    ${isCompleted ? 'opacity-40 -translate-y-2' : ''}
                    ${isCurrent ? 'opacity-100 transform translate-x-1 scale-105' : ''}
                    ${isNext ? 'opacity-30 translate-y-2' : ''}
                  `}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                    ) : isCurrent ? (
                      <div className="w-5 h-5 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-slate-300 rounded-full"></div>
                    )}
                  </div>
                  <span className={`leading-snug ${isCurrent ? 'text-indigo-900 font-bold' : 'text-slate-600 font-medium'}`}>
                    {msg}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center flex flex-col items-center gap-2">
            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              Connexion Sécurisée & Ne fermez pas la page
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoadingSpinner;