/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring } from 'framer-motion';
import {
  ArrowRight, TrendingUp, Brain, Building2, BarChart3, MessageSquare,
  CheckCircle2, Globe, Shield, Mail, FileText, Users, Play,
  Target, LineChart
} from 'lucide-react';

const LOGO_URL = 'https://i.ibb.co/tMbhC8Sy/Minimalist-Real-Estate-Logo-1.png';

// =====================================================
// 🎬 PRIMITIVES ANIMATION
// =====================================================

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }
  })
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
};

function Reveal({ children, delay = 0, className = '', y = 28 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Animated counter
function AnimatedNumber({ value, suffix = '', duration = 2 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (value - start) * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(value);
    };
    requestAnimationFrame(tick);
  }, [inView, value, duration]);
  return <span ref={ref}>{display.toLocaleString('fr-CA')}{suffix}</span>;
}

// =====================================================
// 🎯 NAV
// =====================================================

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/70 shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <motion.div whileHover={{ rotate: -5, scale: 1.05 }} className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-30 group-hover:opacity-50 transition-opacity rounded-xl"></div>
            <img src={LOGO_URL} alt="OptimiPlex" className="relative w-11 h-11 rounded-xl bg-white p-1 shadow-md" />
          </motion.div>
          <span className={`font-black text-2xl tracking-tight hidden sm:inline transition-colors ${scrolled ? 'text-slate-900' : 'text-white drop-shadow'}`}>OptimiPlex</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { href: '#produit', label: 'Produit' },
            { href: '#pricing', label: 'Tarification' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${scrolled ? 'text-slate-600 hover:text-slate-900' : 'text-white/85 hover:text-white'}`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className={`px-4 py-2 text-sm font-bold transition-colors hidden sm:inline-block ${scrolled ? 'text-slate-700 hover:text-slate-900' : 'text-white/85 hover:text-white'}`}
          >
            Connexion
          </Link>
          <Link
            to="/register"
            className={`group inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:shadow-lg ${scrolled ? 'bg-slate-900 hover:bg-slate-800 text-white hover:shadow-slate-900/20' : 'bg-white hover:bg-slate-100 text-slate-900 hover:shadow-white/20'}`}
          >
            Commencer
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </motion.header>
  );
}

// =====================================================
// 🚀 HERO
// =====================================================

function Hero() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.4]);

  // Mouse parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150 };
  const dxBg = useSpring(useTransform(mouseX, [-1, 1], [-15, 15]), springConfig);
  const dyBg = useSpring(useTransform(mouseY, [-1, 1], [-15, 15]), springConfig);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width * 2 - 1);
    mouseY.set((e.clientY - rect.top) / rect.height * 2 - 1);
  };

  return (
    <section ref={heroRef} onMouseMove={handleMouseMove} className="relative pt-36 pb-20 sm:pt-44 sm:pb-32 overflow-hidden">
      {/* Video background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[940px] overflow-hidden">
        <motion.div style={{ x: dxBg, y: dyBg }} className="absolute inset-0 scale-110">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/veo.mp4" type="video/mp4" />
          </video>
        </motion.div>
        {/* Dark gradient overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-900/65 to-slate-900/40" />
        {/* Subtle vignette */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(2,6,23,0.55) 100%)' }} />
        {/* Bottom fade to page background */}
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent to-white" />
      </div>

      <motion.div style={{ y, opacity }} className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg shadow-black/10 mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-white/90">
            PropTech IA · Conçu au Québec
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={stagger}
          initial="hidden"
          animate="show"
          className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white tracking-tighter leading-[0.95] mb-6 drop-shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
        >
          <motion.span variants={fadeUp} custom={0} className="block">
            L'intelligence
          </motion.span>
          <motion.span variants={fadeUp} custom={1} className="block">
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-br from-indigo-300 via-blue-300 to-cyan-200 bg-clip-text text-transparent">
                immobilière
              </span>
              <motion.svg
                className="absolute -bottom-2 left-0 w-full"
                height="14"
                viewBox="0 0 300 14"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, delay: 1.2, ease: 'easeInOut' }}
              >
                <motion.path
                  d="M2 8C50 4, 150 12, 298 6"
                  stroke="url(#g1)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="300" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#a5b4fc" />
                    <stop offset="1" stopColor="#67e8f9" />
                  </linearGradient>
                </defs>
              </motion.svg>
            </span>
          </motion.span>
          <motion.span variants={fadeUp} custom={2} className="block text-white">
            de nouvelle génération.
          </motion.span>
        </motion.h1>

        {/* Subline */}
        <motion.p
          variants={fadeUp} custom={3}
          initial="hidden" animate="show"
          className="text-lg sm:text-xl text-slate-200/90 max-w-2xl mx-auto mb-10 leading-relaxed font-medium drop-shadow"
        >
          Évaluation propulsée par l'IA pour les courtiers et investisseurs québécois qui prennent de meilleures décisions, plus vite.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp} custom={4}
          initial="hidden" animate="show"
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
        >
          <Link
            to="/register"
            className="group relative inline-flex items-center justify-center gap-2 px-7 py-4 bg-white text-slate-900 rounded-xl font-black text-base shadow-2xl shadow-black/30 hover:shadow-black/50 transition-all hover:-translate-y-0.5 overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"></span>
            <span className="relative group-hover:text-white transition-colors">Démarrer gratuitement</span>
            <ArrowRight size={18} className="relative group-hover:translate-x-1 group-hover:text-white transition-all" />
          </Link>
          <a
            href="#produit"
            className="group inline-flex items-center justify-center gap-2 px-7 py-4 bg-white/10 backdrop-blur-md border border-white/25 text-white rounded-xl font-black text-base hover:bg-white/20 hover:border-white/40 transition-all"
          >
            <Play size={16} className="text-cyan-300" />
            Voir la plateforme
          </a>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          variants={fadeUp} custom={5}
          initial="hidden" animate="show"
          className="flex flex-wrap justify-center gap-x-10 gap-y-6 text-center"
        >
          {[
            { value: 12000, suffix: '+', label: 'Propriétés analysées' },
            { value: 98, suffix: '%', label: 'Précision IA' },
            { value: 24, suffix: 'h/24', label: 'Disponibilité' }
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow">
                <AnimatedNumber value={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-white/70 mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Product mockup */}
      <ProductMockup />
    </section>
  );
}

// =====================================================
// 💎 PRODUCT MOCKUP (faux dashboard, vraiment beau)
// =====================================================

function ProductMockup() {
  return (
    <div className="relative max-w-6xl mx-auto px-6 lg:px-8 mt-20">
      <Reveal>
        <div className="relative">
          {/* Glow */}
          <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500/30 via-blue-500/30 to-cyan-500/30 rounded-3xl blur-2xl opacity-70"></div>

          {/* Window frame */}
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Title bar */}
            <div className="bg-slate-50/80 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
              </div>
              <div className="flex-1 mx-4 px-3 py-1 bg-white rounded-md border border-slate-200 text-xs text-slate-500 max-w-md text-center font-mono">
                app.optimiplex.com/dashboard
              </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-12 gap-0 bg-slate-50/30 min-h-[480px]">
              {/* Sidebar */}
              <div className="col-span-3 bg-white border-r border-slate-200 p-4 hidden md:block">
                <div className="flex items-center gap-2 mb-6 px-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600"></div>
                  <span className="font-black text-slate-900 text-sm">OptimiPlex</span>
                </div>
                {['📈 Vue d\'ensemble', '📊 Évaluation', '⚡ Optimiseur', '🏆 Classement', '👤 Profil'].map((item, i) => (
                  <div key={i} className={`px-3 py-2 rounded-lg text-xs font-bold mb-1 ${i === 1 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600'}`}>
                    {item}
                  </div>
                ))}
              </div>

              {/* Main */}
              <div className="col-span-12 md:col-span-9 p-6 space-y-4">
                {/* Hero card */}
                <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-5 text-white relative overflow-hidden">
                  <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10"></div>
                  <p className="text-xs font-black uppercase tracking-widest opacity-80">Plan actuel</p>
                  <div className="flex items-end justify-between mt-1">
                    <h3 className="text-3xl font-black">Pro</h3>
                    <p className="text-sm font-bold">29$ / mois</p>
                  </div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <MiniStat label="Évaluations" value="247" trend="+18%" color="indigo" />
                  <MiniStat label="Cash-flow optimisé" value="$ 14.5k" trend="+32%" color="emerald" />
                  <MiniStat label="Crédits" value="125" trend="78 utilisés" color="amber" />
                </div>

                {/* Mini chart */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Performance · 30 jours</p>
                    <span className="text-xs font-bold text-emerald-600">+24.5%</span>
                  </div>
                  <MiniChart />
                </div>
              </div>
            </div>
          </div>

          {/* Floating cards */}
          <FloatingCard className="hidden lg:block absolute -left-12 top-1/3" delay={1.4}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recommandation IA</p>
                <p className="text-sm font-black text-slate-900">+1 450 $ / mois récupérable</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="hidden lg:block absolute -right-12 bottom-1/4" delay={1.6}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Brain size={20} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Analyse IA</p>
                <p className="text-sm font-black text-slate-900">Stress test passé · 7%</p>
              </div>
            </div>
          </FloatingCard>
        </div>
      </Reveal>
    </div>
  );
}

function MiniStat({ label, value, trend, color }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3">
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{label}</p>
      <p className="text-xl font-black text-slate-900">{value}</p>
      <p className={`text-[11px] font-bold text-${color}-600`}>{trend}</p>
    </div>
  );
}

function MiniChart() {
  const points = [20, 32, 28, 45, 38, 52, 48, 65, 60, 72, 70, 88];
  const max = Math.max(...points);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {points.map((p, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          whileInView={{ height: `${(p / max) * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-500 to-cyan-400"
        />
      ))}
    </div>
  );
}

function FloatingCard({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 p-3 backdrop-blur-md"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// =====================================================
// 🌟 LOGO STRIP / SOCIAL PROOF
// =====================================================

function SocialProof() {
  return (
    <Reveal>
      <section className="py-16 border-y border-slate-200/80 bg-white/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-center text-xs font-black uppercase tracking-[0.25em] text-slate-500 mb-8">
            Construit avec et pour les pros de l'immobilier québécois
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
            {[
              { icon: Building2, label: 'Courtiers Hypothécaires' },
              { icon: Users, label: 'Agences Immobilières' },
              { icon: Target, label: 'Investisseurs Privés' },
              { icon: BarChart3, label: 'Gestionnaires d\'Actifs' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="flex items-center justify-center gap-2.5 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <item.icon size={18} />
                <span className="text-sm font-bold">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

// =====================================================
// 💼 FEATURES (Bento grid moderne)
// =====================================================

function Features() {
  return (
    <section id="produit" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/60 to-white"></div>
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="inline-block text-xs font-black uppercase tracking-[0.25em] text-indigo-600 mb-4">
              La plateforme
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-5 leading-tight">
              Une suite complète pour <span className="bg-gradient-to-br from-indigo-600 to-cyan-500 bg-clip-text text-transparent">votre marché</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Évaluation IA, analyse de marché, scan Web en direct, recommandations stratégiques. Tous les outils pour évaluer une propriété en quelques secondes.
            </p>
          </div>
        </Reveal>

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Big card */}
          <BentoCard className="lg:col-span-2 lg:row-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white" delay={0}>
            <span className="inline-block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-3">
              Intelligence IA · Live
            </span>
            <h3 className="text-3xl sm:text-4xl font-black mb-4 leading-tight">
              L'IA qui comprend le marché québécois
            </h3>
            <p className="text-slate-300 leading-relaxed mb-6 max-w-md">
              Évaluation de propriété, prédictions de cash-flow, optimisation de baux. Nourrie par les données du marché en direct et des milliers de transactions.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Stress test 7%', 'TAL conformité', 'ABD/ATD', 'Comparables LIVE', 'Cap rate'].map((tag) => (
                <span key={tag} className="px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-bold text-white border border-white/10">
                  {tag}
                </span>
              ))}
            </div>
            <div className="absolute -bottom-12 -right-12 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 opacity-30 blur-3xl"></div>
            <Brain className="absolute top-8 right-8 text-white/10" size={140} />
          </BentoCard>

          <BentoCard delay={0.1}>
            <FeatureIcon Icon={Globe} color="indigo" />
            <h3 className="text-xl font-black text-slate-900 mb-2">Scan Web Live</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Croise annonces actives, transactions récentes et données publiques en temps réel.
            </p>
          </BentoCard>

          <BentoCard delay={0.15}>
            <FeatureIcon Icon={LineChart} color="emerald" />
            <h3 className="text-xl font-black text-slate-900 mb-2">Optimisation revenus</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Détecte les baux sous-évalués et propose des plans d'augmentation conformes au TAL.
            </p>
          </BentoCard>

          <BentoCard delay={0.2}>
            <FeatureIcon Icon={MessageSquare} color="cyan" />
            <h3 className="text-xl font-black text-slate-900 mb-2">Assistant IA 24/7</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Chatbot stratégique pour scénarios, calculs et avis d'augmentation prêts à envoyer.
            </p>
          </BentoCard>

          <BentoCard delay={0.25}>
            <FeatureIcon Icon={FileText} color="amber" />
            <h3 className="text-xl font-black text-slate-900 mb-2">Rapports automatisés</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Génération PDF et Excel professionnels pour soumission bancaire en un clic.
            </p>
          </BentoCard>

          <BentoCard className="lg:col-span-2 bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-200/70" delay={0.3}>
            <FeatureIcon Icon={Shield} color="emerald" />
            <h3 className="text-xl font-black text-slate-900 mb-2">Données sécurisées · Hébergement Canada</h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md">
              Conformité Loi 25, chiffrement bout-en-bout, infrastructure Firebase Canada-Central. Vos données restent au Québec.
            </p>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

function BentoCard({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative rounded-3xl p-6 sm:p-8 border border-slate-200/80 bg-white shadow-sm hover:shadow-xl transition-shadow overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  );
}

function FeatureIcon({ Icon, color }) {
  return (
    <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-${color}-100 text-${color}-600 mb-4`}>
      <Icon size={20} />
    </div>
  );
}

// =====================================================
// 💰 PRICING
// =====================================================

function Pricing() {
  const plans = [
    {
      name: 'Essai',
      price: 'Gratuit',
      period: '',
      description: 'Découvrez la plateforme',
      features: ['1 évaluation offerte', 'Conseils de base', 'Support standard'],
      cta: 'Commencer',
      ctaTo: '/register',
      highlighted: false,
    },
    {
      name: 'À la carte',
      price: '5$',
      period: '/ analyse',
      description: 'Pour besoin ponctuel',
      features: ['Achat par crédits', 'Scan Web en direct', 'Sans engagement', 'Crédits valides à vie'],
      cta: 'Acheter des crédits',
      ctaTo: '/register',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '29$',
      period: '/ mois',
      description: 'Pour investisseurs actifs',
      features: ['30 analyses / mois', 'Scan Web en direct', 'Recommandations IA', 'Support prioritaire'],
      cta: 'Choisir Pro',
      ctaTo: '/register',
      highlighted: true,
      tag: 'Populaire',
    },
  ];

  return (
    <section id="pricing" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-white"></div>
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="inline-block text-xs font-black uppercase tracking-[0.25em] text-indigo-600 mb-4">
              Tarification
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-5 leading-tight">
              Choisissez votre <span className="bg-gradient-to-br from-indigo-600 to-cyan-500 bg-clip-text text-transparent">niveau</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Du test gratuit aux équipes de courtiers — un plan qui s'adapte à votre rythme.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-3xl p-7 border-2 flex flex-col ${
                plan.highlighted
                  ? 'border-indigo-500 bg-gradient-to-b from-indigo-50/40 to-white shadow-2xl shadow-indigo-200/50 lg:scale-[1.04]'
                  : plan.premium
                  ? 'border-slate-900 bg-slate-900 text-white shadow-xl'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg transition-all'
              }`}
            >
              {plan.tag && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                  {plan.tag}
                </span>
              )}
              {plan.premium && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                  ⭐ Pro Team
                </span>
              )}

              <h3 className={`text-xl font-black mb-1 ${plan.premium ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
              <p className={`text-xs font-bold uppercase tracking-wide mb-6 ${plan.premium ? 'text-slate-400' : 'text-slate-500'}`}>{plan.description}</p>

              <div className="mb-6">
                <span className={`text-4xl font-black tracking-tight ${plan.premium ? 'text-white' : 'text-slate-900'}`}>
                  {plan.price}
                </span>
                {plan.period && (
                  <span className={`text-sm font-bold ml-1 ${plan.premium ? 'text-slate-400' : 'text-slate-500'}`}>
                    {plan.period}
                  </span>
                )}
              </div>

              <Link
                to={plan.ctaTo}
                className={`block w-full py-3 rounded-xl font-black text-sm text-center transition-all mb-6 ${
                  plan.highlighted
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-300/50'
                    : plan.premium
                    ? 'bg-white text-slate-900 hover:bg-slate-100'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {plan.cta}
              </Link>

              <ul className="space-y-2.5 mt-auto">
                {plan.features.map((f, j) => (
                  <li key={j} className={`flex items-start gap-2 text-sm font-semibold ${plan.premium ? 'text-slate-300' : 'text-slate-700'}`}>
                    <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${plan.highlighted ? 'text-indigo-600' : plan.premium ? 'text-emerald-400' : 'text-slate-400'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================
// 🚀 FINAL CTA
// =====================================================

function FinalCta() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-10 sm:p-16 overflow-hidden"
        >
          {/* Animated gradient blob */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 opacity-30 blur-3xl"
          />

          <div className="relative">
            <span className="inline-block text-xs font-black uppercase tracking-[0.25em] text-indigo-300 mb-4">
              Prêt à scaler ?
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6">
              Démarrez en moins<br/>de <span className="bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">2 minutes</span>.
            </h2>
            <p className="text-lg text-slate-300 max-w-xl leading-relaxed mb-8">
              Aucune carte de crédit requise. Première évaluation IA offerte. Annulation en un clic.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/register"
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 bg-white text-slate-900 rounded-xl font-black text-base hover:bg-slate-100 transition-all hover:-translate-y-0.5 shadow-xl"
              >
                Créer mon compte
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="mailto:contact@optimiplex.com"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white/10 backdrop-blur border border-white/20 text-white rounded-xl font-black text-base hover:bg-white/20 transition-all"
              >
                <Mail size={16} />
                Demande entreprise
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// =====================================================
// 🦶 FOOTER
// =====================================================

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img src={LOGO_URL} alt="OptimiPlex" className="w-10 h-10 rounded-lg bg-white p-1 shadow-sm" />
              <span className="font-black text-slate-900 text-xl tracking-tight">OptimiPlex</span>
            </Link>
            <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
              L'intelligence artificielle immobilière qui aide les pros québécois à prendre de meilleures décisions, plus vite.
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Produit</p>
            <ul className="space-y-2 text-sm font-semibold text-slate-600">
              <li><a href="#produit" className="hover:text-slate-900 transition">Fonctionnalités</a></li>
              <li><a href="#pricing" className="hover:text-slate-900 transition">Tarification</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Entreprise</p>
            <ul className="space-y-2 text-sm font-semibold text-slate-600">
              <li><a href="mailto:contact@optimiplex.com" className="hover:text-slate-900 transition">Contact</a></li>
              <li><a href="#" className="hover:text-slate-900 transition">Conditions</a></li>
              <li><a href="#" className="hover:text-slate-900 transition">Confidentialité</a></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            © 2026 OptimiPlex Intelligence Inc.
          </p>
          <p className="text-xs font-semibold text-slate-400">
            Construit avec ❤ au Québec
          </p>
        </div>
      </div>
    </footer>
  );
}

// =====================================================
// 🏠 PAGE
// =====================================================

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-white overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 text-slate-900">
      <Nav />
      <Hero />
      <SocialProof />
      <Features />
      <Pricing />
      <FinalCta />
      <Footer />
    </div>
  );
}
