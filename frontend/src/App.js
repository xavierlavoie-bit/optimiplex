/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable jsx-a11y/anchor-is-valid */
// App.jsx - OPTIMIPLEX avec STRIPE INTÉGRÉ

import { useState, useEffect, useRef, useCallback  } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { initializeApp } from 'firebase/app';
import { Eye, EyeOff, Menu, ChevronRight,Trash2, X, Check, Edit2,  MapPin,  MessageCircle, Send, Loader2, Search, Target, DollarSign, Zap, Home, Plus, MessageSquare, Paperclip, Mic, Sparkles, TrendingUp, Building,
  Settings, ChevronDown, Star, Shield, CheckCircle2, Share2, ArrowRight, ShieldAlert, Building2
  } from 'lucide-react';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot,
  getDoc,
  where,
  increment,
  orderBy,    // Ajoute ceci pour le classement !
  limit
} from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import ReactMarkdown from 'react-markdown';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

// Toujours afficher pour debug
console.log('📡 Frontend API URL:', API_BASE_URL);
console.log('📡 NODE_ENV:', process.env.NODE_ENV);
console.log('📡 REACT_APP_BACKEND_URL env var:', process.env.REACT_APP_BACKEND_URL);


axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = 190000;

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);


// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// --- CONFIGURATION STRIPE ---
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

// ============================================
// 1️⃣ HOOK POUR DÉTECTION MOBILE
// ============================================
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1024, 
    height: typeof window !== 'undefined' ? window.innerHeight : 800 
  });
  
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initialisation au montage
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return windowSize;
};

// ============================================
// 2️⃣ MOBILE HEADER - TOP BAR MOBILE
// ============================================
function MobileHeader({ sidebarOpen, setSidebarOpen, user, userPlan, planInfo, credits }) {
  const windowSize = useWindowSize();
  const isMobile = windowSize.width < 768;

  useEffect(() => {
    // Si on repasse sur Desktop, on s'assure que le Sidebar s'ouvre bien
    if (!isMobile && !sidebarOpen) {
      setSidebarOpen(true);
    }
  }, [isMobile]); // Dépendance uniquement sur isMobile pour éviter les boucles

  return (
    <>
      {/* Mobile Top Bar - Visible < 768px */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 transition-all duration-300 z-50 h-16 flex items-center justify-between px-4 shadow-sm">
        <h1 className="text-xl font-black text-gray-900 tracking-tight">OptimiPlex</h1>
        
        <div className="flex items-center gap-3">
          {/* ✅ Affichage crédits mobile */}
          <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full text-sm font-black text-indigo-700 border border-indigo-100 shadow-sm">
            <span>💎</span>
            <span>{credits || 0}</span>
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl transition-colors hover:bg-gray-100 active:bg-gray-200 text-gray-800"
            aria-label="Menu mobile"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay - Flou pour la fluidité/beauté */}
      {sidebarOpen && isMobile && (
        <div
          className="md:hidden fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity duration-300"
          style={{ top: '4rem' }} // Démarre juste sous le header de 16 (4rem)
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Espace vide pour ne pas cacher le contenu sous la Top Bar fixe */}
      <div className="md:hidden h-16 w-full shrink-0" />
    </>
  );
}

// ============================================
// 3️⃣ SIDEBAR RESPONSIVE - DESKTOP + MOBILE
// ============================================
function ResponsiveSidebar({ sidebarOpen, setSidebarOpen, activeTab, setActiveTab, user, userPlan, planInfo, onLogout, credits }) {
  const windowSize = useWindowSize();
  const isMobile = windowSize.width < 768;

  const navItems = [
    { id: 'overview', label: '📈 Vue d\'ensemble' },
    { id: 'valuation', label: '📊 Évaluation' },
    { id: 'optimization', label: '⚡ Optimiseur' },
    { id: 'leaderboard', label: '🏆 Classement' },
    { id: 'profile', label: '👤 Mon Profil' },
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (isMobile) setSidebarOpen(false); // Ferme automatiquement sur mobile
  };

  // 🛑 Verrouillage du scroll : Très important pour la fluidité mobile !
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobile, sidebarOpen]);

  return (
    <>
      {/* Desktop Sidebar - Visible >= 768px */}
      <div className={`hidden md:flex flex-col fixed left-0 top-0 h-full ${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-40 shadow-sm`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-center shrink-0 h-20">
          <h1 className={`font-black text-gray-900 whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarOpen ? 'text-2xl' : 'text-lg'}`}>
            {sidebarOpen ? 'OptimiPlex' : 'OP'}
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              title={!sidebarOpen ? label : ''}
              className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === id
                  ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
              }`}
            >
              {sidebarOpen ? (
                <span className="font-bold whitespace-nowrap">{label}</span>
              ) : (
                <span className="text-center w-full text-xl group-hover:scale-110 transition-transform">{[...label][0]}</span>
              )}
            </button>
          ))}
        </nav>

        {/* ✅ Affichage crédits Sidebar Desktop */}
        <div className={`px-4 py-4 shrink-0 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-4 border border-indigo-100 shadow-inner">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Crédits</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl drop-shadow-sm">💎</span>
              <span className="text-3xl font-black text-indigo-900">{credits || 0}</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 space-y-2 border-t border-gray-100 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex justify-center items-center p-3 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors text-sm font-bold"
            title={sidebarOpen ? 'Réduire le menu' : 'Agrandir le menu'}
          >
            {sidebarOpen ? '← Réduire' : '→'}
          </button>
          <button
            onClick={onLogout}
            className={`w-full flex justify-center items-center p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors font-bold text-sm ${!sidebarOpen && 'px-0'}`}
            title="Déconnexion"
          >
            {sidebarOpen ? '🚪 Déconnexion' : '🚪'}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar (Drawer) - Visible < 768px */}
      <nav
        className={`md:hidden fixed top-16 bottom-0 left-0 bg-white w-64 z-50 transform transition-transform duration-300 ease-in-out border-r border-gray-200 shadow-2xl flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* User Info Mobile */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <p className="text-sm text-gray-600 truncate font-bold">{user?.email || 'Utilisateur'}</p>
          <div className="mt-3 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 rounded-lg shadow-sm">
              <span className="text-xs font-black text-blue-800 uppercase tracking-wide">
                {planInfo?.[userPlan]?.name || 'Plan Free'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items Mobile */}
        <div className="py-4 flex-1 overflow-y-auto px-3 space-y-1">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl transition-all font-bold text-sm ${
                activeTab === id
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Logout Mobile */}
        <div className="p-4 border-t border-gray-100 bg-white shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-black text-sm shadow-sm"
          >
            🚪 Déconnexion
          </button>
        </div>
      </nav>
    </>
  );
}



// ============================================
// 🎯 DASHBOARD LAYOUT
// ============================================
function DashboardLayout() {
  const [user, setUser] = useState(null);
  const [userPlan, setUserPlan] = useState('essai');
  const [userProfile, setUserProfile] = useState(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const planInfo = {
    essai: { name: 'Essai', price: 'Gratuit', color: 'blue', priceId: null },
    pro: { name: 'Pro', price: '$29/mois', color: 'purple', priceId: process.env.REACT_APP_STRIPE_PRO_PRICE_ID },
    growth: { name: 'Growth', price: '$69/mois', color: 'emerald', priceId: process.env.REACT_APP_STRIPE_GROWTH_PRICE_ID },
    premium: { name: 'Premium', price: 'Custom', color: 'amber', priceId: null }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const type = params.get('type');
    
    if (success === 'true' && user) {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      
      if (type === 'credits') {
        alert('✅ Crédits ajoutés avec succès !');
      } else {
        alert('✅ Votre plan a été mis à jour avec succès !');
      }
      
      window.history.replaceState({}, document.title, '/dashboard/profile');
      localStorage.removeItem('pendingPlan');
    }
  }, [user]);

  useEffect(() => {
    let unsubscribeAuth = null;
    let unsubscribeSnapshot = null;

    unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setPlanLoaded(false);

        const db = getFirestore();
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        if (unsubscribeSnapshot) unsubscribeSnapshot();

        unsubscribeSnapshot = onSnapshot(userDocRef, (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserPlan(userData.plan || 'essai');
            setUserProfile(userData); // Contient creditsBalance
            setPlanLoaded(true);
          } else {
            const initialData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              plan: 'essai',
              creditsBalance: 0,
              createdAt: serverTimestamp()
            };
            setDoc(userDocRef, initialData, { merge: true });
            setUserPlan('essai');
            setUserProfile(initialData);
            setPlanLoaded(true);
          }
        });
      } else {
        setUser(null);
        setUserPlan('essai');
        setPlanLoaded(false);
        navigate('/login');
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  if (!planLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement du compte...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

 return (
  <div className="min-h-screen bg-gray-50">
    <MobileHeader 
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      user={user}
      userPlan={userPlan}
      planInfo={planInfo}
      credits={userProfile?.creditsBalance || 0} // ✅ Passer les crédits
    />

    <ResponsiveSidebar
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={user}
      userPlan={userPlan}
      planInfo={planInfo}
      onLogout={handleLogout}
      credits={userProfile?.creditsBalance || 0} // ✅ Passer les crédits
    />

    <div className={`${sidebarOpen ? 'md:ml-64' : 'md:ml-20'} transition-all duration-300`}>
      <header className="border-b border-gray-200 bg-white80 backdrop-blur-sm sticky top-0 z-30 hidden md:block">
        <div className="px-8 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-black text-gray-900">
            {activeTab === 'profile' ? '👤 Mon Profil' : activeTab === 'optimization' ? '⚡ Optimiseur' : activeTab === 'valuation' ? '📊 Évaluation' :activeTab === '💬 chat'
    ? 'Optimiplex IA': '📈 Tableau de bord'}
          </h1>
          <div className="flex items-center space-x-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900">{userProfile?.displayName || user?.email?.split('@')[0]}</p>
              
              {/* ✅ Affichage Crédits Header Desktop */}
              <div className="flex items-center justify-end gap-2 text-indigo-600 text-sm font-bold mt-0.5">
                💎
                <span>{userProfile?.creditsBalance || 0} crédits</span>
              </div>
            </div>
            <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 border border-indigo-700 text-white shadow-md">
              <span className="font-bold text-sm">{planInfo[userPlan]?.name}</span>
            </div>
          </div>
        </div>
      </header>

      {activeTab !== 'profile' && (
        <div className="px-4 sm:px-8 py-6">
          <div className="relative rounded-2xl overflow-hidden shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48"></div>
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full -ml-36 -mb-36"></div>

            <div className="relative p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 z-10">
              <div className="flex-1">
                <p className="text-white/70 text-sm font-semibold mb-2 uppercase tracking-wide">Plan actuel</p>
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">
                    {planInfo[userPlan]?.name}
                  </h2>
                  {/* ✅ Badge Crédits Banner */}
                  {(userProfile?.creditsBalance || 0) > 0 && (
                    <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-white text-sm font-bold flex items-center gap-1 border border-white/30">
                      💎 {userProfile.creditsBalance} Crédits
                    </span>
                  )}
                </div>
                <p className="text-white/90 text-lg font-bold">
                  {planInfo[userPlan]?.price}
                </p>
              </div>

              {userPlan !== 'premium' && (
                <button 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="w-full sm:w-auto px-8 py-4 bg-white text-indigo-600 font-black rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 transform hover:-translate-y-1"
                >
                  🚀 Upgrader / Crédits
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs Content */}
      <div className="px-8 py-6 pb-20">
        {activeTab === 'overview' && <DashboardOverview user={user} userPlan={userPlan} setActiveTab={setActiveTab} />}
        {activeTab === 'optimization' && <OptimizationTab userPlan={userPlan} user={user} setUserPlan={setUserPlan} showUpgradeModal={showUpgradeModal} setShowUpgradeModal={setShowUpgradeModal} />}
        {activeTab === 'valuation' && <PropertyValuationTab user={user} userPlan={userPlan} setUserPlan={setUserPlan} showUpgradeModal={showUpgradeModal} setShowUpgradeModal={setShowUpgradeModal} />}
        {activeTab === 'leaderboard' && <LeaderboardTab user={user} userProfile={userProfile} userPlan={userPlan} />}
        {activeTab === 'profile' && <ProfileTab user={user} userProfile={userProfile} userPlan={userPlan} />}
      </div>
    </div>

    {/* Upgrade Modal */}
    {showUpgradeModal && (
      <UpgradeModal 
        user={user} 
        userPlan={userPlan} 
        planInfo={planInfo} 
        setUserPlan={setUserPlan} 
        showUpgradeModal={showUpgradeModal} 
        setShowUpgradeModal={setShowUpgradeModal} 
      />
    )}
  </div>
);
}


// ============================================
// ⬆️ MODAL UPGRADE avec STRIPE
// ============================================

function UpgradeModal({ user, userPlan, planInfo, setUserPlan, showUpgradeModal, setShowUpgradeModal }) {
  const [activeTab, setActiveTab] = useState('plans'); 
  const [subLoading, setSubLoading] = useState(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState(null);

  if (!showUpgradeModal) return null;

  const plans = [
    { 
      key: 'essai', 
      name: 'Essai', 
      price: '0$', 
      analyses: '1 seule / mois',
      internet: 'Analyses avec données WEB 🌐',
      features: [
        'Évaluation avec comparables LIVE',
        'Optimisation loyer (Temps réel)',
        'Chatbot IA Standard (Sans Web)'
      ],
      icon: <span className="text-3xl md:text-4xl">⚡</span>,
      color: 'gray'
    },
    { 
      key: 'pro', 
      name: 'Pro', 
      price: '29$',
      priceId: process.env.REACT_APP_STRIPE_PRO_PRICE_ID, 
      analyses: '30 analyses / mois',
      internet: 'Chatbot avec RECHERCHE WEB LIVE 🌐',
      features: [
        'Volume pour investisseur actif',
        'Analyses 7+ logements incluses',
        'Chatbot IA connecté au Web Live',
        'Support prioritaire'
      ],
      icon: <span className="text-3xl md:text-4xl">⭐</span>,
      color: 'indigo',
      badge: '🔥 Populaire'
    },
    { 
      key: 'growth', 
      name: 'Growth', 
      price: '69$',
      priceId: process.env.REACT_APP_STRIPE_GROWTH_PRICE_ID,
      analyses: 'Analyses ILLIMITÉES ♾️',
      internet: 'Chatbot Pro avec RECHERCHE WEB LIVE 🌐',
      features: [
        'Zéro limite de volume',
        'Accès complet Centris Pro',
        'Analyses financières avancées',
        'Support VIP dédié'
      ],
      icon: <span className="text-3xl md:text-4xl">🚀</span>,
      color: 'purple',
      recommended: true,
      badge: '👑 Puissance Totale'
    },
    { 
      key: 'entreprise', 
      name: 'Entreprise', 
      price: 'Contact', 
      analyses: 'Volume Adapté',
      internet: 'Chatbot Multi-Agents 🌐',
      features: [
        'Solution sur mesure',
        'Accès API + Marque blanche',
        'Formation équipe incluse',
        'Analyse de portefeuille'
      ],
      icon: <span className="text-3xl md:text-4xl">🏢</span>,
      color: 'amber'
    }
  ];

  const creditPlans = [
    {
      name: 'decouverte',
      displayName: 'Découverte',
      description: 'Idéal pour tester un deal spécifique.',
      credits: 5,
      priceId: process.env.REACT_APP_STRIPE_DECOUVERTE_PRICE_ID,
      price: '4.99',
      color: 'from-blue-500 to-cyan-400',
      textColor: 'text-blue-600',
      badge: '🧊 Pack 5',
      buttonColor: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      name: 'chasseur',
      displayName: 'Chasseur',
      description: 'Pour votre prochaine acquisition.',
      credits: 25,
      priceId: process.env.REACT_APP_STRIPE_CHASSEUR_PRICE_ID,
      price: '19.99',
      color: 'from-indigo-600 to-blue-500',
      textColor: 'text-indigo-600',
      badge: '🎯 Pack 25',
      buttonColor: 'bg-indigo-600 hover:bg-indigo-700',
      popular: true
    },
    {
      name: 'investisseur',
      displayName: 'Investisseur',
      description: 'Dominez le marché local.',
      credits: 150,
      priceId: process.env.REACT_APP_STRIPE_INVESTISSEUR_PRICE_ID,
      price: '79.99',
      color: 'from-purple-600 to-indigo-600',
      textColor: 'text-purple-600',
      badge: '👑 Pack 150',
      buttonColor: 'bg-purple-600 hover:bg-purple-700'
    }
  ];

  // ✅ LOGIQUE DE VÉRIFICATION DES DOWNGRADES
  const isDowngrade = (planKey) => {
    const weights = { 'essai': 0, 'pro': 1, 'growth': 2, 'entreprise': 3 };
    return weights[planKey] < weights[userPlan];
  };

  const handleSubscribe = async (planKey) => {
    try {
      setSubLoading(planKey);
      const selectedPlan = plans.find(p => p.key === planKey);
      if (!selectedPlan?.priceId) return;

      const response = await axios.post(`${window.API_BASE_URL || ''}/api/stripe/create-checkout-session`, {
        userId: user?.uid,
        userEmail: user?.email,
        plan: planKey, 
        priceId: selectedPlan.priceId
      });

      if (response.data.sessionUrl) {
        window.location.href = response.data.sessionUrl;
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setSubLoading(null);
    }
  };

  const handleBuyCredits = async (plan) => {
    try {
      setCreditsLoading(true);
      const response = await axios.post(`${window.API_BASE_URL || ''}/api/stripe/create-checkout-session-credits`, {
        userId: user?.uid,
        userEmail: user?.email,
        creditsPlan: plan.name,
        priceId: plan.priceId
      });
      if (response.data.sessionUrl) window.location.href = response.data.sessionUrl;
    } catch (err) {
      setCreditsError('Erreur Stripe');
    } finally {
      setCreditsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[9999] p-2 md:p-8"
      onClick={(e) => e.target === e.currentTarget && setShowUpgradeModal(false)}
    >
      <div className="bg-white rounded-[32px] md:rounded-[48px] shadow-2xl max-w-6xl w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto border border-white/20 animate-in fade-in zoom-in duration-300">
        
        {/* HEADER */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-100 px-6 md:px-12 py-5 md:py-8 flex items-center justify-between z-20">
          <div className="max-w-[80%] md:max-w-none">
            <h2 className="text-xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight">Accélérez vos investissements 🚀</h2>
            <p className="text-gray-500 mt-1 flex items-center gap-2 font-bold uppercase tracking-widest text-[9px] md:text-[10px]">
              Statut actuel : <span className="bg-indigo-50 text-indigo-700 px-2 md:px-3 py-0.5 rounded-full border border-indigo-100">{userPlan}</span>
            </p>
          </div>
          <button
            onClick={() => setShowUpgradeModal(false)}
            className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-2xl md:rounded-3xl bg-gray-50 text-gray-900 hover:bg-red-50 hover:text-red-500 transition-all font-black text-lg md:text-xl shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="px-5 md:px-12 py-6 md:py-10">
          
          {/* TABS SELECTOR */}
          <div className="flex p-1.5 bg-slate-100 rounded-2xl md:rounded-[32px] w-full md:w-fit mb-8 md:mb-12 mx-auto border border-slate-200 overflow-hidden">
            <button
              onClick={() => setActiveTab('plans')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[24px] font-black text-xs md:text-sm transition-all duration-300 ${activeTab === 'plans' ? 'bg-white text-indigo-600 shadow-lg scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span>⚡</span> Abonnements
            </button>
            <button
              onClick={() => setActiveTab('credits')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[24px] font-black text-xs md:text-sm transition-all duration-300 ${activeTab === 'credits' ? 'bg-white text-indigo-600 shadow-lg scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span>💎</span> Crédits Flex
            </button>
          </div>

          {/* PLANS TAB */}
          {activeTab === 'plans' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {plans.map((p) => {
                const isCurrent = userPlan === p.key;
                const isLoading = subLoading === p.key;
                const isDown = isDowngrade(p.key);

                return (
                  <div 
                    key={p.key} 
                    className={`relative p-6 md:p-8 rounded-[32px] md:rounded-[40px] border-2 transition-all flex flex-col h-full ${
                      isCurrent 
                        ? 'border-indigo-500 bg-indigo-50/20 ring-4 ring-indigo-500/5' 
                        : isDown 
                          ? 'border-gray-100 opacity-80 bg-gray-50/30' 
                          : 'border-gray-50 bg-white hover:border-indigo-100 shadow-sm'
                    }`}
                  >
                    {p.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] md:text-[9px] px-3 md:px-4 py-1.5 rounded-full font-black shadow-lg uppercase tracking-widest whitespace-nowrap z-10">
                        {p.badge}
                      </div>
                    )}
                    
                    <div className="mb-4 md:mb-6 filter drop-shadow-md">{p.icon}</div>
                    <h4 className="text-xl md:text-2xl font-black text-gray-900 mb-1">{p.name}</h4>
                    <div className="flex items-baseline gap-1 mb-4 md:mb-6">
                       <span className="text-2xl md:text-3xl font-black text-indigo-600">{p.price}</span>
                       {p.price.includes('$') && <span className="text-gray-400 font-bold text-[10px] md:text-xs">/mois</span>}
                    </div>

                    {/* VALEUR AJOUTÉE - HIGHLIGHTS */}
                    <div className="mb-6 p-4 bg-gray-50/80 rounded-2xl border border-gray-100 shadow-inner">
                       <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Statut IA</p>
                       <p className="text-[11px] font-black text-gray-900 leading-tight mb-2.5">📊 {p.analyses}</p>
                       <p className={`text-[11px] font-black leading-tight text-emerald-600`}>
                          🌐 Données Web Incluses
                       </p>
                       {(p.key === 'pro' || p.key === 'growth') && (
                          <p className="text-[11px] font-black leading-tight text-red-600 animate-pulse-slow">
                            🤖 Chatbot après analyse inclus
                          </p>
                        )}
                       
                    </div>
                    
                    <ul className="space-y-3 md:space-y-4 text-[11px] md:text-xs font-bold text-gray-500 mb-8 flex-grow">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5 leading-tight">
                          <span className={isCurrent ? 'text-indigo-500' : 'text-emerald-500'}>•</span>
                          <span className={f.includes('WEB') || f.includes('ILLIMITÉES') ? 'text-gray-900' : ''}>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <div className="w-full py-4 md:py-5 bg-gray-100 text-gray-400 rounded-2xl md:rounded-[24px] font-black text-center text-[9px] uppercase tracking-widest border border-gray-200">
                        Plan Actuel
                      </div>
                    ) : isDown ? (
                      <div className="w-full py-4 md:py-5 bg-gray-50 text-gray-300 rounded-2xl md:rounded-[24px] font-black text-center text-[9px] uppercase tracking-widest border border-dashed border-gray-200">
                        Forfait Inférieur
                      </div>
                    ) : (
                      <button
                        onClick={() => p.key === 'entreprise' ? window.location.href='mailto:info@optimiplex.com' : handleSubscribe(p.key)}
                        disabled={subLoading !== null}
                        className={`w-full py-4 md:py-5 rounded-2xl md:rounded-[24px] font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 ${p.key === 'essai' ? 'bg-gray-100 text-gray-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                      >
                        {isLoading ? '...' : p.key === 'entreprise' ? 'Contacter' : 'Choisir'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CREDITS TAB */}
          {activeTab === 'credits' && (
            <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-6 duration-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
                {creditPlans.map((cp) => (
                  <div key={cp.name} className={`relative p-1 rounded-[32px] md:rounded-[48px] bg-white transition-all duration-500 hover:shadow-2xl flex flex-col group ${cp.popular ? 'ring-2 ring-indigo-500 shadow-xl' : 'border border-gray-100 shadow-sm'}`}>
                    
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-white shadow-md border border-gray-50 flex items-center gap-2">
                       <span className="text-[9px] font-black uppercase tracking-widest text-gray-900 whitespace-nowrap">{cp.badge}</span>
                    </div>

                    <div className="p-6 md:p-10 flex-grow flex flex-col items-center">
                      <div className={`w-full rounded-[24px] md:rounded-[40px] p-8 md:p-12 mb-6 md:mb-8 text-center bg-gradient-to-br ${cp.color} shadow-lg relative overflow-hidden group-hover:scale-[1.03] transition-transform duration-500`}>
                        <div className="absolute top-0 right-0 w-32 md:w-40 h-32 md:h-40 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                        <p className="text-6xl md:text-8xl font-black text-white drop-shadow-xl">{cp.credits}</p>
                        <p className="text-[8px] md:text-[10px] font-black text-white/90 uppercase tracking-[0.4em] mt-2 md:mt-3">Crédits Analyses</p>
                      </div>

                      <h4 className={`text-xl md:text-2xl font-black mb-1 md:mb-2 ${cp.textColor}`}>{cp.displayName}</h4>
                      <p className="text-gray-400 text-[10px] md:text-[11px] font-bold text-center mb-6 md:mb-8 px-2 leading-relaxed">{cp.description}</p>
                      
                      <div className="flex items-baseline gap-1 mb-8 md:mb-10">
                        <span className="text-4xl md:text-5xl font-black text-gray-900">${cp.price}</span>
                        <span className="text-gray-300 text-[10px] font-black uppercase tracking-widest">/ achat</span>
                      </div>

                      <button 
                        onClick={() => handleBuyCredits(cp)} 
                        disabled={creditsLoading}
                        className={`w-full py-5 md:py-6 rounded-[24px] md:rounded-[32px] text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 ${cp.buttonColor} hover:shadow-indigo-300`}
                      >
                        {creditsLoading ? '...' : 'Débloquer'}
                      </button>

                      {cp.credits > 5 && (
                        <p className="mt-4 md:mt-6 text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 animate-pulse text-center">
                           ✨ ÉCONOMIE MASSIVE INCLUSE
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FOOTER VALUES */}
          <div className="mt-12 md:mt-20 p-6 md:p-12 bg-slate-50/80 backdrop-blur rounded-[32px] md:rounded-[48px] border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              <div className="flex flex-col items-center text-center gap-3">
                <span className="text-3xl md:text-4xl">🚀</span>
                <div>
                  <p className="font-black text-gray-900 text-xs md:text-sm uppercase tracking-widest">Vitesse IA</p>
                  <p className="text-[10px] md:text-[11px] font-bold text-gray-400 mt-1 md:mt-2 leading-relaxed">Analyses complètes en moins de 30 secondes.</p>
                </div>
              </div>
              <div className="flex flex-col items-center text-center gap-3 md:border-x md:border-slate-200 md:px-8">
                <span className="text-3xl md:text-4xl">🌐</span>
                <div>
                  <p className="font-black text-gray-900 text-xs md:text-sm uppercase tracking-widest">Données Réelles</p>
                  <p className="text-[10px] md:text-[11px] font-bold text-gray-400 mt-1 md:mt-2 leading-relaxed">Scan de Centris et JLR en temps réel.</p>
                </div>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <span className="text-3xl md:text-4xl">💎</span>
                <div>
                  <p className="font-black text-gray-900 text-xs md:text-sm uppercase tracking-widest">Flexibilité</p>
                  <p className="text-[10px] md:text-[11px] font-bold text-gray-400 mt-1 md:mt-2 leading-relaxed">Vos crédits n'expirent jamais.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================
// 👤 PROFILE TAB (NOUVEAU COMPOSANT)
// ============================================
function ProfileTab({ user, userProfile, userPlan }) {
  const [activeProfileTab, setActiveProfileTab] = useState('info');
  const [formData, setFormData] = useState({
    displayName: '',
    role: 'proprio',
    phone: '',
    company: '',
    bio: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [billingHistory, setBillingHistory] = useState([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  
  // États pour la gestion du portail Stripe
  const [portalLoading, setPortalLoading] = useState(false);
  
  const [claimLoading, setClaimLoading] = useState(null);

  // --- ÉTATS POUR LE COMPTAGE DYNAMIQUE ---
  const [totalEvaluations, setTotalEvaluations] = useState(0);
  const [isCounting, setIsCounting] = useState(true);

  // --- ÉTATS LOCAUX POUR GAMIFICATION ---
  const [localCredits, setLocalCredits] = useState(userProfile?.creditsBalance || 0);
  const [localClaimed, setLocalClaimed] = useState(userProfile?.claimedAchievements || []);

  useEffect(() => {
    if (userProfile) {
      setLocalCredits(userProfile.creditsBalance || 0);
      setLocalClaimed(userProfile.claimedAchievements || []);
      setFormData({
        displayName: userProfile.displayName || '',
        role: userProfile.role || 'proprio',
        phone: userProfile.phone || '',
        company: userProfile.company || '',
        bio: userProfile.bio || ''
      });
    }
  }, [userProfile]);

  // Fonction pour compter les évaluations
  useEffect(() => {
    const fetchRealEvaluationCount = async () => {
      if (!user?.uid) return;
      setIsCounting(true);
      
      try {
        const db = getFirestore();
        
        const rootEvalsQuery = query(collection(db, 'evaluations'), where('userId', '==', user.uid));
        const rootEvalsCommQuery = query(collection(db, 'evaluations_commerciales'), where('userId', '==', user.uid));
        const rootAnalysesQuery = query(collection(db, 'analyses'), where('userId', '==', user.uid));

        const [rootEvalsSnap, rootEvalsCommSnap, rootAnalysesSnap] = await Promise.all([
          getDocs(rootEvalsQuery).catch(() => ({ size: 0 })),
          getDocs(rootEvalsCommQuery).catch(() => ({ size: 0 })),
          getDocs(rootAnalysesQuery).catch(() => ({ size: 0 }))
        ]);

        const rootTotal = rootEvalsSnap.size + rootEvalsCommSnap.size + rootAnalysesSnap.size;

        const [subEvalsSnap, subEvalsCommSnap, subAnalysesSnap] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'evaluations')).catch(() => ({ size: 0 })),
          getDocs(collection(db, 'users', user.uid, 'evaluations_commerciales')).catch(() => ({ size: 0 })),
          getDocs(collection(db, 'users', user.uid, 'analyses')).catch(() => ({ size: 0 }))
        ]);

        const subTotal = subEvalsSnap.size + subEvalsCommSnap.size + subAnalysesSnap.size;

        const realTotal = Math.max(rootTotal, subTotal);
        
        setTotalEvaluations(realTotal);

        if (userProfile && (userProfile.evaluationCount || 0) !== realTotal) {
          await updateDoc(doc(db, 'users', user.uid), { 
            evaluationCount: realTotal,
            updatedAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Erreur comptage :", error);
        setTotalEvaluations(userProfile?.evaluationCount || 0);
      } finally {
        setIsCounting(false);
      }
    };

    fetchRealEvaluationCount();
  }, [user, userProfile]);

  useEffect(() => {
    if (activeProfileTab === 'billing' && user?.uid) {
      fetchBillingHistory();
    }
  }, [activeProfileTab, user]);

  const getLevelInfo = (count) => {
    if (count < 10) return { title: 'Débutant', nextTier: 10, icon: '🌱', color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (count < 50) return { title: 'Analyste', nextTier: 50, icon: '🔍', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (count < 100) return { title: 'Expert', nextTier: 100, icon: '⚡', color: 'text-purple-600', bg: 'bg-purple-100' };
    return { title: 'Tycoon', nextTier: null, icon: '👑', color: 'text-yellow-600', bg: 'bg-yellow-100' };
  };

  const levelInfo = getLevelInfo(totalEvaluations);
  const progressPercent = levelInfo.nextTier ? Math.min(100, (totalEvaluations / levelInfo.nextTier) * 100) : 100;

  const achievements = [
    { id: 'first_eval', title: 'Premier pas', desc: '1ère évaluation', req: 1, icon: '🎯', reward: 1 },
    { id: 'ten_evals', title: 'L\'Œil vif', desc: '10 évaluations', req: 10, icon: '🥉', reward: 2 },
    { id: 'fifty_evals', title: 'Machine à Deal', desc: '50 évaluations', req: 50, icon: '🥈', reward: 5 },
    { id: 'hundred_evals', title: 'Maître du Cashflow', desc: '100 évaluations', req: 100, icon: '🥇', reward: 15 },
  ];

  const fetchBillingHistory = async () => {
    setLoadingBilling(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/stripe/billing-history/${user.uid}`);
      setBillingHistory(response.data.invoices || []);
    } catch (error) {
      console.error('Erreur chargement facturation:', error);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: '✅ Profil mis à jour avec succès !' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (error) {
      console.error('Erreur update profile:', error);
      setMessage({ type: 'error', text: '❌ Erreur lors de la sauvegarde.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (achievement) => {
    if (!user?.uid) return;
    setClaimLoading(achievement.id);
    
    try {
      const db = getFirestore();
      const userRef = doc(db, 'users', user.uid);
      
      const newClaimedList = [...localClaimed, achievement.id];
      
      await updateDoc(userRef, {
        creditsBalance: increment(achievement.reward),
        claimedAchievements: newClaimedList,
        updatedAt: serverTimestamp()
      });
      
      setLocalCredits(prev => prev + achievement.reward);
      setLocalClaimed(newClaimedList);

      setMessage({ type: 'success', text: `🎉 Succès débloqué ! +${achievement.reward} diamants ajoutés à ton compte.` });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Erreur réclamation:', error);
      setMessage({ type: 'error', text: '❌ Erreur lors de la réclamation de la récompense.' });
    } finally {
      setClaimLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/stripe/create-portal-session`, {
        userId: user.uid
      });
      
      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
         setMessage({ type: 'error', text: '❌ Impossible de générer le lien du portail.' });
      }
    } catch (error) {
      console.error('Erreur portail Stripe:', error);
      setMessage({ type: 'error', text: '❌ Une erreur est survenue lors de l\'accès au portail.' });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 animate-fade-in">
      
      {/* Affichage global des messages */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 shadow-sm border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {message.type === 'success' ? <span className="text-xl">✅</span> : <span className="text-xl">❌</span>}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Tabs Principales (Sans le Leaderboard) */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 overflow-x-auto hide-scrollbar">
        {[
          { id: 'info', label: 'Mon Profil', icon: '👤' },
          { id: 'billing', label: 'Abonnement', icon: '💳' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveProfileTab(tab.id)}
            className={`px-6 py-3 font-semibold transition-all whitespace-nowrap flex items-center gap-2 rounded-t-lg ${
              activeProfileTab === tab.id
                ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB PROFIL */}
      {activeProfileTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* COLONNE GAUCHE : Carte Identité & Gamification */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* CARTE IDENTITÉ */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
              <div className="h-28 bg-gradient-to-r from-indigo-600 to-blue-500 relative">
                <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm uppercase tracking-wide border border-white/30">
                  Plan {userProfile?.plan || 'Essai'}
                </div>
              </div>
              
              <div className="px-6 pb-6 text-center relative">
                <div className="w-24 h-24 mx-auto bg-white rounded-full p-1.5 -mt-12 shadow-lg relative">
                  <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full flex items-center justify-center text-3xl font-black text-indigo-600 border border-indigo-100">
                    {formData.displayName ? formData.displayName.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
                  </div>
                  {!isCounting && (
                    <div className={`absolute -bottom-1 -right-1 w-9 h-9 rounded-full border-4 border-white flex items-center justify-center shadow-md ${levelInfo.bg} ${levelInfo.color} animate-bounce-short`}>
                      <span className="text-lg leading-none">{levelInfo.icon}</span>
                    </div>
                  )}
                </div>
                
                <h3 className="mt-4 text-xl font-black text-gray-900">
                  {formData.displayName || 'Investisseur Pro'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">{user?.email}</p>
                
                {/* Badges Info */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1.5">
                    {formData.role === 'courtier' ? '👔' : 
                     formData.role === 'investisseur' ? '📈' : '🏠'}
                    {formData.role === 'courtier' ? 'COURTIER' : 
                     formData.role === 'investisseur' ? 'INVESTISSEUR' : 'PROPRIÉTAIRE'}
                  </div>
                  <div className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                    <span>💎</span>
                    {localCredits} DIAMANTS
                  </div>
                </div>

                {/* SECTION PROGRESSION */}
                <div className="border-t border-gray-100 pt-5 text-left bg-gray-50/50 -mx-6 px-6 pb-2 transition-opacity duration-500">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Niveau Actuel</span>
                      <span className={`font-black text-lg ${levelInfo.color} flex items-center gap-1`}>
                        {isCounting ? 'Calcul...' : levelInfo.title}
                      </span>
                    </div>
                    <div className="text-right">
                      {isCounting ? (
                         <span className="text-xl font-bold text-gray-400 animate-pulse">...</span>
                      ) : (
                        <>
                          <span className="text-2xl font-black text-gray-800">{totalEvaluations}</span>
                          <span className="text-xs text-gray-500 font-medium ml-1">analyses</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {levelInfo.nextTier && !isCounting && (
                    <div className="mt-3 relative">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out relative" 
                          style={{ width: `${progressPercent}%` }}
                        >
                          <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/30 blur-sm"></div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-3 text-center font-medium">
                        Plus que <strong className="text-indigo-600">{levelInfo.nextTier - totalEvaluations}</strong> analyses pour le rang <span className="font-bold text-gray-700">{getLevelInfo(levelInfo.nextTier).title}</span> !
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CARTE SUCCÈS (ACHIEVEMENTS) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-5">
                <h4 className="font-black text-gray-900 flex items-center gap-2">
                  <span>🏆</span>
                  Tes Succès
                </h4>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                  {localClaimed.length} / {achievements.length}
                </span>
              </div>
              
              <div className="space-y-3">
                {achievements.map((ach) => {
                  const isUnlocked = totalEvaluations >= ach.req;
                  const isClaimed = localClaimed.includes(ach.id);
                  const canClaim = isUnlocked && !isClaimed;

                  return (
                    <div key={ach.id} className={`relative overflow-hidden flex items-center gap-4 p-3 rounded-xl border transition-all duration-300 ${
                      canClaim ? 'bg-indigo-50 border-indigo-300 shadow-sm' :
                      isClaimed ? 'bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-blue-200' : 
                      'bg-gray-50 border-gray-100 opacity-70 grayscale'
                    }`}>
                      <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-2xl shadow-sm ${
                        isClaimed ? 'bg-white' : 
                        canClaim ? 'bg-indigo-100 animate-pulse' :
                        'bg-gray-200 text-transparent text-shadow-none'
                      }`}>
                         {isUnlocked ? ach.icon : '🔒'}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h5 className={`font-bold text-sm truncate ${
                          canClaim ? 'text-indigo-900' :
                          isClaimed ? 'text-blue-900' : 'text-gray-600'
                        }`}>
                          {ach.title}
                        </h5>
                        <p className="text-xs text-gray-500 truncate">{ach.desc}</p>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {canClaim ? (
                          <button 
                            onClick={() => handleClaimReward(ach)}
                            disabled={claimLoading === ach.id}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                          >
                            {claimLoading === ach.id ? '⏳' : `💎 +${ach.reward}`}
                          </button>
                        ) : isClaimed ? (
                          <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm shadow-sm">
                            ✓
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : Formulaire Profil */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 h-full">
              <div className="mb-8">
                <h3 className="text-2xl font-black text-gray-900">
                  Paramètres du profil
                </h3>
                <p className="text-gray-500 text-sm mt-1">Gère tes informations personnelles et tes préférences.</p>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Quel est ton profil principal ?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { val: 'proprio', label: 'Propriétaire', icon: '🏠' },
                      { val: 'courtier', label: 'Courtier', icon: '👔' },
                      { val: 'investisseur', label: 'Investisseur', icon: '📈' }
                    ].map((opt) => (
                      <div
                        key={opt.val}
                        onClick={() => setFormData({...formData, role: opt.val})}
                        className={`cursor-pointer p-4 rounded-xl border-2 text-center transition-all flex flex-col items-center justify-center ${
                          formData.role === opt.val
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm'
                            : 'border-gray-100 text-gray-400 hover:border-indigo-200 hover:bg-gray-50 hover:text-gray-600'
                        }`}
                      >
                        <span className="text-2xl mb-2">{opt.icon}</span>
                        <span className={`text-sm ${formData.role === opt.val ? 'font-bold' : 'font-medium'}`}>{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nom complet</label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                      placeholder="Ex: Jean Dupont"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="(514) 123-4567"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Entreprise / Agence (Optionnel)</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({...formData, company: e.target.value})}
                      placeholder="Ex: Remax, Immobilière Tremblay..."
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Courte Bio</label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({...formData, bio: e.target.value})}
                      placeholder="Ta stratégie d'investissement, tes secteurs de recherche..."
                      rows="4"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3.5 bg-gray-900 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-black transform hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span>⏳</span>
                        Enregistrement...
                      </>
                    ) : (
                      'Sauvegarder les modifications'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB FACTURATION */}
      {activeProfileTab === 'billing' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-fade-in">
          <h3 className="text-2xl font-black text-gray-900 mb-6">Abonnement & Facturation</h3>
          
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Plan actuel</p>
              <h4 className="text-2xl font-black text-indigo-700 capitalize">{userPlan || 'Essai'}</h4>
            </div>
            
            {userPlan !== 'essai' && (
              <button 
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {portalLoading ? <span>⏳</span> : <span>⚙️</span>}
                Gérer mon abonnement
              </button>
            )}
          </div>

          <h4 className="font-bold text-gray-900 mb-4">Historique de facturation</h4>
          {loadingBilling ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
               <span>⏳</span> Chargement...
            </div>
          ) : billingHistory.length > 0 ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Montant</th>
                    <th className="p-4">Statut</th>
                    <th className="p-4 text-right">Lien</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {billingHistory.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-4">{new Date(inv.created * 1000).toLocaleDateString('fr-CA')}</td>
                      <td className="p-4 font-medium">${(inv.amount_paid / 100).toFixed(2)}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">Payé</span>
                      </td>
                      <td className="p-4 text-right">
                        <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold hover:underline">
                          Facture
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 py-4 text-sm">Aucun historique de facturation trouvé.</p>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderboardTab({ user, userScore }) {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const db = getFirestore();
      // On récupère les 50 meilleurs utilisateurs triés par nombre d'évaluations
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('evaluationCount', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      
      const topUsers = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // On ne garde que ceux qui ont au moins 1 évaluation pour éviter de polluer le classement
        if (data.evaluationCount && data.evaluationCount > 0) {
          topUsers.push({ id: doc.id, ...data });
        }
      });
      setLeaderboardData(topUsers);
    } catch (error) {
      console.error('Erreur chargement leaderboard:', error);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Fonction pour masquer l'email (ex: j***@gmail.com ou anonyme***@gmail.com)
  const maskEmail = (email) => {
    if (!email) return 'Anonyme';
    const parts = email.split('@');
    if (parts.length !== 2) return 'Anonyme';
    
    const namePart = parts[0];
    const domainPart = parts[1];
    
    // On montre les 3 premières lettres (ou moins si l'email est très court)
    const showChars = Math.min(3, namePart.length);
    const hiddenPart = '*'.repeat(Math.max(3, namePart.length - showChars));
    
    return `${namePart.substring(0, showChars)}${hiddenPart}@${domainPart}`;
  };

  const getLevelInfo = (count) => {
    if (count < 10) return { title: 'Débutant', nextTier: 10, icon: '🌱', color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (count < 50) return { title: 'Analyste', nextTier: 50, icon: '🔍', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (count < 100) return { title: 'Expert', nextTier: 100, icon: '⚡', color: 'text-purple-600', bg: 'bg-purple-100' };
    return { title: 'Tycoon', nextTier: null, icon: '👑', color: 'text-yellow-600', bg: 'bg-yellow-100' };
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              🏆 Classement Général
            </h3>
            <p className="text-gray-500 mt-1">Les meilleurs analystes et investisseurs de la plateforme.</p>
          </div>
          {/* Affiche le score passé en paramètre depuis le parent s'il existe */}
          {userScore !== undefined && (
            <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
              Ton score : {userScore} analyses
            </div>
          )}
        </div>

        {loadingLeaderboard ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <span className="text-4xl animate-bounce mb-4">🏆</span>
            <p className="font-medium text-gray-500">Chargement du podium...</p>
          </div>
        ) : leaderboardData.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {leaderboardData.map((leader, index) => {
              const rankInfo = getLevelInfo(leader.evaluationCount || 0);
              const isCurrentUser = leader.id === user?.uid;
              
              // On affiche le nom d'affichage s'il existe, sinon l'email masqué, sinon "Anonyme"
              const displayNameToUse = leader.displayName && leader.displayName.trim() !== '' 
                ? leader.displayName 
                : maskEmail(leader.email);
              
              // Style spécial pour le Top 3
              let bgClass = "bg-white border-gray-200 hover:border-gray-300";
              let rankBadge = <span className="text-gray-400 font-bold text-lg">#{index + 1}</span>;
              
              if (index === 0) {
                bgClass = "bg-gradient-to-r from-yellow-50 to-amber-100 border-yellow-300 shadow-md transform hover:-translate-y-1 transition-transform scale-[1.02] z-10";
                rankBadge = <span className="text-3xl" title="1ère Place">🥇</span>;
              } else if (index === 1) {
                bgClass = "bg-gradient-to-r from-gray-50 to-slate-100 border-gray-300 shadow-sm";
                rankBadge = <span className="text-3xl" title="2ème Place">🥈</span>;
              } else if (index === 2) {
                bgClass = "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 shadow-sm";
                rankBadge = <span className="text-3xl" title="3ème Place">🥉</span>;
              }

              if (isCurrentUser) {
                bgClass += " ring-2 ring-indigo-500"; // Surbrillance de ton propre compte
              }

              return (
                <div key={leader.id} className={`flex items-center p-4 rounded-xl border ${bgClass}`}>
                  <div className="w-12 text-center flex-shrink-0">
                    {rankBadge}
                  </div>
                  
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900 truncate text-lg">
                        {displayNameToUse}
                        {isCurrentUser && <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">MOI</span>}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        {leader.role === 'courtier' ? '👔 Courtier' : leader.role === 'investisseur' ? '📈 Investisseur' : '🏠 Propriétaire'}
                      </span>
                      <span>•</span>
                      <span className={`font-semibold ${rankInfo.color} flex items-center gap-1`}>
                        {rankInfo.icon} {rankInfo.title}
                      </span>
                    </div>
                  </div>

                  <div className="text-right ml-4">
                    <div className="text-2xl font-black text-gray-800">
                      {leader.evaluationCount || 0}
                    </div>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                      analyses
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
            <div className="py-20 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <span className="text-4xl mb-4 block">👻</span>
              <p>Le classement est vide pour le moment.</p>
              <p className="text-sm mt-2">Fais ta première analyse pour prendre la première place !</p>
            </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// 💳 BILLING TAB
// ============================================



// ============================================
// 📊 OVERVIEW TAB (Code existant inchangé)
// ============================================
function DashboardOverview({ user, userPlan, setActiveTab }) {
  const [analyses, setAnalyses] = useState([]);
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalValuation: 0,
    totalGainsPotential: 0,
    evaluations: 0,
    optimizations: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  const [listFilter, setListFilter] = useState('all');
  const [copySuccess, setCopySuccess] = useState(false); 

  // ============================================
  // ÉTATS DU CHATBOT IA
  // ============================================
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  const userPlanLower = userPlan?.toLowerCase() || 'gratuit';
  const hasPremiumAccess = ['pro', 'growth', 'premium', 'illimite'].includes(userPlanLower);

  // ============================================
  // CHARGER LES ANALYSES
  // ============================================
  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!user?.uid) return;
      try {
        const db = getFirestore();
        const allData = [];

        const fetchCollection = async (collName, typeOverride) => {
          try {
            const ref = collection(db, 'users', user.uid, collName);
            const snap = await getDocs(query(ref));
            snap.docs.forEach(docSnap => {
              allData.push({
                id: docSnap.id,
                collection: collName,
                proprietype: typeOverride,
                ...docSnap.data()
              });
            });
          } catch (e) {
            console.log(`Info: Collection ${collName} vide ou inaccessible`);
          }
        };

        await fetchCollection('analyses');
        await fetchCollection('evaluations', 'residential');
        await fetchCollection('evaluations_commerciales', 'commercial');

        const data = allData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.timestamp || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.timestamp || 0);
          return dateB - dateA;
        });

        setAnalyses(data);

        let totalVal = 0;
        let totalGains = 0;
        let evaluationCount = 0;
        let optimizationCount = 0;

        data.forEach(item => {
          const res = item.result || {};
          const recs = res.recommendations || res.recommandation || {};
          
          if (res.estimationActuelle?.valeurMoyenne) {
            evaluationCount++;
            totalVal += Number(res.estimationActuelle.valeurMoyenne) || 0;
          }
          
          if (recs.gainannuel || recs.optimisationRevenu) {
            optimizationCount++;
            totalGains += Number(recs.gainannuel) || 0;
          }
        });

        setStats({
          totalProperties: data.length,
          totalValuation: Math.round(totalVal),
          totalGainsPotential: Math.round(totalGains),
          evaluations: evaluationCount,
          optimizations: optimizationCount
        });

      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, [user?.uid]);

  // ============================================
  // LOGIQUE CHATBOT (CHARGEMENT & SAUVEGARDE)
  // ============================================
  
  // Charger l'historique du chat quand on ouvre une analyse
  useEffect(() => {
    if (selectedAnalysis) {
      setChatMessages(selectedAnalysis.chatHistory || []);
      setIsChatOpen(false);
    }
  }, [selectedAnalysis]);

  // Auto-scroll du chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading || !selectedAnalysis) return;

    const userMessage = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMessage];
    
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const isCom = isCommercial(selectedAnalysis);
      const endpointSuffix = isCom ? 'valuation-chat-commercial' : 'valuation-chat';
      const endpoint = `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ''}/api/property/${endpointSuffix}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          propertyData: selectedAnalysis 
        }),
      });

      if (!response.ok) throw new Error('Erreur de communication avec le Stratège IA');
      
      const data = await response.json();
      const assistantMessage = { role: 'assistant', content: data.reply };
      const finalMessages = [...updatedMessages, assistantMessage];
      
      setChatMessages(finalMessages);

      // --- SAUVEGARDE DANS FIRESTORE ---
      const db = getFirestore();
      const docRef = doc(db, 'users', user.uid, selectedAnalysis.collection, selectedAnalysis.id);
      await updateDoc(docRef, { chatHistory: finalMessages });

      // Mettre à jour les états locaux pour maintenir la synchro sans recharger
      setSelectedAnalysis(prev => ({ ...prev, chatHistory: finalMessages }));
      setAnalyses(prev => prev.map(a => a.id === selectedAnalysis.id ? { ...a, chatHistory: finalMessages } : a));

    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur s'est produite lors de la connexion. Vos données ont été sauvegardées, veuillez réessayer." }]);
    } finally {
      setIsChatLoading(false);
    }
  };


  // ============================================
  // ACTIONS & PARTAGE
  // ============================================
  const handleDelete = async (analysisId, collectionName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette analyse?')) return;

    setDeletingId(analysisId);
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'users', user.uid, collectionName || 'analyses', analysisId));
      setAnalyses(prev => prev.filter(a => a.id !== analysisId));
      if (selectedAnalysis?.id === analysisId) setSelectedAnalysis(null);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditTitle = async (analysisId, newTitle, collectionName, e) => {
    if (e) e.stopPropagation();
    if (!newTitle.trim()) return;

    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'users', user.uid, collectionName || 'analyses', analysisId), { titre: newTitle.trim() });
      
      setAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, titre: newTitle.trim() } : a));
      if (selectedAnalysis?.id === analysisId) {
        setSelectedAnalysis(prev => ({ ...prev, titre: newTitle.trim() }));
      }
      setEditingId(null);
    } catch (err) {
      console.error(err);
      alert('Erreur modification titre');
    }
  };

  const handleShare = async (analyse, e) => {
    if (e) e.stopPropagation();
    if (!analyse) return;
    
    const isValuation = getAnalysisType(analyse) === 'valuation';
    const isAcheteur = analyse.userType === 'acheteur';
    const city = analyse.ville || 'ma propriété';
    let shareText = '';
    
    const APP_LINK = "https://optimiplex.com"; 
    
    if (isValuation) {
      if (isAcheteur) {
         shareText = `🕵️‍♂️ Je viens d'analyser un deal commercial à ${city} avec l'IA !\n\nDécouvrez si l'annonce que vous regardez est une bonne affaire et calculez son potentiel d'optimisation (Value-Add). 🚀\n\n👉 Faites le test ici : ${APP_LINK}`;
      } else {
         const val = formatCurrency(analyse.result?.estimationActuelle?.valeurMoyenne);
         shareText = `📊 J'ai évalué ma propriété à ${city} à ${val}$ avec l'IA !\n\nDécouvrez la valeur réelle de votre bien et analysez le marché en quelques secondes. 🚀\n\n👉 Faites le test ici : ${APP_LINK}`;
      }
    } else {
      const gain = formatCurrency(analyse.result?.recommandation?.gainannuel || analyse.result?.recommendations?.gainannuel);
      shareText = `💰 J'ai trouvé comment générer +${gain}$/an avec mon immeuble à ${city} grâce à l'IA !\n\nCalculez le potentiel d'optimisation de vos revenus locatifs. 🚀\n\n👉 Faites le test ici : ${APP_LINK}`;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mon Analyse Immobilière IA',
          text: shareText,
        });
        return;
      } catch (err) {
        console.log('Partage annulé ou non supporté par ce moyen', err);
      }
    } 
    
    const textArea = document.createElement("textarea");
    textArea.value = shareText;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      alert('✨ Le texte de partage a été copié dans votre presse-papier ! Vous pouvez maintenant le coller sur Facebook, LinkedIn ou par courriel.');
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      alert('Erreur lors de la copie du texte de partage.');
    }
    document.body.removeChild(textArea);
  };

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500); 
    } catch (err) {
      console.error('Erreur lors de la copie', err);
    }
    document.body.removeChild(textArea);
  };

  // ============================================
  // UTILITAIRES D'AFFICHAGE
  // ============================================
  const formatCurrency = (val) => {
      if (val === null || val === undefined || isNaN(val)) return 'N/A';
      return Math.round(Number(val)).toLocaleString('fr-CA');
  };
  
  const formatPercent = (val) => {
    if (val === undefined || val === null) return '-';
    return `${Number(val).toFixed(2)}%`;
  };

  const calculateWelcomeTax = (price) => {
    if (!price || isNaN(price)) return 0;
    let tax = 0;
    const p = Number(price);

    if (p > 500000) {
      tax += (p - 500000) * 0.02;
      tax += (500000 - 294600) * 0.015;
      tax += (294600 - 58900) * 0.01;
      tax += 58900 * 0.005;
    } else if (p > 294600) {
      tax += (p - 294600) * 0.015;
      tax += (294600 - 58900) * 0.01;
      tax += 58900 * 0.005;
    } else if (p > 58900) {
      tax += (p - 58900) * 0.01;
      tax += 58900 * 0.005;
    } else {
      tax += p * 0.005;
    }
    return tax;
  };

  const getAnalysisType = (analyse) => {
    if (analyse.result?.estimationActuelle?.valeurMoyenne) return 'valuation';
    return 'optimization';
  };

  const isCommercial = (analyse) => {
    const type = analyse.proprietype || analyse.proprietetype || analyse.proprietyType || '';
    return type === 'commercial' || 
           analyse.collection === 'evaluations_commerciales' || 
           ['immeuble_revenus', 'hotel', 'depanneur', 'bureau', 'commerce', 'restaurant'].includes(type);
  };

  const getResidentialPercentage = (analyse) => {
    const data = analyse.result?.analyse || {};
    const val = data.pourcentageGainTotal ?? 
                data.pourcentageGain ?? 
                data.appreciation ?? 
                data.evolution ?? 
                0;
    return Number(val);
  };

  const getPropertyIcon = (type) => {
    const t = (type || '').toLowerCase();
    const icons = {
      unifamilial: '🏠', jumelee: '🏘️', duplex: '🏢', triplex: '🏢', '4plex': '🏗️',
      condo: '🏙️', immeuble_revenus: '🏗️', hotel: '🏨', depanneur: '🏪',
      restaurant: '🍽️', bureau: '📋', commerce: '🛍️', terrain_commercial: '🌳',
      terrain: '🌳', residential: '🏠', commercial: '🏢'
    };
    if (icons[t]) return icons[t];
    if (t.includes('hotel') || t.includes('commercial') || t.includes('revenu') || t.includes('bureau')) return '🏢';
    return '🏠';
  };

  const getPropertyLabel = (analyse) => analyse.titre || analyse.addresseComplete || analyse.typeappart || analyse.proprietetype || 'Propriété';

  const filteredAnalyses = analyses.filter(a => {
    if (listFilter === 'all') return true;
    return getAnalysisType(a) === listFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p className="text-gray-600 font-medium">Chargement de votre univers...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDU DU CHATBOT (HEADER & WINDOW)
  // ============================================
  const renderChatHeader = () => {
    if (!hasPremiumAccess) {
      return (
        <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm group hover:shadow-md transition-all">
           {/* Icône décorative géante en arrière-plan */}
           <div className="absolute -right-8 -top-8 text-9xl opacity-5 transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">🤖</div>
           
           <div className="relative z-10 max-w-xl">
             <h3 className="text-xl md:text-2xl font-black text-indigo-900 flex items-center gap-3">
               <span className="bg-white p-2 rounded-xl text-2xl shadow-sm">🤖</span> Stratège IA (Premium)
             </h3>
             <p className="text-indigo-800/80 mt-3 text-sm md:text-base font-medium leading-relaxed">
               Besoin d'aller plus loin ? Discutez avec notre IA pour simuler des scénarios de financement, obtenir des conseils de négociation et affiner votre stratégie d'optimisation.
             </p>
           </div>
           
           <button 
             onClick={() => alert("Passez au plan Pro ou Growth pour débloquer le Stratège IA et discuter de vos actifs ! (Redirection à implémenter)")} 
             className="relative z-10 w-full md:w-auto shrink-0 bg-white border-2 border-indigo-200 hover:border-indigo-600 text-indigo-700 hover:text-white hover:bg-indigo-600 font-black py-3.5 px-6 rounded-xl transition-all flex justify-center items-center gap-2"
           >
             🔒 Débloquer la fonctionnalité
           </button>
        </div>
      );
    }

    return (
      <div className="mt-8 bg-gradient-to-r from-slate-900 to-indigo-900 p-6 md:p-8 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 text-white border border-indigo-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black flex items-center gap-3">
            <span className="text-3xl">🤖</span> Discuter de cet actif
          </h2>
          <p className="text-indigo-200 mt-2 text-sm md:text-base leading-relaxed max-w-xl">
            L'historique de votre discussion est sauvegardé. Posez des questions sur le financement, la négo ou les travaux.
          </p>
        </div>
        
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-full md:w-auto bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 whitespace-nowrap"
        >
          {isChatOpen ? 'Fermer le chat' : '💬 Ouvrir le Stratège IA'}
        </button>
      </div>
    );
  };

  const renderChatWindow = () => {
    if (!isChatOpen || !selectedAnalysis) return null;

    return (
      <div className="fixed inset-0 z-[100] w-full h-[100dvh] flex flex-col bg-white overflow-hidden md:inset-auto md:bottom-8 md:right-8 md:w-[400px] md:h-[600px] md:max-h-[80vh] md:rounded-2xl shadow-2xl md:border md:border-gray-200">
        
        {/* Header du chat */}
        <div className="bg-indigo-900 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl md:text-3xl">🤖</span>
            <div>
              <h3 className="font-bold text-sm md:text-base leading-tight">Stratège IA</h3>
              <p className="text-xs text-indigo-300 truncate max-w-[200px]">Dossier: {getPropertyLabel(selectedAnalysis)}</p>
            </div>
          </div>
          <button onClick={() => setIsChatOpen(false)} className="text-indigo-200 hover:text-white p-2 text-xl font-bold rounded-lg hover:bg-white/10 transition">✕</button>
        </div>

        {/* Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {chatMessages.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-12 px-6">
              Posez-moi vos questions sur le financement multi-logement, la rentabilité de ce projet ou la stratégie de négociation. L'historique sera sauvegardé !
            </div>
          )}
          
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.content}
              </div>
            </div>
          ))}
          
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="p-4 bg-white border border-gray-200 rounded-2xl rounded-bl-none flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Formulaire & Input */}
        <form onSubmit={sendChatMessage} className="p-3 md:p-4 bg-white border-t border-gray-100 shrink-0 pb-safe">
          <div className="relative">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Écrivez votre question ici..." 
              className="w-full bg-gray-100 border-transparent rounded-xl py-3.5 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-base md:text-sm transition-all"
              disabled={isChatLoading}
            />
            <button 
              type="submit" 
              disabled={isChatLoading || !chatInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </form>
      </div>
    );
  };

  // ============================================
  // RENDU MODALE (VUE DÉTAILLÉE)
  // ============================================
  const renderModalContent = () => {
    if (!selectedAnalysis) return null;

    const result = selectedAnalysis.result || {};
    const type = getAnalysisType(selectedAnalysis);
    const isValuation = type === 'valuation';
    const isCom = isCommercial(selectedAnalysis);
    
    // Nouveaux profils
    const isAcheteur = selectedAnalysis.userType === 'acheteur' || !!result.potentielOptimisation;
    const isVendeur = selectedAnalysis.userType === 'vendeur';
    const opti = result.potentielOptimisation;

    const analyseData = result.analyse || {};
    const metrics = result.metriquesCommerciales || {};
    const comparable = result.comparable || {}; 
    const comparablesArray = result.comparables || []; 
    
    const secteurAnalysis = analyseData.analyseSecteur || analyseData.secteurAnalysis || analyseData.quartierAnalysis;
    
    const facteurs = result.facteursPrix || result.facteurs_prix || {};
    const positifs = facteurs.positifs || facteurs.augmentent || [];
    const negatifs = facteurs.negatifs || facteurs.diminuent || [];
    const incertitudes = facteurs.incertitudes || [];
    
    const recs = result.recommendations || result.recommandation || {};
    const renovations = recs.renovationsRentables || recs.ameliorationsValeur || [];
    const optRevenus = recs.optimisationRevenu || [];
    const redDepenses = recs.reduceExpenses || [];
    const strategie = recs.strategieVente || recs.strategie;
    const timing = recs.timing || recs.venteMeilleuresChances;
    
    const marketAnalysis = result.marketanalysis || {};
    const marketingKit = result.marketingKit || result.marketingkit || {};
    
    const justification = recs.justification || recs.raisonnement || []; 
    const pointsCles = recs.pointscles || [];
    const prochainesEtabpes = recs.prochainesetapes || [];

    const gainPct = getResidentialPercentage(selectedAnalysis);
    const appreciationDollars = analyseData.appreciationTotale;
    
    const welcomeTax = calculateWelcomeTax(result.estimationActuelle?.valeurMoyenne);

    // BLOC COMMUN : EN-TÊTE DE LA PROPRIÉTÉ
    const renderPropertyHeader = () => (
      <div className={`rounded-2xl p-4 md:p-6 shadow-md border-2 ${
        isAcheteur ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200' :
        isVendeur ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200' :
        isCom ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200' :
        isValuation ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200' : 
        'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl filter drop-shadow-md shrink-0">{getPropertyIcon(selectedAnalysis.proprietyType || selectedAnalysis.proprietype || selectedAnalysis.proprietetype)}</span> 
              <div>
                <h4 className="font-black text-gray-900 text-xl md:text-2xl leading-tight">{getPropertyLabel(selectedAnalysis)}</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs md:text-sm text-gray-600 mt-1 font-medium">
                  <span className="flex items-center gap-1">
                    <MapPin size={16} className="text-gray-500 shrink-0" />
                    <span className="truncate">{selectedAnalysis.ville} {selectedAnalysis.quartier && `• ${selectedAnalysis.quartier}`} {selectedAnalysis.codePostal && `(${selectedAnalysis.codePostal})`}</span>
                  </span>
                  {selectedAnalysis.anneeConstruction && (
                    <span className="bg-white/50 px-2 py-0.5 rounded border border-gray-200/50 whitespace-nowrap">
                      Construction: {selectedAnalysis.anneeConstruction}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 shrink-0">
            <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide self-start md:self-end shadow-sm border ${
              isAcheteur ? 'bg-purple-100 text-purple-700 border-purple-200' :
              isVendeur ? 'bg-amber-100 text-amber-700 border-amber-200' :
              isCom ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
              isValuation ? 'bg-blue-100 text-blue-700 border-blue-200' : 
              'bg-emerald-100 text-emerald-700 border-emerald-200'
            }`}>
              {isAcheteur ? '🕵️‍♂️ Prospection / Deal' : 
               isVendeur ? '🏷️ Évaluation Vendeur' :
               isCom ? '🏢 Commercial' : 
               isValuation ? '🏠 Résidentiel' : '💰 Optimisation'}
            </div>
          </div>
        </div>
      </div>
    );

    // BLOC COMMUN : HERO VALEUR
    const renderValuationHero = () => (
      <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-indigo-200">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative p-6 md:p-12 text-white">
          <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
             <div>
                <p className="text-sm md:text-base font-bold text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="text-2xl">{isCom ? '🏢' : '🏠'}</span> Valeur Estimée ({isCom ? 'Commerciale' : 'Résidentielle'})
                </p>
                <h2 className="text-5xl lg:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-100 drop-shadow-sm break-words">
                  {result.estimationActuelle?.valeurMoyenne ? `$${formatCurrency(result.estimationActuelle.valeurMoyenne)}` : 'N/A'}
                </h2>
             </div>
             
             <div className="flex flex-row md:flex-col items-start md:items-end gap-3 flex-wrap">
                 {result.estimationActuelle?.confiance && (
                    <div className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-3">
                        <span className="text-2xl shrink-0">🎯</span>
                        <div>
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider leading-none">Confiance IA</p>
                          <p className="font-black text-base md:text-lg text-white capitalize leading-none mt-1">{result.estimationActuelle.confiance}</p>
                        </div>
                    </div>
                 )}
                 <div className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-3 mt-0 md:mt-2">
                    <span className="text-xl shrink-0">💸</span>
                    <div>
                       <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider leading-none">Taxe mutation (Est.)</p>
                       <p className="font-black text-base md:text-lg text-white leading-none mt-1">${formatCurrency(welcomeTax)}</p>
                    </div>
                 </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-white/5 shadow-inner">
              <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-1">Valeur basse (📉)</p>
              <p className="text-2xl font-black">{result.estimationActuelle?.valeurBasse ? `$${formatCurrency(result.estimationActuelle.valeurBasse)}` : 'N/A'}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 md:p-5 rounded-2xl border-2 border-indigo-400/50 shadow-[0_0_30px_rgba(99,102,241,0.2)] transform md:-translate-y-2">
              <p className="text-xs text-white font-bold uppercase tracking-wider mb-1 text-left md:text-center">Cible Médiane (💎)</p>
              <p className="text-3xl font-black text-left md:text-center text-white">{result.estimationActuelle?.valeurMoyenne ? `$${formatCurrency(result.estimationActuelle.valeurMoyenne)}` : 'N/A'}</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-white/5 shadow-inner">
              <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-1">Valeur haute (📈)</p>
              <p className="text-2xl font-black">{result.estimationActuelle?.valeurHaute ? `$${formatCurrency(result.estimationActuelle.valeurHaute)}` : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    );

    // BLOC COMMUN : PROSPECTION (LE DEAL)
    const renderProspectionDeal = () => (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-indigo-200 rounded-3xl p-6 shadow-md text-gray-800 transform hover:scale-[1.01] transition-transform">
        <h3 className="text-xl md:text-2xl font-black mb-6 text-indigo-900 flex items-center gap-3">
          <span className="bg-white p-2 rounded-xl text-2xl shadow-sm shrink-0">🕵️‍♂️</span> Verdict Prospection (Le Deal)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/80 p-5 rounded-2xl border border-white shadow-sm">
            <p className="text-indigo-600 text-sm uppercase tracking-wide font-bold mb-1">Avis de l'IA</p>
            <p className="text-xl font-bold text-gray-900 leading-snug">{opti.avisProspection}</p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-center">
            <p className="text-emerald-700 text-sm uppercase tracking-wide font-bold mb-1">Valeur potentielle (Après opti.)</p>
            <p className="text-3xl font-black text-emerald-600">
              {opti.valeurApresTravaux ? `$${formatCurrency(opti.valeurApresTravaux)}` : 'N/A'}
            </p>
            <p className="text-sm text-emerald-700 mt-2 font-medium">Marge de sécurité / ROI visé : <span className="font-bold">{opti.margeSecurite}</span></p>
          </div>
        </div>
      </div>
    );

    // BLOC COMMUN : FACTEURS DE VALEUR
    const renderFacteursValeur = () => (
      <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
        <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
          <span className="bg-slate-100 p-2 rounded-xl text-2xl shadow-sm shrink-0">⚖️</span> Facteurs de Valeur
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {incertitudes.length > 0 && (
             <div className="md:col-span-2 bg-amber-50/80 border border-amber-200 rounded-2xl p-4 md:p-6">
               <p className="font-black text-amber-800 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                 ⚠️ Incertitudes & Risques perçus
               </p>
               <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {incertitudes.map((item, idx) => (
                   <li key={idx} className="flex gap-3 text-sm text-amber-900 font-medium">
                     <span className="shrink-0 text-amber-500">•</span>
                     <span className="leading-snug">{item}</span>
                   </li>
                 ))}
               </ul>
             </div>
          )}
          {positifs.length > 0 && (
            <div className="bg-white border border-green-200 rounded-2xl p-4 md:p-6 shadow-sm">
              <p className="font-black text-green-700 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                ✅ Points Forts (+)
              </p>
              <ul className="space-y-3">
                {positifs.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                    <span className="text-green-500 font-bold flex-shrink-0 mt-0.5">+</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {negatifs.length > 0 && (
            <div className="bg-white border border-red-200 rounded-2xl p-4 md:p-6 shadow-sm">
              <p className="font-black text-red-700 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                ❌ Désuétude & Points Faibles (-)
              </p>
              <ul className="space-y-3">
                {negatifs.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                    <span className="text-red-500 font-bold flex-shrink-0 mt-0.5">-</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );

    // BLOC COMMUN : SECTEUR & COMPARABLES
    const renderSecteurEtComparables = () => (
      <div className="space-y-6">
        {secteurAnalysis && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <h3 className="text-xl md:text-2xl font-black text-amber-900 mb-4 flex items-center gap-3">
              <span className="bg-white p-2 rounded-xl text-2xl shadow-sm shrink-0">📍</span> Analyse du Secteur
            </h3>
            <p className="text-amber-900/80 leading-relaxed text-sm md:text-base whitespace-pre-wrap text-justify font-medium">
              {secteurAnalysis}
            </p>
          </div>
        )}

        {comparablesArray.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
             <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                <span className="bg-indigo-50 p-2 rounded-xl text-2xl shadow-sm shrink-0">🏘️</span> Propriétés Comparables
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {comparablesArray.map((comp, idx) => (
                   <div key={idx} className="border border-gray-100 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-gray-50/50 flex flex-col h-full">
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${comp.statut?.toLowerCase() === 'vendu' ? 'bg-slate-400' : 'bg-green-500'}`}></div>
                      
                      <div className="flex justify-between items-start mb-4 pl-2">
                         <div className="pr-2">
                            <p className="font-bold text-gray-900 text-sm md:text-base leading-snug">{comp.adresse}</p>
                            <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">{comp.date}</p>
                         </div>
                         <span className={`px-2 py-1 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest shrink-0 border shadow-sm ${comp.statut?.toLowerCase() === 'vendu' ? 'bg-white text-slate-600 border-slate-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                           {comp.statut}
                         </span>
                      </div>
                      
                      <p className="text-2xl md:text-3xl font-black text-indigo-900 mb-4 pl-2 tracking-tight">
                         {typeof comp.prix === 'number' && comp.prix > 0 ? `$${formatCurrency(comp.prix)}` : 'Non affiché'}
                      </p>
                      
                      <div className="flex-1">
                        {comp.caracteristiques && (
                          <div className="bg-white rounded-xl p-4 text-sm text-gray-600 mb-3 ml-2 border border-gray-100 shadow-inner font-medium">
                             {comp.caracteristiques}
                          </div>
                        )}
                        
                        {comp.ajustementParite && (
                          <div className="bg-indigo-50/50 rounded-xl p-3 md:p-4 text-xs md:text-sm text-indigo-800 mb-4 ml-2 border border-indigo-100/50 font-medium flex items-start gap-2">
                             <span className="shrink-0 mt-0.5">⚖️</span>
                             <p><span className="font-bold">Parité:</span> {comp.ajustementParite}</p>
                          </div>
                        )}
                      </div>

                      {comp.url && comp.url !== "null" && (
                         <div className="pl-2 mt-auto">
                           <a href={comp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-full md:w-auto gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-indigo-200">
                              Consulter l'annonce
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                           </a>
                         </div>
                      )}
                   </div>
                ))}
             </div>
          </div>
        )}
      </div>
    );

    // BLOC COMMUN : MARKETING KIT
    const renderMarketingKit = () => (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-3xl p-6 md:p-8 shadow-md text-gray-800">
        <h3 className="text-xl md:text-2xl font-black mb-6 text-purple-900 flex items-center gap-3">
          <span className="shrink-0">📢</span> Kit Marketing (Prêt à publier)
        </h3>
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-purple-100 shadow-sm space-y-5">
          <div>
            <p className="text-purple-600 text-xs uppercase tracking-wide font-bold mb-1">Titre suggéré</p>
            <p className="text-lg md:text-xl font-bold text-gray-900">{marketingKit.titreAnnonce || marketingKit.titreannonce}</p>
          </div>
          
          {marketingKit.prixAfficheSuggere && (
            <div>
              <p className="text-purple-600 text-xs uppercase tracking-wide font-bold mb-1">Prix à afficher suggéré</p>
              <p className="text-2xl md:text-3xl font-black text-purple-700">
                ${formatCurrency(marketingKit.prixAfficheSuggere)}
              </p>
            </div>
          )}
          
          {marketingKit.descriptionaccroche && (
             <div>
              <p className="text-purple-600 text-xs uppercase tracking-wide font-bold mb-1">Accroche</p>
              <p className="text-sm text-gray-700 italic">"{marketingKit.descriptionaccroche}"</p>
            </div>
          )}

          <div className="pt-2">
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-end gap-3 mb-3">
               <p className="text-purple-600 text-xs uppercase tracking-wide font-bold">Description générée (DuProprio/Centris)</p>
               <button 
                  onClick={() => copyToClipboard(marketingKit.descriptionDuProprio || marketingKit.descriptionaccroche)}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 w-full md:w-auto ${copySuccess ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
               >
                  {copySuccess ? '✅ Copiée !' : '📋 Copier le texte'}
               </button>
            </div>
            <div className="bg-gray-50 p-4 md:p-5 rounded-xl border border-gray-200 whitespace-pre-line text-sm md:text-base text-gray-700 leading-relaxed font-medium">
              {marketingKit.descriptionDuProprio || "Veuillez utiliser l'accroche ci-dessus pour votre description."}
            </div>
          </div>
        </div>
      </div>
    );

    // ==========================================
    // RENDU : COMMERCIAL
    // ==========================================
    const renderCommercialValuationSection = () => (
      <>
        {renderValuationHero()}
        {renderChatHeader()}
        {isAcheteur && opti && renderProspectionDeal()}

        <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
             <span className="bg-indigo-50 text-indigo-600 p-2 rounded-xl text-2xl shadow-sm shrink-0">📊</span> Métriques Commerciales
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {typeof metrics.capRate === 'number' && (
              <div className="bg-gray-50 p-4 md:p-5 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-colors">
                <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cap Rate</p>
                <p className="text-xl md:text-3xl font-black text-indigo-600">{metrics.capRate.toFixed(2)}%</p>
              </div>
            )}
            {typeof metrics.noiAnnuel === 'number' && (
              <div className="bg-gray-50 p-4 md:p-5 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-colors">
                <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">RNE Annuel</p>
                <p className="text-xl md:text-3xl font-black text-emerald-600">${formatCurrency(metrics.noiAnnuel)}</p>
              </div>
            )}
            {typeof metrics.cashOnCash === 'number' && metrics.cashOnCash > 0 && (
              <div className="bg-gray-50 p-4 md:p-5 rounded-2xl border border-gray-100 hover:border-purple-200 transition-colors">
                <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cash-on-Cash</p>
                <p className="text-xl md:text-3xl font-black text-purple-600">{metrics.cashOnCash.toFixed(2)}%</p>
              </div>
            )}
            {typeof metrics.multiplicateurRevenu === 'number' && metrics.multiplicateurRevenu > 0 && (
              <div className="bg-gray-50 p-4 md:p-5 rounded-2xl border border-gray-100 hover:border-orange-200 transition-colors">
                <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">MRB</p>
                <p className="text-xl md:text-3xl font-black text-orange-600">{metrics.multiplicateurRevenu.toFixed(2)}x</p>
              </div>
            )}
          </div>
        </div>

        {analyseData.analyseRentabilite && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 md:p-8 shadow-sm">
             <h4 className="font-black text-indigo-900 mb-4 flex items-center gap-3 text-lg md:text-xl">
               <span className="bg-white p-2 rounded-xl text-2xl shadow-sm shrink-0">💵</span> Analyse de Rentabilité
             </h4>
             <p className="text-sm md:text-base text-indigo-900 leading-relaxed text-justify whitespace-pre-line font-medium">
               {analyseData.analyseRentabilite}
             </p>
          </div>
        )}

        {renderSecteurEtComparables()}
        {renderFacteursValeur()}
        {marketingKit && (marketingKit.descriptionDuProprio || marketingKit.titreannonce) && renderMarketingKit()}
      </>
    );

    // ==========================================
    // RENDU : RÉSIDENTIEL
    // ==========================================
    const renderResidentialValuationSection = () => (
      <>
        {renderValuationHero()}
        {renderChatHeader()}
        {isAcheteur && opti && renderProspectionDeal()}

        <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
             <span className="bg-emerald-50 text-emerald-600 p-2 rounded-xl text-2xl shadow-sm shrink-0">📈</span> Performance de l'Actif
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isAcheteur && selectedAnalysis.prixAffichage && (
               <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100">
                  <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Prix Affiché (Annonce)</p>
                  <p className="text-3xl font-black text-purple-900">${formatCurrency(selectedAnalysis.prixAffichage)}</p>
               </div>
            )}
            {isVendeur && selectedAnalysis.prixAchat && (
               <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">Acheté en {selectedAnalysis.anneeAchat}</p>
                  <p className="text-3xl font-black text-amber-900">${formatCurrency(selectedAnalysis.prixAchat)}</p>
               </div>
            )}
            
            {typeof appreciationDollars === 'number' && (
              <div className="col-span-1 md:col-span-2 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                 <div>
                    <p className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Plus-Value Estimée</p>
                    <p className="text-xs text-emerald-600 mt-1 font-medium">Historique du gain / Perte</p>
                 </div>
                 <div className="text-left sm:text-right flex items-center gap-4">
                    <p className={`text-xl font-bold ${gainPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {gainPct > 0 ? '+' : ''}{gainPct.toFixed(1)}%
                    </p>
                    <p className={`text-3xl font-black ${appreciationDollars >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {appreciationDollars >= 0 ? '+' : ''}${formatCurrency(appreciationDollars)}
                    </p>
                 </div>
              </div>
            )}
          </div>
        </div>

        {renderSecteurEtComparables()}
        {renderFacteursValeur()}

        {(renovations.length > 0 || strategie || timing || optRevenus.length > 0 || redDepenses.length > 0) && (
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-3xl p-6 md:p-8 shadow-sm">
            <h3 className="text-xl md:text-2xl font-black text-indigo-900 mb-6 flex items-center gap-3">
               <span className="bg-white p-2 rounded-xl text-2xl shadow-sm shrink-0">💡</span> Recommandations & Stratégie
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {renovations.length > 0 && (
                <div className="bg-white rounded-2xl p-5 md:p-6 border border-indigo-50 shadow-sm">
                  <p className="font-black text-indigo-900 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                    🔨 Rénovations à haut ROI
                  </p>
                  <ul className="space-y-3">
                    {renovations.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                        <span className="text-indigo-500 font-bold flex-shrink-0">»</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {optRevenus.length > 0 && (
                <div className="bg-white rounded-2xl p-5 md:p-6 border border-emerald-50 shadow-sm">
                  <p className="font-black text-emerald-900 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                    💰 Optimisation Revenus
                  </p>
                  <ul className="space-y-3">
                    {optRevenus.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                        <span className="text-emerald-500 font-bold flex-shrink-0">$</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {redDepenses.length > 0 && (
                <div className="bg-white rounded-2xl p-5 md:p-6 border border-blue-50 shadow-sm">
                  <p className="font-black text-blue-900 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                    📉 Réduction Dépenses
                  </p>
                  <ul className="space-y-3">
                    {redDepenses.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                        <span className="text-blue-500 font-bold flex-shrink-0">🔻</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {strategie && (
              <div className="bg-white rounded-2xl p-5 md:p-8 border border-indigo-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <p className="font-black text-indigo-900 mb-4 text-xs md:text-sm uppercase tracking-widest">
                    📋 Stratégie de Marché Conseillée
                </p>
                <p className="text-sm md:text-base text-gray-700 leading-loose whitespace-pre-line text-justify font-medium">{strategie}</p>
              </div>
            )}

            {timing && (
              <div className="mt-6 bg-white/60 p-5 md:p-6 rounded-2xl border border-indigo-200/50">
                <p className="font-black text-indigo-800 mb-3 text-xs uppercase tracking-widest">⏳ Timing / Fenêtre de vente</p>
                <div className="space-y-3">
                   <p className="text-sm text-gray-800 font-medium leading-relaxed">{timing}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {marketingKit && (marketingKit.descriptionDuProprio || marketingKit.titreannonce) && renderMarketingKit()}
      </>
    );

    // ==========================================
    // RENDU : OPTIMISATION PURE
    // ==========================================
    const renderOptimizationSection = () => (
      <div className="space-y-6">
        {renderChatHeader()}
        
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-100">
          <h4 className="font-black text-emerald-900 text-xl md:text-2xl mb-6 flex items-center gap-3">
             <span className="bg-white p-2 rounded-xl text-2xl shadow-sm shrink-0">💰</span> Potentiel d'Optimisation
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 divide-x divide-emerald-200/50">
            <div className="px-2 md:px-4 first:pl-0">
              <p className="text-[10px] md:text-xs text-emerald-700 font-bold uppercase mb-1">Loyer Optimal</p>
              <p className="text-xl md:text-3xl font-black text-emerald-800">${formatCurrency(recs.loyeroptimal)}</p>
            </div>
            <div className="px-2 md:px-4">
              <p className="text-[10px] md:text-xs text-emerald-700 font-bold uppercase mb-1">Gain Annuel</p>
              <p className="text-xl md:text-3xl font-black text-emerald-800">+${formatCurrency(recs.gainannuel)}</p>
            </div>
             <div className="px-2 md:px-4">
              <p className="text-[10px] md:text-xs text-emerald-700 font-bold uppercase mb-1">Augmentation</p>
              <p className="text-xl md:text-3xl font-black text-emerald-800">{formatPercent(recs.pourcentageaugmentation)}</p>
            </div>
            <div className="px-2 md:px-4">
              <p className="text-[10px] md:text-xs text-emerald-700 font-bold uppercase mb-1">Confiance IA</p>
              <div className="flex items-center gap-2">
                <span className="text-xl md:text-2xl">🤖</span>
                <span className="font-black text-emerald-800 text-lg md:text-xl">{recs.confiance || 85}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {marketAnalysis.mediane && (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h5 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                📊 Marché Locatif
              </h5>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm font-bold">Médiane Quartier</span>
                  <span className="font-black text-gray-900 text-lg">${formatCurrency(marketAnalysis.mediane)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm font-bold">Taux Occupation</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{marketAnalysis.occupation}%</span>
                </div>
                 <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <span className="text-gray-600 text-sm font-bold">Tendance (30j)</span>
                  <span className={`font-black flex items-center gap-1 ${marketAnalysis.tendance30j >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {marketAnalysis.tendance30j > 0 ? '↗️' : '↘️'} {marketAnalysis.tendance30j}%
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm h-full">
              <h5 className="font-black text-gray-900 mb-4 flex items-center gap-2 text-xl">
                🎯 Analyse & Justification
              </h5>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed text-justify whitespace-pre-line font-medium">
                {recs.raisonnement || (Array.isArray(justification) ? justification.join('\n') : justification)}
              </p>
            </div>
          </div>
        </div>
        
        {(prochainesEtabpes.length > 0 || pointsCles.length > 0) && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm">
            <h4 className="font-black text-gray-900 text-xl mb-6 flex items-center gap-2">
              📋 Plan d'Action
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {pointsCles.length > 0 && (
                <div>
                  <h5 className="font-bold text-gray-700 mb-4 text-xs uppercase tracking-wider">🔑 Stratégie Clé</h5>
                  <ul className="space-y-3">
                    {pointsCles.map((pt, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-600 font-medium">
                        <span className="text-indigo-500 font-bold">•</span> {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {prochainesEtabpes.length > 0 && (
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <h5 className="font-bold text-gray-700 mb-4 text-xs uppercase tracking-wider">🚀 Prochaines Étapes</h5>
                  <ul className="space-y-4">
                    {prochainesEtabpes.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                          {i + 1}
                        </span>
                        <span className="mt-0.5 font-medium">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );

    return (
      <div className="p-4 md:p-8 space-y-8 bg-gray-50/50">
        {renderPropertyHeader()}
        
        {!isValuation 
          ? renderOptimizationSection() 
          : isCom 
            ? renderCommercialValuationSection() 
            : renderResidentialValuationSection()
        }
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12 relative">
      {/* HEADER AVEC EMOJI */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-2 flex items-center gap-3">
            <span className="text-3xl md:text-4xl">🚀</span> Tableau de bord
          </h1>
          <p className="text-gray-500 text-base md:text-lg">Gérez vos analyses et suivez la performance de votre parc.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
           <button onClick={() => setActiveTab('valuation')} className="w-full sm:w-auto justify-center px-5 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
             <span>📊</span> Nouvelle Évaluation
           </button>
           <button onClick={() => setActiveTab('optimization')} className="w-full sm:w-auto justify-center px-5 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
             <span>💰</span> Nouvelle Optimisation
           </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Propriétés', val: stats.totalProperties, icon: '🏘️', from: 'from-indigo-50', to: 'to-blue-50', border: 'border-indigo-100' },
          { label: 'Valeur Totale', val: `$${formatCurrency(stats.totalValuation)}`, icon: '💎', from: 'from-blue-50', to: 'to-cyan-50', border: 'border-blue-100' },
          { label: 'Gain Potentiel', val: `+$${formatCurrency(stats.totalGainsPotential)}`, icon: '📈', from: 'from-emerald-50', to: 'to-teal-50', border: 'border-emerald-100' },
          { label: 'Analyses', val: stats.evaluations + stats.optimizations, icon: '📋', from: 'from-purple-50', to: 'to-fuchsia-50', border: 'border-purple-100' }
        ].map((stat, i) => (
          <div key={i} className={`bg-gradient-to-br ${stat.from} ${stat.to} p-4 md:p-5 rounded-2xl border ${stat.border} shadow-sm hover:shadow-md transition-all`}>
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <span className="text-2xl md:text-4xl filter drop-shadow-sm">{stat.icon}</span>
            </div>
            <div>
              <p className="text-xl md:text-3xl font-black text-gray-900 truncate">{stat.val}</p>
              <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wide mt-1 truncate">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* QUICK START SI VIDE */}
      {stats.totalProperties === 0 && (
        <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 rounded-3xl p-6 md:p-10 border border-indigo-100 text-center shadow-sm">
          <div className="text-5xl md:text-6xl mb-6 animate-bounce">👋</div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-3">Bienvenue sur votre espace !</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8 text-sm md:text-lg">
            Commencez par analyser votre première propriété pour découvrir sa valeur réelle et son potentiel d'optimisation.
          </p>
          <button onClick={() => setActiveTab('valuation')} className="px-6 py-3 md:px-8 md:py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 text-base md:text-lg">
            🚀 Lancer ma première analyse
          </button>
        </div>
      )}

      {/* LISTE DES ANALYSES */}
      {stats.totalProperties > 0 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl md:text-2xl font-black text-gray-900">Analyses Récentes</h2>
            
            {/* FILTRE LISTE */}
            <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
               <button 
                onClick={() => setListFilter('all')}
                className={`flex-1 sm:flex-none px-3 py-1.5 md:px-4 text-[10px] md:text-xs font-bold rounded-lg transition-all ${listFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 Tout
               </button>
               <button 
                onClick={() => setListFilter('valuation')}
                className={`flex-1 sm:flex-none px-3 py-1.5 md:px-4 text-[10px] md:text-xs font-bold rounded-lg transition-all ${listFilter === 'valuation' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 Évaluations
               </button>
               <button 
                onClick={() => setListFilter('optimization')}
                className={`flex-1 sm:flex-none px-3 py-1.5 md:px-4 text-[10px] md:text-xs font-bold rounded-lg transition-all ${listFilter === 'optimization' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 Optimisations
               </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredAnalyses.length === 0 ? (
               <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                 <p className="text-gray-400">Aucune analyse correspondante trouvée.</p>
               </div>
            ) : filteredAnalyses.map((analyse) => {
              const analysisType = getAnalysisType(analyse);
              const isValuation = analysisType === 'valuation';
              
              const isAcheteur = analyse.userType === 'acheteur' || !!analyse.result?.potentielOptimisation;
              const isVendeur = analyse.userType === 'vendeur';
              const opti = analyse.result?.potentielOptimisation;
              
              const isEditing = editingId === analyse.id;
              const residentialGain = getResidentialPercentage(analyse);
              
              const cardBg = isAcheteur ? 'bg-gradient-to-r from-white to-purple-50/30' : 
                             isVendeur ? 'bg-gradient-to-r from-white to-amber-50/30' :
                             isValuation ? 'bg-gradient-to-r from-white to-blue-50/30' : 
                             'bg-gradient-to-r from-white to-emerald-50/30';
              const borderClass = isAcheteur ? 'border-l-purple-500' : 
                                  isVendeur ? 'border-l-amber-500' : 
                                  isValuation ? 'border-l-blue-500' : 'border-l-emerald-500';

              return (
                <div
                  key={analyse.id}
                  onClick={() => !isEditing && setSelectedAnalysis(analyse)}
                  className={`group ${cardBg} p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-l-4 ${borderClass}`}
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="text-3xl md:text-4xl filter drop-shadow-sm transition-transform group-hover:scale-110 shrink-0">
                      {getPropertyIcon(analyse.proprietyType || analyse.proprietype || analyse.proprietetype)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                         {isEditing ? (
                          <div className="flex gap-2 items-center flex-1">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              autoFocus
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-bold text-gray-900"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button onClick={(e) => { e.stopPropagation(); handleEditTitle(analyse.id, editingTitle, analyse.collection, e); }} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-gray-900 text-sm md:text-lg truncate group-hover:text-indigo-600 transition-colors">
                              {getPropertyLabel(analyse)}
                            </h3>
                            
                            {isAcheteur && (
                              <span className="bg-purple-100 text-purple-700 text-[8px] md:text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap">
                                🕵️‍♂️ Deal
                              </span>
                            )}
                            {isVendeur && (
                              <span className="bg-amber-100 text-amber-700 text-[8px] md:text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap">
                                🏷️ Vente
                              </span>
                            )}

                            <button onClick={(e) => { e.stopPropagation(); setEditingId(analyse.id); setEditingTitle(analyse.titre || analyse.addresseComplete || ''); }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition-all"><Edit2 size={14} /></button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-2 md:gap-x-3 text-[10px] md:text-xs text-gray-500 font-medium mt-1">
                         <span className="flex items-center gap-1 truncate"><MapPin size={10} /> {analyse.ville}</span>
                         <span className="hidden md:inline w-1 h-1 bg-gray-300 rounded-full"></span>
                         <span className="flex items-center gap-1">🗓️ {analyse.createdAt?.toDate?.().toLocaleDateString('fr-CA') || new Date(analyse.timestamp || Date.now()).toLocaleDateString('fr-CA')}</span>
                      </div>
                      
                      {isAcheteur && opti && (
                        <div className="mt-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100/50 inline-block max-w-full">
                           <p className="text-[10px] md:text-xs font-medium text-indigo-900 line-clamp-1">
                             <span className="font-bold mr-1">Avis IA:</span> {opti.avisProspection}
                           </p>
                        </div>
                      )}
                    </div>

                    <div className="hidden lg:flex items-center gap-8 mr-4 shrink-0">
                       {isAcheteur && opti ? (
                         <>
                           <div className="text-right">
                             <p className="text-[10px] text-gray-400 font-bold uppercase">Affiché</p>
                             <p className="font-black text-gray-900 text-lg">${formatCurrency(analyse.prixAffichage)}</p>
                           </div>
                           <div className="text-right w-24">
                              <p className="text-[10px] text-gray-400 font-bold uppercase">Post-Opti</p>
                              <p className="font-black text-emerald-600 text-lg">${formatCurrency(opti.valeurApresTravaux)}</p>
                           </div>
                         </>
                       ) : isValuation ? (
                         <>
                           <div className="text-right">
                             <p className="text-[10px] text-gray-400 font-bold uppercase">Valeur</p>
                             <p className="font-black text-gray-900 text-lg">${formatCurrency(analyse.result?.estimationActuelle?.valeurMoyenne)}</p>
                           </div>
                           <div className="text-right w-24">
                              <p className="text-[10px] text-gray-400 font-bold uppercase">{isCommercial(analyse) ? 'Cap Rate' : 'Gain/Perte'}</p>
                              <p className={`font-black text-lg ${isCommercial(analyse) ? 'text-indigo-600' : residentialGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {isCommercial(analyse) ? `${analyse.result?.metriquesCommerciales?.capRate?.toFixed(2) || '-'}%` : `${residentialGain > 0 ? '+' : ''}${residentialGain.toFixed(1)}%`}
                              </p>
                           </div>
                         </>
                       ) : (
                          <>
                           <div className="text-right">
                             <p className="text-[10px] text-gray-400 font-bold uppercase">Loyer Cible</p>
                             <p className="font-black text-gray-900 text-lg">${formatCurrency(analyse.result?.recommandation?.loyeroptimal)}</p>
                           </div>
                           <div className="text-right w-24">
                              <p className="text-[10px] text-gray-400 font-bold uppercase">Gain/An</p>
                              <p className="font-black text-emerald-600 text-lg">+${formatCurrency(analyse.result?.recommandation?.gainannuel)}</p>
                           </div>
                         </>
                       )}
                    </div>

                    {/* ACTIONS BARS LIST */}
                    <div className="flex flex-col sm:flex-row items-center gap-1 md:gap-2 pl-2 md:pl-4 border-l border-gray-100 shrink-0">
                      <div className="flex items-center">
                        <button 
                          onClick={(e) => handleShare(analyse, e)} 
                          className="p-1.5 md:p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Partager"
                        >
                          <Share2 size={16} className="md:w-[18px] md:h-[18px]" />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(analyse.id, analyse.collection, e)} 
                          className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Supprimer"
                        >
                          <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                        </button>
                      </div>
                      <div className="hidden sm:block p-1 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALE DÉTAILS - PRO + NEW GEN */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-5xl w-full max-h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 relative">
            
            {/* Header Modale */}
            <div className="bg-white border-b border-gray-100 px-4 md:px-8 py-3 md:py-5 flex items-center justify-between z-10 shrink-0">
              <div>
                <h3 className="text-base md:text-xl font-black text-gray-900 flex items-center gap-2">
                   {getAnalysisType(selectedAnalysis) === 'valuation' ? <span className="text-xl md:text-2xl">📊</span> : <span className="text-xl md:text-2xl">💰</span>}
                   <span className="hidden sm:inline">{getAnalysisType(selectedAnalysis) === 'valuation' ? 'Détails de l\'évaluation' : 'Détails de l\'optimisation'}</span>
                   <span className="sm:hidden">Détails</span>
                </h3>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                 <button 
                    onClick={(e) => handleShare(selectedAnalysis, e)} 
                    className="flex items-center gap-1.5 md:gap-2 px-2 py-1.5 md:px-3 md:py-2 text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                    title="Partager cette analyse"
                 >
                    <Share2 size={16} className="md:w-[18px] md:h-[18px]" />
                    <span className="hidden sm:inline text-sm">Partager</span>
                 </button>
                 <button onClick={(e) => handleDelete(selectedAnalysis.id, selectedAnalysis.collection, e)} className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={18} className="md:w-[20px] md:h-[20px]" />
                 </button>
                 <div className="w-px h-5 md:h-6 bg-gray-200 mx-1 md:mx-2"></div>
                 <button onClick={() => setSelectedAnalysis(null)} className="p-1.5 md:p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all">
                    <X size={20} className="md:w-[24px] md:h-[24px]" />
                 </button>
              </div>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto">
               {renderModalContent()}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-4 md:px-8 py-3 md:py-4 flex flex-col sm:flex-row justify-end gap-2 md:gap-3 shrink-0">
              <button 
                onClick={(e) => handleShare(selectedAnalysis, e)} 
                className="w-full sm:w-auto justify-center px-4 md:px-6 py-2.5 md:py-3 bg-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-200 transition-all shadow-sm flex items-center gap-2"
              >
                <Share2 size={16} className="md:w-[18px] md:h-[18px]" /> Partager
              </button>
              <button onClick={() => setSelectedAnalysis(null)} className="w-full sm:w-auto justify-center px-4 md:px-6 py-2.5 md:py-3 bg-white border border-gray-300 text-gray-800 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm">
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Fenêtre de Chat flottante (en dehors de la modale pour passer par-dessus) */}
      {renderChatWindow()}
    </div>
  );
}


// ============================================
// 🎯 OPTIMIZATION TAB (Code existant inchangé)
// ============================================
function OptimizationTab({ userPlan, user, setUserPlan, showUpgradeModal, setShowUpgradeModal }) {
  const [propertyType, setPropertyType] = useState('residential');

  // État quota avec crédits
  const [quotaInfo, setQuotaInfo] = useState({
    remaining: 0,
    limit: 1,
    current: 0,
    plan: 'essai',
    resetDate: new Date(),
    isUnlimited: false,
    credits: 0 
  });

  const PLAN_LIMITS = { essai: 1, pro: 30, growth: 999, entreprise: 999 };

  // CHARGER LE QUOTA ET LES CRÉDITS DEPUIS FIRESTORE
  useEffect(() => {
    const loadQuota = async () => {
      try {
        if (!user?.uid) return;
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const userPlanNow = userData.plan || 'essai';
        const planLimit = PLAN_LIMITS[userPlanNow] || 1;
        
        // Récupération des crédits
        const creditsBalance = userData.creditsBalance || 0;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let quotaCount = 0;
        let resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        if (userData.quotaTracking) {
          const trackingMonth = userData.quotaTracking.month || '';
          if (trackingMonth === currentMonth) {
            quotaCount = userData.quotaTracking.count || 0;
            if (userData.quotaTracking.resetAt?.toDate) {
              resetDate = userData.quotaTracking.resetAt.toDate();
            } else if (userData.nextResetDate) {
              resetDate = new Date(userData.nextResetDate);
            }
          } else {
            // Nouveau mois, reset compteur pour affichage local
            quotaCount = 0;
          }
        }

        const remaining = Math.max(0, planLimit - quotaCount);

        setQuotaInfo({
          remaining: remaining,
          limit: planLimit,
          current: quotaCount,
          plan: userPlanNow,
          resetDate: resetDate,
          isUnlimited: planLimit >= 999,
          credits: creditsBalance 
        });

      } catch (error) {
        console.error('❌ Erreur chargement quota:', error);
      }
    };

    if (user?.uid) loadQuota();
  }, [user?.uid]);

  const isButtonDisabled = (!quotaInfo.isUnlimited && quotaInfo.remaining <= 0 && quotaInfo.credits <= 0);
  const percentUsed = quotaInfo.limit > 0 ? (quotaInfo.current / quotaInfo.limit) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      
      {/* HEADER SECTION */}
      <div className="mb-2">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
          <span className="text-3xl filter drop-shadow-sm">🎯</span>
          Optimiseur de Loyer IA
        </h2>
        <p className="text-gray-500 font-medium mt-1 ml-11">
          Maximisez vos revenus locatifs grâce aux recommandations basées sur les données du marché.
        </p>
      </div>

      {/* WIDGET QUOTA & CRÉDITS (STYLE DASHBOARD) */}
      {quotaInfo && (
        <div className={`relative overflow-hidden rounded-3xl p-6 md:p-8 border-2 transition-all duration-300 shadow-sm ${
          !isButtonDisabled 
            ? 'bg-white border-gray-100 hover:border-indigo-100 hover:shadow-md' 
            : 'bg-red-50/50 border-red-200'
        }`}>
          
          {/* Background décoratif */}
          <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none -translate-y-1/2 translate-x-1/3 ${
            !isButtonDisabled ? 'bg-indigo-400' : 'bg-red-400'
          }`} />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Partie Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-black text-xl text-gray-900">
                  {!isButtonDisabled ? 'Capacité d\'optimisation' : 'Quota épuisé'}
                </h3>
                <span className={`px-3 py-1 text-[10px] uppercase tracking-widest font-black rounded-full border ${
                  quotaInfo.plan === 'essai' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>
                  Plan {quotaInfo.plan}
                </span>
              </div>
              
              {!quotaInfo.isUnlimited && (
                <div className="mt-4 max-w-md">
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-gray-500">Analyses utilisées</span>
                    <span className={quotaInfo.remaining > 0 ? 'text-indigo-600' : 'text-red-600'}>
                      {quotaInfo.current} / {quotaInfo.limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isButtonDisabled ? 'bg-red-500' : percentUsed > 80 ? 'bg-amber-400' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Partie Chiffres & Bouton */}
            <div className="flex flex-col items-start md:items-end gap-3 min-w-[200px]">
              <div className="flex items-center gap-4 bg-gray-50/80 backdrop-blur px-5 py-3 rounded-2xl border border-gray-100 w-full md:w-auto">
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Abonnement</p>
                  <p className="text-2xl font-black text-gray-900 leading-none">
                    {quotaInfo.isUnlimited ? '∞' : quotaInfo.remaining}
                  </p>
                </div>
                <div className="w-px h-8 bg-gray-200 mx-2"></div>
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5 flex items-center justify-center gap-1">
                    💎 Crédits
                  </p>
                  <p className="text-2xl font-black text-indigo-600 leading-none">
                    {quotaInfo.credits}
                  </p>
                </div>
              </div>

              {isButtonDisabled && (
                <button 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="w-full py-3 px-6 bg-gray-900 hover:bg-black text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">💎</span>
                  Obtenir des crédits
                  <span className="opacity-50 group-hover:translate-x-1 transition-transform">→</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE D'ALERTE SI BLOQUÉ */}
      {isButtonDisabled && (
        <div className="flex items-start gap-3 p-4 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-sm font-medium">
          <span className="text-xl shrink-0 mt-0.5">🚨</span>
          <p>Votre quota d'optimisation est épuisé. Pour continuer à analyser vos loyers, veuillez upgrader votre plan ou acheter des crédits additionnels.</p>
        </div>
      )}

      {/* SÉLECTEUR DE TYPE (SEGMENTED CONTROL MODERNE) */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <label className="block text-sm font-black text-gray-900 mb-4 uppercase tracking-widest">
          Type de propriété à optimiser
        </label>
        
        <div className="flex p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 relative">
          {['residential', 'commercial'].map((type) => {
            const isActive = propertyType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setPropertyType(type)}
                disabled={isButtonDisabled}
                className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 py-4 md:py-3 px-6 rounded-xl text-sm font-black transition-all duration-300 relative z-10 ${
                  isActive
                    ? 'text-indigo-700 shadow-[0_2px_10px_rgba(0,0,0,0.06)] bg-white border border-gray-100/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                } ${isButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`text-xl transition-all ${isActive ? 'grayscale-0 scale-110' : 'grayscale opacity-60'}`}>
                  {type === 'residential' ? '🏠' : '🏢'}
                </span>
                <span>{type === 'residential' ? 'Immobilier Résidentiel' : 'Immobilier Commercial'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDER ACTIVE OPTIMIZER COMPONENT */}
      <div className="transition-all duration-500">
        {propertyType === 'residential' ? (
          <ResidentialOptimizer
            userPlan={userPlan}
            user={user}
            quotaInfo={quotaInfo}
            setQuotaInfo={setQuotaInfo}
            isButtonDisabled={isButtonDisabled}
            setShowUpgradeModal={setShowUpgradeModal}
          />
        ) : (
          <CommercialOptimizer
            userPlan={userPlan}
            user={user}
            quotaInfo={quotaInfo}
            setQuotaInfo={setQuotaInfo}
            isButtonDisabled={isButtonDisabled}
            setShowUpgradeModal={setShowUpgradeModal}
          />
        )}
      </div>
    </div>
  );
}


// ============================================
// 🏠 RESIDENTIAL OPTIMIZER (Code existant inchangé)
// ============================================
function ResidentialOptimizer({ userPlan, user, setShowUpgradeModal }) {
  const [loading, setLoading] = useState(false);
  
  // ✅ État étendu pour inclure les crédits
  const [quotaInfo, setQuotaInfo] = useState({
    remaining: 0,
    limit: 1,
    current: 0,
    plan: 'essai',
    resetDate: new Date(),
    isUnlimited: false,
    credits: 0 // Nouveau champ pour stocker les crédits
  });
  
  const [quotaError, setQuotaError] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);

  const loadingMessages = [
    '🔍 Recherche des meilleur listing...',
    '📊 Analyse comparables du marché...',
    '🤖 IA prédit prix optimal...',
    '💰 Calcul gains potentiels...',
    '📈 Génération recommandations...',
    '✅ Finalisation du rapport...'
  ];

  const PLAN_LIMITS = { essai: 1, pro: 30, growth: 999, entreprise: 999 };

  const [formData, setFormData] = useState({
    titre: '', ville: '', quartier: '', typeappart: '312', etat: 'renove', loyeractuel: 1400,
    meuble: false, balcon: false, garage: false, animaux: false, climatise: false,
    chauffage: false, stationnement: false, laverie: false, gym: false, piscine: false
  });

  const [customVille, setCustomVille] = useState('');
  const [showCustomVille, setShowCustomVille] = useState(false);
  
  const villeOptions = ['Montréal', 'Québec', 'Lévis', 'Laval', 'Longueuil', 'Gatineau', 'Sherbrooke', 'Autre'];
  const appartOptions = [
    { value: '112', label: '1 1/2 (Studio)' }, { value: '312', label: '3 1/2' },
    { value: '412', label: '4 1/2' }, { value: '512', label: '5 1/2' }, { value: '612', label: '6 1/2' }
  ];
  const etatOptions = [
    { value: 'renove', label: '✨ Rénové' }, { value: 'bon', label: '🏡 Bon état' },
    { value: 'neuf', label: '🆕 Neuf' }, { value: 'arenover', label: '🔨 À rénover' }
  ];

  const getApartmentLabel = (typeValue) => {
    const labels = { '112': '1 1/2', '312': '3 1/2', '412': '4 1/2', '512': '5 1/2', '612': '6 1/2' };
    return labels[typeValue] || typeValue;
  };

  // ✅ CHARGER LE QUOTA ET LES CRÉDITS DEPUIS FIRESTORE
  useEffect(() => {
    const loadQuota = async () => {
      try {
        if (!user?.uid) return;
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const userPlanNow = userData.plan || 'essai';
        const planLimit = PLAN_LIMITS[userPlanNow] || 1;
        
        // ✅ RECUPERATION DES CREDITS
        const creditsBalance = userData.creditsBalance || 0;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let quotaCount = 0;
        let resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        if (userData.quotaTracking) {
          const trackingMonth = userData.quotaTracking.month || '';
          if (trackingMonth === currentMonth) {
            quotaCount = userData.quotaTracking.count || 0;
            if (userData.quotaTracking.resetAt?.toDate) resetDate = userData.quotaTracking.resetAt.toDate();
          } else {
            // Nouveau mois détecté, on considère le compteur à 0 pour l'affichage local
            quotaCount = 0;
          }
        }

        const remaining = Math.max(0, planLimit - quotaCount);

        setQuotaInfo({
          remaining: remaining,
          limit: planLimit,
          current: quotaCount,
          plan: userPlanNow,
          resetDate: resetDate,
          isUnlimited: planLimit >= 999,
          credits: creditsBalance // ✅ Stockage des crédits
        });

      } catch (error) {
        console.error('❌ Erreur chargement quota:', error);
      }
    };

    if (user?.uid) loadQuota();
  }, [user?.uid]);

  // Scroll automatique
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, [result]);

  const handleSubmit = async () => {
    const apartmentLabel = getApartmentLabel(formData.typeappart);
    const villeFinale = showCustomVille && customVille.trim() ? customVille.trim() : formData.ville;

    if (!villeFinale || !formData.loyeractuel || formData.loyeractuel < 1) {
      setError('🚨 Veuillez remplir tous les champs obligatoires');
      return;
    }

    // ✅ VÉRIFICATION PRINCIPALE : A-t-il le droit de générer ?
    // Condition : Quota illimité OU Quota restant > 0 OU Crédits > 0
    const hasAccess = quotaInfo.isUnlimited || quotaInfo.remaining > 0 || quotaInfo.credits > 0;
    
    if (!hasAccess) {
      setQuotaError(`🔒 Quota ${quotaInfo.plan} atteint et aucun crédit disponible (Solde: ${quotaInfo.credits}).`);
      return;
    }

    setLoading(true);
    setError('');
    setQuotaError(null);

    try {
      const analysisData = {
        ...formData,
        proprietetype: 'residential',
        titre: formData.titre || `${apartmentLabel} - ${villeFinale}`,
        ville: villeFinale,
        quartier: formData.quartier,
        typeappart: formData.typeappart,
        loyeractuel: parseInt(formData.loyeractuel) || 1400
      };

      const response = await axios.post(
      `${API_BASE_URL}/api/pricing/optimizer-pro`,
        { userId: user.uid, ...analysisData },
        { timeout: 90000 } // 90 secondes recommandées
        );

      // ✅ MISE À JOUR OPTIMISTE DU UI
      // Le backend fait le vrai travail, mais on met à jour l'affichage tout de suite pour l'utilisateur
      if (!quotaInfo.isUnlimited) {
        if (quotaInfo.remaining > 0) {
           // On a utilisé le quota mensuel
           setQuotaInfo(prev => ({ ...prev, remaining: Math.max(0, prev.remaining - 1) }));
        } else {
           // On a utilisé un crédit
           setQuotaInfo(prev => ({ ...prev, credits: Math.max(0, prev.credits - 1) }));
        }
      }

      // Sauvegarde optionnelle dans Firestore (déjà gérée par le backend normalement, mais garde pour l'historique front)
      const db = getFirestore();
      if (user) {
        const analysesRef = collection(db, 'users', user.uid, 'analyses');
        await addDoc(analysesRef, {
          ...analysisData,
          result: response.data,
          plan: userPlan,
          proprietetype: 'residential',
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      }
      
      setResult(response.data);

    } catch (err) {
      console.error('❌ Erreur:', err);
      // Gestion spécifique erreur 429 (Quota backend)
      if (err.response?.status === 429) {
        setQuotaError(`🔒 ${err.response.data.error}`);
        // Mise à jour forcée des infos quota si le backend renvoie les nouvelles valeurs
        if(err.response.data) {
             setQuotaInfo(prev => ({
                 ...prev,
                 remaining: err.response.data.remaining || 0,
                 credits: err.response.data.credits || 0
             }));
        }
      } else {
        setError('Erreur: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const getDifferenceDisplay = () => {
    if (!result || !result.recommandation) return null;
    const difference = result.recommandation.loyeroptimal - formData.loyeractuel;
    return {
      mensuelle: Math.round(difference),
      annuelle: Math.round(difference * 12),
      isPositive: difference >= 0,
      isBetter: difference >= 0
    };
  };

  // ✅ LOGIQUE DU BOUTON DISABLED
  // Désactivé si : chargement OU (pas illimité ET pas de quota restant ET pas de crédits)
  const isButtonDisabled = loading || (!quotaInfo.isUnlimited && quotaInfo.remaining <= 0 && quotaInfo.credits <= 0);

  return (
    <div className="space-y-8">
      <LoadingSpinner isLoading={loading} messages={loadingMessages} estimatedTime={30} type="optimization" />

     
      {/* FORMULAIRE PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-8 bg-gray-100 rounded-xl border border-gray-300">
        <div className="lg:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            📝 Titre de la propriété (optionnel)
          </label>
          <input
            value={formData.titre}
            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
            placeholder="Ex: Triplex rue Laurier, 3.5 rénové..."
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">🏙️ Ville</label>
          {!showCustomVille ? (
            <input
              type="text"
              value={formData.ville}
              onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
              placeholder="Ex: Montréal, Québec, Lévis..."
              className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          ) : (
            <div className="flex gap-2">
              <input
                value={customVille}
                onChange={(e) => setCustomVille(e.target.value)}
                placeholder="Entrez la ville..."
                className="flex-1 p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={() => { 
                  setShowCustomVille(false); 
                  setCustomVille(''); 
                  setFormData({ ...formData, ville: '' }); 
                }}
                className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 font-semibold text-gray-900"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">📍 Quartier (optionnel)</label>
          <input
            value={formData.quartier}
            onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
            placeholder="Plateau-Mont-Royal..."
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">🏠 Type</label>
          <select
            value={formData.typeappart}
            onChange={(e) => setFormData({ ...formData, typeappart: e.target.value })}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {appartOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">💰 Loyer actuel ($)</label>
          <input
            type="number"
            value={formData.loyeractuel || ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || value === '0') {
                setFormData({ ...formData, loyeractuel: value === '' ? '' : 0 });
              } else {
                setFormData({ ...formData, loyeractuel: parseInt(value) || '' });
              }
            }}
            onBlur={(e) => {
              if (!formData.loyeractuel || formData.loyeractuel === 0 || formData.loyeractuel === '') {
                setFormData({ ...formData, loyeractuel: 1400 });
              }
            }}
            placeholder="Ex: 1400"
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">🏡 État du bien</label>
          <select
            value={formData.etat}
            onChange={(e) => setFormData({ ...formData, etat: e.target.value })}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {etatOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">✨ Extras inclus</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { key: 'meuble', label: '🛋️ Meublé' },
              { key: 'balcon', label: '🌳 Balcon' },
              { key: 'garage', label: '🚗 Garage' },
              { key: 'climatise', label: '❄️ Climatisé' },
              { key: 'chauffage', label: '🔥 Chauffage' }
            ].map(item => (
              <label key={item.key} className="flex items-center p-3 bg-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-200 transition-colors border border-indigo-300">
                <input
                  type="checkbox"
                  checked={formData[item.key]}
                  onChange={(e) => setFormData({ ...formData, [item.key]: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="ml-2 text-xs font-semibold text-indigo-700">{item.label}</span>
              </label>
            ))}
          </div>

          <label className="block text-sm font-semibold text-gray-700 mt-4 mb-3">🏬 Aménagements</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: 'stationnement', label: '🅿️ Stationnement' },
              { key: 'laverie', label: '🧺 Laverie' },
              { key: 'gym', label: '💪 Gym' },
              { key: 'piscine', label: '🏊 Piscine' }
            ].map(item => (
              <label key={item.key} className="flex items-center p-3 bg-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-200 transition-colors border border-indigo-300">
                <input
                  type="checkbox"
                  checked={formData[item.key]}
                  onChange={(e) => setFormData({ ...formData, [item.key]: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="ml-2 text-xs font-semibold text-indigo-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* BOUTON ANALYSER */}
      <div className="text-center mt-6">
        <button
          onClick={handleSubmit}
          disabled={isButtonDisabled}
          className={`px-16 py-4 font-black text-xl rounded-xl shadow-lg transform hover:-translate-y-1 transition-all w-full max-w-md mx-auto
            ${isButtonDisabled
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-indigo-400'
            }`}
        >
          {loading ? '🔄 Analyse en cours...' : isButtonDisabled ? '❌ Quota & Crédits épuisés' : '🚀 Analyser'}
        </button>
      </div>

      {/* RÉSULTATS */}
      {result && getDifferenceDisplay() && (
        <div ref={resultRef} className="space-y-8 mt-8">
          {/* Header résumé */}
          <div className={`p-8 bg-gradient-to-r rounded-2xl border-2 text-center ${
            getDifferenceDisplay().isBetter 
              ? 'from-emerald-100 to-emerald-200 border-emerald-300' 
              : 'from-orange-100 to-orange-200 border-orange-300'
          }`}>
            <h3 className={`text-4xl font-black mb-2 ${
              getDifferenceDisplay().isBetter 
                ? 'text-emerald-900' 
                : 'text-orange-900'
            }`}>
              ${Math.round(result.recommandation?.loyeroptimal || 0)}
            </h3>
            <p className={`text-lg mb-6 ${
              getDifferenceDisplay().isBetter 
                ? 'text-emerald-800' 
                : 'text-orange-800'
            }`}>
              Loyer optimal recommandé
            </p>

            <div className="flex flex-wrap justify-center gap-8">
              <div>
                <div className={`font-black text-2xl ${
                  getDifferenceDisplay().isBetter 
                    ? 'text-emerald-700' 
                    : 'text-orange-700'
                }`}>
                  {getDifferenceDisplay().mensuelle > 0 ? '+' : ''}{getDifferenceDisplay().mensuelle >= 0 ? '$' : '-$'}{Math.abs(getDifferenceDisplay().mensuelle)}
                </div>
                <div className={`text-sm ${
                  getDifferenceDisplay().isBetter 
                    ? 'text-emerald-600' 
                    : 'text-orange-600'
                }`}>
                  par mois
                </div>
              </div>

              <div>
                <div className={`font-black text-2xl ${
                  getDifferenceDisplay().isBetter 
                    ? 'text-emerald-700' 
                    : 'text-orange-700'
                }`}>
                  {getDifferenceDisplay().annuelle > 0 ? '+' : ''}{getDifferenceDisplay().annuelle >= 0 ? '$' : '-$'}{Math.abs(getDifferenceDisplay().annuelle)}
                </div>
                <div className={`text-sm ${
                  getDifferenceDisplay().isBetter 
                    ? 'text-emerald-600' 
                    : 'text-orange-600'
                }`}>
                  par année
                </div>
              </div>

              <div>
                <div className="font-black text-2xl text-blue-700">
                  {result.recommandation?.confiance || 88}%
                </div>
                <div className="text-blue-600 text-sm">confiance IA</div>
              </div>
            </div>
          </div>

          {/* Justification */}
          {result.recommandation?.justification && Array.isArray(result.recommandation.justification) && result.recommandation.justification.length > 0 && (
            <div className="p-6 bg-blue-100 rounded-xl border border-blue-300">
              <h4 className="font-black text-blue-900 text-lg mb-4">✓ Justification</h4>
              <ul className="space-y-2">
                {result.recommandation.justification.map((item, i) => (
                  <li key={i} className="text-sm text-gray-800 flex gap-3">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Points clés */}
          {result.recommandation?.pointscles && Array.isArray(result.recommandation.pointscles) && result.recommandation.pointscles.length > 0 && (
            <div className="p-6 bg-purple-100 rounded-xl border border-purple-300">
              <h4 className="font-black text-purple-900 text-lg mb-4">• Points clés</h4>
              <ul className="space-y-2">
                {result.recommandation.pointscles.map((item, i) => (
                  <li key={i} className="text-sm text-gray-800 flex gap-3">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Considérations */}
          {result.recommandation?.considerations && Array.isArray(result.recommandation.considerations) && result.recommandation.considerations.length > 0 && (
            <div className="p-6 bg-amber-100 rounded-xl border border-amber-300">
              <h4 className="font-black text-amber-900 text-lg mb-4">⚠️ Considérations</h4>
              <ul className="space-y-2">
                {result.recommandation.considerations.map((item, i) => (
                  <li key={i} className="text-sm text-gray-800 flex gap-3">
                    <span className="text-amber-600 font-bold">⚠️</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prochaines étapes */}
          {result.recommandation?.prochainesetapes && Array.isArray(result.recommandation.prochainesetapes) && result.recommandation.prochainesetapes.length > 0 && (
            <div className="p-6 bg-green-100 rounded-xl border border-green-300">
              <h4 className="font-black text-green-900 text-lg mb-4">🎯 Prochaines étapes</h4>
              <ol className="space-y-2">
                {result.recommandation.prochainesetapes.map((item, i) => (
                  <li key={i} className="text-sm text-gray-800 flex gap-3">
                    <span className="text-green-600 font-bold">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Marketing Kit */}
          {result.marketingkit && (
            <div className="p-6 bg-pink-100 rounded-xl border border-pink-300">
              <h4 className="font-black text-pink-900 text-lg mb-4">📢 Marketing Kit</h4>
              <div className="space-y-4">
                {result.marketingkit.titreannonce && (
                  <div>
                    <h5 className="font-bold text-pink-800 mb-2">📝 Titre annonce</h5>
                    <p className="text-gray-800 bg-white p-3 rounded-lg border border-pink-200 font-semibold">{result.marketingkit.titreannonce}</p>
                  </div>
                )}
                {result.marketingkit.descriptionaccroche && (
                  <div>
                    <h5 className="font-bold text-pink-800 mb-2">💬 Description accroche</h5>
                    <p className="text-gray-800 bg-white p-3 rounded-lg border border-pink-200">{result.marketingkit.descriptionaccroche}</p>
                  </div>
                )}
                {result.marketingkit.profillocataire && (
                  <div>
                    <h5 className="font-bold text-pink-800 mb-2">👥 Profil locataire idéal</h5>
                    <p className="text-gray-800 bg-white p-3 rounded-lg border border-pink-200">{result.marketingkit.profillocataire}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raisonnement IA */}
          {result.recommandation?.raisonnement && (
            <div className="p-6 bg-indigo-100 rounded-xl border border-indigo-300">
              <h4 className="font-black text-indigo-900 text-lg mb-4">🤖 Raisonnement IA</h4>
              <p className="text-gray-800 leading-relaxed">{result.recommandation.raisonnement}</p>
            </div>
          )}

          {/* Bouton réinitialiser */}
          <div className="text-center">
            <button
              onClick={() => setResult(null)}
              className="px-8 py-3 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← Nouvelle analyse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}




// ============================================
// 🏢 COMMERCIAL OPTIMIZER (Code existant inchangé)
// ============================================
function CommercialOptimizer({ userPlan, user, setShowUpgradeModal }) {
  const [loading, setLoading] = useState(false);
  
  // ✅ État étendu pour inclure les crédits
  const [quotaInfo, setQuotaInfo] = useState({
    remaining: 0,
    limit: 0,
    current: 0,
    plan: 'essai',
    resetDate: new Date(),
    isUnlimited: false,
    credits: 0 // Nouveau champ pour les crédits
  });
  
  const [quotaError, setQuotaError] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);

  const loadingMessages = [
    '🔍 Recherche des meilleur listing...',
    '📊 Analyse comparables du marché...',
    '🤖 IA prédit prix optimal...',
    '💰 Calcul gains potentiels...',
    '📈 Génération recommandations...',
    '✅ Finalisation du rapport...'
  ];

  const PLAN_LIMITS = { essai: 1, pro: 30, growth: 999, entreprise: 999 };

  const [formData, setFormData] = useState({
    titre: '',
    ville: '',
    quartier: '',
    typecommercial: 'office',
    surfacepiedcarre: 2000,
    prixactuelpiedcarre: 18,
    termebailans: 3,
    visibilite: 'bonne',
    parking: false,
    ascenseur: false,
    acceshandicape: false,
    amenages: false
  });

  const visibiliteOptions = [
    { value: 'excellente', label: '⭐⭐⭐ Excellente' },
    { value: 'bonne', label: '⭐⭐ Bonne' },
    { value: 'passante', label: '⭐ Passante' },
    { value: 'faible', label: '⚠️ Faible' }
  ];

  const typeCommercialOptions = [
    { value: 'office', label: '🏢 Bureau' },
    { value: 'warehouse', label: '📦 Entrepôt' },
    { value: 'retail', label: '🛍️ Retail' }
  ];

  // ✅ CHARGER LE QUOTA ET LES CRÉDITS DEPUIS FIRESTORE
  useEffect(() => {
    const loadQuota = async () => {
      try {
        if (!user?.uid) return;
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const userPlanNow = userData.plan || 'essai';
        const planLimit = PLAN_LIMITS[userPlanNow] || 1;
        
        // ✅ Récupération des crédits
        const creditsBalance = userData.creditsBalance || 0;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let quotaCount = 0;
        let resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        if (userData.quotaTracking) {
          const trackingMonth = userData.quotaTracking.month || '';
          if (trackingMonth === currentMonth) {
            quotaCount = userData.quotaTracking.count || 0;
            if (userData.quotaTracking.resetAt?.toDate) {
              resetDate = userData.quotaTracking.resetAt.toDate();
            } else if (userData.nextResetDate) {
              resetDate = new Date(userData.nextResetDate);
            }
          } else {
            // Nouveau mois, reset compteur pour affichage local
            quotaCount = 0;
          }
        }

        const remaining = Math.max(0, planLimit - quotaCount);

        setQuotaInfo({
          remaining: remaining,
          limit: planLimit,
          current: quotaCount,
          plan: userPlanNow,
          resetDate: resetDate,
          isUnlimited: planLimit >= 999,
          credits: creditsBalance // ✅ Stockage
        });

      } catch (error) {
        console.error('❌ Erreur chargement quota:', error);
      }
    };

    if (user?.uid) loadQuota();
  }, [user?.uid]);

  // Scroll automatique
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, [result]);

  const handleSubmit = async () => {
    if (!formData.ville) {
      setError('🚨 Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.surfacepiedcarre < 100 || formData.prixactuelpiedcarre < 5) {
      setError('Veuillez remplir tous les champs correctement');
      return;
    }

    // ✅ VÉRIFICATION PRINCIPALE : Quota OU Crédits
    const hasAccess = quotaInfo.isUnlimited || quotaInfo.remaining > 0 || quotaInfo.credits > 0;

    if (!hasAccess) {
      setQuotaError(`🔒 Quota épuisé et aucun crédit disponible.`);
      return;
    }

    setLoading(true);
    setError('');
    setQuotaError(null);

    try {
      const analysisData = {
        ...formData,
        proprietetype: 'commercial',
        titre: formData.titre || `${formData.typecommercial} - ${formData.ville}`,
        surfacepiedcarre: parseInt(formData.surfacepiedcarre),
        prixactuelpiedcarre: parseFloat(formData.prixactuelpiedcarre),
        termebailans: parseInt(formData.termebailans)
      };

      const response = await axios.post(
        `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ''}/api/pricing/commercial-optimizer`,
        { userId: user.uid, ...analysisData }
      );

      // ✅ MISE À JOUR OPTIMISTE DU QUOTA/CRÉDITS
      if (!quotaInfo.isUnlimited) {
        if (quotaInfo.remaining > 0) {
           // Déduction du quota mensuel
           setQuotaInfo(prev => ({ ...prev, remaining: Math.max(0, prev.remaining - 1) }));
        } else {
           // Déduction des crédits
           setQuotaInfo(prev => ({ ...prev, credits: Math.max(0, prev.credits - 1) }));
        }
      }

      // Sauvegarde optionnelle dans Firestore pour l'historique frontend
      const db = getFirestore();
      if (user) {
        const analysesRef = collection(db, 'users', user.uid, 'analyses');
        await addDoc(analysesRef, {
          ...analysisData,
          result: response.data,
          plan: userPlan,
          proprietetype: 'commercial',
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      }

      setResult(response.data);

    } catch (err) {
      console.error('❌ Erreur complète:', err);
      // Gestion erreur quota venant du backend (double sécurité)
      if (err.response?.status === 429) {
        setQuotaError(`🔒 ${err.response.data.error}`);
        // Mise à jour si le backend renvoie les nouvelles valeurs
        if (err.response.data) {
             setQuotaInfo(prev => ({
                ...prev,
                remaining: err.response.data.remaining || 0,
                credits: err.response.data.credits || 0, // Si le backend renvoie ça
                resetDate: err.response.data.resetDate ? new Date(err.response.data.resetDate) : prev.resetDate
             }));
        }
      } else {
        setError('Erreur: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ LOGIQUE DU BOUTON DISABLED
  // Désactivé si : chargement OU (pas illimité ET pas de quota restant ET pas de crédits)
  const isButtonDisabled = loading || (!quotaInfo.isUnlimited && quotaInfo.remaining <= 0 && quotaInfo.credits <= 0);

  return (
    <div className="space-y-8">
      <LoadingSpinner isLoading={loading} messages={loadingMessages} estimatedTime={30} type="optimization" />
 

      {/* FORMULAIRE PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-8 bg-gray-100 rounded-xl border border-gray-300">
        <div className="lg:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">📝 Titre du local (optionnel)</label>
          <input
            value={formData.titre}
            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
            placeholder="Ex: Bureau Centre-ville, Retail Laurier..."
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">🏢 Type de local</label>
          <select
            value={formData.typecommercial}
            onChange={(e) => setFormData({ ...formData, typecommercial: e.target.value })}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {typeCommercialOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">📍 Quartier (optionnel)</label>
          <input
            value={formData.quartier}
            onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
            placeholder="Centre-ville, Plateau, Griffintown..."
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">🏙️ Ville</label>
          <input
            type="text"
            value={formData.ville}
            onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
            placeholder="Ex: Montréal, Québec, Lévis..."
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">📏 Surface (pi²)</label>
          <input
            type="number"
            value={formData.surfacepiedcarre}
            onChange={(e) => setFormData({ ...formData, surfacepiedcarre: parseInt(e.target.value) || 2000 })}
            min="100"
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">💰 Prix actuel ($/pi²/an)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={formData.prixactuelpiedcarre}
              onChange={(e) => setFormData({ ...formData, prixactuelpiedcarre: parseFloat(e.target.value) || 18 })}
              step="0.5"
              min="5"
              className="flex-1 p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <div className="flex items-center px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold">
              $/pi²
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">👀 Visibilité du local</label>
          <select
            value={formData.visibilite}
            onChange={(e) => setFormData({ ...formData, visibilite: e.target.value })}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {visibiliteOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">📅 Terme du bail (ans)</label>
          <input
            type="number"
            value={formData.termebailans}
            onChange={(e) => setFormData({ ...formData, termebailans: parseInt(e.target.value) || 3 })}
            min="1"
            max="10"
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">✨ Aménagements du local</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: 'parking', label: '🅿️ Parking' },
              { key: 'ascenseur', label: '🛗 Ascenseur' },
              { key: 'acceshandicape', label: '♿ Accès handicapé' },
              { key: 'amenages', label: '🏗️ Aménagé' }
            ].map(item => (
              <label
                key={item.key}
                className="flex items-center p-3 bg-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-200 transition-colors border border-indigo-300"
              >
                <input
                  type="checkbox"
                  checked={formData[item.key]}
                  onChange={(e) => setFormData({ ...formData, [item.key]: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="ml-2 text-xs font-semibold text-indigo-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* BOUTON ANALYSER */}
      <div className="text-center mt-6">
        <button
          onClick={handleSubmit}
          disabled={isButtonDisabled}
          className={`px-16 py-4 font-black text-xl rounded-xl shadow-lg transform hover:-translate-y-1 transition-all w-full max-w-md mx-auto
            ${isButtonDisabled
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-indigo-400'
            }`}
        >
          {loading 
            ? '🔄 Analyse en cours...' 
            : isButtonDisabled 
              ? '❌ Quota & Crédits épuisés' 
              : '🏢 Analyser Commercial'}
        </button>
      </div>

      {/* RÉSULTATS */}
      {result && (
        <div ref={resultRef} className="space-y-8 mt-8">
          <div className="p-8 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-2xl border-2 border-emerald-300 text-center shadow-lg">
            <h3 className="text-4xl font-black text-emerald-900 mb-2">
              ${(result.recommandation?.loyeroptimal || 0).toFixed(2)}/pi²/an
            </h3>
            <p className="text-emerald-800 text-lg mb-6 font-semibold">Loyer optimal recommandé</p>

            <div className="flex flex-wrap justify-center gap-8">
              <div>
                <div className="font-black text-2xl text-emerald-700">
                  +${Math.round((result.recommandation?.loyeroptimal - formData.prixactuelpiedcarre) * formData.surfacepiedcarre / 12) || 0}
                </div>
                <div className="text-emerald-600 text-sm">par mois</div>
              </div>

              <div>
                <div className="font-black text-2xl text-emerald-700">
                  ${Math.round((result.recommandation?.loyeroptimal - formData.prixactuelpiedcarre) * formData.surfacepiedcarre) || 0}
                </div>
                <div className="text-emerald-600 text-sm">par année</div>
              </div>

              <div>
                <div className="font-black text-2xl text-blue-700">
                  {result.recommandation?.confiance || 85}%
                </div>
                <div className="text-blue-600 text-sm">confiance IA</div>
              </div>
            </div>
          </div>

          {/* ... (Affichage des autres sections de résultats) ... */}
          {/* JUSTIFICATION */}
          {result.recommandation?.justification && Array.isArray(result.recommandation.justification) && result.recommandation.justification.length > 0 && (
            <div className="p-6 bg-blue-100 rounded-xl border border-blue-300">
              <h4 className="font-black text-blue-900 text-lg mb-4">✓ Justification</h4>
              <ul className="space-y-2">
                {result.recommandation.justification.map((item, i) => (
                  <li key={i} className="text-sm text-gray-800 flex gap-3">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* POINTS CLÉS */}
          {result.recommandation?.pointscles && Array.isArray(result.recommandation.pointscles) && result.recommandation.pointscles.length > 0 && (
            <div className="p-6 bg-purple-100 rounded-xl border border-purple-300">
              <h4 className="font-black text-purple-900 text-lg mb-4">• Points clés</h4>
              <ul className="space-y-2">
                {result.recommandation.pointscles.map((item, i) => (
                  <li key={i} className="text-sm text-gray-800 flex gap-3">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CONSIDÉRATIONS */}
          {result.recommandation?.considerations && Array.isArray(result.recommandation.considerations) && result.recommandation.considerations.length > 0 && (
            <div className="p-6 bg-amber-100 rounded-xl border border-amber-300">
              <h4 className="font-black text-amber-900 text-lg mb-4">⚠️ Considérations</h4>
              <ul className="space-y-2">
                {result.recommandation.considerations.map((item, i) => (
                  <li key={i} className="text-sm text-gray-800 flex gap-3">
                    <span className="text-amber-600 font-bold">⚠️</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* PROCHAINES ÉTAPES */}
          {result.recommandation?.prochainesetapes && Array.isArray(result.recommandation.prochainesetapes) && result.recommandation.prochainesetapes.length > 0 && (
            <div className="p-6 bg-green-100 rounded-xl border border-green-300">
              <h4 className="font-black text-green-900 text-lg mb-4">🎯 Prochaines étapes</h4>
              <ol className="space-y-2">
                {result.recommandation.prochainesetapes.map((item, i) => (
                  <li key={i} className="text-sm text-gray-800 flex gap-3">
                    <span className="text-green-600 font-bold">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* MARKETING KIT */}
          {result.marketingkit && (
            <div className="p-6 bg-pink-100 rounded-xl border border-pink-300">
              <h4 className="font-black text-pink-900 text-lg mb-4">📢 Marketing Kit</h4>
              <div className="space-y-4">
                {result.marketingkit.titreannonce && (
                  <div>
                    <h5 className="font-bold text-pink-800 mb-2">📝 Titre annonce</h5>
                    <p className="text-gray-800 bg-white p-3 rounded-lg border border-pink-200 font-semibold">{result.marketingkit.titreannonce}</p>
                  </div>
                )}
                {result.marketingkit.descriptionaccroche && (
                  <div>
                    <h5 className="font-bold text-pink-800 mb-2">💬 Description accroche</h5>
                    <p className="text-gray-800 bg-white p-3 rounded-lg border border-pink-200">{result.marketingkit.descriptionaccroche}</p>
                  </div>
                )}
                {result.marketingkit.profillocataire && (
                  <div>
                    <h5 className="font-bold text-pink-800 mb-2">👥 Profil locataire idéal</h5>
                    <p className="text-gray-800 bg-white p-3 rounded-lg border border-pink-200">{result.marketingkit.profillocataire}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RAISONNEMENT IA */}
          {result.recommandation?.raisonnement && (
            <div className="p-6 bg-indigo-100 rounded-xl border border-indigo-300">
              <h4 className="font-black text-indigo-900 text-lg mb-4">🤖 Raisonnement IA</h4>
              <p className="text-gray-800 leading-relaxed">{result.recommandation.raisonnement}</p>
            </div>
          )}

          {/* ANALYSE MARCHÉ */}
          {result.analyseMarche && (
            <div className="p-6 bg-gradient-to-r from-cyan-100 to-blue-100 rounded-xl border border-cyan-300">
              <h4 className="font-black text-cyan-900 text-lg mb-4">📊 Analyse du Marché</h4>
              <p className="text-gray-800 leading-relaxed">{result.analyseMarche}</p>
            </div>
          )}

          {/* STRATÉGIE RECOMMANDÉE */}
          {result.recommandation?.strategie && (
            <div className="p-6 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-xl border border-orange-300">
              <h4 className="font-black text-orange-900 text-lg mb-4">🎯 Stratégie Recommandée</h4>
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{result.recommandation.strategie}</p>
            </div>
          )}

          {/* COMPARABLES */}
          {result.comparable && (
            <div className="p-6 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl border border-indigo-300">
              <h4 className="font-black text-indigo-900 text-lg mb-4">📈 Comparables du Marché</h4>
              <div className="space-y-3">
                {result.comparable.prix_moyen && (
                  <div className="bg-white p-3 rounded-lg border border-indigo-200">
                    <p className="text-xs font-semibold text-indigo-600">PRIX MOYEN MARCHÉ</p>
                    <p className="text-2xl font-bold text-indigo-700">${result.comparable.prix_moyen.toFixed(2)}/pi²/an</p>
                  </div>
                )}
                {result.comparable.prix_min && result.comparable.prix_max && (
                  <div className="bg-white p-3 rounded-lg border border-indigo-200">
                    <p className="text-xs font-semibold text-indigo-600">FOURCHETTE MARCHÉ</p>
                    <p className="text-sm text-gray-700">
                      <span className="font-bold">${result.comparable.prix_min.toFixed(2)}</span>
                      {' - '}
                      <span className="font-bold">${result.comparable.prix_max.toFixed(2)}</span>
                      {' $/pi²/an'}
                    </p>
                  </div>
                )}
                {result.comparable.evaluation_qualite && (
                  <div className="bg-white p-3 rounded-lg border border-indigo-200">
                    <p className="text-xs font-semibold text-indigo-600">QUALITÉ ÉVALUATION</p>
                    <p className="text-sm text-gray-700">{result.comparable.evaluation_qualite}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FACTEURS DE PRIX */}
          {result.facteurs_prix && (
            <div className="p-6 bg-gradient-to-r from-lime-100 to-green-100 rounded-xl border border-lime-300">
              <h4 className="font-black text-lime-900 text-lg mb-4">🔑 Facteurs de Prix</h4>
              <div className="space-y-3">
                {result.facteurs_prix.augmentent && result.facteurs_prix.augmentent.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-green-700 mb-2">✅ Augmentent le loyer:</p>
                    <ul className="text-sm space-y-1">
                      {result.facteurs_prix.augmentent.map((item, idx) => (
                        <li key={idx} className="text-gray-700">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.facteurs_prix.diminuent && result.facteurs_prix.diminuent.length > 0 && (
                  <div className="pt-3 border-t border-lime-300">
                    <p className="text-sm font-bold text-red-700 mb-2">⚠️ Diminuent le loyer:</p>
                    <ul className="text-sm space-y-1">
                      {result.facteurs_prix.diminuent.map((item, idx) => (
                        <li key={idx} className="text-gray-700">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOUTON RÉINITIALISER */}
          <div className="text-center">
            <button
              onClick={() => setResult(null)}
              className="px-8 py-3 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← Nouvelle analyse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ====================================================================
// 🏠 COMPOSANT : ESTIMATEUR DE VALEUR IMMOBILIÈRE
// ====================================================================

function PropertyValuationTab({
  user,
  userPlan,
  setUserPlan,
  showUpgradeModal,
  setShowUpgradeModal,
}) {
  const [evaluationType, setEvaluationType] = useState('residential');

  // État quota avec crédits
  const [quotaInfo, setQuotaInfo] = useState({
    remaining: 0,
    limit: 1,
    current: 0,
    plan: 'essai',
    resetDate: new Date(),
    isUnlimited: false,
    credits: 0 
  });

  const PLAN_LIMITS = { essai: 1, pro: 30, growth: 999, entreprise: 999 };

  // CHARGER LE QUOTA ET LES CRÉDITS DEPUIS FIRESTORE
  useEffect(() => {
    const loadQuota = async () => {
      try {
        if (!user?.uid) return;
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const userPlanNow = userData.plan || 'essai';
        const planLimit = PLAN_LIMITS[userPlanNow] || 1;
        
        // Récupération des crédits
        const creditsBalance = userData.creditsBalance || 0;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let quotaCount = 0;
        let resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        if (userData.quotaTracking) {
          const trackingMonth = userData.quotaTracking.month || '';
          if (trackingMonth === currentMonth) {
            quotaCount = userData.quotaTracking.count || 0;
            if (userData.quotaTracking.resetAt?.toDate) {
              resetDate = userData.quotaTracking.resetAt.toDate();
            } else if (userData.nextResetDate) {
              resetDate = new Date(userData.nextResetDate);
            }
          } else {
            // Nouveau mois, reset compteur pour affichage local
            quotaCount = 0;
          }
        }

        const remaining = Math.max(0, planLimit - quotaCount);

        setQuotaInfo({
          remaining: remaining,
          limit: planLimit,
          current: quotaCount,
          plan: userPlanNow,
          resetDate: resetDate,
          isUnlimited: planLimit >= 999,
          credits: creditsBalance 
        });

      } catch (error) {
        console.error('❌ Erreur chargement quota:', error);
      }
    };

    if (user?.uid) loadQuota();
  }, [user?.uid]);

  const isButtonDisabled = (!quotaInfo.isUnlimited && quotaInfo.remaining <= 0 && quotaInfo.credits <= 0);
  const percentUsed = quotaInfo.limit > 0 ? (quotaInfo.current / quotaInfo.limit) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      
      {/* HEADER SECTION */}
      <div className="mb-2">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
          <span className="text-3xl filter drop-shadow-sm">⚡</span>
          Générateur d'Évaluation IA
        </h2>
        <p className="text-gray-500 font-medium mt-1 ml-11">
          Obtenez une valeur marchande précise basée sur les données réelles du marché.
        </p>
      </div>

      {/* WIDGET QUOTA & CRÉDITS (STYLE DASHBOARD) */}
      {quotaInfo && (
        <div className={`relative overflow-hidden rounded-3xl p-6 md:p-8 border-2 transition-all duration-300 shadow-sm ${
          !isButtonDisabled 
            ? 'bg-white border-gray-100 hover:border-indigo-100 hover:shadow-md' 
            : 'bg-red-50/50 border-red-200'
        }`}>
          
          {/* Background décoratif */}
          <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none -translate-y-1/2 translate-x-1/3 ${
            !isButtonDisabled ? 'bg-indigo-400' : 'bg-red-400'
          }`} />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Partie Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-black text-xl text-gray-900">
                  {!isButtonDisabled ? 'Capacité d\'analyse' : 'Quota épuisé'}
                </h3>
                <span className={`px-3 py-1 text-[10px] uppercase tracking-widest font-black rounded-full border ${
                  quotaInfo.plan === 'essai' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>
                  Plan {quotaInfo.plan}
                </span>
              </div>
              
              {!quotaInfo.isUnlimited && (
                <div className="mt-4 max-w-md">
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-gray-500">Analyses utilisées</span>
                    <span className={quotaInfo.remaining > 0 ? 'text-indigo-600' : 'text-red-600'}>
                      {quotaInfo.current} / {quotaInfo.limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isButtonDisabled ? 'bg-red-500' : percentUsed > 80 ? 'bg-amber-400' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Partie Chiffres & Bouton */}
            <div className="flex flex-col items-start md:items-end gap-3 min-w-[200px]">
              <div className="flex items-center gap-4 bg-gray-50/80 backdrop-blur px-5 py-3 rounded-2xl border border-gray-100 w-full md:w-auto">
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Abonnement</p>
                  <p className="text-2xl font-black text-gray-900 leading-none">
                    {quotaInfo.isUnlimited ? '∞' : quotaInfo.remaining}
                  </p>
                </div>
                <div className="w-px h-8 bg-gray-200 mx-2"></div>
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5 flex items-center justify-center gap-1">
                    💎 Crédits
                  </p>
                  <p className="text-2xl font-black text-indigo-600 leading-none">
                    {quotaInfo.credits}
                  </p>
                </div>
              </div>

              {isButtonDisabled && (
                <button 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="w-full py-3 px-6 bg-gray-900 hover:bg-black text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">💎</span>
                  Obtenir des crédits
                  <span className="opacity-50 group-hover:translate-x-1 transition-transform">→</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE D'ALERTE SI BLOQUÉ */}
      {isButtonDisabled && (
        <div className="flex items-start gap-3 p-4 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-sm font-medium">
          <span className="text-xl shrink-0 mt-0.5">🚨</span>
          <p>Vous avez atteint la limite de votre plan mensuel et vous ne possédez aucun crédit additionnel. Veuillez recharger votre compte pour lancer une nouvelle évaluation.</p>
        </div>
      )}

      {/* SÉLECTEUR DE TYPE (SEGMENTED CONTROL MODERNE) */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <label className="block text-sm font-black text-gray-900 mb-4 uppercase tracking-widest">
          Type de propriété à évaluer
        </label>
        
        <div className="flex p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 relative">
          {['residential', 'commercial'].map((type) => {
            const isActive = evaluationType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setEvaluationType(type)}
                disabled={isButtonDisabled}
                className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 py-4 md:py-3 px-6 rounded-xl text-sm font-black transition-all duration-300 relative z-10 ${
                  isActive
                    ? 'text-indigo-700 shadow-[0_2px_10px_rgba(0,0,0,0.06)] bg-white border border-gray-100/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                } ${isButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`text-xl transition-all ${isActive ? 'grayscale-0 scale-110' : 'grayscale opacity-60'}`}>
                  {type === 'residential' ? '🏠' : '🏢'}
                </span>
                <span>{type === 'residential' ? 'Immobilier Résidentiel' : 'Immobilier Commercial'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDER ACTIVE VALUATION COMPONENT */}
      <div className="transition-all duration-500">
        {evaluationType === 'residential' ? (
          <ResidentialValuation 
            user={user} 
            quotaInfo={quotaInfo} 
            setQuotaInfo={setQuotaInfo} 
            isButtonDisabled={isButtonDisabled}
          />
        ) : (
          <CommercialValuation 
            user={user} 
            quotaInfo={quotaInfo} 
            setQuotaInfo={setQuotaInfo} 
            isButtonDisabled={isButtonDisabled}
          />
        )}
      </div>
    </div>
  );
}

function ResidentialValuation({ user, quotaInfo, setQuotaInfo, isButtonDisabled }) {
  const [loading, setLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [error, setError] = useState('');
  const [slideErrors, setSlideErrors] = useState({});
  const [copySuccess, setCopySuccess] = useState(false);
  
  const isSubmittingRef = useRef(false);
  const resultRef = useRef(null);

  // --- NOUVEAUX STATES POUR LE CHATBOT ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  // Détermine si l'utilisateur a accès au chat
  const userPlan = quotaInfo?.plan?.toLowerCase() || quotaInfo?.planId?.toLowerCase() || 'gratuit';
  const hasPremiumAccess = ['pro', 'growth', 'premium', 'illimite'].includes(userPlan) || quotaInfo?.isUnlimited;

  const [formData, setFormData] = useState({
    userType: 'acheteur', 
    titre: '',
    proprietyType: 'unifamilial',
    ville: '',
    quartier: '',
    codePostal: '',
    addresseComplete: '',
    prixAffichage: '', 
    urlAnnonce: '', 
    prixAchat: '', 
    anneeAchat: '', 
    revenusAnnuels: '', 
    depensesAnnuelles: '',
    anneeConstruction: 1990,
    surfaceUnit: 'pi2', // <-- NOUVEAU: Unité de surface par défaut
    surfaceHabitee: '',
    surfaceLot: '',
    nombreChambres: 3,
    nombreSallesBain: 2,
    garage: 0,
    sous_sol: 'none',
    etatGeneral: 'bon',
    toitureAnnee: '',
    fenetresAnnee: '',
    plomberieEtat: 'inconnu',
    electriciteEtat: 'inconnu',
    piscine: false,
    terrain_detail: '',
    notes_additionnelles: '',
  });

  const loadingMessages = [
    '🔍 Analyse du profil et de la propriété...',
    '📊 Récupération des comparables du secteur sur le Web...',
    '🤖 Évaluation des composantes (Toiture, Électricité, etc.)...',
    ['duplex', 'triplex', '4plex'].includes(formData.proprietyType) 
        ? '💵 Calcul de rentabilité (MRB, TGA) pour immeuble à revenus...' 
        : '📈 Calcul de la valeur marchande actuelle...',
    '🔗 Extraction des données (Centris, DuProprio)...',
    formData.userType === 'acheteur'
        ? '🎯 Analyse du deal et du potentiel de flip...'
        : '📝 Préparation du kit marketing et stratégie...',
    '✅ Finalisation du rapport expert...',
  ];

  const slides = [
    { id: 'profil', title: 'Votre Profil', description: 'Êtes-vous en mode prospection ou évaluation ?', icon: '👤', required: ['userType'] },
    { id: 'location', title: 'Localisation', description: 'Où se situe la propriété ?', icon: '📍', required: ['ville', 'proprietyType'] },
    { id: 'dimensions', title: 'Dimensions', description: 'Taille et configuration', icon: '📏', required: ['anneeConstruction'] },
    { id: 'components', title: 'Composantes', description: 'État des systèmes majeurs', icon: '🔧', required: [] },
    { id: 'condition', title: 'État et condition', description: 'Finition et sous-sol', icon: '🏗️', required: ['etatGeneral'] },
    { id: 'finances', title: formData.userType === 'acheteur' ? "Données de l'annonce" : 'Données Financières', description: ['duplex', 'triplex', '4plex'].includes(formData.proprietyType) ? "Chiffres et revenus de l'immeuble" : (formData.userType === 'acheteur' ? "Pour analyser le deal" : "Pour calculer votre plus-value"), icon: '💰', required: [] },
    { id: 'amenities', title: 'Extras & Détails', description: 'Équipements et notes', icon: '✨', required: [] },
  ];

  const propertyTypes = [
    { value: 'unifamilial', label: 'Unifamilial', icon: '🏠' },
    { value: 'jumelee', label: 'Jumelée', icon: '🏘️' },
    { value: 'duplex', label: 'Duplex', icon: '🏢' },
    { value: 'triplex', label: 'Triplex', icon: '🏢' },
    { value: '4plex', label: '4-plex', icon: '🏗️' },
    { value: 'condo', label: 'Condo', icon: '🏙️' },
  ];

  const etatsGeneraux = [
    { value: 'excellent', label: 'Clé en main', icon: '⭐' },
    { value: 'bon', label: 'Bon', icon: '👍' },
    { value: 'moyen', label: 'Moyen', icon: '➖' },
    { value: 'faible', label: 'Défraîchi', icon: '⚠️' },
    { value: 'renovation', label: 'À rénover', icon: '🔨' },
  ];

  const typesUnderground = [
    { value: 'none', label: 'Aucun / Vide Sanit.', icon: '❌' },
    { value: 'partial', label: 'Partiel', icon: '🔨' },
    { value: 'full', label: 'Fini', icon: '✅' },
  ];

  const etatSystemes = [
    { value: 'inconnu', label: 'Inconnu' },
    { value: 'origine', label: "D'origine / Vieux" },
    { value: 'partiel', label: 'Partiellement refait' },
    { value: 'recent', label: 'Récent / À jour' },
  ];

  useEffect(() => {
    setSlideProgress(((currentSlide + 1) / slides.length) * 100);
  }, [currentSlide, slides.length]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSlideErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // --- NOUVELLE FONCTION: Changement d'unité avec conversion UX ---
  const handleUnitChange = (newUnit) => {
    if (newUnit === formData.surfaceUnit) return;
    
    let newHabitee = formData.surfaceHabitee;
    let newLot = formData.surfaceLot;

    // Facteur de conversion: 1 m² = 10.7639 pi²
    const factor = 10.7639;

    const convertValue = (val, toM2) => {
      if (!val) return '';
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      return toM2 ? Math.round(num / factor) : Math.round(num * factor);
    };

    newHabitee = convertValue(newHabitee, newUnit === 'm2');
    newLot = convertValue(newLot, newUnit === 'm2');

    setFormData(prev => ({
      ...prev,
      surfaceUnit: newUnit,
      surfaceHabitee: newHabitee,
      surfaceLot: newLot
    }));
  };

  const validateCurrentSlide = () => {
    const cfg = slides[currentSlide];
    const errors = {};
    cfg.required.forEach((field) => {
      const value = formData[field];
      if (value === '' || value === null || value === undefined) {
        errors[field] = true;
      }
    });
    setSlideErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextSlide = () => {
    if (!validateCurrentSlide()) return;
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((s) => s + 1);
    } else {
      submitEvaluation();
    }
  };

  const previousSlide = () => {
    if (currentSlide > 0) setCurrentSlide((s) => s - 1);
  };

  const submitEvaluation = async () => {
    const hasAccess = quotaInfo?.isUnlimited || quotaInfo?.remaining > 0 || quotaInfo?.credits > 0;
    if (!hasAccess && setQuotaInfo) {
      setError("Quota épuisé et pas de crédits disponibles.");
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    try {
      setLoading(true);
      setError('');

      const endpoint = `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ''}/api/property/valuation-estimator`;
      
      const payload = { userId: user?.uid, ...formData };

      // --- COMPATIBILITÉ BACKEND GARANTIE ---
      // On s'assure d'envoyer les valeurs en pieds carrés au backend s'il ne gère pas nativement les mètres carrés.
      if (payload.surfaceUnit === 'm2') {
        const factor = 10.7639;
        if (payload.surfaceHabitee) payload.surfaceHabitee = Math.round(parseFloat(payload.surfaceHabitee) * factor);
        if (payload.surfaceLot) payload.surfaceLot = Math.round(parseFloat(payload.surfaceLot) * factor);
        payload.surfaceUnit = 'pi2'; // On informe le backend que les données sont bien en pi2
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Erreur HTTP ${resp.status}`);
      }

      const result = await resp.json();

      if (setQuotaInfo && quotaInfo && !quotaInfo.isUnlimited) {
        if (quotaInfo.remaining > 0) {
           setQuotaInfo(prev => ({ ...prev, remaining: Math.max(0, prev.remaining - 1) }));
        } else {
           setQuotaInfo(prev => ({ ...prev, credits: Math.max(0, prev.credits - 1) }));
        }
      }

      setSelectedProperty(result);
      setShowForm(false);
      setCurrentSlide(0);
      
      setChatMessages([]);
      setIsChatOpen(false);

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur lors de l'évaluation");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch (err) {
      console.error('Erreur lors de la copie', err);
    }
    document.body.removeChild(textArea);
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMessage];
    
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const endpoint = `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ''}/api/property/valuation-chat`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          propertyData: selectedProperty
        }),
      });

      if (!response.ok) throw new Error('Erreur de communication avec le Stratège IA');
      
      const data = await response.json();
      const assistantMessage = { role: 'assistant', content: data.reply };
      const finalMessages = [...updatedMessages, assistantMessage];
      
      setChatMessages(finalMessages);

      if (selectedProperty?.id && user?.uid) {
        try {
          // --- Nécessite l'import de firebase/firestore ---
          // const db = getFirestore();
          // const collectionName = selectedProperty.collection || 'evaluations';
          // const docRef = doc(db, 'users', user.uid, collectionName, selectedProperty.id);
          // await updateDoc(docRef, { chatHistory: finalMessages });
          
          setSelectedProperty(prev => ({ ...prev, chatHistory: finalMessages }));
        } catch (dbErr) {
          console.error("Erreur lors de la sauvegarde Firestore de l'historique:", dbErr);
        }
      }
      
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur s'est produite lors de la connexion à mes systèmes. Veuillez réessayer." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const renderProfilSlide = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button type="button" onClick={() => handleChange('userType', 'acheteur')} className={`p-6 rounded-2xl text-left transition border-2 flex flex-col gap-2 ${formData.userType === 'acheteur' ? 'bg-indigo-50 border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
          <div className="text-3xl">🕵️‍♂️</div>
          <h3 className={`text-lg font-black ${formData.userType === 'acheteur' ? 'text-indigo-900' : 'text-gray-800'}`}>Acheteur / Prospection</h3>
          <p className="text-sm text-gray-500">J'ai vu une annonce, je veux savoir si c'est un bon prix et évaluer le deal (Flip, optimisation).</p>
        </button>
        <button type="button" onClick={() => handleChange('userType', 'vendeur')} className={`p-6 rounded-2xl text-left transition border-2 flex flex-col gap-2 ${formData.userType === 'vendeur' ? 'bg-indigo-50 border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
          <div className="text-3xl">🏷️</div>
          <h3 className={`text-lg font-black ${formData.userType === 'vendeur' ? 'text-indigo-900' : 'text-gray-800'}`}>Vendeur / Propriétaire</h3>
          <p className="text-sm text-gray-500">Je suis propriétaire, je veux estimer la valeur de ma maison pour la vendre et obtenir mon annonce clé en main.</p>
        </button>
      </div>
    </div>
  );

  const renderLocationSlide = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Titre (optionnel)</label>
        <input type="text" placeholder="Ex: Maison familiale Lévis" value={formData.titre} onChange={(e) => handleChange('titre', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Type de propriété * {slideErrors.proprietyType && <span className="text-red-500">requis</span>}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {propertyTypes.map((t) => (
            <button key={t.value} type="button" onClick={() => handleChange('proprietyType', t.value)} className={`p-2 rounded-lg text-center transition border-2 ${formData.proprietyType === t.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 hover:border-indigo-300'}`}>
              <div className="text-lg">{t.icon}</div>
              <div className="text-xs font-medium">{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Ville * {slideErrors.ville && <span className="text-red-500">requis</span>}
        </label>
        <input type="text" placeholder="Ex: Lévis" value={formData.ville} onChange={(e) => handleChange('ville', e.target.value)} className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${slideErrors.ville ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`} />
      </div>

      <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Quartier</label>
            <input type="text" placeholder="Ex: Desjardins" value={formData.quartier} onChange={(e) => handleChange('quartier', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Code Postal</label>
            <input type="text" placeholder="Ex: G6V 8T4" value={formData.codePostal} onChange={(e) => handleChange('codePostal', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Adresse complète</label>
        <input type="text" placeholder="Ex: 123 rue Exemple" value={formData.addresseComplete} onChange={(e) => handleChange('addresseComplete', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
    </div>
  );

  const renderDimensionsSlide = () => (
    <div className="space-y-4">
      <div>
         <label className="block text-sm font-semibold text-gray-700 mb-2">
           Année de construction * {slideErrors.anneeConstruction && <span className="text-red-500">requis</span>}
         </label>
         <input type="number" min="1800" max={new Date().getFullYear()} value={formData.anneeConstruction} onChange={(e) => handleChange('anneeConstruction', parseInt(e.target.value, 10) || '')} className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${slideErrors.anneeConstruction ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`} />
      </div>

      {/* --- NOUVEAU : Sélecteur d'unité --- */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Unité de mesure (Surfaces)</label>
        <div className="flex gap-2">
          <button 
            type="button" 
            onClick={() => handleUnitChange('pi2')} 
            className={`flex-1 py-2 rounded-lg transition border-2 text-sm font-medium ${formData.surfaceUnit === 'pi2' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 hover:border-indigo-300 text-gray-700'}`}
          >
            Pieds carrés (pi²)
          </button>
          <button 
            type="button" 
            onClick={() => handleUnitChange('m2')} 
            className={`flex-1 py-2 rounded-lg transition border-2 text-sm font-medium ${formData.surfaceUnit === 'm2' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 hover:border-indigo-300 text-gray-700'}`}
          >
            Mètres carrés (m²)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Surface habitable ({formData.surfaceUnit === 'm2' ? 'm²' : 'pi²'})
          </label>
          <input type="number" value={formData.surfaceHabitee} onChange={(e) => handleChange('surfaceHabitee', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Surface du lot ({formData.surfaceUnit === 'm2' ? 'm²' : 'pi²'})
          </label>
          <input type="number" value={formData.surfaceLot} onChange={(e) => handleChange('surfaceLot', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Chambres</label>
          <input type="number" min="0" value={formData.nombreChambres} onChange={(e) => handleChange('nombreChambres', parseInt(e.target.value, 10) || 0)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Salles bain</label>
          <input type="number" min="0" value={formData.nombreSallesBain} onChange={(e) => handleChange('nombreSallesBain', parseInt(e.target.value, 10) || 0)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Garage</label>
          <input type="number" min="0" value={formData.garage} onChange={(e) => handleChange('garage', parseInt(e.target.value, 10) || 0)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
    </div>
  );

  const renderComponentsSlide = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4 text-sm text-blue-800 rounded-r">
        Ces informations permettent à l'IA d'ajuster l'évaluation selon la désuétude physique du bâtiment.
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Année Toiture (approx.)</label>
          <input type="number" placeholder="Ex: 2018" min="1950" max={new Date().getFullYear()} value={formData.toitureAnnee} onChange={(e) => handleChange('toitureAnnee', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Année Fenêtres (approx.)</label>
          <input type="number" placeholder="Ex: 2015" min="1950" max={new Date().getFullYear()} value={formData.fenetresAnnee} onChange={(e) => handleChange('fenetresAnnee', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Plomberie</label>
          <select value={formData.plomberieEtat} onChange={(e) => handleChange('plomberieEtat', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            {etatSystemes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Électricité (Panneau/Fils)</label>
          <select value={formData.electriciteEtat} onChange={(e) => handleChange('electriciteEtat', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            {etatSystemes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const renderConditionSlide = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Sous-sol</label>
        <div className="grid grid-cols-3 gap-2">
          {typesUnderground.map((t) => (
            <button key={t.value} type="button" onClick={() => handleChange('sous_sol', t.value)} className={`p-2 rounded-lg transition border-2 text-sm font-medium flex flex-col items-center justify-center text-center ${formData.sous_sol === t.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 hover:border-indigo-300'}`}>
              <span className="mb-1">{t.icon}</span> <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          État général des finitions * {slideErrors.etatGeneral && <span className="text-red-500">requis</span>}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {etatsGeneraux.map((etat) => (
            <button key={etat.value} type="button" onClick={() => handleChange('etatGeneral', etat.value)} className={`p-2 rounded-lg transition border-2 text-sm font-medium flex items-center justify-center gap-2 ${formData.etatGeneral === etat.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 hover:border-indigo-300'}`}>
              {etat.icon} {etat.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFinancesSlide = () => {
    const isPlex = ['duplex', 'triplex', '4plex'].includes(formData.proprietyType);

    return (
      <div className="space-y-4">
        {formData.userType === 'acheteur' ? (
          <>
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-3 mb-4 text-sm text-indigo-800 rounded-r">
              Entrez les informations de l'annonce pour que l'IA détecte si c'est une bonne affaire (Deal/Flip).
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Prix affiché / demandé ($)</label>
              <input type="number" placeholder="Ex: 350000" value={formData.prixAffichage} onChange={(e) => handleChange('prixAffichage', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Lien web de l'annonce (Optionnel)</label>
              <input type="text" placeholder="https://..." value={formData.urlAnnonce} onChange={(e) => handleChange('urlAnnonce', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 mb-4 text-sm text-emerald-800 rounded-r">
              Ces informations sont <strong>100% optionnelles</strong>. Remplissez-les pour calculer votre plus-value.
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Prix d'achat ($)</label>
              <input type="number" placeholder="Ex: 350000" value={formData.prixAchat} onChange={(e) => handleChange('prixAchat', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Année d'achat</label>
              <input type="number" min="1950" max={new Date().getFullYear()} value={formData.anneeAchat} onChange={(e) => handleChange('anneeAchat', parseInt(e.target.value, 10) || '')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </>
        )}

        {isPlex && (
          <div className="mt-6 border-t border-gray-200 pt-5">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">🏢 Chiffres de l'immeuble (Optionnel)</h4>
            <div className="bg-blue-50 border border-blue-100 p-3 mb-4 text-xs md:text-sm text-blue-800 rounded-lg">
              Ajoutez les revenus pour que l'IA utilise l'approche du revenu (TGA / MRB) pour évaluer cet immeuble.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Revenus annuels bruts ($)</label>
                <input type="number" placeholder="Ex: 36000" value={formData.revenusAnnuels} onChange={(e) => handleChange('revenusAnnuels', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dépenses annuelles ($)</label>
                <input type="number" placeholder="Taxes, assurances..." value={formData.depensesAnnuelles} onChange={(e) => handleChange('depensesAnnuelles', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAmenitiesSlide = () => (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">Piscine</label>
      <div className="flex gap-2">
        {[true, false].map((val) => (
          <button key={String(val)} type="button" onClick={() => handleChange('piscine', val)} className={`flex-1 py-2 rounded-lg transition border-2 font-medium ${formData.piscine === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 hover:border-indigo-300'}`}>
            {val ? '✅ Oui' : '❌ Non'}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Particularités du terrain</label>
        <input type="text" placeholder="Vue, boisé, coin tranquille..." value={formData.terrain_detail} onChange={(e) => handleChange('terrain_detail', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div>
        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
          Notes additionnelles (Rénovations récentes, etc.)
        </label>
        <textarea placeholder="Ex: Cuisine refaite en 2022 avec comptoirs en quartz..." value={formData.notes_additionnelles} onChange={(e) => handleChange('notes_additionnelles', e.target.value)} rows={4} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder:text-gray-400" />
      </div>
    </div>
  );

  const renderHeroValuation = () => {
    const est = selectedProperty.estimationActuelle || {};
    return (
      <div className="relative overflow-hidden rounded-2xl shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-blue-600 to-indigo-900" />
        
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-400 opacity-20 rounded-full blur-2xl"></div>

        <div className="relative p-8 md:p-12 text-white">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
             <div>
                <p className="text-sm md:text-base font-semibold opacity-90 mb-2 tracking-wider uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Valeur Marchande Estimée
                </p>
                <h2 className="text-5xl md:text-6xl font-black drop-shadow-md">
                  {est.valeurMoyenne ? `${est.valeurMoyenne.toLocaleString('fr-CA')} $` : 'N/A'}
                </h2>
             </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
              <p className="text-xs md:text-sm opacity-80 uppercase tracking-wide">Fourchette basse</p>
              <p className="text-xl md:text-2xl font-bold mt-1">
                {est.valeurBasse ? `${est.valeurBasse.toLocaleString('fr-CA')} $` : 'N/A'}
              </p>
            </div>
            <div className="hidden md:block bg-white/20 backdrop-blur-md p-4 rounded-xl border-2 border-white/40 transform scale-105 shadow-lg">
              <p className="text-xs md:text-sm text-white uppercase tracking-wide font-semibold">Cible médiane</p>
              <p className="text-xl md:text-2xl font-black mt-1">
                {est.valeurMoyenne ? `${est.valeurMoyenne.toLocaleString('fr-CA')} $` : 'N/A'}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
              <p className="text-xs md:text-sm opacity-80 uppercase tracking-wide">Fourchette haute</p>
              <p className="text-xl md:text-2xl font-bold mt-1">
                {est.valeurHaute ? `${est.valeurHaute.toLocaleString('fr-CA')} $` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProspectionAvis = () => {
    const opti = selectedProperty.potentielOptimisation;
    if (!opti) return null;

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-indigo-200 rounded-2xl p-6 md:p-8 shadow-md text-gray-800 transform hover:scale-[1.01] transition-transform">
        <h3 className="text-xl md:text-2xl font-black mb-6 text-indigo-900 flex items-center gap-3">
          🕵️‍♂️ Verdict Prospection (Le Deal)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/80 p-5 rounded-xl border border-white shadow-sm">
            <p className="text-indigo-600 text-sm uppercase tracking-wide font-bold mb-1">Avis de l'IA</p>
            <p className="text-xl font-bold text-gray-900">{opti.avisProspection}</p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 shadow-sm">
            <p className="text-emerald-700 text-sm uppercase tracking-wide font-bold mb-1">Valeur potentielle (Après rénos)</p>
            <p className="text-2xl font-black text-emerald-600">
              {opti.valeurApresTravaux ? `${opti.valeurApresTravaux.toLocaleString('fr-CA')} $` : 'N/A'}
            </p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Marge de sécurité suggérée: {opti.margeSecurite}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderMarketingKit = () => {
    const kit = selectedProperty.marketingKit;
    if (!kit) return null;

    return (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-6 md:p-8 shadow-md text-gray-800">
        <h3 className="text-xl md:text-2xl font-black mb-6 text-purple-900 flex items-center gap-3">
          📢 Kit Marketing (Prêt à publier)
        </h3>
        <div className="bg-white p-6 rounded-xl border border-purple-100 shadow-sm space-y-5">
          <div>
            <p className="text-purple-600 text-sm uppercase tracking-wide font-bold mb-1">Titre suggéré</p>
            <p className="text-xl font-bold text-gray-900">{kit.titreAnnonce}</p>
          </div>
          <div>
            <p className="text-purple-600 text-sm uppercase tracking-wide font-bold mb-1">Prix à afficher suggéré</p>
            <p className="text-2xl font-black text-purple-700">
              {kit.prixAfficheSuggere ? `${kit.prixAfficheSuggere.toLocaleString('fr-CA')} $` : 'Selon valeur moyenne'}
            </p>
          </div>
          <div className="pt-2">
            <div className="flex justify-between items-end mb-2">
               <p className="text-purple-600 text-sm uppercase tracking-wide font-bold">Description générée (DuProprio/Centris)</p>
               <button onClick={() => copyToClipboard(kit.descriptionDuProprio)} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${copySuccess ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}>
                  {copySuccess ? '✅ Copiée !' : '📋 Copier le texte'}
               </button>
            </div>
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 whitespace-pre-line text-gray-700 leading-relaxed font-medium">
              {kit.descriptionDuProprio}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderResidentialAppreciation = () => {
    const analyse = selectedProperty.analyse || {};
    const showFinancials = analyse.appreciationTotale || analyse.pourcentageGainTotal;
    const showMarket = analyse.marketTrend;

    if (!showFinancials && !showMarket && !analyse.analyseRentabilite) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
          📈 Analyse Financière & Marché
        </h3>
        
        {analyse.analyseRentabilite && (
          <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-5">
            <p className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                💵 Rentabilité (MRB / TGA)
            </p>
            <p className="text-gray-800 text-sm leading-relaxed">{analyse.analyseRentabilite}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6">
          {showFinancials && (
             <div className="flex-1 grid grid-cols-2 gap-4">
                {typeof analyse.appreciationTotale === 'number' && (
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-700 uppercase">Gain en capital</p>
                    <p className={`text-2xl font-black mt-1 ${analyse.appreciationTotale >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {analyse.appreciationTotale > 0 ? '+' : ''}{analyse.appreciationTotale.toLocaleString('fr-CA')} $
                    </p>
                  </div>
                )}
                {typeof analyse.pourcentageGainTotal === 'number' && (
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-700 uppercase">Retour (ROI)</p>
                    <p className={`text-2xl font-black mt-1 ${analyse.pourcentageGainTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {analyse.pourcentageGainTotal > 0 ? '+' : ''}{analyse.pourcentageGainTotal.toFixed(1)} %
                    </p>
                  </div>
                )}
             </div>
          )}

          {showMarket && (
             <div className="flex-1 bg-blue-50 p-5 rounded-xl border border-blue-100 flex flex-col justify-center">
                <p className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wide">Dynamique actuelle</p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {analyse.marketTrend.toLowerCase().includes('vendeur') ? '🔥' : analyse.marketTrend.toLowerCase().includes('acheteur') ? '🧊' : '⚖️'}
                  </span>
                  <div>
                    <p className="text-lg font-black text-blue-800 capitalize">Marché {analyse.marketTrend}</p>
                    <p className="text-xs text-blue-600 mt-1">Selon l'inventaire et les taux</p>
                  </div>
                </div>
             </div>
          )}
        </div>
      </div>
    );
  };

  const renderComparablesAndSecteur = () => {
    const analyse = selectedProperty.analyse || {};
    const comparables = selectedProperty.comparables || [];

    return (
      <div className="space-y-6">
        {analyse.analyseSecteur && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg md:text-xl font-black text-amber-900 mb-3 flex items-center gap-2">
              🎯 Analyse du Secteur
            </h3>
            <p className="text-amber-900/80 leading-relaxed text-sm md:text-base">
              {analyse.analyseSecteur}
            </p>
          </div>
        )}

        {comparables.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
             <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
                🏘️ Propriétés Comparables
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {comparables.map((comp, idx) => (
                   <div key={idx} className="border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${comp.statut?.toLowerCase() === 'vendu' ? 'bg-red-400' : 'bg-green-400'}`}></div>
                      <div className="flex justify-between items-start mb-3 pl-2">
                         <div>
                            <p className="font-bold text-gray-900 text-lg">{comp.adresse}</p>
                            <p className="text-xs text-gray-500">{comp.date}</p>
                         </div>
                         <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${comp.statut?.toLowerCase() === 'vendu' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                           {comp.statut}
                         </span>
                      </div>
                      <p className="text-2xl font-black text-indigo-900 mb-3 pl-2">
                         {typeof comp.prix === 'number' ? `${comp.prix.toLocaleString('fr-CA')} $` : comp.prix}
                      </p>
                      
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-4 ml-2 border border-gray-100 flex-grow">
                         {comp.caracteristiques}
                      </div>

                      {comp.ajustementParite && (
                        <div className="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-900 mb-4 ml-2 border border-indigo-100 flex items-start gap-2">
                          <span className="mt-0.5">⚖️</span>
                          <p className="font-medium">{comp.ajustementParite}</p>
                        </div>
                      )}

                      {comp.url && comp.url !== "null" && comp.url !== "" && (
                         <div className="pl-2 mt-auto">
                           <a href={comp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg">
                              Voir l'annonce
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                           </a>
                         </div>
                      )}
                   </div>
                ))}
             </div>
          </div>
        )}
      </div>
    );
  };

  const renderFacteursPrix = () => {
    const f = selectedProperty.facteursPrix || {};
    const positives = f.positifs || [];
    const negatives = f.negatifs || [];
    const uncertainties = f.incertitudes || [];

    if (!positives.length && !negatives.length && !uncertainties.length) return null;

    const colCount = (positives.length > 0 ? 1 : 0) + (negatives.length > 0 ? 1 : 0) + (uncertainties.length > 0 ? 1 : 0);
    const gridColsClass = colCount === 3 ? 'md:grid-cols-3' : colCount === 2 ? 'md:grid-cols-2' : 'grid-cols-1';

    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">⚖️ Facteurs d'Influence</h3>
        <div className={`grid grid-cols-1 ${gridColsClass} gap-4`}>
          {positives.length > 0 && (
            <div className="bg-green-50 p-5 rounded-xl border border-green-100">
              <p className="font-bold text-green-800 mb-3 text-sm uppercase tracking-wide">Points forts (+)</p>
              <ul className="space-y-2">
                {positives.map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-gray-800">
                    <span className="text-green-600 font-bold">✓</span> <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {negatives.length > 0 && (
            <div className="bg-red-50 p-5 rounded-xl border border-red-100">
              <p className="font-bold text-red-800 mb-3 text-sm uppercase tracking-wide">Points faibles (-)</p>
              <ul className="space-y-2">
                {negatives.map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-gray-800">
                    <span className="text-red-500 font-bold">✕</span> <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {uncertainties.length > 0 && (
            <div className="bg-amber-50 p-5 rounded-xl border border-amber-100">
              <p className="font-bold text-amber-800 mb-3 text-sm uppercase tracking-wide">Incertitudes (?)</p>
              <ul className="space-y-2">
                {uncertainties.map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-gray-800">
                    <span className="text-amber-500 font-bold">?</span> <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRecommendations = () => {
    const r = selectedProperty.recommendations || {};
    if (!r) return null;

    const renovations = r.renovationsRentables || [];
    const strategy = r.strategieVente;

    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6 md:p-8 shadow-sm">
        <h3 className="text-xl md:text-2xl font-black text-indigo-900 mb-6 flex items-center gap-3">💡 Recommandations Stratégiques</h3>
        
        {renovations.length > 0 && (
          <div className="mb-6">
            <p className="font-bold text-indigo-800 mb-3 text-sm uppercase tracking-wide">🔨 Rénovations à haut ROI</p>
            <ul className="space-y-2 bg-white/60 p-4 rounded-xl border border-indigo-100/50">
              {renovations.map((item, idx) => (
                <li key={idx} className="flex gap-3 text-sm md:text-base text-gray-800">
                  <span className="text-indigo-600 font-bold">»</span> <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {strategy && (
          <div>
            <p className="font-bold text-indigo-800 mb-3 text-sm uppercase tracking-wide">📋 Stratégie d'action</p>
            <p className="text-sm md:text-base text-gray-800 leading-relaxed bg-white/60 p-4 rounded-xl border border-indigo-100/50">
                {strategy}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderChatHeader = () => (
    <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-6 md:p-8 rounded-2xl shadow-lg mb-8 flex flex-col md:flex-row items-center justify-between gap-4 text-white">
      <div>
        <h2 className="text-2xl font-black flex items-center gap-2">
          🤖 Discuter de cette évaluation avec l'IA
        </h2>
        <p className="text-indigo-200 mt-1 text-sm md:text-base">
          Posez des questions sur le financement, la stratégie de flip, ou comment maximiser le prix de vente.
        </p>
      </div>
      
      {hasPremiumAccess ? (
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
        >
          {isChatOpen ? 'Fermer le chat' : '💬 Ouvrir le Stratège IA'}
        </button>
      ) : (
        <button 
          onClick={() => alert("Redirection vers la page d'upgrade (À implémenter !)")}
          className="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
        >
          🔒 Débloquer avec Pro/Growth
        </button>
      )}
    </div>
  );

  const renderChatWindow = () => {
    if (!isChatOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] w-full h-[100dvh] flex flex-col bg-white overflow-hidden md:inset-auto md:bottom-8 md:right-8 md:w-[400px] md:h-[600px] md:max-h-[80vh] md:rounded-2xl shadow-2xl md:border md:border-gray-200">
        
        <div className="bg-indigo-900 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl md:text-3xl">🤖</span>
            <div>
              <h3 className="font-bold text-sm md:text-base">Stratège Immobilier IA</h3>
              <p className="text-xs text-indigo-300">Analyse en direct</p>
            </div>
          </div>
          <button onClick={() => setIsChatOpen(false)} className="text-indigo-200 hover:text-white p-2 text-xl font-bold rounded-lg hover:bg-white/10 transition">✕</button>
        </div>

        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {chatMessages.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-12 px-6">
              Posez-moi vos questions sur le financement, la stratégie de rénovation ou le potentiel de revente.
            </div>
          )}
          
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.content}
              </div>
            </div>
          ))}
          
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="p-4 bg-white border border-gray-200 rounded-2xl rounded-bl-none flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={sendChatMessage} className="p-3 md:p-4 bg-white border-t border-gray-100 shrink-0 pb-safe">
          <div className="relative">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Écrivez votre question ici..." 
              className="w-full bg-gray-100 border-transparent rounded-xl py-3.5 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-base md:text-sm transition-all"
              disabled={isChatLoading}
            />
            <button 
              type="submit" 
              disabled={isChatLoading || !chatInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto w-full font-sans relative">
      
      
        <LoadingSpinner isLoading={loading} messages={loadingMessages} estimatedTime={100} type="residential" /> 
    
      
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-6 border-b border-indigo-700/20 shrink-0">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white mb-1 flex items-center gap-2">
                    {slides[currentSlide].icon} {slides[currentSlide].title}
                  </h2>
                  <p className="text-indigo-100 text-sm md:text-base">{slides[currentSlide].description}</p>
                </div>
                <button type="button" onClick={() => { setShowForm(false); setCurrentSlide(0); setSlideErrors({}); }} className="text-white hover:bg-white/20 p-2 rounded-lg transition">✕</button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-indigo-900/40 rounded-full h-2 overflow-hidden">
                  <div className="bg-white h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${slideProgress}%` }} />
                </div>
                <span className="text-white text-xs font-bold whitespace-nowrap bg-white/20 px-2 py-1 rounded-md">
                  {currentSlide + 1} / {slides.length}
                </span>
              </div>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-50">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                {slides[currentSlide].id === 'profil' && renderProfilSlide()}
                {slides[currentSlide].id === 'location' && renderLocationSlide()}
                {slides[currentSlide].id === 'dimensions' && renderDimensionsSlide()}
                {slides[currentSlide].id === 'components' && renderComponentsSlide()}
                {slides[currentSlide].id === 'condition' && renderConditionSlide()}
                {slides[currentSlide].id === 'finances' && renderFinancesSlide()}
                {slides[currentSlide].id === 'amenities' && renderAmenitiesSlide()}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl mt-6 text-red-700 text-sm flex gap-3 items-start">
                  <span className="text-xl">❌</span>
                  <div>
                    <p className="font-bold">Erreur</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {Object.keys(slideErrors).length > 0 && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl mt-6 text-orange-700 text-sm flex gap-3 items-start">
                  <span className="text-xl">⚠️</span>
                  <div>
                     <p className="font-bold">Champs obligatoires manquants</p>
                     <ul className="mt-1 space-y-1">
                       {Object.entries(slideErrors).map(([field]) => {
                         const labels = { ville: 'Ville', proprietyType: 'Type de propriété', anneeConstruction: 'Année de construction', etatGeneral: 'État général', userType: 'Votre Profil' };
                         return <li key={field}>• {labels[field] || field}</li>;
                       })}
                     </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              {currentSlide > 0 && (
                <button type="button" onClick={previousSlide} className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition" disabled={loading}>
                  ← Retour
                </button>
              )}
              <button type="button" onClick={nextSlide} disabled={loading} className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? 'Traitement...' : currentSlide === slides.length - 1 ? '✅ Lancer l\'analyse IA' : 'Suivant →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!showForm && !selectedProperty && !loading && (
        <div className="flex justify-center my-12">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={isButtonDisabled}
            className={`px-8 md:px-12 py-5 font-black text-lg md:text-xl rounded-2xl shadow-xl transform hover:-translate-y-1 transition-all flex items-center gap-3 ${
              isButtonDisabled
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-80 shadow-none'
                : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:shadow-indigo-500/30'
            }`}
          >
            {isButtonDisabled ? '❌ Quota épuisé' : (
                <>
                  <span className="text-2xl">🚀</span>
                  Lancer une Analyse Immobilière
                </>
            )}
          </button>
        </div>
      )}

      {selectedProperty && (
        <div ref={resultRef} className="space-y-6 md:space-y-8 mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-24">
          
          {renderChatHeader()}
          {renderHeroValuation()}
          {selectedProperty.potentielOptimisation && renderProspectionAvis()}
          {renderResidentialAppreciation()}
          {renderComparablesAndSecteur()}
          {renderFacteursPrix()}
          {selectedProperty.marketingKit && renderMarketingKit()}
          {renderRecommendations()}

          <div className="flex justify-center pt-8 pb-12">
            <button
              type="button"
              onClick={() => {
                setSelectedProperty(null);
                setShowForm(false);
                setCurrentSlide(0);
                setIsChatOpen(false);
              }}
              className="px-8 py-3 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-bold rounded-xl transition-all hover:bg-gray-50 flex items-center gap-2 shadow-sm"
            >
              ← Recommencer une analyse
            </button>
          </div>
        </div>
      )}

      {renderChatWindow()}
    </div>
  );
}

function CommercialValuation({ user, quotaInfo, setQuotaInfo, isButtonDisabled }) {
  const [loading, setLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [error, setError] = useState('');
  const [slideErrors, setSlideErrors] = useState({});
  
  const isSubmittingRef = useRef(false);
  const resultRef = useRef(null);

  // --- NOUVEAUX STATES POUR LE CHATBOT ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  // Détermine si l'utilisateur a accès au chat
  const userPlan = quotaInfo?.plan?.toLowerCase() || quotaInfo?.planId?.toLowerCase() || 'gratuit';
  const hasPremiumAccess = ['pro', 'growth', 'premium', 'illimite'].includes(userPlan) || quotaInfo?.isUnlimited;

  const [formData, setFormData] = useState({
    userType: 'acheteur', // 'acheteur' ou 'vendeur'
    titre: '',
    proprietyType: 'immeuble_revenus',
    ville: '',
    quartier: '',
    codePostal: '',
    addresseComplete: '',
    prixAffichage: '', // Pour acheteur
    urlAnnonce: '', // Pour acheteur
    prixAchat: '', // Pour vendeur
    anneeAchat: '', // Pour vendeur
    anneeConstruction: 1990,
    surfaceUnit: 'pi2', // <-- NOUVEAU: Unité de surface par défaut
    surfaceTotale: '',
    surfaceLocable: '',
    etatGeneral: 'bon',
    renovations: [],
    accessibilite: 'tres_bonne',
    parking: 6,
    terrain_detail: '',
    notes_additionnelles: '',
    nombreUnites: 6,
    tauxOccupation: 95,
    loyerMoyenParUnite: 1200,
    revenuBrutAnnuel: '',
    depensesAnnuelles: '',
    nombreChambres: 50,
    tauxOccupationHotel: 70,
    tariffMoyenParNuit: 150,
    clienteleActive: 'stable',
    
    // NOUVEAUX CHAMPS D'OPTIMISATION (VALUE-ADD) POUR PLEX
    chauffage_proprio: false,
    electricite_proprio: false,
    unites_non_renovees: false,
    sous_sol_inexploite: false,
    stationnement_gratuit: false,

    // DÉTAIL DES LOGEMENTS
    logementsDetail: [{ type: '4 1/2', quantite: 1 }]
  });

  const loadingMessages = [
    '🏪 Analyse de l\'actif commercial...',
    '🌐 Recherche globale (Scouting) sur Centris/LoopNet...',
    '🔍 Extraction et ciblage des fiches individuelles...',
    '💹 Calcul du NOI, Cap Rate et valeur économique...',
    formData.userType === 'acheteur' 
        ? '🎯 Évaluation du deal et du potentiel de Value-Add...' 
        : '📝 Préparation de la stratégie de mise en marché...',
    '💰 Génération du rapport de rentabilité...',
  ];

  const propertyTypes = [
    { value: 'immeuble_revenus', label: 'Immeuble à revenus', icon: '🏢' },
    { value: 'hotel', label: 'Hôtel', icon: '🏨' },
    { value: 'depanneur', label: 'Dépanneur', icon: '🏪' },
    { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
    { value: 'bureau', label: 'Bureau', icon: '📋' },
    { value: 'commerce', label: 'Autre commerce', icon: '🛍️' },
    { value: 'terrain_commercial', label: 'Terrain', icon: '🌳' },
  ];

  const etatsGeneraux = [
    { value: 'excellent', label: 'Excellent', icon: '⭐' },
    { value: 'bon', label: 'Bon', icon: '👍' },
    { value: 'moyen', label: 'Moyen', icon: '➖' },
    { value: 'faible', label: 'Faible', icon: '⚠️' },
    { value: 'renovation', label: 'À rénover', icon: '🔨' },
  ];

  const accessibiliteOptions = [
    { value: 'tres_bonne', label: 'Très bonne', icon: '✅' },
    { value: 'bonne', label: 'Bonne', icon: '👍' },
    { value: 'moyenne', label: 'Moyenne', icon: '➖' },
    { value: 'limitee', label: 'Limitée', icon: '⚠️' },
  ];

  // ============================================
  // GÉNÉRATION DYNAMIQUE DES SLIDES SELON LE TYPE
  // ============================================
  const getActiveSlides = () => {
    const type = formData.proprietyType;
    const isTerrain = type === 'terrain_commercial';
    const isImmeuble = type === 'immeuble_revenus';
    const isHotel = type === 'hotel';

    const dynamicSlides = [
      {
        id: 'profil',
        title: 'Votre Profil',
        description: 'Êtes-vous en mode prospection ou évaluation ?',
        icon: '👤',
        required: ['userType'],
      },
      {
        id: 'location',
        title: 'Localisation',
        description: 'Où se situe l\'actif commercial?',
        icon: '📍',
        required: ['ville', 'proprietyType'],
      }
    ];

    dynamicSlides.push({
      id: 'acquisition',
      title: formData.userType === 'acheteur' ? "Données de l'annonce" : 'Historique (Optionnel)',
      description: formData.userType === 'acheteur' ? "Pour analyser le deal" : "Pour calculer la plus-value et le ROI",
      icon: '💰',
      required: isTerrain ? [] : ['anneeConstruction'], 
    });

    dynamicSlides.push({
      id: 'dimensions',
      title: isImmeuble ? 'Configuration' : (isTerrain ? 'Détails du terrain' : 'Infrastructure'),
      description: isImmeuble ? 'Types de logements et stationnements' : 'Superficie et accessibilité',
      icon: isImmeuble ? '🚪' : '📏',
      required: [],
    });

    if (isImmeuble || isHotel) {
      dynamicSlides.push({
        id: 'specific',
        title: 'Exploitation & Potentiel',
        description: 'Détails spécifiques à l\'activité',
        icon: '💹',
        required: [],
      });
    }

    if (!isTerrain) {
      dynamicSlides.push({
        id: 'financial',
        title: 'Données Financières',
        description: 'Revenus et dépenses annuelles',
        icon: '💵',
        required: ['revenuBrutAnnuel', 'depensesAnnuelles'],
      });

      dynamicSlides.push({
        id: 'condition',
        title: 'État de la bâtisse',
        description: 'Condition et rénovations',
        icon: '🔧',
        required: ['etatGeneral'],
      });
    }

    dynamicSlides.push({
      id: 'details',
      title: 'Notes & Stratégie',
      description: 'Informations additionnelles pour l\'IA',
      icon: '📝',
      required: [],
    });

    return dynamicSlides;
  };

  const activeSlides = getActiveSlides();

  useEffect(() => {
    setSlideProgress(((currentSlide + 1) / activeSlides.length) * 100);
  }, [currentSlide, activeSlides.length]);

  // Scroll auto du chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSlideErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // --- NOUVELLE FONCTION: Changement d'unité avec conversion UX ---
  const handleUnitChange = (newUnit) => {
    if (newUnit === formData.surfaceUnit) return;
    
    let newTotale = formData.surfaceTotale;
    let newLocable = formData.surfaceLocable;

    // Facteur de conversion: 1 m² = 10.7639 pi²
    const factor = 10.7639;

    const convertValue = (val, toM2) => {
      if (!val) return '';
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      return toM2 ? Math.round(num / factor) : Math.round(num * factor);
    };

    newTotale = convertValue(newTotale, newUnit === 'm2');
    newLocable = convertValue(newLocable, newUnit === 'm2');

    setFormData(prev => ({
      ...prev,
      surfaceUnit: newUnit,
      surfaceTotale: newTotale,
      surfaceLocable: newLocable
    }));
  };

  const validateCurrentSlide = () => {
    const cfg = activeSlides[currentSlide];
    const errors = {};
    if (cfg.required) {
      cfg.required.forEach((field) => {
        const value = formData[field];
        if (value === '' || value === null || value === undefined) {
          errors[field] = true;
        }
      });
    }
    setSlideErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextSlide = () => {
    if (!validateCurrentSlide()) return;
    if (currentSlide < activeSlides.length - 1) {
      setCurrentSlide((s) => s + 1);
    } else {
      submitEvaluation();
    }
  };

  const previousSlide = () => {
    if (currentSlide > 0) setCurrentSlide((s) => s - 1);
  };

  // ============================================
  // LOGIQUE DE PARTAGE (SHARE)
  // ============================================
  const handleShare = async () => {
    const est = selectedProperty?.estimationActuelle?.valeurMoyenne;
    if (!est) return;

    const city = formData.ville || 'mon actif commercial';
    const val = est.toLocaleString('fr-CA');
    const typeLabel = propertyTypes.find(t => t.value === formData.proprietyType)?.label || 'Immeuble commercial';
    
    const APP_LINK = "https://optimiplex.com"; 
    
    const shareText = `🏢 Je viens d'évaluer mon ${typeLabel.toLowerCase()} à ${city} à ${val}$ avec l'IA !\n\nDécouvrez la valeur réelle de vos actifs commerciaux, analysez les Cap Rates du marché et optimisez vos revenus en quelques secondes. 🚀\n\n👉 Faites le test ici : ${APP_LINK}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mon Évaluation Commerciale IA', text: shareText });
        return;
      } catch (err) {
        console.log('Partage natif ignoré', err);
      }
    } 
    
    const textArea = document.createElement("textarea");
    textArea.value = shareText;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert('✨ Le texte de partage a été copié dans votre presse-papier !');
    } catch (err) {
      alert('Erreur lors de la copie du texte.');
    }
    document.body.removeChild(textArea);
  };

  const submitEvaluation = async () => {
    const hasAccess = quotaInfo?.isUnlimited || quotaInfo?.remaining > 0 || quotaInfo?.credits > 0;
    if (!hasAccess && setQuotaInfo) {
      setError("Quota épuisé et pas de crédits disponibles.");
      return;
    }

    if (isSubmittingRef.current) return; 
    isSubmittingRef.current = true;
    
    try {
      setLoading(true);
      setError('');

      const endpoint = `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ''}/api/property/valuation-estimator-commercial`;
      
      // --- COMPATIBILITÉ BACKEND GARANTIE ---
      let finalSurfaceTotale = Number(formData.surfaceTotale) || 0;
      let finalSurfaceLocable = Number(formData.surfaceLocable) || 0;
      
      // On convertit en pi2 avant d'envoyer au backend
      if (formData.surfaceUnit === 'm2') {
        const factor = 10.7639;
        finalSurfaceTotale = Math.round(finalSurfaceTotale * factor);
        finalSurfaceLocable = Math.round(finalSurfaceLocable * factor);
      }

      const payload = {
        userId: user?.uid,
        ...formData,
        surfaceUnit: 'pi2', // On envoie 'pi2' au backend par défaut pour assurer la compatibilité
        typeCom: formData.proprietyType,
        surfaceTotale: finalSurfaceTotale,
        surfaceLocable: finalSurfaceLocable,
        accessibilite: formData.accessibilite || 'moyenne',
        parking: Number(formData.parking) || 0,
        ...(formData.proprietyType === 'immeuble_revenus' && {
          nombreUnites: Number(formData.nombreUnites) || 0,
          tauxOccupation: Number(formData.tauxOccupation) || 0,
          loyerMoyenParUnite: Number(formData.loyerMoyenParUnite) || 0,
          chauffage_proprio: formData.chauffage_proprio,
          electricite_proprio: formData.electricite_proprio,
          unites_non_renovees: formData.unites_non_renovees,
          sous_sol_inexploite: formData.sous_sol_inexploite,
          stationnement_gratuit: formData.stationnement_gratuit,
          logementsDetail: formData.logementsDetail
        }),
        ...(formData.proprietyType === 'hotel' && {
          nombreChambres: Number(formData.nombreChambres) || 0,
          tauxOccupationHotel: Number(formData.tauxOccupationHotel) || 0,
          tariffMoyenParNuit: Number(formData.tariffMoyenParNuit) || 0,
        }),
        revenus_bruts_annuels: formData.proprietyType !== 'terrain_commercial' ? (Number(formData.revenuBrutAnnuel) || 0) : 0,
        depenses_annuelles: formData.proprietyType !== 'terrain_commercial' ? (Number(formData.depensesAnnuelles) || 0) : 0,
      };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Erreur HTTP ${resp.status}`);
      }

      const result = await resp.json();

      if (setQuotaInfo && quotaInfo && !quotaInfo.isUnlimited) {
        if (quotaInfo.remaining > 0) {
           setQuotaInfo(prev => ({ ...prev, remaining: Math.max(0, prev.remaining - 1) }));
        } else {
           setQuotaInfo(prev => ({ ...prev, credits: Math.max(0, prev.credits - 1) }));
        }
      }

      setSelectedProperty(result);
      setShowForm(false);
      setCurrentSlide(0);
      
      // Réinitialiser le chatbot
      setChatMessages([]);
      setIsChatOpen(false);

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur lors de l'évaluation");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // --- NOUVELLE FONCTION CHATBOT AVEC SAUVEGARDE FIRESTORE ---
  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMessage];
    
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const endpoint = `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ''}/api/property/valuation-chat-commercial`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          propertyData: selectedProperty 
        }),
      });

      if (!response.ok) throw new Error('Erreur de communication avec le Stratège IA');
      
      const data = await response.json();
      const assistantMessage = { role: 'assistant', content: data.reply };
      const finalMessages = [...updatedMessages, assistantMessage];
      
      setChatMessages(finalMessages);

      // --- SAUVEGARDE DANS FIRESTORE ---
      if (selectedProperty?.id && user?.uid) {
        try {
          // Nécessite import { getFirestore, doc, updateDoc } from 'firebase/firestore'; 
          // const db = getFirestore();
          // const collectionName = selectedProperty.collection || 'evaluations_commerciales';
          // const docRef = doc(db, 'users', user.uid, collectionName, selectedProperty.id);
          // await updateDoc(docRef, { chatHistory: finalMessages });
          
          // Mettre à jour la propriété locale pour garder la synchro
          setSelectedProperty(prev => ({ ...prev, chatHistory: finalMessages }));
        } catch (dbErr) {
          console.error("Erreur lors de la sauvegarde Firestore de l'historique:", dbErr);
        }
      }
      
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur s'est produite lors de la connexion à mes systèmes. Veuillez réessayer." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- RENDERERS DE SLIDES ---

  const renderProfilSlide = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleChange('userType', 'acheteur')}
          className={`p-6 rounded-2xl text-left transition border-2 flex flex-col gap-2 ${formData.userType === 'acheteur' ? 'bg-indigo-50 border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white border-gray-200 hover:border-indigo-300'}`}
        >
          <div className="text-3xl">🕵️‍♂️</div>
          <h3 className={`text-lg font-black ${formData.userType === 'acheteur' ? 'text-indigo-900' : 'text-gray-800'}`}>Acheteur / Prospection</h3>
          <p className="text-sm text-gray-500">J'ai vu une annonce, je veux savoir si c'est un bon prix, analyser le Cap Rate et évaluer le potentiel d'optimisation (Value-Add).</p>
        </button>
        
        <button
          type="button"
          onClick={() => handleChange('userType', 'vendeur')}
          className={`p-6 rounded-2xl text-left transition border-2 flex flex-col gap-2 ${formData.userType === 'vendeur' ? 'bg-indigo-50 border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white border-gray-200 hover:border-indigo-300'}`}
        >
          <div className="text-3xl">🏷️</div>
          <h3 className={`text-lg font-black ${formData.userType === 'vendeur' ? 'text-indigo-900' : 'text-gray-800'}`}>Vendeur / Propriétaire</h3>
          <p className="text-sm text-gray-500">Je possède l'actif, je veux estimer sa valeur économique pour le vendre, le refinancer ou mesurer ma plus-value.</p>
        </button>
      </div>
    </div>
  );

  const renderLocationSlide = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          Type d'actif * {slideErrors.proprietyType && <span className="text-red-500">requis</span>}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {propertyTypes.map((t) => (
            <button
              key={t.value} type="button" onClick={() => handleChange('proprietyType', t.value)}
              className={`p-3 rounded-xl flex flex-col items-center justify-center text-center transition border-2 ${
                formData.proprietyType === t.value ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 border-gray-200 hover:border-indigo-300 text-gray-700'
              }`}
            >
              <div className="mb-1">{t.icon}</div>
              <div className="text-xs font-bold leading-tight">{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          Adresse complète (Très recommandée)
        </label>
        <input 
          type="text" 
          placeholder="Ex: 1234 Boul. Charest, local 100..." 
          value={formData.addresseComplete} 
          onChange={(e) => handleChange('addresseComplete', e.target.value)} 
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm" 
        />
        <p className="text-xs text-gray-500 mt-1">Aide l'IA à effectuer des recherches ciblées si l'annonce n'est pas trouvée.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-2">Ville * {slideErrors.ville && <span className="text-red-500">requis</span>}</label>
            <input type="text" placeholder="Ex: Québec" value={formData.ville} onChange={(e) => handleChange('ville', e.target.value)} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 ${slideErrors.ville ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`} />
        </div>
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Code Postal</label>
            <input type="text" placeholder="Ex: G1V 2M2" value={formData.codePostal} onChange={(e) => handleChange('codePostal', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Quartier (Optionnel)</label>
            <input type="text" placeholder="Ex: Ste-Foy" value={formData.quartier} onChange={(e) => handleChange('quartier', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Nom du dossier (Optionnel)</label>
          <input type="text" placeholder="Ex: 6-plex Sainte-Foy" value={formData.titre} onChange={(e) => handleChange('titre', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
    </div>
  );

  const renderAcquisitionSlide = () => {
    const isTerrain = formData.proprietyType === 'terrain_commercial';
    return (
      <div className="space-y-4">
        {formData.userType === 'acheteur' ? (
          <>
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-4 rounded-r-xl text-sm text-indigo-800 font-medium">
              Entrez les informations de l'annonce pour que l'IA détecte si c'est une bonne affaire (Évaluation de la rentabilité demandée).
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Prix affiché / demandé ($)</label>
                <input type="number" placeholder="Ex: 1200000" value={formData.prixAffichage} onChange={(e) => handleChange('prixAffichage', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Lien web de l'annonce (Très recommandé)</label>
                <input type="text" placeholder="https://..." value={formData.urlAnnonce} onChange={(e) => handleChange('urlAnnonce', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-4 rounded-r-xl text-sm text-emerald-800 font-medium">
              Les données d'achat sont <strong>optionnelles</strong>. Remplissez-les uniquement pour calculer le rendement sur investissement (ROI) historique.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Prix d'achat ($)</label>
                <input type="number" placeholder="Optionnel" value={formData.prixAchat} onChange={(e) => handleChange('prixAchat', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Année d'achat</label>
                <input type="number" placeholder="Optionnel" min="1950" max={new Date().getFullYear()} value={formData.anneeAchat} onChange={(e) => handleChange('anneeAchat', parseInt(e.target.value, 10) || '')} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </>
        )}

        {!isTerrain && (
          <div className="pt-4 border-t border-gray-100 mt-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Année de construction * {slideErrors.anneeConstruction && <span className="text-red-500">requis</span>}
            </label>
            <input type="number" min="1800" max={new Date().getFullYear()} value={formData.anneeConstruction} onChange={(e) => handleChange('anneeConstruction', parseInt(e.target.value, 10) || '')} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 ${slideErrors.anneeConstruction ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`} />
          </div>
        )}
      </div>
    );
  };

  const renderDimensionsSlide = () => {
    const isTerrain = formData.proprietyType === 'terrain_commercial';
    const isImmeuble = formData.proprietyType === 'immeuble_revenus';

    return (
      <div className="space-y-4">
        
        {/* NOUVEAU : Sélecteur d'unité pour Commercial */}
        {!isImmeuble && (
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">Unité de mesure (Surfaces)</label>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => handleUnitChange('pi2')} 
                className={`flex-1 py-2 rounded-lg transition border-2 text-sm font-bold ${formData.surfaceUnit === 'pi2' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 hover:border-indigo-300 text-gray-700'}`}
              >
                Pieds carrés (pi²)
              </button>
              <button 
                type="button" 
                onClick={() => handleUnitChange('m2')} 
                className={`flex-1 py-2 rounded-lg transition border-2 text-sm font-bold ${formData.surfaceUnit === 'm2' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 hover:border-indigo-300 text-gray-700'}`}
              >
                Mètres carrés (m²)
              </button>
            </div>
          </div>
        )}

        {/* SECTION DYNAMIQUE POUR LES PLEX */}
        {isImmeuble ? (
          <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl mb-4">
            <p className="font-black text-indigo-900 mb-4 flex items-center gap-2">🚪 Configuration des logements</p>
            
            {formData.logementsDetail.map((logement, index) => (
              <div key={index} className="flex items-center gap-3 mb-3 animate-in fade-in duration-200">
                <div className="w-1/3">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Quantité</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={logement.quantite} 
                    onChange={(e) => {
                      const newLogements = [...formData.logementsDetail];
                      newLogements[index].quantite = parseInt(e.target.value, 10) || 1;
                      handleChange('logementsDetail', newLogements);
                      
                      // Met à jour automatiquement le nombre d'unités total
                      const totalUnites = newLogements.reduce((sum, log) => sum + Number(log.quantite), 0);
                      handleChange('nombreUnites', totalUnites);
                    }} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
                <div className="w-2/3">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Type de logement</label>
                  <div className="flex gap-2">
                    <select 
                      value={logement.type} 
                      onChange={(e) => {
                        const newLogements = [...formData.logementsDetail];
                        newLogements[index].type = e.target.value;
                        handleChange('logementsDetail', newLogements);
                      }} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="Chambre">Chambre</option>
                      <option value="1 1/2 (Studio)">1 1/2 (Studio)</option>
                      <option value="2 1/2">2 1/2</option>
                      <option value="3 1/2">3 1/2</option>
                      <option value="4 1/2">4 1/2</option>
                      <option value="5 1/2">5 1/2</option>
                      <option value="6 1/2 et +">6 1/2 et +</option>
                      <option value="Local Commercial">Local Commercial</option>
                    </select>
                    
                    {formData.logementsDetail.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          const newLogements = formData.logementsDetail.filter((_, i) => i !== index);
                          handleChange('logementsDetail', newLogements);
                          const totalUnites = newLogements.reduce((sum, log) => sum + Number(log.quantite), 0);
                          handleChange('nombreUnites', totalUnites);
                        }} 
                        className="p-2 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            <button 
              type="button" 
              onClick={() => {
                const newLogements = [...formData.logementsDetail, { type: '3 1/2', quantite: 1 }];
                handleChange('logementsDetail', newLogements);
                const totalUnites = newLogements.reduce((sum, log) => sum + Number(log.quantite), 0);
                handleChange('nombreUnites', totalUnites);
              }} 
              className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-4 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-colors w-full justify-center"
            >
              + Ajouter un autre type
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Superficie totale ({formData.surfaceUnit === 'm2' ? 'm²' : 'pi²'})
              </label>
              <input type="number" value={formData.surfaceTotale} onChange={(e) => handleChange('surfaceTotale', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
            </div>
            {!isTerrain && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Superficie locable ({formData.surfaceUnit === 'm2' ? 'm²' : 'pi²'})
                </label>
                <input type="number" value={formData.surfaceLocable} onChange={(e) => handleChange('surfaceLocable', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!isTerrain && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Stationnements inclus</label>
              <input type="number" value={formData.parking} onChange={(e) => handleChange('parking', parseInt(e.target.value, 10) || 0)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Accessibilité (Transport, routes)</label>
            <select value={formData.accessibilite} onChange={(e) => handleChange('accessibilite', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white">
              {accessibiliteOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    );
  };

  const renderSpecificSlide = () => {
    const isImmeuble = formData.proprietyType === 'immeuble_revenus';
    const isHotel = formData.proprietyType === 'hotel';
    return (
      <div className="space-y-4">
        {isImmeuble && (
          <>
            <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl">
              <p className="font-black text-indigo-900 mb-4 flex items-center gap-2"> 🏢Opérations Locatives</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Unités (Total)</label>
                  <input type="number" value={formData.nombreUnites} readOnly className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50 rounded-lg text-indigo-900 font-bold focus:outline-none" />
                  <p className="text-[10px] text-gray-500 mt-1">Calculé auto.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Occupation (%)</label>
                  <input type="number" min="0" max="100" value={formData.tauxOccupation} onChange={(e) => handleChange('tauxOccupation', parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Loyer moyen/unité/mois ($)</label>
                <input type="number" value={formData.loyerMoyenParUnite} onChange={(e) => handleChange('loyerMoyenParUnite', parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl mt-4">
              <p className="font-black text-emerald-900 mb-4 flex items-center gap-2"> ✨ Potentiel d'Optimisation (Value-Add)</p>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: 'chauffage_proprio', label: '🔥 Chauffage payé par le proprio' },
                  { key: 'electricite_proprio', label: '🔌 Électricité payée par le proprio' },
                  { key: 'unites_non_renovees', label: '🛠️ Logements d\'origine (à rénover)' },
                  { key: 'sous_sol_inexploite', label: '📦 Sous-sol inexploité (Potentiel logement)' },
                  { key: 'stationnement_gratuit', label: '🚗 Stationnements inclus gratuitement' }
                ].map(item => (
                  <label key={item.key} className="flex items-center p-3 bg-white rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors border border-emerald-200 shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={formData[item.key] || false} 
                      onChange={(e) => handleChange(item.key, e.target.checked)} 
                      className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300" 
                    />
                    <span className="ml-3 text-sm font-bold text-emerald-800">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {isHotel && (
          <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl">
            <p className="font-black text-indigo-900 mb-4 flex items-center gap-2">🏨Opérations Hôtelières</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Chambres</label>
                <input type="number" value={formData.nombreChambres} onChange={(e) => handleChange('nombreChambres', parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Occupation (%)</label>
                <input type="number" min="0" max="100" value={formData.tauxOccupationHotel} onChange={(e) => handleChange('tauxOccupationHotel', parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Tarif moyen/nuit (ADR) ($)</label>
              <input type="number" value={formData.tariffMoyenParNuit} onChange={(e) => handleChange('tariffMoyenParNuit', parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFinancialSlide = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          Revenus bruts annuels ($) * {slideErrors.revenuBrutAnnuel && <span className="text-red-500">requis</span>}
        </label>
        <input type="number" placeholder="Avant dépenses" value={formData.revenuBrutAnnuel} onChange={(e) => handleChange('revenuBrutAnnuel', e.target.value)} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 ${slideErrors.revenuBrutAnnuel ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`} />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          Dépenses annuelles ($) * {slideErrors.depensesAnnuelles && <span className="text-red-500">requis</span>}
        </label>
        <input type="number" placeholder="Taxes, entretien, assurances..." value={formData.depensesAnnuelles} onChange={(e) => handleChange('depensesAnnuelles', e.target.value)} className={`w-full px-4 py-3 border rounded-xl focus:ring-2 ${slideErrors.depensesAnnuelles ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`} />
      </div>

      {formData.revenuBrutAnnuel && formData.depensesAnnuelles && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex justify-between items-center mt-4 shadow-sm">
          <div>
             <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Revenu Net (RNE)</p>
             <p className="text-2xl font-black text-green-900">${(parseInt(formData.revenuBrutAnnuel, 10) - parseInt(formData.depensesAnnuelles, 10)).toLocaleString('fr-CA')}</p>
          </div>
          <div className="text-right">
             <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Ratio Dépenses</p>
             <p className="text-xl font-bold text-green-800">{((parseInt(formData.depensesAnnuelles, 10) / parseInt(formData.revenuBrutAnnuel, 10)) * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderConditionSlide = () => {
    const isImmeuble = formData.proprietyType === 'immeuble_revenus';
    
    const renoOptions = isImmeuble 
      ? ['toiture', 'fenetres', 'electricite', 'plomberie', 'balcons', 'maconnerie']
      : ['toiture', 'systeme_hvac', 'electricite', 'plomberie', 'facade', 'stationnement'];

    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">État général de la bâtisse *</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {etatsGeneraux.map((etat) => (
              <button key={etat.value} type="button" onClick={() => handleChange('etatGeneral', etat.value)} className={`p-3 rounded-xl transition border-2 text-sm font-bold flex items-center justify-center gap-2 ${formData.etatGeneral === etat.value ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 border-gray-200 hover:border-indigo-300 text-gray-700'}`}>
                {etat.icon} {etat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <label className="block text-sm font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">Investissements / Rénovations effectuées</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renoOptions.map((reno) => (
              <label key={reno} className="flex items-center cursor-pointer text-sm font-medium text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 hover:border-indigo-200 transition-colors">
                <input type="checkbox" checked={formData.renovations?.includes(reno)} onChange={(e) => {
                    if (e.target.checked) handleChange('renovations', [...(formData.renovations || []), reno]);
                    else handleChange('renovations', (formData.renovations || []).filter((r) => r !== reno));
                  }} className="mr-3 w-5 h-5 cursor-pointer accent-indigo-600 rounded border-gray-300" />
                <span className="capitalize">{reno.replace('_', ' ').replace('fenetres', 'fenêtres')}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDetailsSlide = () => (
    <div className="space-y-4">
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm text-amber-900 text-sm leading-relaxed">
        <strong>Conseil de pro :</strong> Indiquez toute particularité (baux long terme, locataires majeurs, zonage spécial, contraintes environnementales) pour affiner l'évaluation de l'IA.
      </div>
      <div>
        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
          Notes additionnelles
        </label>
        <textarea placeholder="Ex: Bail de la pharmacie renouvelé jusqu'en 2030, Toiture refaite en 2023..." value={formData.notes_additionnelles} onChange={(e) => handleChange('notes_additionnelles', e.target.value)} rows={5} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm placeholder:text-gray-400 shadow-sm" />
      </div>
    </div>
  );

  // ============================================
  // RENDERERS DE RESULTATS (STYLE VIBRANT & SAAS)
  // ============================================

  const renderHeroValuation = () => {
    const est = selectedProperty.estimationActuelle || {};
    return (
      <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-indigo-200">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative p-8 md:p-12 text-white">
          <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
             <div>
                <p className="text-sm md:text-base font-bold text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="text-2xl">🏢</span> Valeur Commerciale Estimée
                </p>
                <h2 className="text-5xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-100 drop-shadow-sm">
                  {est.valeurMoyenne ? `$${est.valeurMoyenne.toLocaleString('fr-CA')}` : 'N/A'}
                </h2>
             </div>
             
             <div className="flex flex-col items-end gap-3">
                 {est.confiance && (
                    <div className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-3">
                        <span className="text-2xl">🎯</span>
                        <div>
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider leading-none">Confiance IA</p>
                          <p className="font-black text-lg text-white capitalize leading-none mt-1">{est.confiance}</p>
                        </div>
                    </div>
                 )}
                 <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl transition-all font-bold text-sm">
                    <span role="img" aria-label="share">🔗</span> Partager
                 </button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 backdrop-blur-md p-5 rounded-2xl border border-white/5 shadow-inner">
              <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-1">Valeur basse (📉)</p>
              <p className="text-2xl font-black">{est.valeurBasse ? `$${est.valeurBasse.toLocaleString('fr-CA')}` : 'N/A'}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border-2 border-indigo-400/50 shadow-[0_0_30px_rgba(99,102,241,0.2)] transform md:-translate-y-2">
              <p className="text-xs text-white font-bold uppercase tracking-wider mb-1 text-center">Cible Médiane (💎)</p>
              <p className="text-3xl font-black text-center text-white">{est.valeurMoyenne ? `$${est.valeurMoyenne.toLocaleString('fr-CA')}` : 'N/A'}</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-md p-5 rounded-2xl border border-white/5 shadow-inner">
              <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-1">Valeur haute (📈)</p>
              <p className="text-2xl font-black">{est.valeurHaute ? `$${est.valeurHaute.toLocaleString('fr-CA')}` : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProspectionAvis = () => {
    const opti = selectedProperty.potentielOptimisation;
    if (!opti) return null;

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-indigo-200 rounded-3xl p-6 md:p-8 shadow-md text-gray-800 transform hover:scale-[1.01] transition-transform">
        <h3 className="text-xl md:text-2xl font-black mb-6 text-indigo-900 flex items-center gap-3">
          <span className="bg-white p-2 rounded-xl text-2xl shadow-sm">🕵️‍♂️</span> Verdict Prospection (Le Deal)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/80 p-5 rounded-2xl border border-white shadow-sm">
            <p className="text-indigo-600 text-sm uppercase tracking-wide font-bold mb-1">Avis de l'IA</p>
            <p className="text-xl font-bold text-gray-900">{opti.avisProspection}</p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
            <p className="text-emerald-700 text-sm uppercase tracking-wide font-bold mb-1">Valeur potentielle (Après opti.)</p>
            <p className="text-2xl font-black text-emerald-600">
              {opti.valeurApresTravaux ? `$${opti.valeurApresTravaux.toLocaleString('fr-CA')}` : 'N/A'}
            </p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Marge de sécurité / ROI visé: {opti.margeSecurite}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderCommercialMetrics = () => {
    const m = selectedProperty.metriquesCommerciales || {};
    const analyseData = selectedProperty.analyse || {};
    
    if (!m.capRate && !m.noiAnnuel) return null;
    
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
        <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
           <span className="bg-indigo-50 text-indigo-600 p-2 rounded-xl text-2xl shadow-sm">📊</span> Métriques Financières
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {typeof m.capRate === 'number' && (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cap Rate</p>
              <p className="text-3xl font-black text-indigo-600">{m.capRate.toFixed(2)}%</p>
            </div>
          )}
          {typeof m.noiAnnuel === 'number' && (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">RNE Annuel</p>
              <p className="text-3xl font-black text-emerald-600">${m.noiAnnuel.toLocaleString('fr-CA')}</p>
            </div>
          )}
          {typeof m.cashOnCash === 'number' && m.cashOnCash > 0 && (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-purple-200 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cash-on-Cash</p>
              <p className="text-3xl font-black text-purple-600">{m.cashOnCash.toFixed(2)}%</p>
            </div>
          )}
          {typeof m.multiplicateurRevenu === 'number' && m.multiplicateurRevenu > 0 && (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-orange-200 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">MRB</p>
              <p className="text-3xl font-black text-orange-600">{m.multiplicateurRevenu.toFixed(2)}x</p>
            </div>
          )}
        </div>

        {typeof analyseData.appreciationTotale === 'number' && (
          <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between bg-emerald-50/50 p-5 rounded-2xl">
             <div>
                <p className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Plus-Value Estimée (Gain)</p>
                <p className="text-xs text-emerald-600 mt-1 font-medium">Depuis l'acquisition</p>
             </div>
             <div className="text-right">
                <p className={`text-3xl font-black ${analyseData.appreciationTotale >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {analyseData.appreciationTotale >= 0 ? '+' : ''}${analyseData.appreciationTotale.toLocaleString('fr-CA')}
                </p>
             </div>
          </div>
        )}
      </div>
    );
  };

  const renderCommercialSecteurAndComparables = () => {
    const analyse = selectedProperty.analyse || {};
    const comparables = selectedProperty.comparables || [];

    return (
      <div className="space-y-6">
        {(analyse.secteurAnalysis || analyse.analyseSecteur) && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <h3 className="text-xl md:text-2xl font-black text-amber-900 mb-4 flex items-center gap-3">
              <span className="bg-white p-2 rounded-xl text-2xl shadow-sm">📍</span> Analyse du Secteur
            </h3>
            <p className="text-amber-900/80 leading-relaxed text-sm md:text-base whitespace-pre-wrap text-justify font-medium">
              {analyse.secteurAnalysis || analyse.analyseSecteur}
            </p>
          </div>
        )}

        {comparables.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
             <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                <span className="bg-indigo-50 p-2 rounded-xl text-2xl shadow-sm">🏢</span> Propriétés Comparables
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {comparables.map((comp, idx) => (
                   <div key={idx} className="border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-gray-50/50">
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${comp.statut?.toLowerCase() === 'vendu' ? 'bg-slate-400' : 'bg-green-500'}`}></div>
                      
                      <div className="flex justify-between items-start mb-4 pl-2">
                         <div className="pr-4">
                            <p className="font-bold text-gray-900 text-sm md:text-base leading-snug">{comp.adresse}</p>
                            <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">{comp.date}</p>
                         </div>
                         <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0 border shadow-sm ${comp.statut?.toLowerCase() === 'vendu' ? 'bg-white text-slate-600 border-slate-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                           {comp.statut}
                         </span>
                      </div>
                      
                      <p className="text-3xl font-black text-indigo-900 mb-4 pl-2 tracking-tight">
                         {typeof comp.prix === 'number' && comp.prix > 0 ? `$${comp.prix.toLocaleString('fr-CA')}` : 'Non affiché'}
                      </p>
                      
                      <div className="bg-white rounded-xl p-4 text-sm text-gray-600 mb-5 ml-2 border border-gray-100 shadow-inner font-medium">
                         {comp.caracteristiques}
                      </div>

                      {comp.url && comp.url !== "null" && (
                         <div className="pl-2">
                           <a href={comp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition-all shadow-sm shadow-indigo-200">
                              Consulter l'annonce
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                           </a>
                         </div>
                      )}
                   </div>
                ))}
             </div>
          </div>
        )}
      </div>
    );
  };

  const renderCommercialFacteursPrix = () => {
    const f = selectedProperty.facteursPrix || selectedProperty.facteurs_prix || {};
    const positives = f.augmentent || f.positifs || [];
    const negatives = f.diminuent || f.negatifs || [];
    const incertitudes = f.incertitudes || [];
    
    if (!positives.length && !negatives.length && !incertitudes.length) return null;
    
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
        <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
          <span className="bg-slate-100 p-2 rounded-xl text-2xl shadow-sm">⚖️</span> Facteurs de Valeur
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {incertitudes.length > 0 && (
             <div className="md:col-span-2 bg-amber-50/80 border border-amber-200 rounded-2xl p-6">
               <p className="font-black text-amber-800 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                 ⚠️ Incertitudes & Risques perçus
               </p>
               <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {incertitudes.map((item, idx) => (
                   <li key={idx} className="flex gap-3 text-sm text-amber-900 font-medium">
                     <span className="shrink-0 text-amber-500">•</span>
                     <span className="leading-snug">{item}</span>
                   </li>
                 ))}
               </ul>
             </div>
          )}
          {positives.length > 0 && (
            <div className="bg-white border border-green-200 rounded-2xl p-6 shadow-sm">
              <p className="font-black text-green-700 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                ✅ Points Forts (+)
              </p>
              <ul className="space-y-3">
                {positives.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                    <span className="text-green-500 font-bold flex-shrink-0 mt-0.5">+</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {negatives.length > 0 && (
            <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
              <p className="font-black text-red-700 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                ❌ Désuétude & Points Faibles (-)
              </p>
              <ul className="space-y-3">
                {negatives.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                    <span className="text-red-500 font-bold flex-shrink-0 mt-0.5">-</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRecommendations = () => {
    const r = selectedProperty.recommendations || selectedProperty.recommandation || {};
    if (!r) return null;

    const renovations = r.ameliorationsValeur || r.renovationsRentables || [];
    const strategy = r.strategie || r.strategieVente;
    const optRevenus = r.optimisationRevenu || [];
    const redDepenses = r.reduceExpenses || [];

    return (
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-3xl p-6 md:p-8 shadow-sm">
        <h3 className="text-2xl font-black text-indigo-900 mb-8 flex items-center gap-3">
           <span className="bg-white p-2 rounded-xl text-2xl shadow-sm">💡</span> Recommandations & Stratégie
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {renovations.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-indigo-50 shadow-sm">
              <p className="font-black text-indigo-900 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                🔨 Rénovations à haut ROI
              </p>
              <ul className="space-y-3">
                {renovations.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                    <span className="text-indigo-500 font-bold flex-shrink-0">»</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {optRevenus.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-emerald-50 shadow-sm">
              <p className="font-black text-emerald-900 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                💰 Optimisation Revenus
              </p>
              <ul className="space-y-3">
                {optRevenus.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                    <span className="text-emerald-500 font-bold flex-shrink-0">$</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {redDepenses.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-blue-50 shadow-sm">
              <p className="font-black text-blue-900 mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                📉 Réduction Dépenses
              </p>
              <ul className="space-y-3">
                {redDepenses.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                    <span className="text-blue-500 font-bold flex-shrink-0">🔻</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {strategy && (
          <div className="bg-white rounded-2xl p-6 md:p-8 border border-indigo-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
            <p className="font-black text-indigo-900 mb-4 text-sm uppercase tracking-widest">
                📋 Stratégie de Marché Conseillée
            </p>
            <p className="text-sm md:text-base text-gray-700 leading-loose whitespace-pre-line text-justify font-medium">{strategy}</p>
          </div>
        )}

        {(r.timing || r.venteMeilleuresChances) && (
          <div className="mt-6 bg-white/60 p-6 rounded-2xl border border-indigo-200/50">
            <p className="font-black text-indigo-800 mb-3 text-xs uppercase tracking-widest">⏳ Timing / Fenêtre de vente</p>
            <div className="space-y-3">
               {r.timing && <p className="text-sm text-gray-800 font-medium leading-relaxed">{r.timing}</p>}
               {r.venteMeilleuresChances && <p className="text-sm text-gray-800 font-medium leading-relaxed">{r.venteMeilleuresChances}</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- RENDU DU CHATBOT CORRIGÉ ---
  const renderChatHeader = () => (
    <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-6 md:p-8 rounded-3xl shadow-lg mb-8 flex flex-col md:flex-row items-center justify-between gap-4 text-white">
      <div>
        <h2 className="text-2xl font-black flex items-center gap-2">
          🤖 Discuter de cet actif avec l'IA
        </h2>
        <p className="text-indigo-200 mt-1 text-sm md:text-base">
          Posez des questions sur le Cap Rate, le financement ou la stratégie d'optimisation (Value-Add).
        </p>
      </div>
      
      {hasPremiumAccess ? (
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
        >
          {isChatOpen ? 'Fermer le chat' : '💬 Ouvrir le Stratège IA'}
        </button>
      ) : (
        <button 
          onClick={() => alert("Redirection vers la page d'upgrade (À implémenter !)")}
          className="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
        >
          🔒 Débloquer avec Pro/Growth
        </button>
      )}
    </div>
  );

  const renderChatWindow = () => {
    if (!isChatOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] w-full h-[100dvh] flex flex-col bg-white overflow-hidden md:inset-auto md:bottom-8 md:right-8 md:w-[400px] md:h-[600px] md:max-h-[80vh] md:rounded-2xl shadow-2xl md:border md:border-gray-200">
        
        {/* Header du chat */}
        <div className="bg-indigo-900 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl md:text-3xl">🤖</span>
            <div>
              <h3 className="font-bold text-sm md:text-base">Stratège Commercial IA</h3>
              <p className="text-xs text-indigo-300">Analyse en direct</p>
            </div>
          </div>
          <button onClick={() => setIsChatOpen(false)} className="text-indigo-200 hover:text-white p-2 text-xl font-bold rounded-lg hover:bg-white/10 transition">✕</button>
        </div>

        {/* Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {chatMessages.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-12 px-6">
              Posez-moi vos questions sur le financement multi-logement, la rentabilité de ce projet ou les loyers du marché.
            </div>
          )}
          
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
              }`}
              style={{ 
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="p-4 bg-white border border-gray-200 rounded-2xl rounded-bl-none flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Formulaire & Input */}
        <form onSubmit={sendChatMessage} className="p-3 md:p-4 bg-white border-t border-gray-100 shrink-0 pb-safe">
          <div className="relative">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Écrivez votre question ici..." 
              className="w-full bg-gray-100 border-transparent rounded-xl py-3.5 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-base md:text-sm transition-all"
              disabled={isChatLoading}
            />
            <button 
              type="submit" 
              disabled={isChatLoading || !chatInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <>
     <LoadingSpinner isLoading={loading} messages={loadingMessages} estimatedTime={130} type="commercial" /> 
      

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col border border-gray-100">
            <div className="sticky top-0 bg-white px-8 py-6 border-b border-gray-100 z-10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 mb-1 flex items-center gap-3">
                    <span className="text-3xl filter drop-shadow-sm">{activeSlides[currentSlide].icon}</span> 
                    {activeSlides[currentSlide].title}
                  </h2>
                  <p className="text-gray-500 font-medium">{activeSlides[currentSlide].description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setCurrentSlide(0); setSlideErrors({}); }}
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${slideProgress}%` }} />
                </div>
                <span className="text-indigo-600 text-xs font-black uppercase tracking-wider whitespace-nowrap">
                  Étape {currentSlide + 1} / {activeSlides.length}
                </span>
              </div>
            </div>

            <div className="px-8 py-8 flex-1">
              <div className="mb-2">
                {activeSlides[currentSlide].id === 'profil' && renderProfilSlide()}
                {activeSlides[currentSlide].id === 'location' && renderLocationSlide()}
                {activeSlides[currentSlide].id === 'acquisition' && renderAcquisitionSlide()}
                {activeSlides[currentSlide].id === 'dimensions' && renderDimensionsSlide()}
                {activeSlides[currentSlide].id === 'specific' && renderSpecificSlide()}
                {activeSlides[currentSlide].id === 'financial' && renderFinancialSlide()}
                {activeSlides[currentSlide].id === 'condition' && renderConditionSlide()}
                {activeSlides[currentSlide].id === 'details' && renderDetailsSlide()}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl mt-6 text-red-700 text-sm flex items-start gap-3">
                  <span className="text-xl">❌</span>
                  <div><p className="font-black">Erreur lors de l'évaluation</p><p className="mt-1">{error}</p></div>
                </div>
              )}

              {Object.keys(slideErrors).length > 0 && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl mt-6 text-orange-700 text-sm flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="font-black">Champs obligatoires manquants</p>
                    <ul className="mt-2 space-y-1 font-medium">
                      {Object.entries(slideErrors).map(([field]) => {
                        const labels = { ville: 'Ville', proprietyType: 'Type de propriété', anneeConstruction: 'Année de construction', revenuBrutAnnuel: 'Revenus bruts annuels', depensesAnnuelles: 'Dépenses annuelles', etatGeneral: 'État de la bâtisse', userType: 'Votre profil' };
                        return <li key={field}>• {labels[field] || field}</li>;
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-8 py-5 border-t border-gray-200 flex justify-between gap-4 rounded-b-3xl">
              {currentSlide > 0 ? (
                <button type="button" onClick={previousSlide} className="px-6 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-all shadow-sm" disabled={loading}>
                  ← Retour
                </button>
              ) : <div />}
              <button type="button" onClick={nextSlide} disabled={loading} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {loading ? <><span className="animate-spin">⟳</span> Traitement...</> : currentSlide === activeSlides.length - 1 ? <>🚀 Lancer l'Évaluation</> : <>Continuer →</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CTA NO FORM */}
      {!showForm && !selectedProperty && !loading && (
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={isButtonDisabled}
            className={`px-10 py-5 font-black text-xl rounded-2xl shadow-xl transform hover:-translate-y-1 transition-all w-full max-w-lg mx-auto flex flex-col items-center justify-center gap-2 ${
              isButtonDisabled ? 'bg-gray-200 text-gray-500 cursor-not-allowed border-2 border-gray-300' : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:shadow-indigo-300/50'
            }`}
          >
            {isButtonDisabled ? (
               <><span>❌ Quota épuisé</span><span className="text-sm font-medium opacity-80">Passez à un forfait supérieur</span></>
            ) : (
               <><span>🚀 Nouvelle Évaluation Commerciale</span></>
            )}
          </button>
        </div>
      )}

      {/* RESULTS */}
      {selectedProperty && (
        <div ref={resultRef} className="space-y-8 mt-8 pb-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
          
          {/* NOUVEAU: Encadré Chatbot en haut des résultats */}
          {renderChatHeader()}
          
          {renderHeroValuation()}
          {selectedProperty.potentielOptimisation && renderProspectionAvis()}
          {renderCommercialMetrics()}
          {renderCommercialSecteurAndComparables()}
          {renderCommercialFacteursPrix()}
          {renderRecommendations()}

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 py-8 border-t border-gray-200">
            <button type="button" onClick={handleShare} className="w-full sm:w-auto px-8 py-4 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-black rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2">
              <span role="img" aria-label="share">🔗</span> Partager les résultats
            </button>
            <button type="button" onClick={() => { 
                setSelectedProperty(null); 
                setShowForm(false); 
                setCurrentSlide(0); 
                setIsChatOpen(false); // Reset du chatbot au redémarrage
              }} className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-800 font-bold rounded-xl transition-colors shadow-sm">
              ← Nouvelle évaluation
            </button>
          </div>
        </div>
      )}

      {/* Fenêtre de Chat flottante */}
      {renderChatWindow()}
    </>
  );
}

//CHAT TAB




// Composant MessageBubble manquant - à créer séparément

// ============================================
// 🏠 HOME PAGE (Code existant inchangé)
// ============================================

//--- ANIMATION HOME PAGE --- 

function AnimatedBlob() {
  return (
    <>
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -30px); }
          66% { transform: translate(-20px, 20px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-40px, 20px); }
          66% { transform: translate(30px, -40px); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(20px, 40px); }
          66% { transform: translate(-30px, -20px); }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        .blob-float-1 {
          animation: float1 8s ease-in-out infinite;
        }
        .blob-float-2 {
          animation: float2 10s ease-in-out infinite;
        }
        .blob-float-3 {
          animation: float3 9s ease-in-out infinite;
        }
        .fade-in-up {
          animation: fadeInUp 1s ease-out forwards;
          opacity: 0;
        }
        .slide-in-left {
          animation: slideInLeft 1s ease-out forwards;
          opacity: 0;
        }
        .slide-in-right {
          animation: slideInRight 1s ease-out forwards;
          opacity: 0;
        }
        .card-hover {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .card-hover:hover {
          transform: translateY(-8px) scale(1.02);
        }
        .glow-on-hover {
          position: relative;
          overflow: hidden;
        }
        .glow-on-hover::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }
        .glow-on-hover:hover::after {
          opacity: 1;
        }
        
        /* Particle background styles */
        .particle-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        
        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.8) 0%, rgba(99, 102, 241, 0) 70%);
          border-radius: 50%;
          filter: blur(0.5px);
        }
        
        .particle.blue {
          background: radial-gradient(circle, rgba(56, 189, 248, 0.6) 0%, rgba(56, 189, 248, 0) 70%);
        }
        
        .particle.purple {
          background: radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, rgba(139, 92, 246, 0) 70%);
        }
        
        .particle-line {
          position: absolute;
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(99, 102, 241, 0.3), transparent);
          pointer-events: none;
        }
      `}</style>
    </>
  );
}

function ParticleBackground() {
  const containerRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create particles
    const particleCount = 40;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const colors = ['', 'blue', 'purple'];
      particle.className = `particle ${colors[Math.floor(Math.random() * colors.length)]}`;
      
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const duration = 4 + Math.random() * 6;
      const delay = Math.random() * 2;
      
      particle.style.left = x + '%';
      particle.style.top = y + '%';
      particle.style.animation = `float ${duration}s ease-in-out ${delay}s infinite`;
      particle.style.width = (2 + Math.random() * 4) + 'px';
      particle.style.height = particle.style.width;
      
      containerRef.current.appendChild(particle);
      particles.push({
        element: particle,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
      });
    }

    particlesRef.current = particles;

    // Animate particles
    let animationId;
    const animate = () => {
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > 100) p.vx *= -1;
        if (p.y < 0 || p.y > 100) p.vy *= -1;

        p.x = Math.max(0, Math.min(100, p.x));
        p.y = Math.max(0, Math.min(100, p.y));

        p.element.style.left = p.x + '%';
        p.element.style.top = p.y + '%';
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      containerRef.current?.querySelectorAll('.particle').forEach(p => p.remove());
    };
  }, []);

  return <div ref={containerRef} className="particle-container" />;
}


function HomePage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail('');
      setTimeout(() => setSubmitted(false), 3000);
    }
  };

  return (
    <div className="relative min-h-screen bg-white overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      <AnimatedBlob />

      {/* ==================== BACKGROUND DÉCORATIF SUBTIL ==================== */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* Motif radial */}
        <div className="absolute inset-0 opacity-[0.4] mix-blend-soft-light bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.85),_transparent_60%)]" />

        {/* Grille subtile */}
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,_rgba(148,163,184,0.25)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(148,163,184,0.25)_1px,_transparent_1px)] bg-[size:80px_80px]" />
      </div>

      {/* CONTENU */}
      <div className="relative z-10">
        {/* ==================== HEADER ==================== */}
        <header className="border-b border-gray-200 sticky top-0 z-50 bg-white/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition flex-shrink-0"
            >
              <img
                src="https://i.ibb.co/tMbhC8Sy/Minimalist-Real-Estate-Logo-1.png"
                alt="OptimiPlex Logo"
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl shadow-lg shadow-indigo-200/40 bg-white/90 p-1 flex-shrink-0"
              />
              <span className="font-black text-gray-900 text-2xl sm:text-3xl hidden sm:inline tracking-tight">
                OptimiPlex
              </span>
            </Link>

            <nav className="flex items-center space-x-2 sm:space-x-4">
              <a
                href="#features"
                className="hidden sm:inline px-4 py-2 text-gray-700 hover:text-gray-900 font-semibold transition"
              >
                Fonctionnalités
              </a>
              <a
                href="#pricing"
                className="hidden sm:inline px-4 py-2 text-gray-700 hover:text-gray-900 font-semibold transition"
              >
                Tarification
              </a>
              <Link
                to="/login"
                className="px-4 sm:px-6 py-2 text-gray-700 hover:text-gray-900 font-semibold transition"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="px-4 sm:px-6 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-indigo-300/40 transition-all"
              >
                Commencer
              </Link>
            </nav>
          </div>
        </header>

        {/* ==================== HERO SECTION ==================== */}
        <section className="relative min-h-[800px] sm:min-h-[900px] max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center flex flex-col justify-center">
          <ParticleBackground />

          {/* Badge Live Global */}
          <div className="relative z-10 inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-full mb-6 backdrop-blur-md w-fit mx-auto">
            <span className="animate-pulse">🌐</span>
            <span className="text-sm font-bold text-indigo-700 uppercase tracking-widest">
              Nouveau : Recherche Web Illimitée & Stratégies IA Live
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="relative z-10 text-3xl sm:text-5xl lg:text-7xl font-black text-gray-900 mb-6 leading-tight tracking-tight">
            Évaluez. <span className="text-indigo-600">Planifiez.</span> Optimisez.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              L'IA experte du marché Québecois!
            </span>
          </h1>

          {/* Subheadline */}
          <p className="relative z-10 text-lg sm:text-xl lg:text-2xl text-gray-600 max-w-4xl mx-auto mb-4 font-light leading-relaxed">
            Plus qu'un moteur de recherche. OptimiPlex parcourt l'intégralité du Web immobilier pour bâtir vos stratégies d'investissement, recommander des optimisations de baux et prédire les tendances avant tout le monde.
            <span className="block mt-2 font-bold text-gray-900">
              Des données en direct, des recommandations intelligentes, un plan d'action concret.
            </span>
          </p>

          {/* Trust Badges */}
          <div className="relative z-10 flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 mt-8 text-sm text-gray-600 mb-12">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">⚡</span>
              <span>Marché Web Total & Live</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">🧠</span>
              <span>Stratégies & Recommandations IA</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">📈</span>
              <span>Optimisation de Cash-flow</span>
            </div>
          </div>

          {/* CTA Button */}
          <div className="relative z-10 mb-12 flex gap-3 sm:gap-4 justify-center flex-wrap">
            <Link
              to="/register"
              className="inline-block px-6 sm:px-8 lg:px-10 py-3 sm:py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 text-white rounded-xl font-bold text-base sm:text-lg shadow-[0_18px_45px_rgba(79,70,229,0.35)] hover:shadow-[0_20px_60px_rgba(56,189,248,0.5)] transform hover:-translate-y-1 transition-all card-hover"
            >
              🚀 Créer ma Stratégie IA
            </Link>
            <Link
              to="/register"
              className="inline-block px-6 sm:px-8 lg:px-10 py-3 sm:py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold text-base sm:text-lg hover:bg-indigo-50 transform hover:-translate-y-1 transition-all card-hover"
            >
              💰 Optimiser mes revenus
            </Link>
          </div>

          {/* Hero Visual - Updated for Rent Evaluation, Property Eval & Chatbot */}
          <div className="relative z-10 mt-10 sm:mt-16">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-200/50 via-sky-200/40 to-emerald-200/40 rounded-3xl opacity-80 blur-xl" />
            <div className="relative rounded-3xl overflow-hidden border border-white/60 bg-white/80 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-gray-200/70 card-hover">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                
                {/* Card 1: Évaluateur & Optimisateur de Loyer */}
                <div className="p-5 sm:p-6 bg-white/90 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-200/40 transition card-hover text-left flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-3xl sm:text-4xl">📈</div>
                      <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">Évaluation de Loyer</span>
                    </div>
                    <h3 className="font-black text-gray-900 mb-2 text-lg sm:text-xl">
                      Optimisation des Revenus
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 leading-relaxed">
                      L'IA a comparé vos baux aux annonces actives de votre secteur et identifié un important potentiel d'optimisation.
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 mt-2">
                    <p className="text-xs font-bold text-indigo-700">Manque à gagner récupérable :</p>
                    <p className="text-sm sm:text-base font-black text-indigo-900 flex items-center gap-1">
                      <span className="text-lg">💰</span> + 1 450 $ / mois
                    </p>
                  </div>
                </div>

                {/* Card 2: Évaluateur de Propriété (NOUVEAU) */}
                <div className="p-5 sm:p-6 bg-gradient-to-br from-blue-50/80 via-white to-blue-50/50 rounded-2xl border border-blue-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-200/40 transition card-hover text-left flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-3xl sm:text-4xl">🏢</div>
                      <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">Valeur Marchande Live</span>
                    </div>
                    <h3 className="font-black text-gray-900 mb-2 text-lg sm:text-xl">
                      Évaluation de Propriété
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 leading-relaxed">
                      L'IA calcule la valeur de votre immeuble en croisant les données du marché en temps réel et l'historique des ventes récentes.
                    </p>
                  </div>
                  <div className="p-3 bg-blue-600 rounded-xl shadow-inner mt-2">
                    <p className="text-xs font-bold text-blue-100">Valeur estimée actuelle :</p>
                    <p className="text-sm sm:text-base font-black text-white flex items-center justify-between">
                      <span>1 250 000 $</span>
                      <span className="text-xs bg-blue-500 px-1.5 py-0.5 rounded font-bold text-white">+12%</span>
                    </p>
                  </div>
                </div>

                {/* Card 3: Chatbot IA Stratégique */}
                <div className="p-5 sm:p-6 bg-gradient-to-br from-emerald-100/40 via-emerald-200/30 to-emerald-50/40 rounded-2xl border-2 border-emerald-300 shadow-lg shadow-emerald-200/40 card-hover text-left flex flex-col justify-between md:col-span-2 lg:col-span-1">
                   <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-3xl sm:text-4xl">💬</div>
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">Assistant IA 24/7</span>
                    </div>
                    <h3 className="font-black text-emerald-900 mb-2 text-lg sm:text-xl">
                      Chatbot Stratégique
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-700 font-semibold mb-3">
                      Discutez avec votre assistant pour simuler des scénarios ou générer vos avis d'augmentation conformes.
                    </p>
                  </div>
                  <div className="bg-white/90 rounded-xl p-3 border border-emerald-200 shadow-sm relative mt-2">
                    <div className="absolute -left-2 -top-2 bg-emerald-500 rounded-full w-4 h-4 border-2 border-white animate-pulse"></div>
                    <p className="text-[11px] sm:text-xs text-gray-700 italic font-medium">
                      « Comment puis-je maximiser la rentabilité de l'unité #4 cette année en respectant les grilles du TAL ? »
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ==================== FEATURES SECTION ==================== */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="fade-in-up mx-auto max-w-3xl text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4 tracking-tight">
              Une intelligence qui <span className="text-indigo-600">pense stratégiquement</span>
            </h2>
            <p className="text-gray-600 text-base sm:text-lg">
              OptimiPlex ne se contente pas de trouver des données. Elle les analyse pour vous fournir des conseils d'experts et des plans d'action personnalisés.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: '🔍',
                title: 'Scan du Web Immobilier',
                description:
                  'Notre IA explore tout l\'Internet (annonces actives, articles, données publiques) pour capter chaque mouvement du marché en temps réel.',
              },
              {
                icon: '🧠',
                title: 'Recommandations Stratégiques',
                description:
                  'Recevez des conseils sur le refinancement, la rénovation rentable et l\'optimisation fiscale de vos biens.',
              },
              {
                icon: '📈',
                title: 'Plans d\'Action IA',
                description:
                  'Chaque analyse inclut un plan par étapes pour augmenter votre cash-flow et votre valeur immobilière.',
              },
              {
                icon: '📊',
                title: 'Analyses Multi-Sources',
                description:
                  'Fusion des annonces actives, des historiques de transactions et des comparables Web pour une vision à 360 degrés.',
              },
              {
                icon: '⚡',
                title: 'Intelligence Connectée',
                description:
                  "Propulsé par les derniers modèles IA capables de synthétiser des milliers d'informations en quelques secondes.",
              },
              {
                icon: '🏢',
                title: 'Gestion Commerciale Pro',
                description:
                  'Analyse prédictive des baux et des cycles de marché pour sécuriser vos investissements à long terme.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="fade-in-up p-6 sm:p-8 rounded-2xl border border-gray-200 bg-white/80 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-200/40 transition-all group cursor-pointer backdrop-blur-xl glow-on-hover card-hover"
              >
                <div className="inline-flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-indigo-100/60 border border-indigo-200 text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== PRICING SECTION ==================== */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="fade-in-up text-3xl sm:text-4xl font-black text-gray-900 text-center mb-4 tracking-tighter">
            Tarification <span className="text-indigo-600 underline decoration-indigo-200">transparente</span>
          </h2>
          <p className="fade-in-up text-lg sm:text-xl text-gray-600 text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            Débloquez la puissance de l'Intelligence Web avec nos plans flexibles.
          </p>

          {/* Passage de lg:grid-cols-3 à lg:grid-cols-4 pour inclure le plan À la carte */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-6">
            {[
              {
                name: 'Essai',
                price: 'Gratuit',
                description: 'Pour découvrir l\'interface',
                features: [
                  '1 évaluation offerte',
                  'Conseils de base',
                  'Support standard',
                ],
                highlighted: false,
                buttonText: 'Commencer',
              },
              {
                name: 'À la carte',
                price: '5$',
                period: '/ analyse',
                description: 'Pour un besoin ponctuel',
                features: [
                  'Achat par crédits',
                  'Scan Web en direct',
                  'Sans abonnement',
                  'Crédits valides à vie',
                ],
                highlighted: false,
                buttonText: 'Acheter des crédits',
              },
              {
                name: 'Pro',
                price: '29$',
                period: '/ mois',
                description: 'Le cerveau de votre parc',
                features: [
                  '30 analyses / mois',
                  'Scan du Web en direct',
                  'Transactions récentes',
                  'Recommandations IA',
                ],
                highlighted: true,
                buttonText: 'Activer l\'Intelligence',
              },
              {
                name: 'Growth',
                price: '69$',
                period: '/ mois',
                description: 'Gestionnaires experts',
                features: [
                  'Analyses illimitées',
                  'Scan Temps Réel Global',
                  'Plans d\'action IA',
                  'Support prioritaire',
                ],
                highlighted: false,
                buttonText: 'Passer à Growth',
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`fade-in-up rounded-2xl border p-6 sm:p-7 transition-all backdrop-blur-xl card-hover glow-on-hover flex flex-col ${
                  plan.highlighted
                    ? 'border-indigo-400 bg-gradient-to-b from-indigo-50/50 via-white/90 to-white shadow-2xl shadow-indigo-200/50 transform md:scale-[1.03] z-10'
                    : 'border-gray-200 bg-white/80 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-200/40'
                }`}
              >
                {plan.highlighted && (
                  <div className="mb-4 inline-block px-3 py-1 bg-indigo-600 text-white text-[10px] sm:text-xs font-black rounded-full uppercase tracking-widest animate-pulse w-fit">
                    🚀 Meilleure Valeur
                  </div>
                )}
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-600 mb-6 font-medium uppercase tracking-tight h-8">{plan.description}</p>
                <div className="mb-6 sm:mb-8">
                  <span className="text-3xl sm:text-4xl font-black text-gray-900">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-gray-600 text-xs sm:text-sm font-bold ml-1">
                      {plan.period}
                    </span>
                  )}
                </div>
                <Link
                  to="/register"
                  className={`block w-full py-3 px-4 rounded-xl font-black mb-6 sm:mb-8 text-center transition-all text-sm ${
                    plan.highlighted
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.buttonText}
                </Link>
                <ul className="space-y-3 mt-auto">
                  {plan.features.map((feature, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-gray-700 text-xs sm:text-sm"
                    >
                      <CheckCircle2 size={16} className={plan.highlighted ? "text-indigo-600 mt-0.5 shrink-0" : "text-gray-400 mt-0.5 shrink-0"} />
                      <span className={feature.includes('Pas de') ? "text-gray-400 line-through font-medium" : "font-bold text-gray-800"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== FOOTER ==================== */}
        <footer className="border-t border-gray-200 bg-white/90 py-10 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-8 sm:gap-0">
              <div className="text-center sm:text-left">
                <div className="flex items-center gap-3 justify-center sm:justify-start mb-4">
                  <img src="https://i.ibb.co/tMbhC8Sy/Minimalist-Real-Estate-Logo-1.png" className="w-10 h-10 grayscale opacity-50" alt="" />
                  <h4 className="font-black text-gray-900 text-xl tracking-tighter">
                    OptimiPlex
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 max-w-sm leading-relaxed font-medium">
                  L'intelligence artificielle immobilière qui navigue sur l'intégralité du Web pour bâtir vos stratégies de réussite.
                </p>
              </div>
              <div className="mt-4 sm:mt-0 text-center sm:text-right">
                <div className="flex gap-4 sm:gap-8 justify-center sm:justify-end mb-6 text-sm font-black text-gray-400 uppercase tracking-widest">
                  <a href="#" className="hover:text-indigo-600 transition">Contact</a>
                  <a href="#" className="hover:text-indigo-600 transition">Conditions</a>
                  <a href="#" className="hover:text-indigo-600 transition">Confidentialité</a>
                </div>
                <p className="text-gray-400 text-[11px] sm:text-xs font-bold uppercase tracking-widest">
                  &copy; 2026 OptimiPlex Intelligence Inc. Tous droits réservés.
                  <br />
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================
// LOGIN & REGISTER (Kept Simple)
// ============================================
function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const navigate = useNavigate();

  // ✅ Toggle affichage du mot de passe
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // ✅ Fonction mot de passe oublié
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      setError('Veuillez entrer votre email');
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('✅ Email de réinitialisation envoyé avec succès! Vérifiez votre boîte de réception.');
      setResetEmail('');
      setTimeout(() => {
        setShowResetForm(false);
        setResetMessage('');
      }, 3000);
    } catch (err) {
      setError('Erreur: ' + err.message);
    }
  };

  // ✅ Login Google Simplifié via Firebase
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      console.log('✅ Google Login Réussi');
      navigate('/dashboard/overview', { replace: true });
    } catch (error) {
      console.error('❌ Erreur Google:', error);
      setError("Erreur lors de la connexion Google: " + error.message);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      navigate('/dashboard/overview');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-black text-gray-900 mb-8">Connexion</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {resetMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg text-green-700">
            {resetMessage}
          </div>
        )}

        {!showResetForm ? (
          <>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full p-3 bg-white border border-gray-300 text-gray-900 rounded-lg focus:border-indigo-500 outline-none"
                required
              />
              
              {/* ✅ Champ Mot de passe avec toggle */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mot de passe"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full p-3 pr-10 bg-white border border-gray-300 text-gray-900 rounded-lg focus:border-indigo-500 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-3.5 text-gray-600 hover:text-gray-900"
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>

            <div className="mt-4">
              <button
                onClick={() => setShowResetForm(true)}
                className="w-full text-center text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
              >
                Mot de passe oublié?
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">Entrez votre email pour recevoir un lien de réinitialisation.</p>
            <input
              type="email"
              placeholder="Votre email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="w-full p-3 bg-white border border-gray-300 text-gray-900 rounded-lg focus:border-indigo-500 outline-none"
              required
            />
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
            >
              Envoyer le lien
            </button>
            <button
              type="button"
              onClick={() => setShowResetForm(false)}
              className="w-full py-3 bg-gray-300 text-gray-900 font-bold rounded-lg hover:bg-gray-400"
            >
              Retour
            </button>
          </form>
        )}

        <div className="mt-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Ou continuer avec</span>
            </div>
          </div>
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <img className="h-5 w-5" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google logo" />
            Se connecter avec Google
          </button>
        </div>

        <p className="text-center mt-6 text-gray-600">
          Pas de compte? <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold">Inscrire</Link>
        </p>
      </div>
    </div>
  );
}

function RegisterPage() {
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  // ✅ Toggle affichage du mot de passe
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // ✅ Login Google Simplifié via Firebase
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      console.log('✅ Google Register Réussi');
      navigate('/dashboard/overview', { replace: true });
    } catch (error) {
      console.error('❌ Erreur Google:', error);
      setError("Erreur lors de l'inscription Google: " + error.message);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ✅ Validation des mots de passe
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const db = getFirestore();
      const currentUser = getAuth().currentUser;
      
      await setDoc(doc(db, 'users', currentUser.uid), {
        email: formData.email,
        plan: 'essai',
        createdAt: serverTimestamp()
      });
      
      navigate('/dashboard/overview');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-black text-gray-900 mb-8">Créer un compte</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full p-3 bg-white border border-gray-300 text-gray-900 rounded-lg focus:border-indigo-500 outline-none"
            required
          />

          {/* ✅ Champ Mot de passe avec toggle */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              minLength="8"
              className="w-full p-3 pr-10 bg-white border border-gray-300 text-gray-900 rounded-lg focus:border-indigo-500 outline-none"
              required
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-3 top-3.5 text-gray-600 hover:text-gray-900"
            >
              {showPassword ? (
                <EyeOff size={20} />
              ) : (
                <Eye size={20} />
              )}
            </button>
          </div>

          {/* ✅ Champ Confirmer le mot de passe avec toggle */}
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirmer le mot de passe"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              minLength="8"
              className="w-full p-3 pr-10 bg-white border border-gray-300 text-gray-900 rounded-lg focus:border-indigo-500 outline-none"
              required
            />
            <button
              type="button"
              onClick={toggleConfirmPasswordVisibility}
              className="absolute right-3 top-3.5 text-gray-600 hover:text-gray-900"
            >
              {showConfirmPassword ? (
                <EyeOff size={20} />
              ) : (
                <Eye size={20} />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer un compte'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Ou continuer avec</span>
            </div>
          </div>
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <img className="h-5 w-5" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google logo" />
            S'inscrire avec Google
          </button>
        </div>

        <p className="text-center mt-6 text-gray-600">
          Déjà inscrit? <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================
function App() {
  return (
    // Suppression du provider React OAuth qui causait l'erreur
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard/*" element={<DashboardLayout />} />
        </Routes>
      </BrowserRouter>
  );
}

export default App;