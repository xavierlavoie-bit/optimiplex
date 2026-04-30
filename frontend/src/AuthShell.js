import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const LOGO_URL = 'https://i.ibb.co/tMbhC8Sy/Minimalist-Real-Estate-Logo-1.png';

export function AuthAmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Grille subtile */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* Orbes flottantes */}
      <motion.div
        className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 60%)' }}
        animate={{ x: [0, 50, -20, 0], y: [0, -40, 30, 0], scale: [1, 1.08, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -right-40 w-[34rem] h-[34rem] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 60%)' }}
        animate={{ x: [0, -50, 30, 0], y: [0, 40, -30, 0], scale: [1, 1.05, 0.9, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export default function AuthShell({ children, side = 'left' }) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 overflow-hidden text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <AuthAmbientBackground />

      {/* Top bar minimal */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <motion.div whileHover={{ rotate: -5, scale: 1.05 }} className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-30 group-hover:opacity-50 transition-opacity rounded-xl"></div>
            <img src={LOGO_URL} alt="OptimiPlex" className="relative w-11 h-11 rounded-xl bg-white p-1 shadow-md" />
          </motion.div>
          <span className="font-black text-slate-900 text-2xl tracking-tight hidden sm:inline">OptimiPlex</span>
        </Link>

        <Link
          to="/"
          className="group inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Retour à l'accueil
        </Link>
      </header>

      {/* Body : carte glassmorphism + bénéfices/illustration */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pb-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-100px)]">
        {side === 'left' ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-br from-indigo-500/15 via-blue-500/15 to-cyan-500/15 rounded-3xl blur-xl"></div>
              <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-8 sm:p-10">
                {children}
              </div>
            </motion.div>
            <SidePanel />
          </>
        ) : (
          <>
            <SidePanel />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-br from-indigo-500/15 via-blue-500/15 to-cyan-500/15 rounded-3xl blur-xl"></div>
              <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-8 sm:p-10">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

function SidePanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="hidden lg:flex flex-col justify-center"
    >
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm w-fit mb-6">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-xs font-black uppercase tracking-widest text-slate-700">PropTech IA · Québec</span>
      </div>

      <h2 className="text-4xl xl:text-5xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">
        L'intelligence{' '}
        <span className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
          immobilière
        </span>{' '}
        dans votre poche.
      </h2>
      <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-md">
        Évaluation, optimisation, CRM. Une plateforme propulsée par l'IA pour les pros québécois.
      </p>

      <ul className="space-y-3">
        {[
          { icon: '⚡', label: 'Évaluation IA en temps réel' },
          { icon: '📈', label: 'Optimisation de cash-flow automatisée' },
          { icon: '💼', label: 'CRM Hypothécaire & Immobilier intégrés' },
          { icon: '🔒', label: 'Données hébergées au Canada — Loi 25' },
        ].map((b, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <span className="text-xl">{b.icon}</span>
            <span className="text-sm font-bold text-slate-700">{b.label}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
