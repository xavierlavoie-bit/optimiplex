/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable jsx-a11y/anchor-is-valid */
// App.jsx - OPTIMIPLEX avec STRIPE INTÉGRÉ

import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { initializeApp } from 'firebase/app';
import { Eye, EyeOff, Menu, ChevronRight,Trash2, X, Check, Edit2, Home, Building, DollarSign, TrendingUp, Users,
  Megaphone,
  Target,
  List,
  AlertCircle } from 'lucide-react';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail
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
  increment
} from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

// Toujours afficher pour debug
console.log('📡 Frontend API URL:', API_BASE_URL);
console.log('📡 NODE_ENV:', process.env.NODE_ENV);
console.log('📡 REACT_APP_BACKEND_URL env var:', process.env.REACT_APP_BACKEND_URL);


axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = 30000;

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
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return windowSize;
};

// ============================================
// 2️⃣ MOBILE HEADER - TOP BAR MOBILE
// ============================================
function MobileHeader({ sidebarOpen, setSidebarOpen, user, userPlan, planInfo }) {
  const windowSize = useWindowSize();
  const isMobile = windowSize.width < 768;

  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(true);
    }
  }, [isMobile, setSidebarOpen]);

  return (
    <>
      {/* Mobile Top Bar - Visible < 768px */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 transition-all duration-300 z-50 h-16 flex items-center justify-between px-4">
        <h1 className="text-lg font-black text-gray-900">OptimiPlex</h1>
        
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg transition hover:bg-gray-100"
        >
          {sidebarOpen ? (
            <X size={24} className="text-gray-900" />
          ) : (
            <Menu size={24} className="text-gray-900" />
          )}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 top-16"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Offset for mobile top bar */}
      <div className="md:hidden h-16" />
    </>
  );
}

// ============================================
// 3️⃣ SIDEBAR RESPONSIVE - DESKTOP + MOBILE
// ============================================
function ResponsiveSidebar({ sidebarOpen, setSidebarOpen, activeTab, setActiveTab, user, userPlan, planInfo, onLogout }) {
  const windowSize = useWindowSize();
  const isMobile = windowSize.width < 768;

  const navItems = [
    { id: 'overview', label: '📈 Vue d\'ensemble' },
    { id: 'optimization', label: '⚡ Optimiseur' },
    { id: 'valuation', label: '📊 Évaluation' },
    { id: 'profile', label: '👤 Mon Profil' },
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <>
      {/* Desktop Sidebar - Visible >= 768px */}
      <div className={`hidden md:block fixed left-0 top-0 h-full ${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 z-40`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <h1 className={`font-black text-gray-900 ${sidebarOpen ? 'text-lg' : 'text-sm text-center'}`}>
            {sidebarOpen ? 'OptimiPlex' : 'OP'}
          </h1>
        </div>

        {/* Navigation */}
        <nav className="py-4 space-y-2 px-4">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === id
                  ? 'bg-indigo-100 border border-indigo-300 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {sidebarOpen ? (
                <span className="font-semibold">{label}</span>
              ) : (
                <span className="text-center w-full">{label.charAt(0)}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-6 left-0 right-0 px-4 space-y-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all text-sm"
          >
            {sidebarOpen ? '← Réduire' : '→'}
          </button>
          <button
            onClick={onLogout}
            className="w-full p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-all text-sm font-semibold"
          >
            {sidebarOpen ? '🚪 Déconnexion' : '✕'}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar - Visible < 768px */}
      <nav
        className={`md:hidden fixed top-16 left-0 h-screen bg-white w-64 z-40 transform transition-transform duration-300 border-r border-gray-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        {/* User Info Mobile */}
        <div className="p-4 border-b border-gray-200">
          <p className="text-sm text-gray-600 truncate font-medium">{user?.email}</p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
            <span className="text-xs font-semibold text-blue-700">
              {planInfo[userPlan]?.name}
            </span>
          </div>
        </div>

        {/* Navigation Items Mobile */}
        <div className="py-2">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-l-4 ${
                activeTab === id
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-600'
                  : 'text-gray-700 hover:bg-gray-50 border-transparent'
              }`}
            >
              <span className="font-medium text-sm">{label}</span>
            </button>
          ))}
        </div>

        {/* Logout Mobile */}
        <div className="px-4 py-2 mt-4 border-t border-gray-200 pt-4">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium text-sm"
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
  // Vérifie si l'utilisateur revient du paiement Stripe
  const params = new URLSearchParams(window.location.search);
  const success = params.get('success');
  
  if (success === 'true' && user) {
    console.log('✅ Retour du paiement Stripe, rechargement des données...');
    
    // Recharge les données utilisateur depuis Firestore
    const db = getFirestore();
    const userDocRef = doc(db, 'users', user.uid);
    
    onSnapshot(userDocRef, (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserPlan(userData.plan || 'essai');
        setUserProfile(userData);
      }
    });

    // Nettoie l'URL
    window.history.replaceState({}, document.title, '/dashboard/profile');
    
    // Affiche un message de succès
    alert('✅ Votre plan a été mis à jour avec succès!');
    
    // Nettoie le localStorage
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
            setUserProfile(userData);
            setPlanLoaded(true);
          } else {
            const initialData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              plan: 'essai',
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

  const displayName = userProfile?.displayName || user?.email?.split('@')[0] || 'Utilisateur';
  const displayRole = userProfile?.role === 'courtier' ? 'Courtier Immobilier' : 
                      userProfile?.role === 'proprio' ? 'Propriétaire' : 
                      userProfile?.role === 'investisseur' ? 'Investisseur' : 'Membre';

 return (
  <div className="min-h-screen bg-gray-50">
    {/* 1️⃣ MOBILE HEADER */}
    <MobileHeader 
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      user={user}
      userPlan={userPlan}
      planInfo={planInfo}
    />

    {/* 2️⃣ RESPONSIVE SIDEBAR */}
    <ResponsiveSidebar
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={user}
      userPlan={userPlan}
      planInfo={planInfo}
      onLogout={handleLogout}
    />

    {/* 3️⃣ MAIN CONTENT - DESKTOP AVEC MARGIN */}
    <div className={`${sidebarOpen ? 'md:ml-64' : 'md:ml-20'} transition-all duration-300`}>
      {/* TOP HEADER - ton header actuel */}
      <header className="border-b border-gray-200 bg-white80 backdrop-blur-sm sticky top-0 z-30 hidden md:block">
        <div className="px-8 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-black text-gray-900">
            {activeTab === 'profile' ? '👤 Mon Profil' : activeTab === 'optimization' ? '⚡ Optimiseur' : activeTab === 'valuation' ? '📊 Évaluation' : '📈 Tableau de bord'}
          </h1>
          <div className="flex items-center space-x-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900">{userProfile?.displayName || user?.email?.split('@')[0]}</p>
              <p className="text-xs text-indigo-600 font-semibold">
                {userProfile?.role === 'courtier' ? 'Courtier Immobilier' : userProfile?.role === 'proprio' ? 'Propriétaire' : userProfile?.role === 'investisseur' ? 'Investisseur' : 'Membre'}
              </p>
            </div>
            <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 border border-indigo-700 text-white shadow-md">
              <span className="font-bold text-sm">{planInfo[userPlan]?.name}</span>
            </div>
          </div>
        </div>
      </header>

      {/* PLAN BANNER - ton banner actuel */}
      {activeTab !== 'profile' && (
        <div className="px-4 sm:px-8 py-6">
    <div className="relative rounded-2xl overflow-hidden shadow-lg">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500"></div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full -ml-36 -mb-36"></div>

      {/* Content */}
      <div className="relative p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 z-10">
        
        {/* Left Section - Plan Info */}
        <div className="flex-1">
          <p className="text-white/70 text-sm font-semibold mb-2 uppercase tracking-wide">Plan actuel</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">
            {planInfo[userPlan]?.name}
          </h2>
          <p className="text-white/90 text-lg font-bold">
            {planInfo[userPlan]?.price}
          </p>
        </div>

        {/* Right Section - CTA Button */}
        {userPlan !== 'premium' && (
          <button 
            onClick={() => setShowUpgradeModal(true)} 
            className="w-full sm:w-auto px-8 py-4 bg-white text-indigo-600 font-black rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 transform hover:-translate-y-1"
          >
            🚀 Upgrader
          </button>
        )}

        {userPlan === 'premium' && (
          <div className="w-full sm:w-auto px-8 py-4 bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl border border-white/30 text-center">
            ✨ Plan Premium actif
          </div>
        )}
      </div>
    </div>
  </div>
      )}

      {/* TABS CONTENT - ton contenu actuel */}
      <div className="px-8 py-6 pb-20">
        {activeTab === 'overview' && <DashboardOverview user={user} userPlan={userPlan} setActiveTab={setActiveTab} />}
        {activeTab === 'optimization' && <OptimizationTab userPlan={userPlan} user={user} setUserPlan={setUserPlan} showUpgradeModal={showUpgradeModal} setShowUpgradeModal={setShowUpgradeModal} />}
        {activeTab === 'valuation' && <PropertyValuationTab user={user} userPlan={userPlan} setUserPlan={setUserPlan} showUpgradeModal={showUpgradeModal} setShowUpgradeModal={setShowUpgradeModal} />}
        {activeTab === 'profile' && <ProfileTab user={user} userProfile={userProfile} userPlan={userPlan} />}
      </div>
    </div>

    {/* UPGRADE MODAL - ton modal actuel */}
    {showUpgradeModal && (
      <UpgradeModal user={user} userPlan={userPlan} planInfo={planInfo} setUserPlan={setUserPlan} showUpgradeModal={showUpgradeModal} setShowUpgradeModal={setShowUpgradeModal} />
    )}
  </div>
);
}

// ============================================
// ⬆️ MODAL UPGRADE avec STRIPE
// ============================================
function UpgradeModal({ user, userPlan, planInfo, setUserPlan, showUpgradeModal, setShowUpgradeModal }) {
  const [selectedPlan, setSelectedPlan] = useState(null);

  if (!showUpgradeModal) return null;

  const plans = [
    { 
      key: 'essai', 
      name: 'Essai', 
      price: 'Gratuit', 
      features: [
        '1 analyse résidentielle/mois',
        'Résidentiel basique',
        'Accès limité'
      ],
      icon: '🎯',
      color: 'blue'
    },
    { 
      key: 'pro', 
      name: 'Pro', 
      price: '$29/mois', 
      features: [
        '5 analyses résidentiel/mois',
        'Résidentiel + extras',
        'Support email',
        'Rapports détaillés'
      ],
      icon: '🚀',
      color: 'purple'
    },
    { 
      key: 'growth', 
      name: 'Growth', 
      price: '$69/mois', 
      features: [
        'Analyses illimitées',
        'Résidentiel + Commercial',
        'Support prioritaire',
        'Données avancées'
      ],
      icon: '💎',
      color: 'indigo',
      recommended: true
    },
    { 
      key: 'entreprise', 
      name: 'Entreprise', 
      price: 'Sur mesure', 
      features: [
        'Solution 100% adaptée',
        'API + White label',
        'Formation équipe incluse',
        'Support dédié 24/7',
        'Volume illimité'
      ],
      icon: '👑',
      color: 'amber'
    }
  ];

  const isDowngrade = (key) => {
    if (key === 'essai' && userPlan !== 'essai') return true;
    if (key === 'pro' && (userPlan === 'growth' || userPlan === 'entreprise')) return true;
    if (key === 'growth' && userPlan === 'entreprise') return true;
    return false;
  };

  const handleContactEnterprise = () => {
    const emailContent = `Bonjour équipe OptimiPlex,

Je suis intéressé par une **solution sur mesure** adaptée à mes besoins spécifiques:

👤 Mon profil actuel:
• Plan: ${userPlan === 'pro' ? 'Pro ($29)' : userPlan === 'growth' ? 'Growth ($69)' : userPlan === 'essai' ? 'Essai' : 'Autre'}
• Email: ${user?.email || 'non fourni'}
• Analyses/mois: [précisez votre volume actuel]

🎯 Mes besoins spécifiques:
□ Solution Entreprise complète
□ IA adaptée à mon marché [précisez: immobilier, commercial, etc.]
□ API personnalisée
□ Formation équipe [nombre personnes]
□ White label / branding
□ [Autres besoins spécifiques]

💰 Budget mensuel approximatif: [$XXX]
⏰ Délai souhaité: [MM/AAAA]

Pouvez-vous me proposer une démo / pricing adapté?

Merci!
---
${user?.email || 'contact'}`;

    navigator.clipboard.writeText(emailContent);
    window.open(
      'https://mail.google.com/mail/?view=cm&fs=1&to=info@optimiplex.com&su=Demande+Plan+Entreprise&body=' + encodeURIComponent(emailContent),
      '_blank'
    );
    setShowUpgradeModal(false);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowUpgradeModal(false);
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto border border-gray-200">
        {/* HEADER STICKY */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 md:px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl md:text-4xl font-black text-gray-900">⬆️ Upgrader votre plan</h2>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Plan actuel: <span className="font-bold uppercase">{userPlan}</span></p>
          </div>
          <button
            onClick={() => setShowUpgradeModal(false)}
            className="flex-shrink-0 ml-4 text-2xl md:text-3xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="px-4 md:px-8 py-6 md:py-8">
          {/* PLANS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
            {plans.map(({ key, name, price, features, icon, color, recommended }) => {
              const isPlanDowngrade = isDowngrade(key);
              const isCurrentPlan = userPlan === key;

              const colorClasses = {
                blue: {
                  bg: 'bg-blue-50',
                  border: 'border-blue-200',
                  active: 'bg-blue-100 border-blue-400 shadow-lg shadow-blue-200',
                  button: 'bg-blue-600 hover:bg-blue-700'
                },
                purple: {
                  bg: 'bg-purple-50',
                  border: 'border-purple-200',
                  active: 'bg-purple-100 border-purple-400 shadow-lg shadow-purple-200',
                  button: 'bg-purple-600 hover:bg-purple-700'
                },
                indigo: {
                  bg: 'bg-indigo-50',
                  border: 'border-indigo-200',
                  active: 'bg-indigo-100 border-indigo-400 shadow-lg shadow-indigo-200',
                  button: 'bg-indigo-600 hover:bg-indigo-700'
                },
                amber: {
                  bg: 'bg-amber-50',
                  border: 'border-amber-200',
                  active: 'bg-amber-100 border-amber-400 shadow-lg shadow-amber-200',
                  button: 'bg-amber-600 hover:bg-amber-700'
                }
              };

              const colors = colorClasses[color];

              return (
                <div
                  key={key}
                  className={`relative p-4 md:p-6 rounded-xl border-2 transition-all ${
                    isCurrentPlan
                      ? `${colors.active}`
                      : isPlanDowngrade
                      ? `${colors.bg} ${colors.border} opacity-60 cursor-not-allowed`
                      : `${colors.bg} ${colors.border} hover:border-${color}-400 hover:shadow-md cursor-pointer`
                  }`}
                  onClick={() => !isPlanDowngrade && !isCurrentPlan && setSelectedPlan(key)}
                >
                  {/* RECOMMENDED BADGE */}
                  {recommended && (
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg">
                      RECOMMANDÉ ⭐
                    </div>
                  )}

                  {/* ICON & NAME */}
                  <div className="mb-4">
                    <div className="text-3xl md:text-4xl mb-2">{icon}</div>
                    <h4 className="text-lg md:text-xl font-black text-gray-900">{name}</h4>
                  </div>

                  {/* PRICE */}
                  <p className={`text-xl md:text-2xl font-black mb-4`}>
                    <span className={`text-${color}-600`}>{price}</span>
                  </p>

                  {/* FEATURES */}
                  <ul className="space-y-2 text-xs md:text-sm text-gray-700 mb-6">
                    {features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold flex-shrink-0 mt-0.5">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* ACTION BUTTON */}
                  {isCurrentPlan ? (
                    <div className={`w-full py-2 md:py-3 ${colors.button} text-white rounded-lg font-bold text-center shadow-md text-sm md:text-base`}>
                      Plan actuel ✅
                    </div>
                  ) : isPlanDowngrade ? (
                    <div className="w-full py-2 md:py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-lg text-center font-semibold text-xs md:text-sm shadow-md">
                      🔒 Downgrade via annulation
                    </div>
                  ) : key === 'entreprise' ? (
                    <button
                      onClick={handleContactEnterprise}
                      className="w-full py-2 md:py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold shadow-lg hover:shadow-xl hover:from-amber-600 hover:to-orange-600 transition-all transform hover:-translate-y-0.5 text-sm md:text-base active:translate-y-0"
                    >
                      📧 Contacter
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedPlan(key)}
                      className={`w-full py-2 md:py-3 ${colors.button} text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 text-sm md:text-base active:translate-y-0`}
                    >
                      Choisir
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* CHECKOUT SECTION */}
          {selectedPlan && selectedPlan !== 'entreprise' && !isDowngrade(selectedPlan) && userPlan !== selectedPlan && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-xl p-6 md:p-8 shadow-lg">
              <h3 className="text-xl md:text-2xl font-black text-indigo-900 mb-4">
                ✅ Confirmer votre upgrade vers {plans.find(p => p.key === selectedPlan)?.name}
              </h3>
              
              <div className="mb-6 p-4 bg-white rounded-lg border border-indigo-200">
                <p className="text-sm md:text-base text-gray-700 mb-3">
                  <span className="font-bold">Récapitulatif:</span>
                </p>
                <ul className="text-sm md:text-base space-y-2 text-gray-800">
                  <li>• Plan: <span className="font-bold">{plans.find(p => p.key === selectedPlan)?.name}</span></li>
                  <li>• Email: <span className="font-bold">{user?.email}</span></li>
                  <li>• Prix: <span className="font-bold">{plans.find(p => p.key === selectedPlan)?.price}</span></li>
                </ul>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="flex-1 py-2 md:py-3 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold rounded-lg transition-colors text-sm md:text-base"
                >
                  ← Retour
                </button>
                <div className="flex-1">
                  <StripeCheckoutButton
                    plan={selectedPlan}
                    planInfo={planInfo}
                    user={user}
                    setUserPlan={setUserPlan}
                    setShowUpgradeModal={setShowUpgradeModal}
                  />
                </div>
              </div>
            </div>
          )}

          {/* FOIRE AUX QUESTIONS */}
          <div className="mt-8 md:mt-12 pt-8 md:pt-12 border-t border-gray-200">
            <h3 className="text-lg md:text-xl font-black text-gray-900 mb-6">❓ Questions fréquentes</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900 mb-2 text-sm md:text-base">Puis-je changer de plan après?</p>
                <p className="text-xs md:text-sm text-gray-700">Oui! Vous pouvez upgrader ou downgrader à tout moment. Les changements sont effectifs le mois suivant.</p>
              </div>

              <div className="bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900 mb-2 text-sm md:text-base">Aucun engagement?</p>
                <p className="text-xs md:text-sm text-gray-700">Correct! Vous pouvez annuler votre abonnement à tout moment, sans pénalité.</p>
              </div>

              <div className="bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900 mb-2 text-sm md:text-base">Quand est la facturation?</p>
                <p className="text-xs md:text-sm text-gray-700">Le paiement est débité le même jour chaque mois. Vous recevez une facture par email.</p>
              </div>

              <div className="bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900 mb-2 text-sm md:text-base">Besoin d'aide?</p>
                <p className="text-xs md:text-sm text-gray-700">Contactez support@optimiplex.com ou utilisez le chat en bas à droite.</p>
              </div>
            </div>
          </div>

          {/* FOOTER INFO */}
          <div className="mt-8 md:mt-12 text-center text-xs md:text-sm text-gray-600 py-4 border-t border-gray-200">
            <p>💳 Paiement sécurisé via Stripe | 🔒 Aucune donnée partagée</p>
            <p className="mt-2">Conditions d'utilisation • Politique de confidentialité</p>
          </div>
        </div>
      </div>
    </div>
  );
}



// ============================================
// 💳 STRIPE CHECKOUT BUTTON
// ============================================
function StripeCheckoutButton({ plan, planInfo, user, setUserPlan, setShowUpgradeModal }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      if (!planInfo[plan]?.priceId) {
        alert('Ce plan ne peut pas être acheté');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/stripe/create-checkout-session`,
        {
          userId: user.uid,
          userEmail: user.email,
          plan: plan,
          priceId: planInfo[plan].priceId
        }
      );

      if (response.data && response.data.sessionUrl) {
        // Stockez le plan visé localement avant redirection
        localStorage.setItem('pendingPlan', plan);
        window.location.href = response.data.sessionUrl;
      } else {
        throw new Error('Pas d\'URL de session reçue');
      }
    } catch (error) {
      console.error('Erreur Stripe:', error);
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCheckout} 
      disabled={loading}
      className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50"
    >
      {loading ? 'Redirection...' : `Passer à ${planInfo[plan].name}`}
    </button>
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Charger les données existantes
  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || '',
        role: userProfile.role || 'proprio',
        phone: userProfile.phone || '',
        company: userProfile.company || '',
        bio: userProfile.bio || ''
      });
    }
  }, [userProfile]);

  // Charger l'historique de facturation
  useEffect(() => {
    if (activeProfileTab === 'billing') {
      fetchBillingHistory();
    }
  }, [activeProfileTab]);

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
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Erreur update profile:', error);
      setMessage({ type: 'error', text: '❌ Erreur lors de la sauvegarde.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/stripe/cancel-subscription`, {
        userId: user.uid
      });

      // Downgrade à essai dans Firestore
      const db = getFirestore();
      await updateDoc(doc(db, 'users', user.uid), {
        plan: 'essai',
        updatedAt: serverTimestamp()
      });

      setMessage({ type: 'success', text: '✅ Abonnement annulé. Passage à plan Essai.' });
      setShowCancelModal(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Erreur annulation:', error);
      setMessage({ type: 'error', text: '❌ Erreur lors de l\'annulation.' });
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tabs Profil */}
      <div className="flex gap-4 mb-8 border-b border-gray-200">
        {[
          { id: 'info', label: '👤 Informations', icon: '✏️' },
          { id: 'billing', label: '💳 Facturation', icon: '📋' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveProfileTab(tab.id)}
            className={`px-6 py-3 font-bold transition-all ${
              activeProfileTab === tab.id
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Informations */}
      {activeProfileTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Carte Identité */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-indigo-500 to-blue-600"></div>
              <div className="px-6 pb-6 text-center relative">
                <div className="w-24 h-24 mx-auto bg-white rounded-full p-1 -mt-12 shadow-md">
                  <div className="w-full h-full bg-indigo-100 rounded-full flex items-center justify-center text-3xl">
                    {formData.displayName ? formData.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>
                </div>
                <h3 className="mt-4 text-xl font-black text-gray-900">
                  {formData.displayName || 'Utilisateur'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">{user.email}</p>
                <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wide mb-4">
                  {formData.role === 'courtier' ? 'Courtier' : 
                   formData.role === 'investisseur' ? 'Investisseur' : 'Propriétaire'}
                </div>
                <div className="border-t border-gray-100 pt-4 text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Plan</span>
                    <span className="font-semibold text-gray-900 capitalize">{userProfile?.plan || 'Essai'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Formulaire */}
          <div className="md:col-span-2">
            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                ✏️ Modifier mes informations
              </h3>

              {message.text && (
                <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6">
                {/* Rôle */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Je suis principalement...</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { val: 'proprio', label: '🏠 Propriétaire' },
                      { val: 'courtier', label: '👔 Courtier' },
                      { val: 'investisseur', label: '📈 Investisseur' }
                    ].map((opt) => (
                      <div
                        key={opt.val}
                        onClick={() => setFormData({...formData, role: opt.val})}
                        className={`cursor-pointer px-4 py-3 rounded-lg border-2 text-center transition-all ${
                          formData.role === opt.val
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                            : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                        }`}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nom */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nom complet</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                    placeholder="Ex: Jean Dupont"
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                {/* Téléphone & Compagnie */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="(514) 123-4567"
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entreprise</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({...formData, company: e.target.value})}
                      placeholder="Ex: Remax..."
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bio courte</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    placeholder="Parlez un peu de vous..."
                    rows="3"
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg hover:shadow-indigo-200 transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {loading ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: Facturation */}
      {activeProfileTab === 'billing' && (
        <BillingTab 
          user={user} 
          userPlan={userPlan} 
          billingHistory={billingHistory}
          loadingBilling={loadingBilling}
          showCancelModal={showCancelModal}
          setShowCancelModal={setShowCancelModal}
          cancelLoading={cancelLoading}
          handleCancelSubscription={handleCancelSubscription}
          message={message}
        />
      )}
    </div>
  );
}

// ============================================
// 💳 BILLING TAB
// ============================================
function BillingTab({ user, userPlan, billingHistory, loadingBilling, 
                     showCancelModal, setShowCancelModal, cancelLoading, 
                     handleCancelSubscription, message }) {
  
  const [portalLoading, setPortalLoading] = useState(false);
  const planInfo = {
    essai: { name: 'Essai', price: 'Gratuit' },
    pro: { name: 'Pro', price: '29$/mois' },
    growth: { name: 'Growth', price: '69$/mois' },
    premium: { name: 'Premium', price: 'Custom' }
  };

  // ✅ NOUVEAU : Portail Stripe
  const handlePortalRedirect = async () => {
    setPortalLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/stripe/create-portal-session`,
        {
          userId: user.uid,
          returnUrl: window.location.origin + '/dashboard/profile'
        }
      );
      window.location.href = response.data.url;
    } catch (error) {
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Plan actuel */}
      <div className="bg-gradient-to-r from-indigo-100 to-blue-100 rounded-xl p-8 border border-indigo-300">
        <h3 className="text-2xl font-black text-indigo-900 mb-6">Votre plan actuel</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-indigo-700 mb-2">Plan</p>
            <p className="text-3xl font-black text-indigo-900">{planInfo[userPlan]?.name}</p>
            <p className="text-lg text-indigo-700 mt-2">{planInfo[userPlan]?.price}</p>
          </div>
          
          {userPlan !== 'essai' && (
            <div className="flex gap-3">
              
              {/* ✅ PORTAIL STRIPE */}
              <button 
                onClick={handlePortalRedirect}
                disabled={portalLoading}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {portalLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Ouverture...
                  </>
                ) : (
                  <>
                    💳 Gérer le paiement
                  </>
                )}
              </button>
              
            </div>
          )}
        </div>
      </div>

      {/* Historique facturation (inchangé) */}
      <div>
        <h3 className="text-2xl font-black text-gray-900 mb-6">Historique de facturation</h3>
        {loadingBilling ? (
          <div className="text-center py-12">
            <div className="animate-spin text-4xl mb-4"></div>
            <p className="text-gray-600">Chargement...</p>
          </div>
        ) : billingHistory?.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-6xl mb-4"></div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Aucune facture</h3>
            <p className="text-gray-600 mb-6">Votre historique apparaîtra ici</p>
          </div>
        ) : (
          <div className="space-y-3">
            {billingHistory?.map((invoice, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between hover:border-indigo-400 transition-all">
                <div>
                  <p className="font-bold text-gray-900">Facture #{invoice.number || invoice.id}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(invoice.created * 1000).toLocaleDateString('fr-CA')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-gray-900 text-lg">
                    {invoice.amount_paid / 100}.00$
                  </p>
                  <p className="text-xs text-gray-600 capitalize">{invoice.status}</p>
                </div>
                {invoice.invoice_pdf && (
                  <a 
                    href={invoice.invoice_pdf} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-4 px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-200 transition-all"
                  >
                    📄 Télécharger
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



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

  // ============================================
  // CHARGER LES ANALYSES
  // ============================================
  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!user?.uid) return;
      try {
        const db = getFirestore();
        const allData = [];

        // Helper pour charger une collection de manière sécurisée
        const fetchCollection = async (collName, typeOverride) => {
          try {
            const ref = collection(db, 'users', user.uid, collName);
            const snap = await getDocs(query(ref));
            snap.docs.forEach(doc => {
              allData.push({
                id: doc.id,
                collection: collName,
                proprietype: typeOverride, // force le type si connu par la collection
                ...doc.data()
              });
            });
          } catch (e) {
            console.log(`Info: Collection ${collName} vide ou inaccessible`);
          }
        };

        await fetchCollection('analyses');
        await fetchCollection('evaluations', 'residential');
        await fetchCollection('evaluations_commerciales', 'commercial');

        // Trier par date décroissante
        const data = allData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.timestamp || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.timestamp || 0);
          return dateB - dateA;
        });

        setAnalyses(data);

        // Calculer les stats
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
  // ACTIONS (EDIT / DELETE)
  // ============================================
  const handleDelete = async (analysisId, collectionName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette analyse?')) return;

    setDeletingId(analysisId);
    try {
      const db = getFirestore();
      // Fallback sur 'analyses' si collectionName est vide (pour compatibilité)
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

  // ============================================
  // UTILITAIRES D'AFFICHAGE
  // ============================================
  const formatCurrency = (val) => val ? Math.round(val).toLocaleString('fr-CA') : '0';

  const getAnalysisType = (analyse) => {
    if (analyse.result?.estimationActuelle?.valeurMoyenne) return 'valuation';
    return 'optimization';
  };

  const isCommercial = (analyse) => {
    const type = analyse.proprietype || analyse.proprietetype || '';
    return type === 'commercial' || 
           analyse.collection === 'evaluations_commerciales' || 
           ['immeuble_revenus', 'hotel', 'depanneur', 'bureau', 'commerce', 'restaurant'].includes(type);
  };

  const getPropertyIcon = (type) => {
    const t = (type || '').toLowerCase();
    const icons = {
      unifamilial: '🏠',
      jumelee: '🏘️',
      duplex: '🏢',
      triplex: '🏢',
      '4plex': '🏗️',
      condo: '🏙️',
      immeuble_revenus: '🏗️',
      hotel: '🏨',
      depanneur: '🏪',
      restaurant: '🍽️',
      bureau: '📋',
      commerce: '🛍️',
      terrain_commercial: '🌳',
      terrain: '🌳',
      residential: '🏠',
      commercial: '🏢'
    };
    
    if (icons[t]) return icons[t];
    
    // Fallback logic
    if (t.includes('hotel') || t.includes('commercial') || t.includes('revenu') || t.includes('bureau')) {
      return '🏢';
    }
    return '🏠';
  };

  const getPropertyLabel = (analyse) => {
    return analyse.titre || analyse.typeappart || analyse.proprietetype || 'Propriété';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p className="text-gray-600">Chargement de vos données...</p>
        </div>
      </div>
    );
  }

  // Variables pour la modale (extraction sécurisée des données)
  const renderModalContent = () => {
    if (!selectedAnalysis) return null;

    const result = selectedAnalysis.result || {};
    const type = getAnalysisType(selectedAnalysis);
    const isValuation = type === 'valuation';
    const isCom = isCommercial(selectedAnalysis);

    // Extraction robuste des données
    const facteurs = result.facteursPrix || result.facteurs_prix || {};
    const comparable = result.comparable || {};
    const qualiteEval = comparable.evaluationQualite || comparable.evaluation_qualite;
    
    // Supporte les deux formats de clés pour les recommandations
    const recs = result.recommendations || result.recommandation || {};
    
    // Données spécifiques optimisation
    const marketAnalysis = result.marketanalysis || {};
    const marketingKit = result.marketingkit || {};
    
    // Données spécifiques évaluation
    const metrics = result.metriquesCommerciales || {};
    const analyseData = result.analyse || {};
    
    // Texte d'analyse (quartier ou secteur)
    const textAnalysis = analyseData.quartierAnalysis || analyseData.secteurAnalysis;

    return (
      <div className="p-8 space-y-8">
        {/* INFO PROPRIÉTÉ */}
        <div className={`rounded-2xl p-6 border-2 ${isValuation ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <h4 className="font-black text-gray-900 text-lg mb-4 flex items-center gap-2">
            <span className="text-2xl">{getPropertyIcon(selectedAnalysis.proprietype || selectedAnalysis.proprietetype)}</span> Propriété
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-600 font-semibold mb-1">Titre</p>
              <p className="text-gray-900 font-bold">{getPropertyLabel(selectedAnalysis)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold mb-1">Localisation</p>
              <p className="text-gray-900 font-bold">{selectedAnalysis.ville}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold mb-1">Quartier</p>
              <p className="text-gray-900 font-bold">{selectedAnalysis.quartier || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold mb-1">Date analyse</p>
              <p className="text-gray-900 font-bold">
                {selectedAnalysis.createdAt?.toDate?.().toLocaleDateString('fr-CA') || new Date(selectedAnalysis.timestamp).toLocaleDateString('fr-CA')}
              </p>
            </div>
          </div>
        </div>

        {/* =================================================================================
                                      SECTION ÉVALUATION 
           ================================================================================= */}
        {isValuation && (
          <>
            <div className="bg-gradient-to-r from-blue-100 to-cyan-100 rounded-2xl p-6 border-2 border-blue-300">
              <h4 className="font-black text-blue-900 text-lg mb-4">💎 Estimation de valeur</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-blue-700 font-semibold mb-2">Valeur moyenne</p>
                  <p className="text-2xl font-black text-blue-700">
                    ${formatCurrency(result.estimationActuelle?.valeurMoyenne)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-semibold mb-2">Fourchette basse</p>
                  <p className="text-xl font-bold text-blue-600">
                    ${formatCurrency(result.estimationActuelle?.valeurBasse)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-semibold mb-2">Fourchette haute</p>
                  <p className="text-xl font-bold text-blue-600">
                    ${formatCurrency(result.estimationActuelle?.valeurHaute)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-semibold mb-2">
                    {isCom ? 'Cap Rate' : 'Appréciation'}
                  </p>
                  <p className="text-2xl font-black text-blue-700">
                    {isCom 
                      ? `${metrics.capRate?.toFixed(2) || '-'}%` 
                      : `+${analyseData.pourcentageGain?.toFixed(1) || 0}%`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* ANALYSE DÉTAILLÉE */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analyseData.appreciationTotale !== undefined && (
                  <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Appréciation Totale</p>
                    <p className="text-2xl font-black text-green-600">${formatCurrency(analyseData.appreciationTotale)}</p>
                  </div>
                )}
                {analyseData.appreciationAnnuelle !== undefined && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Appréciation/An</p>
                    <p className="text-2xl font-black text-blue-600">${formatCurrency(analyseData.appreciationAnnuelle)}</p>
                  </div>
                )}
                {analyseData.marketTrend && (
                  <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Tendance Marché</p>
                    <p className="text-lg font-black text-orange-600 capitalize">{analyseData.marketTrend}</p>
                  </div>
                )}
              </div>

              {textAnalysis && (
                <div className="bg-indigo-50 rounded-2xl p-6 border-2 border-indigo-200">
                  <p className="text-sm font-bold text-indigo-900 mb-2">🎯 Analyse du {isCom ? 'Secteur' : 'Quartier'}</p>
                  <p className="text-gray-800 leading-relaxed text-sm">{textAnalysis}</p>
                </div>
              )}
            </div>

            {/* MÉTRIQUES COMMERCIALES SUPPLÉMENTAIRES */}
            {isCom && metrics.noiAnnuel !== undefined && (
               <div className="bg-purple-50 rounded-2xl p-6 border-2 border-purple-200">
                 <h4 className="font-black text-purple-900 text-lg mb-4">💹 Métriques Financières</h4>
                 <div className="grid grid-cols-3 gap-4">
                   <div>
                     <p className="text-xs text-purple-700 font-semibold mb-1">NOI Annuel</p>
                     <p className="text-xl font-bold text-purple-800">${formatCurrency(metrics.noiAnnuel)}</p>
                   </div>
                   {metrics.multiplicateurRevenu && (
                     <div>
                       <p className="text-xs text-purple-700 font-semibold mb-1">Mult. Revenu</p>
                       <p className="text-xl font-bold text-purple-800">{metrics.multiplicateurRevenu.toFixed(2)}x</p>
                     </div>
                   )}
                   {metrics.cashOnCash && (
                     <div>
                       <p className="text-xs text-purple-700 font-semibold mb-1">Cash-on-Cash</p>
                       <p className="text-xl font-bold text-purple-800">{metrics.cashOnCash.toFixed(2)}%</p>
                     </div>
                   )}
                 </div>
               </div>
            )}

            {/* FACTEURS DE PRIX */}
            {(facteurs.augmentent?.length > 0 || facteurs.diminuent?.length > 0) && (
              <div>
                <h4 className="font-black text-gray-900 text-lg mb-4">🎯 Facteurs de Prix</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {facteurs.augmentent?.length > 0 && (
                    <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
                      <p className="text-sm font-black text-green-700 mb-3">✅ Points Forts</p>
                      <ul className="text-sm space-y-1">
                        {facteurs.augmentent.map((item, idx) => (
                          <li key={idx} className="text-gray-700 flex gap-2"><Check size={14} className="mt-1 text-green-600 shrink-0"/> {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {facteurs.diminuent?.length > 0 && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                      <p className="text-sm font-black text-red-700 mb-3">⚠️ Points Faibles</p>
                      <ul className="text-sm space-y-1">
                        {facteurs.diminuent.map((item, idx) => (
                          <li key={idx} className="text-gray-700 flex gap-2"><X size={14} className="mt-1 text-red-600 shrink-0"/> {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* =================================================================================
                                      SECTION OPTIMISATION
           ================================================================================= */}
        {!isValuation && (
          <>
            <div className="bg-gradient-to-r from-emerald-100 to-green-100 rounded-2xl p-6 border-2 border-emerald-300">
              <h4 className="font-black text-emerald-900 text-lg mb-4">💰 Potentiel d'Optimisation</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-emerald-700 font-semibold mb-2">Loyer Optimal</p>
                  <p className="text-2xl font-black text-emerald-700">
                    ${formatCurrency(recs.loyeroptimal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700 font-semibold mb-2">Gain Mensuel</p>
                  <p className="text-2xl font-black text-emerald-700">
                    +${formatCurrency(recs.gainmensuel)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700 font-semibold mb-2">Gain Annuel</p>
                  <p className="text-2xl font-black text-emerald-700">
                    +${formatCurrency(recs.gainannuel)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700 font-semibold mb-2">Confiance IA</p>
                  <p className="text-2xl font-black text-emerald-700">
                    {recs.confiance || 85}%
                  </p>
                </div>
              </div>
            </div>

            {/* ANALYSE MARCHÉ (Optimisation) */}
            {marketAnalysis.mediane && (
              <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
                <h4 className="font-black text-gray-900 text-lg mb-4 flex items-center gap-2">
                  📈 Analyse du Marché Local
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Médiane Marché</p>
                    <p className="font-bold text-gray-900">${formatCurrency(marketAnalysis.mediane)}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Taux Occupation</p>
                    <p className="font-bold text-gray-900">{marketAnalysis.occupation}%</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Tendance 30j</p>
                    <p className={`font-bold ${marketAnalysis.tendance30j >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {marketAnalysis.tendance30j > 0 ? '+' : ''}{marketAnalysis.tendance30j}%
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Listings Similaires</p>
                    <p className="font-bold text-gray-900">{marketAnalysis.listingssimilaires}</p>
                  </div>
                </div>
                {marketAnalysis.fourchette && (
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold">Fourchette du marché :</span> ${formatCurrency(marketAnalysis.fourchette[0])} - ${formatCurrency(marketAnalysis.fourchette[1])}
                  </div>
                )}
              </div>
            )}

            {/* MARKETING KIT (Optimisation) */}
            {marketingKit.titreannonce && (
              <div className="bg-pink-50 rounded-2xl p-6 border-2 border-pink-200">
                <h4 className="font-black text-pink-900 text-lg mb-4 flex items-center gap-2">
                  📢 Kit Marketing
                </h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-pink-100">
                    <p className="text-xs text-pink-500 font-bold mb-1 uppercase">Titre de l'annonce</p>
                    <p className="font-bold text-gray-900">{marketingKit.titreannonce}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-pink-100">
                    <p className="text-xs text-pink-500 font-bold mb-1 uppercase">Description accrocheuse</p>
                    <p className="text-gray-700 text-sm italic">"{marketingKit.descriptionaccroche}"</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-pink-100">
                    <p className="text-xs text-pink-500 font-bold mb-1 uppercase flex items-center gap-1">
                      👥 Profil locataire cible
                    </p>
                    <p className="text-gray-700 text-sm">{marketingKit.profillocataire}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* =================================================================================
                                      RECOMMANDATIONS STRATÉGIQUES
           ================================================================================= */}
        
        {recs && (recs.ameliorationsValeur || recs.strategie || recs.operationnelle || recs.pointscles || recs.raisonnement) && (
          <div className="space-y-6">
            <h4 className="font-black text-gray-900 text-xl flex items-center gap-3">
              <span className="bg-yellow-100 p-2 rounded-xl text-2xl">💡</span> Recommandations Stratégiques
            </h4>
            
            <div className="grid grid-cols-1 gap-6">

              {/* === RAISONNEMENT GLOBAL === */}
              {recs.raisonnement && (
                <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
                  <p className="font-bold text-blue-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    🤖 Analyse & Raisonnement
                  </p>
                  <p className="text-gray-800 text-sm leading-relaxed">
                    {recs.raisonnement}
                  </p>
                </div>
              )}
              
              {/* === OPTIMISATION : POINTS CLÉS === */}
              {!isValuation && recs.pointscles && (
                <div className="bg-emerald-50 rounded-2xl p-6 border-2 border-emerald-200">
                  <p className="font-bold text-emerald-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    🎯 Points Clés
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recs.pointscles.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-700 bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                        <span className="text-emerald-500 font-bold mt-0.5 shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* === OPTIMISATION : JUSTIFICATION === */}
              {!isValuation && recs.justification && (
                <div className="bg-indigo-50 rounded-2xl p-6 border-2 border-indigo-200">
                  <p className="font-bold text-indigo-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    📝 Justification
                  </p>
                  <ul className="space-y-3">
                    {recs.justification.map((item, i) => (
                      <li key={i} className="text-sm text-indigo-800 flex gap-3 items-start">
                        <span className="text-indigo-500 font-bold">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* === OPTIMISATION : CONSIDÉRATIONS === */}
              {!isValuation && recs.considerations && (
                <div className="bg-red-50 rounded-2xl p-6 border-2 border-red-200">
                  <p className="font-bold text-red-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    ⚠️ Considérations Importantes
                  </p>
                  <ul className="space-y-3">
                    {recs.considerations.map((item, i) => (
                      <li key={i} className="text-sm text-red-800 flex gap-3 items-start">
                        <span className="text-red-500 font-bold">!</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* === VALUATION : RENOVATIONS === */}
              {recs.ameliorationsValeur?.length > 0 && (
                <div className="bg-orange-50 rounded-2xl p-6 border-2 border-orange-200">
                  <p className="font-bold text-orange-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    🔨 Travaux Prioritaires
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recs.ameliorationsValeur.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-700 bg-white p-3 rounded-xl border border-orange-100 shadow-sm">
                        <span className="text-orange-500 font-bold mt-0.5 shrink-0">✓</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* === STRATÉGIE GLOBALE (Commun) === */}
              {recs.strategie && (
                <div className="bg-purple-50 rounded-2xl p-6 border-2 border-purple-200">
                  <p className="font-bold text-purple-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    📈 Stratégie Globale
                  </p>
                  <p className="text-purple-800 text-sm leading-relaxed">{recs.strategie}</p>
                </div>
              )}

              {/* === OPÉRATIONNEL (Commercial) === */}
              {isCommercial && recs.operationnelle && (
                <div className="bg-amber-50 rounded-2xl p-6 border-2 border-amber-200">
                  <p className="font-bold text-amber-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    ⚙️ Optimisation Opérationnelle
                  </p>
                  <p className="text-amber-800 text-sm leading-relaxed">{recs.operationnelle}</p>
                </div>
              )}

              {/* === TIMING & PROCHAINES ÉTAPES === */}
              {(recs.timing || recs.venteMeilleuresChances || recs.prochainesetapes) && (
                <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
                  <p className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                    🚀 Plan d'action
                  </p>
                  
                  {(recs.timing || recs.venteMeilleuresChances) && (
                    <div className="flex gap-3 items-start mb-4 bg-white p-3 rounded-xl border border-gray-200">
                      <span className="text-xl">⏱️</span>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Timing Recommandé</p>
                        <p className="text-sm font-medium text-gray-800">
                          {recs.timing || recs.venteMeilleuresChances}
                        </p>
                      </div>
                    </div>
                  )}

                  {recs.prochainesetapes && (
                    <div>
                      <p className="font-bold text-gray-700 mb-3 text-sm">Prochaines étapes :</p>
                      <ul className="space-y-2">
                        {recs.prochainesetapes.map((step, i) => (
                          <li key={i} className="text-gray-600 flex gap-3 text-sm bg-white p-2 rounded-lg border border-gray-100">
                            <span className="bg-gray-200 text-gray-700 font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs shrink-0">{i+1}</span> 
                            <span className="mt-0.5">{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-4xl font-black text-gray-900 mb-2">📊 Vue d'ensemble</h1>
        <p className="text-gray-600 text-lg">Résumé de vos évaluations et optimisations immobilières</p>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* CARD 1: Total Propriétés */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border-2 border-indigo-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-semibold mb-2">Propriétés analysées</p>
              <p className="text-4xl font-black text-indigo-600">{stats.totalProperties}</p>
            </div>
            <span className="text-4xl">🏠</span>
          </div>
          <p className="text-xs text-gray-500">
            {stats.evaluations} éval. + {stats.optimizations} opt.
          </p>
        </div>

        {/* CARD 2: Valeur totale */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-semibold mb-2">Valeur totale estimée</p>
              <p className="text-3xl font-black text-purple-600">
                ${formatCurrency(stats.totalValuation)}
              </p>
            </div>
            <span className="text-4xl">💎</span>
          </div>
          <p className="text-xs text-gray-500">{stats.evaluations} propriétés évaluées</p>
        </div>

        {/* CARD 3: Gains potentiels */}
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border-2 border-emerald-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-semibold mb-2">Gains annuels potentiels</p>
              <p className="text-3xl font-black text-emerald-600">
                +${formatCurrency(stats.totalGainsPotential)}
              </p>
            </div>
            <span className="text-4xl">📈</span>
          </div>
          <p className="text-xs text-gray-500">{stats.optimizations} propriétés optimisées</p>
        </div>

        {/* CARD 4: Évaluations */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-semibold mb-2">Évaluations</p>
              <p className="text-4xl font-black text-blue-600">{stats.evaluations}</p>
            </div>
            <span className="text-4xl">📋</span>
          </div>
          <button
            onClick={() => setActiveTab('valuation')}
            className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 mt-2"
          >
            Voir détails <ChevronRight size={14} />
          </button>
        </div>

        {/* CARD 5: Optimisations */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-semibold mb-2">Optimisations</p>
              <p className="text-4xl font-black text-amber-600">{stats.optimizations}</p>
            </div>
            <span className="text-4xl">💰</span>
          </div>
          <button
            onClick={() => setActiveTab('optimization')}
            className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 mt-2"
          >
            Voir détails <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* QUICK START */}
      {stats.totalProperties === 0 && (
        <div className="bg-gradient-to-r from-indigo-100 via-blue-100 to-cyan-100 rounded-3xl p-8 border-2 border-indigo-300 text-center">
          <h2 className="text-3xl font-black text-indigo-900 mb-3">🚀 Commencez dès maintenant!</h2>
          <p className="text-indigo-800 text-lg mb-8 max-w-2xl mx-auto">
            Analysez votre première propriété pour découvrir sa valeur réelle et optimiser vos revenus locatifs.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => setActiveTab('valuation')}
              className="px-8 py-4 bg-indigo-600 text-white font-black rounded-lg hover:bg-indigo-700 transition-all transform hover:-translate-y-1 shadow-lg"
            >
              📊 Faire une évaluation
            </button>
            <button
              onClick={() => setActiveTab('optimization')}
              className="px-8 py-4 bg-white border-2 border-indigo-600 text-indigo-600 font-black rounded-lg hover:bg-indigo-50 transition-all transform hover:-translate-y-1"
            >
              💰 Optimiser mes loyers
            </button>
          </div>
        </div>
      )}

      {/* LISTE DES ANALYSES */}
      {stats.totalProperties > 0 && (
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-6">📋 Vos analyses récentes</h2>

          <div className="space-y-4">
            {analyses.map((analyse) => {
              const analysisType = getAnalysisType(analyse);
              const isValuation = analysisType === 'valuation';
              const isOptimization = analysisType === 'optimization';
              const isEditing = editingId === analyse.id;

              return (
                <div
                  key={analyse.id}
                  onClick={() => !isEditing && setSelectedAnalysis(analyse)}
                  className={`rounded-2xl p-6 border-2 transition-all cursor-pointer ${
                    isValuation
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1'
                      : isOptimization
                      ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 hover:border-emerald-400 hover:shadow-lg hover:-translate-y-1'
                      : 'bg-gray-50 border-gray-200 hover:shadow-lg hover:-translate-y-1'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* TYPE BADGE + TITLE */}
                    <div className="md:col-span-3">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getPropertyIcon(analyse.proprietype || analyse.proprietetype)}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${
                          isValuation
                            ? 'bg-blue-200 text-blue-800'
                            : isOptimization
                            ? 'bg-emerald-200 text-emerald-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}>
                          {isValuation ? '📊 Évaluation' : isOptimization ? '💰 Optimisation' : 'Analyse'}
                        </span>
                      </div>
                      
                      {isEditing ? (
                        <div className="flex gap-2 items-center mb-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            autoFocus
                            className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg font-black text-gray-900 focus:outline-none focus:border-blue-500"
                            placeholder="Entrez le titre..."
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditTitle(analyse.id, editingTitle, analyse.collection, e); }}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-all"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditingTitle(''); }}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 group">
                          <h3 className="font-black text-gray-900 text-lg flex-1">
                            {getPropertyLabel(analyse)}
                          </h3>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingId(analyse.id); setEditingTitle(analyse.titre || ''); }}
                            className="p-1 text-gray-400 group-hover:text-blue-600 hover:bg-blue-100 rounded transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-600 mt-1">
                        📍 {analyse.ville} {analyse.quartier && `• ${analyse.quartier}`}
                      </p>
                    </div>

                    {/* DETAILS RAPIDES */}
                    {isValuation && (
                      <>
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Valeur estimée</p>
                          <p className="text-2xl font-black text-blue-600">
                            ${formatCurrency(analyse.result?.estimationActuelle?.valeurMoyenne)}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-600 font-semibold mb-1">
                             {isCommercial(analyse) ? 'Cap Rate' : 'Appréciation'}
                          </p>
                          <p className="text-2xl font-black text-blue-600">
                            {isCommercial(analyse)
                              ? `${analyse.result?.metriquesCommerciales?.capRate?.toFixed(2) || '-'}%`
                              : `+${analyse.result?.analyse?.pourcentageGain?.toFixed(1) || 0}%`
                            }
                          </p>
                        </div>
                      </>
                    )}

                    {isOptimization && (
                      <>
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Loyer optimal</p>
                          <p className="text-2xl font-black text-emerald-600">
                            ${formatCurrency(analyse.result?.recommandation?.loyeroptimal)}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Gain annuel</p>
                          <p className="text-2xl font-black text-emerald-600">
                            +${formatCurrency(analyse.result?.recommandation?.gainannuel)}
                          </p>
                        </div>
                      </>
                    )}

                    {/* ACTIONS */}
                    <div className="md:col-span-3 flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => handleDelete(analyse.id, analyse.collection, e)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={20} />
                      </button>
                      <button className="p-2 text-gray-400">
                        <ChevronRight size={24} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALE DÉTAILS */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-3xl z-10">
              <h3 className="text-2xl font-black text-gray-900">
                {getAnalysisType(selectedAnalysis) === 'valuation' ? '📊 Détails Évaluation' : '💰 Détails Optimisation'}
              </h3>
              <button
                onClick={() => setSelectedAnalysis(null)}
                className="text-3xl text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* CONTENU MODALE AVEC LOGIQUE ROBUSTE */}
            {renderModalContent()}

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3">
              <button
                onClick={() => setSelectedAnalysis(null)}
                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition-all"
              >
                Fermer
              </button>
              <button
                onClick={(e) => handleDelete(selectedAnalysis.id, selectedAnalysis.collection, e)}
                disabled={deletingId === selectedAnalysis.id}
                className="py-3 px-6 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all disabled:opacity-50"
              >
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// ============================================
// 🎯 OPTIMIZATION TAB (Code existant inchangé)
// ============================================
function OptimizationTab({ userPlan, user, setUserPlan, showUpgradeModal, setShowUpgradeModal }) {
  const [propertyType, setPropertyType] = useState('residential');

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-black text-gray-900 mb-8">🎯 Optimiseur IA Pro</h2>

      {/* Sélecteur Résidentiel/Commercial */}
      <div className="mb-8">
        <div className="flex gap-4 p-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-xl border border-indigo-300">
          {['residential', 'commercial'].map(type => (
            <button
              key={type}
              onClick={() => setPropertyType(type)}
              className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                propertyType === type
                  ? 'bg-white text-gray-900 shadow-lg border-2 border-indigo-500'
                  : 'bg-transparent text-gray-700 hover:text-gray-900'
              }`}
            >
              {type === 'residential' ? '🏠 Résidentiel' : '🏢 Commercial'}
            </button>
          ))}
        </div>
      </div>

      {propertyType === 'residential' ? (
        <ResidentialOptimizer
          userPlan={userPlan}
          user={user}
          setShowUpgradeModal={setShowUpgradeModal}
        />
      ) : (
        <CommercialOptimizer
          userPlan={userPlan}
          user={user}
          setShowUpgradeModal={setShowUpgradeModal}
        />
      )}
    </div>
  );
}

// ============================================
// 🏠 RESIDENTIAL OPTIMIZER (Code existant inchangé)
// ============================================
function ResidentialOptimizer({ userPlan, user, setShowUpgradeModal }) {
  const [loading, setLoading] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState({
    remaining: 0,
    limit: 1,
    current: 0,
    plan: 'essai',
    resetDate: new Date(),
    isUnlimited: false
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

  // 📊 DÉFINITION DES LIMITES DE QUOTA PAR PLAN
  const PLAN_LIMITS = {
    essai: 1,
    pro: 5,
    growth: 999,
    entreprise: 999
  };

  const [formData, setFormData] = useState({
    titre: '',
    ville: '',
    quartier: '',
    typeappart: '312',
    etat: 'renove',
    loyeractuel: 1400,
    meuble: false,
    balcon: false,
    garage: false,
    animaux: false,
    climatise: false,
    chauffage: false,
    stationnement: false,
    laverie: false,
    gym: false,
    piscine: false
  });

  const [customVille, setCustomVille] = useState('');
  const [showCustomVille, setShowCustomVille] = useState(false);
  const villeOptions = ['Montréal', 'Québec', 'Lévis', 'Laval', 'Longueuil', 'Gatineau', 'Sherbrooke', 'Autre'];

  const appartOptions = [
    { value: '112', label: '1 1/2 (Studio)' },
    { value: '312', label: '3 1/2' },
    { value: '412', label: '4 1/2' },
    { value: '512', label: '5 1/2' },
    { value: '612', label: '6 1/2' }
  ];

  const getApartmentLabel = (typeValue) => {
    const labels = {
      '112': '1 1/2',
      '312': '3 1/2',
      '412': '4 1/2',
      '512': '5 1/2',
      '612': '6 1/2'
    };
    return labels[typeValue] || typeValue;
  };

  const etatOptions = [
    { value: 'renove', label: '✨ Rénové' },
    { value: 'bon', label: '🏡 Bon état' },
    { value: 'neuf', label: '🆕 Neuf' },
    { value: 'arenover', label: '🔨 À rénover' }
  ];

  // ✅ CHARGER LE QUOTA DEPUIS FIRESTORE
  useEffect(() => {
    const loadQuota = async () => {
      try {
        if (!user?.uid) {
          console.log('❌ Pas d\'utilisateur connecté');
          return;
        }

        // 🔥 Récupérer les données depuis Firestore directement
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
          console.log('❌ Utilisateur non trouvé dans Firestore');
          return;
        }

        const userData = userDoc.data();
        console.log('📊 Données utilisateur Firestore:', userData);

        // 📋 Récupérer le plan et les limites
        const userPlanNow = userData.plan || 'essai';
        const planLimit = PLAN_LIMITS[userPlanNow] || PLAN_LIMITS['essai'];

        // 📅 Vérifier si le mois a changé et réinitialiser si nécessaire
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let quotaCount = 0;
        let resetDate = new Date();

        if (userData.quotaTracking) {
          const trackingMonth = userData.quotaTracking.month || '';

          if (trackingMonth === currentMonth) {
            // Même mois - utiliser le count actuel
            quotaCount = userData.quotaTracking.count || 0;
            resetDate = userData.quotaTracking.resetAt?.toDate ? userData.quotaTracking.resetAt.toDate() : new Date(userData.nextResetDate);
          } else {
            // Mois différent - réinitialiser
            console.log('🔄 Réinitialisation du quota (nouveau mois)');
            quotaCount = 0;

            // Calculer la date de réinitialisation (premier jour du mois prochain)
            resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            // Mettre à jour Firestore
            await updateDoc(doc(db, 'users', user.uid), {
              'quotaTracking.count': 0,
              'quotaTracking.month': currentMonth,
              'quotaTracking.resetAt': resetDate
            });
          }
        } else {
          // Pas de tracking existant - initialiser
          resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          await updateDoc(doc(db, 'users', user.uid), {
            'quotaTracking.count': 0,
            'quotaTracking.month': currentMonth,
            'quotaTracking.resetAt': resetDate
          });
        }

        // 📊 Calculer remaining et updated
        const remaining = Math.max(0, planLimit - quotaCount);

        setQuotaInfo({
          remaining: remaining,
          limit: planLimit,
          current: quotaCount,
          plan: userPlanNow,
          resetDate: resetDate,
          isUnlimited: planLimit >= 999
        });

        console.log('✅ Quota chargé:', {
          plan: userPlanNow,
          current: quotaCount,
          limit: planLimit,
          remaining: remaining,
          resetDate: resetDate.toLocaleDateString('fr-CA')
        });
      } catch (error) {
        console.error('❌ Erreur chargement quota:', error);
        setQuotaInfo({
          remaining: 1,
          limit: 1,
          current: 0,
          plan: 'essai',
          resetDate: new Date(),
          isUnlimited: false
        });
      }
    };

    if (user?.uid) {
      loadQuota();
    }
  }, [user?.uid]);

  // ✅ SCROLL AUTOMATIQUE VERS LES RÉSULTATS
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => {
        resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [result]);

  const handleSubmit = async () => {
    const apartmentLabel = getApartmentLabel(formData.typeappart);
    const villeFinale = showCustomVille && customVille.trim()
      ? customVille.trim()
      : formData.ville;

    if (!villeFinale || !formData.loyeractuel || formData.loyeractuel < 1) {
      setError('🚨 Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (quotaInfo && quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited) {
      setQuotaError(`🔒 Quota ${quotaInfo.plan} atteint! Réinitialisation ${quotaInfo.resetDate.toLocaleDateString('fr-CA')}`);
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
        { userId: user.uid, ...analysisData }
      );

      console.log('🎉 Réponse API complète:', response.data);

      // 📝 Mettre à jour le quota dans Firestore
      const db = getFirestore();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      await updateDoc(doc(db, 'users', user.uid), {
        'quotaTracking.count': increment(1),
        'quotaTracking.month': currentMonth
      });

      // Sauvegarder l'analyse
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

      // ✅ Mettre à jour le quota localement
      setQuotaInfo(prev => ({
        ...prev,
        current: prev.current + 1,
        remaining: Math.max(0, prev.remaining - 1)
      }));

      setResult(response.data);
    } catch (err) {
      console.error('❌ Erreur complète:', err);
      if (err.response?.status === 429) {
        setQuotaError(`🔒 ${err.response.data.error}`);
        setQuotaInfo({
          current: err.response.data.current,
          limit: err.response.data.limit,
          remaining: 0,
          plan: quotaInfo.plan,
          resetDate: new Date(err.response.data.resetDate),
          isUnlimited: false
        });
      } else {
        setError('Erreur: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ FONCTION POUR AFFICHER CORRECTEMENT LES GAINS/PERTES
  const getDifferenceDisplay = () => {
    if (!result || !result.recommandation) return null;
    
    const difference = result.recommandation.loyeroptimal - formData.loyeractuel;
    const differenceMensuelle = Math.round(difference);
    const differenceAnnuelle = Math.round(difference * 12);

    return {
      mensuelle: differenceMensuelle,
      annuelle: differenceAnnuelle,
      isPositive: difference >= 0,
      isBetter: difference >= 0
    };
  };

  return (
    <div className="space-y-8">
      <LoadingSpinner 
  isLoading={loading} 
  messages={loadingMessages}
  estimatedTime={25}
/>

      {/* ✅ QUOTA INFO CARD */}
      {quotaInfo && (
        <div className={`p-6 rounded-xl border-2 ${
          quotaInfo.remaining > 0
            ? 'bg-emerald-50 border-emerald-300'
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg">
                {quotaInfo.remaining > 0 ? '📊 Analyses restantes' : '❌ Quota atteint'}
              </h3>
              <p className="text-xs text-gray-600 mt-1">Plan: <span className="font-bold uppercase">{quotaInfo.plan}</span></p>
            </div>
            <span className="text-3xl font-black">
              {quotaInfo.remaining}/{quotaInfo.limit}
            </span>
          </div>

          <div className="w-full bg-gray-300 rounded-full h-3 mb-3">
            <div
              className={`h-3 rounded-full transition-all ${
                quotaInfo.remaining > 0 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ width: `${quotaInfo.limit > 0 ? ((quotaInfo.limit - quotaInfo.current) / quotaInfo.limit) * 100 : 100}%` }}
            />
          </div>

          <p className={`text-sm ${quotaInfo.remaining > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {quotaInfo.remaining > 0
              ? `${quotaInfo.remaining} analyse${quotaInfo.remaining > 1 ? 's' : ''} restante${quotaInfo.remaining > 1 ? 's' : ''} ce mois`
              : `Réinitialisation ${quotaInfo.resetDate.toLocaleDateString('fr-CA')}`
            }
          </p>

          {quotaInfo.plan === 'essai' && quotaInfo.remaining === 0 && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all"
            >
              ⬆️ Upgrader pour plus d'analyses
            </button>
          )}
        </div>
      )}

      {quotaError && (
        <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 font-semibold">
          {quotaError}
        </div>
      )}

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
              // Quand on quitte le champ, on met une valeur par défaut si vide
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
      <div className="text-center">
        <button
          onClick={handleSubmit}
          disabled={loading || (quotaInfo && quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited)}
          className={`px-16 py-4 font-black text-xl rounded-xl shadow-lg transform hover:-translate-y-1 transition-all w-full max-w-md mx-auto
            ${loading || (quotaInfo && quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited)
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-indigo-400'
            }`}
        >
          {loading ? '🔄 Analyse en cours...' : quotaInfo?.remaining <= 0 && !quotaInfo?.isUnlimited ? '❌ Quota atteint' : '🚀 Analyser'}
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
  const [quotaInfo, setQuotaInfo] = useState({
    remaining: 0,
    limit: 0,
    current: 0,
    plan: 'essai',
    resetDate: new Date(),
    isUnlimited: false
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

  // 📊 DÉFINITION DES LIMITES DE QUOTA PAR PLAN (Aligné avec PropertyValuationTab)
  const PLAN_LIMITS = {
    essai: 1,
    pro: 5,
    growth: 999,
    entreprise: 999
  };

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

  // ✅ CHARGER LE QUOTA DEPUIS FIRESTORE
  useEffect(() => {
    const loadQuota = async () => {
      try {
        if (!user?.uid) {
          console.log('❌ Pas d\'utilisateur connecté');
          return;
        }

        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
          console.log('❌ Utilisateur non trouvé dans Firestore');
          return;
        }

        const userData = userDoc.data();
        // console.log('📊 Données utilisateur Firestore:', userData);

        const userPlanNow = userData.plan || 'essai';
        const planLimit = PLAN_LIMITS[userPlanNow] || PLAN_LIMITS['essai'];

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
            console.log('🔄 Réinitialisation du quota (nouveau mois)');
            quotaCount = 0;
            // Mise à jour si mois différent (optionnel ici, fait au submit généralement, mais bon pour l'affichage)
          }
        }

        const remaining = Math.max(0, planLimit - quotaCount);

        setQuotaInfo({
          remaining: remaining,
          limit: planLimit,
          current: quotaCount,
          plan: userPlanNow,
          resetDate: resetDate,
          isUnlimited: planLimit >= 999
        });

      } catch (error) {
        console.error('❌ Erreur chargement quota:', error);
        setQuotaInfo({
          remaining: 0,
          limit: 0,
          current: 0,
          plan: 'essai',
          resetDate: new Date(),
          isUnlimited: false
        });
      }
    };

    if (user?.uid) {
      loadQuota();
    }
  }, [user?.uid]);

  // ✅ SCROLL AUTOMATIQUE VERS LES RÉSULTATS
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => {
        resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [result]);

  const handleSubmit = async () => {
    
    if (!formData.ville) {
      setError('🚨 Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (quotaInfo && quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited) {
      setQuotaError(`🔒 Quota ${quotaInfo.plan} atteint! Réinitialisation ${quotaInfo.resetDate.toLocaleDateString('fr-CA')}`);
      return;
    }

    if (formData.surfacepiedcarre < 100 || formData.prixactuelpiedcarre < 5) {
      setError('Veuillez remplir tous les champs correctement');
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

      console.log('🎉 Réponse API complète:', response.data);

      const db = getFirestore();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Mise à jour du quota côté client pour synchro immédiate (optionnel si le backend le fait aussi)
      await updateDoc(doc(db, 'users', user.uid), {
        'quotaTracking.count': increment(1),
        'quotaTracking.month': currentMonth
      });

      if (user) {
        // Enregistrement dans une collection distincte ou 'analyses'
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

      setQuotaInfo(prev => ({
        ...prev,
        current: prev.current + 1,
        remaining: Math.max(0, prev.remaining - 1)
      }));

      setResult(response.data);
    } catch (err) {
      console.error('❌ Erreur complète:', err);
      if (err.response?.status === 429) {
        setQuotaError(`🔒 ${err.response.data.error}`);
        // Mise à jour force du quota si l'API renvoie les infos
        if (err.response.data.resetDate) {
             setQuotaInfo(prev => ({
                ...prev,
                remaining: 0,
                resetDate: new Date(err.response.data.resetDate)
             }));
        }
      } else {
        setError('Erreur: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <LoadingSpinner 
        isLoading={loading} 
        messages={loadingMessages}
        estimatedTime={25}
      />

      {/* ✅ QUOTA INFO CARD - Style PropertyValuationTab */}
      {quotaInfo && (
        <div
          className={`p-6 rounded-xl border-2 ${
            quotaInfo.remaining > 0
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-red-50 border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg">
                {quotaInfo.remaining > 0
                  ? '📊 Analyses commerciales restantes'
                  : '❌ Quota atteint'}
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Plan:{' '}
                <span className="font-bold uppercase">{quotaInfo.plan}</span>
              </p>
            </div>
            <span className="text-3xl font-black">
              {quotaInfo.remaining}/{quotaInfo.limit}
            </span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-3 mb-3">
            <div
              className={`h-3 rounded-full transition-all ${
                quotaInfo.remaining > 0 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{
                width: `${
                  quotaInfo.limit > 0
                    ? ((quotaInfo.limit - quotaInfo.current) /
                        quotaInfo.limit) *
                      100
                    : 100
                }%`,
              }}
            />
          </div>
          <p
            className={`text-sm ${
              quotaInfo.remaining > 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {quotaInfo.remaining > 0
              ? `${quotaInfo.remaining} analyse${
                  quotaInfo.remaining > 1 ? 's' : ''
                } restante${quotaInfo.remaining > 1 ? 's' : ''} ce mois`
              : `Réinitialisation ${quotaInfo.resetDate.toLocaleDateString(
                  'fr-CA'
                )}`}
          </p>
          {quotaInfo.plan === 'essai' &&
            quotaInfo.remaining === 0 &&
            !quotaInfo.isUnlimited && (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all"
              >
                ⬆️ Upgrader pour plus d'analyses
              </button>
            )}
        </div>
      )}

      {quotaError && (
        <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 font-semibold">
          {quotaError}
        </div>
      )}

      {/* FORMULAIRE PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-8 bg-gray-100 rounded-xl border border-gray-300">
        <div className="lg:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">📝 Titre du local (optionnel)</label>
          <input
            value={formData.titre}
            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
            placeholder="Ex: Bureau Centre-ville, Retail Laurier..."
            disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">🏢 Type de local</label>
          <select
            value={formData.typecommercial}
            onChange={(e) => setFormData({ ...formData, typecommercial: e.target.value })}
            disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
            disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">🏙️ Ville</label>
          <input
            type="text"
            value={formData.ville}
            onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
            placeholder="Ex: Montréal, Québec, Lévis..."
            disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">📏 Surface (pi²)</label>
          <input
            type="number"
            value={formData.surfacepiedcarre}
            onChange={(e) => setFormData({ ...formData, surfacepiedcarre: parseInt(e.target.value) || 2000 })}
            min="100"
            disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
              className="flex-1 p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex items-center px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold disabled:opacity-50">
              $/pi²
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">👀 Visibilité du local</label>
          <select
            value={formData.visibilite}
            onChange={(e) => setFormData({ ...formData, visibilite: e.target.value })}
            disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
            disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                className={`flex items-center p-3 bg-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-200 transition-colors border border-indigo-300 ${quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={formData[item.key]}
                  onChange={(e) => setFormData({ ...formData, [item.key]: e.target.checked })}
                  disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
                  className="w-4 h-4 text-indigo-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="text-center">
        <button
          onClick={handleSubmit}
          disabled={loading || (quotaInfo && quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited)}
          className={`px-16 py-4 font-black text-xl rounded-xl shadow-lg transform hover:-translate-y-1 transition-all w-full max-w-md mx-auto
            ${loading || (quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited)
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-indigo-400'
            }`}
        >
          {loading 
            ? '🔄 Analyse en cours...' 
            : quotaInfo?.remaining <= 0 && !quotaInfo?.isUnlimited 
              ? '❌ Quota atteint' 
              : '🏢 Analyser Commercial'}
        </button>
      </div>

      {/* RÉSULTATS */}
      {result && (
        <div ref={resultRef} className="space-y-8 mt-8">
          {/* HEADER RÉSUMÉ */}
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
  const [loading, setLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);

  const isSubmittingRef = useRef(false);

  const [quotaInfo, setQuotaInfo] = useState({
    remaining: 0,
    limit: 1,
    current: 0,
    plan: 'essai',
    resetDate: new Date(),
    isUnlimited: false,
  });

  const [error, setError] = useState('');
  const [slideErrors, setSlideErrors] = useState({});

  const resultRef = useRef(null);

  const loadingMessages = {
    residential: [
      '🔍 Analyse de la propriété résidentielle...',
      '📊 Récupération des données du marché...',
      '🤖 IA prédit la valeur actuelle...',
      '📈 Calcul de l’appréciation...',
      '💰 Génération du rapport...',
      '✅ Finalisation de l’évaluation...',
    ],
    commercial: [
      '🏪 Analyse de la propriété commerciale...',
      '📊 Calcul des revenus et dépenses...',
      '💹 Analyse des métriques commerciales...',
      '🤖 IA évalue le potentiel de rentabilité...',
      '📈 Optimisation des stratégies...',
      '💰 Génération du rapport complet...',
    ],
  };

  const PLAN_LIMITS = {
    essai: 1,
    pro: 5,
    growth: 999,
    entreprise: 999,
  };

  // ------------ FORM STATES ------------

  const [formDataResidential, setFormDataResidential] = useState({
    titre: '',
    proprietyType: 'unifamilial',
    ville: '',
    quartier: '',
    addresseComplete: '',
    prixAchat: '',
    anneeAchat: new Date().getFullYear() - 3,
    anneeConstruction: 1990,
    surfaceHabitee: '',
    surfaceLot: '',
    nombreChambres: 3,
    nombreSallesBain: 2,
    garage: 0,
    sous_sol: 'none',
    etatGeneral: 'bon',
    piscine: false,
    terrain_detail: '',
    notes_additionnelles: '',
  });

  const [formDataCommercial, setFormDataCommercial] = useState({
    titre: '',
    proprietyType: 'immeuble_revenus',
    ville: '',
    quartier: '',
    addresseComplete: '',
    prixAchat: '',
    anneeAchat: new Date().getFullYear() - 3,
    anneeConstruction: 1990,
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
    nombreChambres: 50,        // pour hôtel
    tauxOccupationHotel: 70,   // pour hôtel
    tariffMoyenParNuit: 150,   // pour hôtel
    clienteleActive: 'stable', // pour hôtel / commerce
  });

  const slidesResidential = [
    {
      id: 'location',
      title: 'Localisation',
      description: 'Où se situe votre propriété?',
      icon: '📍',
      required: ['ville', 'proprietyType'],
      fields: ['titre', 'proprietyType', 'ville', 'quartier', 'addresseComplete'],
    },
    {
      id: 'acquisition',
      title: 'Acquisition',
      description: "Informations d'achat",
      icon: '💰',
      required: ['prixAchat', 'anneeAchat', 'anneeConstruction'],
      fields: ['prixAchat', 'anneeAchat', 'anneeConstruction'],
    },
    {
      id: 'dimensions',
      title: 'Dimensions',
      description: 'Taille et surface',
      icon: '📏',
      required: [],
      fields: ['surfaceHabitee', 'surfaceLot', 'nombreChambres', 'nombreSallesBain', 'garage'],
    },
    {
      id: 'condition',
      title: 'État et condition',
      description: 'Caractéristiques de la propriété',
      icon: '🏗️',
      required: ['etatGeneral'],
      fields: ['sous_sol', 'etatGeneral'],
    },
    {
      id: 'amenities',
      title: 'Aménagements',
      description: 'Équipements spéciaux',
      icon: '✨',
      required: [],
      fields: ['piscine', 'terrain_detail'],
    },
    {
      id: 'details',
      title: 'Détails additionnels',
      description: 'Informations complémentaires',
      icon: '📝',
      required: [],
      fields: ['notes_additionnelles'],
    },
  ];

  const slidesCommercial = [
    {
      id: 'location-com',
      title: 'Localisation',
      description: 'Où se situe votre propriété?',
      icon: '📍',
      required: ['ville', 'proprietyType'],
      fields: ['titre', 'proprietyType', 'ville', 'quartier', 'addresseComplete'],
    },
    {
      id: 'acquisition-com',
      title: 'Acquisition',
      description: "Informations d'achat",
      icon: '💰',
      required: ['prixAchat', 'anneeAchat', 'anneeConstruction'],
      fields: ['prixAchat', 'anneeAchat', 'anneeConstruction'],
    },
    {
      id: 'dimensions-com',
      title: 'Infrastructure',
      description: 'Surface et caractéristiques',
      icon: '📏',
      required: [],
      fields: ['surfaceTotale', 'surfaceLocable', 'parking', 'accessibilite'],
    },
    {
      id: 'specific-com',
      title: 'Détails spécifiques',
      description: 'Données du type de propriété',
      icon: '💹',
      required: [],
      fields: [
        'nombreUnites',
        'tauxOccupation',
        'loyerMoyenParUnite',
        'nombreChambres',
        'tauxOccupationHotel',
        'tariffMoyenParNuit',
        'clienteleActive',
      ],
    },
    {
      id: 'financial-com',
      title: 'Détails financiers',
      description: 'Revenus et dépenses',
      icon: '💰',
      required: ['revenuBrutAnnuel', 'depensesAnnuelles'],
      fields: ['revenuBrutAnnuel', 'depensesAnnuelles'],
    },
    {
      id: 'condition-com',
      title: 'État de la propriété',
      description: 'Condition et rénovations',
      icon: '🔧',
      required: [],
      fields: ['etatGeneral', 'renovations'],
    },
    {
      id: 'details-com',
      title: 'Notes finales',
      description: 'Informations additionnelles',
      icon: '📝',
      required: [],
      fields: ['terrain_detail', 'notes_additionnelles'],
    },
  ];

  const slides = evaluationType === 'residential' ? slidesResidential : slidesCommercial;
  const formData = evaluationType === 'residential' ? formDataResidential : formDataCommercial;
  const setFormData =
    evaluationType === 'residential' ? setFormDataResidential : setFormDataCommercial;

  const propertyTypesResidential = [
    { value: 'unifamilial', label: 'Unifamilial', icon: '🏠' },
    { value: 'jumelee', label: 'Jumelée', icon: '🏘️' },
    { value: 'duplex', label: 'Duplex', icon: '🏢' },
    { value: 'triplex', label: 'Triplex', icon: '🏢' },
    { value: '4plex', label: '4-plex', icon: '🏗️' },
    { value: 'condo', label: 'Condo', icon: '🏙️' },
  ];

  const propertyTypesCommercial = [
    { value: 'immeuble_revenus', label: 'Immeuble à revenus', icon: '🏢' },
    { value: 'hotel', label: 'Hôtel', icon: '🏨' },
    { value: 'depanneur', label: 'Dépanneur', icon: '🏪' },
    { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
    { value: 'bureau', label: 'Bureau', icon: '📋' },
    { value: 'commerce', label: 'Autre commerce', icon: '🛍️' },
    { value: 'terrain_commercial', label: 'Terrain', icon: '🌳' },
  ];

  const propertyTypes =
    evaluationType === 'residential' ? propertyTypesResidential : propertyTypesCommercial;

  const etatsGeneraux = [
    { value: 'excellent', label: 'Excellent', icon: '⭐' },
    { value: 'bon', label: 'Bon', icon: '👍' },
    { value: 'moyen', label: 'Moyen', icon: '➖' },
    { value: 'faible', label: 'Faible', icon: '⚠️' },
    { value: 'renovation', label: 'À rénover', icon: '🔨' },
  ];

  const typesUnderground = [
    { value: 'none', label: 'Aucun', icon: '❌' },
    { value: 'partial', label: 'Partiellement fini', icon: '🔨' },
    { value: 'full', label: 'Entièrement fini', icon: '✅' },
  ];

  const accessibiliteOptions = [
    { value: 'tres_bonne', label: 'Très bonne', icon: '✅' },
    { value: 'bonne', label: 'Bonne', icon: '👍' },
    { value: 'moyenne', label: 'Moyenne', icon: '➖' },
    { value: 'limitee', label: 'Limitée', icon: '⚠️' },
  ];

  const clienteleOptions = [
    { value: 'stable', label: 'Stable', icon: '➡️' },
    { value: 'croissance', label: 'En croissance', icon: '📈' },
    { value: 'decline', label: 'En déclin', icon: '📉' },
  ];

  // ------------ HELPERS ------------

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSlideErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
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

  const submitEvaluation = async () => {

    if (isSubmittingRef.current) return; // Si déjà en cours, on annule
    isSubmittingRef.current = true;
    
    try {
      setLoading(true);
      setError('');

      if (evaluationType === 'commercial') {
        const requiredFields = ['ville', 'revenuBrutAnnuel', 'depensesAnnuelles'];
        if (formData.proprietyType === 'immeuble_revenus') {
          requiredFields.push('nombreUnites', 'tauxOccupation', 'loyerMoyenParUnite');
        }
        if (formData.proprietyType === 'hotel') {
          requiredFields.push('nombreChambres', 'tauxOccupationHotel', 'tariffMoyenParNuit');
        }
        const missing = requiredFields.filter((f) => {
          const v = formData[f];
          return v === '' || v === null || v === undefined;
        });
        if (missing.length > 0) {
          setError(`Champs obligatoires manquants: ${missing.join(', ')}`);
          setLoading(false);
          isSubmittingRef.current = false;
          return;
        }
      }

      const endpoint =
        evaluationType === 'residential'
          ? `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ''}/api/property/valuation-estimator`
          : `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ''}/api/property/valuation-estimator-commercial`;

      const payload =
        evaluationType === 'residential'
          ? {
              userId: user?.uid,
              ...formData,
            }
          : {
              userId: user?.uid,
              ...formData,
              proprietyType: formData.proprietyType,
              typeCom: formData.proprietyType,
              surfaceTotale: Number(formData.surfaceTotale) || 0,
              surfaceLocable: Number(formData.surfaceLocable) || 0,
              accessibilite: formData.accessibilite || 'moyenne',
              parking: Number(formData.parking) || 0,
              ...(formData.proprietyType === 'immeuble_revenus' && {
                nombreUnites: Number(formData.nombreUnites) || 0,
                tauxOccupation: Number(formData.tauxOccupation) || 0,
                loyerMoyenParUnite: Number(formData.loyerMoyenParUnite) || 0,
                revenus_bruts_annuels: Number(formData.revenuBrutAnnuel) || 0,
                depenses_annuelles: Number(formData.depensesAnnuelles) || 0,
              }),
              ...(formData.proprietyType === 'hotel' && {
                nombreChambres: Number(formData.nombreChambres) || 0,
                tauxOccupationHotel: Number(formData.tauxOccupationHotel) || 0,
                tariffMoyenParNuit: Number(formData.tariffMoyenParNuit) || 0,
                revenuBrutAnnuel: Number(formData.revenuBrutAnnuel) || 0,
                depensesAnnuelles: Number(formData.depensesAnnuelles) || 0,
              }),
              etatGeneral: formData.etatGeneral || 'bon',
              renovations: formData.renovations || [],
              terrain_detail: formData.terrain_detail || '',
              notes_additionnelles: formData.notes_additionnelles || '',
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
      setSelectedProperty(result);
      setShowForm(false);
      setCurrentSlide(0);

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

  const nextSlide = () => {
    if (!validateCurrentSlide()) return;
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((s) => s + 1);
    } else {
      // Call submit only once
      submitEvaluation();
    }
  };

  const previousSlide = () => {
    if (currentSlide > 0) setCurrentSlide((s) => s - 1);
  };

  useEffect(() => {
    setSlideProgress(((currentSlide + 1) / slides.length) * 100);
  }, [currentSlide, slides.length]);

  // quota load
  useEffect(() => {
    const loadQuota = async () => {
      try {
        if (!user?.uid) return;
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        const data = userDoc.data();
        const plan = data.plan || 'essai';
        const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.essai;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, '0')}`;
        let count = 0;
        let resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        if (data.quotaTracking) {
          const trackingMonth = data.quotaTracking.month || '';
          count = data.quotaTracking.count || 0;
          if (trackingMonth !== currentMonth) count = 0;
        }
        const remaining = Math.max(0, limit - count);
        setQuotaInfo({
          remaining,
          limit,
          current: count,
          plan,
          resetDate,
          isUnlimited: limit === 999,
        });
      } catch (e) {
        console.error(e);
      }
    };
    loadQuota();
  }, [user?.uid]);

  // ------------ SLIDE RENDERERS ------------

  const renderLocationSlideResidential = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Titre (optionnel)
        </label>
        <input
          type="text"
          placeholder="Ex: Maison familiale Lévis"
          value={formData.titre}
          onChange={(e) => handleChange('titre', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Type de propriété *{' '}
          {slideErrors.proprietyType && (
            <span className="text-red-500">requis</span>
          )}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {propertyTypes.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleChange('proprietyType', t.value)}
              className={`p-2 rounded-lg text-center transition border-2 ${
                formData.proprietyType === t.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
              }`}
            >
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
        <input
          type="text"
          placeholder="Ex: Lévis"
          value={formData.ville}
          onChange={(e) => handleChange('ville', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            slideErrors.ville
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-indigo-500'
          }`}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Quartier
        </label>
        <input
          type="text"
          placeholder="Ex: Desjardins"
          value={formData.quartier}
          onChange={(e) => handleChange('quartier', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Adresse
        </label>
        <input
          type="text"
          placeholder="Ex: 123 rue Exemple"
          value={formData.addresseComplete}
          onChange={(e) => handleChange('addresseComplete', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  );

  const renderLocationSlideCommercial = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Titre (optionnel)
        </label>
        <input
          type="text"
          placeholder="Ex: 6-plex Sainte-Foy"
          value={formData.titre}
          onChange={(e) => handleChange('titre', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Type de propriété *{' '}
          {slideErrors.proprietyType && (
            <span className="text-red-500">requis</span>
          )}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {propertyTypes.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleChange('proprietyType', t.value)}
              className={`p-2 rounded-lg text-center transition border-2 ${
                formData.proprietyType === t.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
              }`}
            >
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
        <input
          type="text"
          placeholder="Ex: Québec"
          value={formData.ville}
          onChange={(e) => handleChange('ville', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            slideErrors.ville
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-indigo-500'
          }`}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Quartier
        </label>
        <input
          type="text"
          placeholder="Ex: Ste-Foy"
          value={formData.quartier}
          onChange={(e) => handleChange('quartier', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Adresse
        </label>
        <input
          type="text"
          placeholder="Ex: 456 Avenue Principale"
          value={formData.addresseComplete}
          onChange={(e) => handleChange('addresseComplete', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  );

  const renderAcquisitionSlide = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Prix d'achat ($) *{' '}
          {slideErrors.prixAchat && <span className="text-red-500">requis</span>}
        </label>
        <input
          type="number"
          placeholder="Ex: 350000"
          value={formData.prixAchat}
          onChange={(e) => handleChange('prixAchat', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            slideErrors.prixAchat
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-indigo-500'
          }`}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Année d'achat *{' '}
            {slideErrors.anneeAchat && (
              <span className="text-red-500">requis</span>
            )}
          </label>
          <input
            type="number"
            min="1950"
            max={new Date().getFullYear()}
            value={formData.anneeAchat}
            onChange={(e) =>
              handleChange('anneeAchat', parseInt(e.target.value, 10) || '')
            }
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              slideErrors.anneeAchat
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-indigo-500'
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Année construction *{' '}
            {slideErrors.anneeConstruction && (
              <span className="text-red-500">requis</span>
            )}
          </label>
          <input
            type="number"
            min="1800"
            max={new Date().getFullYear()}
            value={formData.anneeConstruction}
            onChange={(e) =>
              handleChange(
                'anneeConstruction',
                parseInt(e.target.value, 10) || ''
              )
            }
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              slideErrors.anneeConstruction
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-indigo-500'
            }`}
          />
        </div>
      </div>
    </div>
  );

  const renderDimensionsSlideResidential = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Surface habitable (pi²)
          </label>
          <input
            type="number"
            value={formData.surfaceHabitee}
            onChange={(e) => handleChange('surfaceHabitee', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Surface du lot (pi²)
          </label>
          <input
            type="number"
            value={formData.surfaceLot}
            onChange={(e) => handleChange('surfaceLot', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Chambres
          </label>
          <input
            type="number"
            min="0"
            value={formData.nombreChambres}
            onChange={(e) =>
              handleChange('nombreChambres', parseInt(e.target.value, 10) || 0)
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Salles de bain
          </label>
          <input
            type="number"
            min="0"
            value={formData.nombreSallesBain}
            onChange={(e) =>
              handleChange(
                'nombreSallesBain',
                parseInt(e.target.value, 10) || 0
              )
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Garage
          </label>
          <input
            type="number"
            min="0"
            value={formData.garage}
            onChange={(e) =>
              handleChange('garage', parseInt(e.target.value, 10) || 0)
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
    </div>
  );

  const renderDimensionsSlideCommercial = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Surface totale (pi²)
          </label>
          <input
            type="number"
            value={formData.surfaceTotale}
            onChange={(e) => handleChange('surfaceTotale', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Surface locable (pi²)
          </label>
          <input
            type="number"
            value={formData.surfaceLocable}
            onChange={(e) => handleChange('surfaceLocable', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Places de stationnement
        </label>
        <input
          type="number"
          value={formData.parking}
          onChange={(e) =>
            handleChange('parking', parseInt(e.target.value, 10) || 0)
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Accessibilité
        </label>
        <div className="grid grid-cols-2 gap-2">
          {accessibiliteOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleChange('accessibilite', opt.value)}
              className={`p-2 rounded-lg transition border-2 text-sm font-medium ${
                formData.accessibilite === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSpecificSlideCommercial = () => {
    const isImmeuble = formData.proprietyType === 'immeuble_revenus';
    const isHotel = formData.proprietyType === 'hotel';
    return (
      <div className="space-y-4">
        {isImmeuble && (
          <>
            <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg text-sm mb-4">
              <p className="font-semibold text-indigo-900">
                📊 Immeuble à revenus (logements)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre d'unités
                </label>
                <input
                  type="number"
                  value={formData.nombreUnites}
                  onChange={(e) =>
                    handleChange(
                      'nombreUnites',
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Taux occupation (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.tauxOccupation}
                  onChange={(e) =>
                    handleChange(
                      'tauxOccupation',
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Loyer moyen/unité ($/mois)
              </label>
              <input
                type="number"
                value={formData.loyerMoyenParUnite}
                onChange={(e) =>
                  handleChange(
                    'loyerMoyenParUnite',
                    parseInt(e.target.value, 10) || 0
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        {isHotel && (
          <>
            <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg text-sm mb-4">
              <p className="font-semibold text-indigo-900">🏨 Hôtel</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre de chambres
                </label>
                <input
                  type="number"
                  value={formData.nombreChambres}
                  onChange={(e) =>
                    handleChange(
                      'nombreChambres',
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Taux occupation (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.tauxOccupationHotel}
                  onChange={(e) =>
                    handleChange(
                      'tauxOccupationHotel',
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tarif moyen/nuit ($)
              </label>
              <input
                type="number"
                value={formData.tariffMoyenParNuit}
                onChange={(e) =>
                  handleChange(
                    'tariffMoyenParNuit',
                    parseInt(e.target.value, 10) || 0
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        {!isImmeuble && !isHotel && (
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-sm">
            <p className="font-semibold text-gray-800">
              Aucun champ spécifique requis pour ce type commercial.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderFinancialSlideCommercial = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Revenus bruts annuels ($) *{' '}
          {slideErrors.revenuBrutAnnuel && (
            <span className="text-red-500">requis</span>
          )}
        </label>
        <input
          type="number"
          placeholder="Avant dépenses"
          value={formData.revenuBrutAnnuel}
          onChange={(e) => handleChange('revenuBrutAnnuel', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            slideErrors.revenuBrutAnnuel
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-indigo-500'
          }`}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Dépenses annuelles ($) *{' '}
          {slideErrors.depensesAnnuelles && (
            <span className="text-red-500">requis</span>
          )}
        </label>
        <input
          type="number"
          placeholder="Taxes, maintenance, assurance..."
          value={formData.depensesAnnuelles}
          onChange={(e) => handleChange('depensesAnnuelles', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            slideErrors.depensesAnnuelles
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-indigo-500'
          }`}
        />
      </div>

      {formData.revenuBrutAnnuel && formData.depensesAnnuelles && (
        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
          <p className="text-sm font-semibold text-green-900">
            NOI:{' '}
            {(
              parseInt(formData.revenuBrutAnnuel, 10) -
              parseInt(formData.depensesAnnuelles, 10)
            ).toLocaleString('fr-CA')}
          </p>
          <p className="text-xs text-green-800">
            Ratio dépenses:{' '}
            {(
              (parseInt(formData.depensesAnnuelles, 10) /
                parseInt(formData.revenuBrutAnnuel, 10)) *
              100
            ).toFixed(1)}
            %
          </p>
        </div>
      )}
    </div>
  );

  const renderConditionSlide = () => (
    <div className="space-y-4">
      {evaluationType === 'residential' && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Sous-sol
          </label>
          <div className="grid grid-cols-3 gap-2">
            {typesUnderground.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleChange('sous_sol', t.value)}
                className={`p-2 rounded-lg transition border-2 text-sm font-medium ${
                  formData.sous_sol === t.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          État général *{' '}
          {slideErrors.etatGeneral && (
            <span className="text-red-500">requis</span>
          )}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {etatsGeneraux.map((etat) => (
            <button
              key={etat.value}
              type="button"
              onClick={() => handleChange('etatGeneral', etat.value)}
              className={`p-2 rounded-lg transition border-2 text-sm font-medium ${
                formData.etatGeneral === etat.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {etat.icon} {etat.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAmenitiesSlide = () => (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Piscine
      </label>
      <div className="flex gap-2">
        {[true, false].map((val) => (
          <button
            key={String(val)}
            type="button"
            onClick={() => handleChange('piscine', val)}
            className={`flex-1 py-2 rounded-lg transition border-2 font-medium ${
              formData.piscine === val
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {val ? '✅ Oui' : '❌ Non'}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Particularités du terrain
        </label>
        <input
          type="text"
          placeholder="Vue, boisé, coin tranquille..."
          value={formData.terrain_detail}
          onChange={(e) => handleChange('terrain_detail', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  );

  const renderConditionCommercialSlide = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          État général
        </label>
        <div className="grid grid-cols-2 gap-2">
          {etatsGeneraux.map((etat) => (
            <button
              key={etat.value}
              type="button"
              onClick={() => handleChange('etatGeneral', etat.value)}
              className={`p-2 rounded-lg transition border-2 text-sm font-medium ${
                formData.etatGeneral === etat.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {etat.icon} {etat.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Rénovations effectuées
        </label>
        <div className="space-y-2">
          {['toiture', 'systeme_hvac', 'electricite', 'plomberie', 'facade'].map(
            (reno) => (
              <label
                key={reno}
                className="flex items-center cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={formData.renovations?.includes(reno)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleChange('renovations', [
                        ...(formData.renovations || []),
                        reno,
                      ]);
                    } else {
                      handleChange(
                        'renovations',
                        (formData.renovations || []).filter((r) => r !== reno)
                      );
                    }
                  }}
                  className="mr-2 w-4 h-4 cursor-pointer"
                />
                <span className="capitalize">
                  {reno.replace('_', ' ')}
                </span>
              </label>
            )
          )}
        </div>
      </div>
    </div>
  );

  const renderDetailsSlide = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Notes additionnelles
        </label>
        <textarea
          placeholder="Informations importantes..."
          value={formData.notes_additionnelles}
          onChange={(e) => handleChange('notes_additionnelles', e.target.value)}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  );

  // ------------ RESULT RENDERERS ------------

  const renderHeroValuation = () => {
    const est = selectedProperty.estimationActuelle || {};
    return (
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600" />
        <div className="relative p-8 md:p-12 text-white">
          <div className="mb-6">
            <p className="text-sm md:text-base font-semibold opacity-90 mb-2">
              📊 Valeur Estimée Actuelle
            </p>
            <h2 className="text-4xl md:text-5xl font-black">
              {est.valeurMoyenne
                ? `${est.valeurMoyenne.toLocaleString('fr-CA')} $`
                : 'N/A'}
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="bg-white/10 backdrop-blur p-3 md:p-4 rounded-lg">
              <p className="text-xs md:text-sm opacity-80">Valeur basse</p>
              <p className="text-lg md:text-xl font-bold">
                {est.valeurBasse
                  ? `${est.valeurBasse.toLocaleString('fr-CA')} $`
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur p-3 md:p-4 rounded-lg border-2 border-white/30">
              <p className="text-xs md:text-sm opacity-80">Valeur moyenne</p>
              <p className="text-lg md:text-xl font-bold">
                {est.valeurMoyenne
                  ? `${est.valeurMoyenne.toLocaleString('fr-CA')} $`
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur p-3 md:p-4 rounded-lg">
              <p className="text-xs md:text-sm opacity-80">Valeur haute</p>
              <p className="text-lg md:text-xl font-bold">
                {est.valeurHaute
                  ? `${est.valeurHaute.toLocaleString('fr-CA')} $`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Résidentiel: analyse d’appréciation basée sur ta structure
  const renderResidentialAppreciation = () => {
    const analyse = selectedProperty.analyse || {};
    return (
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-2xl p-6 md:p-8 shadow-lg">
        <h3 className="text-2xl md:text-3xl font-black text-cyan-900 mb-6 flex items-center gap-3">
          📊 Appréciation & Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {typeof analyse.appreciationTotale === 'number' && (
            <div className="bg-white p-4 rounded-lg border-2 border-cyan-200">
              <p className="text-xs font-semibold text-cyan-600 uppercase">
                Appréciation totale
              </p>
              <p className="text-2xl font-black text-cyan-700 mt-2">
                {analyse.appreciationTotale.toLocaleString('fr-CA')} $
              </p>
            </div>
          )}
          {typeof analyse.appreciationAnnuelle === 'number' && (
            <div className="bg-white p-4 rounded-lg border-2 border-cyan-200">
              <p className="text-xs font-semibold text-cyan-600 uppercase">
                Appréciation/an
              </p>
              <p className="text-2xl font-black text-cyan-700 mt-2">
                {analyse.appreciationAnnuelle.toLocaleString('fr-CA')} $
              </p>
            </div>
          )}
          {typeof analyse.pourcentageGain === 'number' && (
            <div className="bg-white p-4 rounded-lg border-2 border-cyan-200">
              <p className="text-xs font-semibold text-cyan-600 uppercase">
                % Gain
              </p>
              <p className="text-2xl font-black text-cyan-700 mt-2">
                {analyse.pourcentageGain.toFixed(2)} %
              </p>
            </div>
          )}
          {typeof analyse.yearsToBreakEven === 'number' && (
            <div className="bg-white p-4 rounded-lg border-2 border-cyan-200">
              <p className="text-xs font-semibold text-cyan-600 uppercase">
                Années pour break-even
              </p>
              <p className="text-2xl font-black text-cyan-700 mt-2">
                {analyse.yearsToBreakEven}
              </p>
            </div>
          )}
        </div>
        {analyse.marketTrend && (
          <div className="mt-4 pt-4 border-t border-cyan-200">
            <p className="text-sm font-bold text-cyan-900 mb-2">
              Tendance du marché:
            </p>
            <p className="text-lg font-black text-cyan-700 capitalize">
              {analyse.marketTrend === 'haussier'
                ? '📈 Haussière'
                : analyse.marketTrend === 'baissier'
                ? '📉 Baissière'
                : '➡️ Stable'}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Commercial: analyse avec metriquesCommerciales, cap rate, NOI, etc.
  const renderCommercialMetrics = () => {
    const m = selectedProperty.metriquesCommerciales || {};
    if (!m) return null;
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-2xl p-6 md:p-8 shadow-lg">
        <h3 className="text-2xl md:text-3xl font-black text-indigo-900 mb-6 flex items-center gap-3">
          📈 Métriques Commerciales Clés
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {typeof m.capRate === 'number' && (
            <div className="bg-white p-6 rounded-lg border-2 border-indigo-200 shadow-sm">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">
                Cap Rate
              </p>
              <p className="text-4xl font-black text-indigo-700 mt-3">
                {m.capRate.toFixed(2)} %
              </p>
            </div>
          )}
          {typeof m.noiAnnuel === 'number' && (
            <div className="bg-white p-6 rounded-lg border-2 border-green-200 shadow-sm">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-widest">
                NOI Annuel
              </p>
              <p className="text-3xl font-black text-green-700 mt-3">
                {m.noiAnnuel.toLocaleString('fr-CA')} $
              </p>
            </div>
          )}
          {typeof m.cashOnCash === 'number' && (
            <div className="bg-white p-6 rounded-lg border-2 border-purple-200 shadow-sm">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-widest">
                Cash-on-Cash
              </p>
              <p className="text-4xl font-black text-purple-700 mt-3">
                {m.cashOnCash.toFixed(2)} %
              </p>
            </div>
          )}
          {typeof m.multiplicateurRevenu === 'number' && (
            <div className="bg-white p-6 rounded-lg border-2 border-orange-200 shadow-sm">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest">
                Multiplicateur Revenu
              </p>
              <p className="text-4xl font-black text-orange-700 mt-3">
                {m.multiplicateurRevenu.toFixed(2)}x
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderResidentialQuartierAndComparables = () => {
    const analyse = selectedProperty.analyse || {};
    const comp = selectedProperty.comparable || {};
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analyse.quartierAnalysis && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-6 md:p-8 shadow-lg">
            <h3 className="text-2xl md:text-3xl font-black text-amber-900 mb-4 flex items-center gap-3">
              🎯 Analyse du Quartier
            </h3>
            <p className="text-gray-800 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
              {analyse.quartierAnalysis}
            </p>
          </div>
        )}

        {comp.evaluationQualite && (
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-300 rounded-2xl p-6 md:p-8 shadow-lg">
            <h3 className="text-2xl md:text-3xl font-black text-purple-900 mb-4 flex items-center gap-3">
              🏘️ Comparables & Qualité d’évaluation
            </h3>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {comp.evaluationQualite}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderResidentialFacteursPrix = () => {
    const f = selectedProperty.facteursPrix || {};
    if (!f.augmentent && !f.diminuent && !f.neutre) return null;
    return (
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 md:p-8 shadow-lg">
        <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-6 flex items-center gap-3">
          🎯 Facteurs de Prix
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {f.augmentent?.length > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-300">
              <p className="font-black text-green-700 mb-3 text-sm uppercase">
                ✅ Augmentent la valeur
              </p>
              <ul className="space-y-2">
                {f.augmentent.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-xs md:text-sm text-gray-800"
                  >
                    <span className="text-green-600 font-bold">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {f.diminuent?.length > 0 && (
            <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-xl border-2 border-red-300">
              <p className="font-black text-red-700 mb-3 text-sm uppercase">
                ❌ Diminuent la valeur
              </p>
              <ul className="space-y-2">
                {f.diminuent.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-xs md:text-sm text-gray-800"
                  >
                    <span className="text-red-600 font-bold">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {f.neutre?.length > 0 && (
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-xl border-2 border-gray-300">
              <p className="font-black text-gray-700 mb-3 text-sm uppercase">
                ➖ Facteurs neutres
              </p>
              <ul className="space-y-2">
                {f.neutre.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-xs md:text-sm text-gray-800"
                  >
                    <span className="text-gray-600 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCommercialFacteursPrix = () => {
    const f = selectedProperty.facteurs_prix || {};
    if (!f.augmentent && !f.diminuent && !f.neutre) return null;
    return (
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 md:p-8 shadow-lg">
        <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-6 flex items-center gap-3">
          🎯 Facteurs de Prix
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {f.augmentent?.length > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-300">
              <p className="font-black text-green-700 mb-3 text-sm uppercase">
                ✅ Augmentent la valeur
              </p>
              <ul className="space-y-2">
                {f.augmentent.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-xs md:text-sm text-gray-800"
                  >
                    <span className="text-green-600 font-bold">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {f.diminuent?.length > 0 && (
            <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-xl border-2 border-red-300">
              <p className="font-black text-red-700 mb-3 text-sm uppercase">
                ❌ Diminuent la valeur
              </p>
              <ul className="space-y-2">
                {f.diminuent.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-xs md:text-sm text-gray-800"
                  >
                    <span className="text-red-600 font-bold">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {f.neutre?.length > 0 && (
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-xl border-2 border-gray-300">
              <p className="font-black text-gray-700 mb-3 text-sm uppercase">
                ➖ Facteurs neutres
              </p>
              <ul className="space-y-2">
                {f.neutre.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-xs md:text-sm text-gray-800"
                  >
                    <span className="text-gray-600 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCommercialSecteurAndComparables = () => {
    const analyse = selectedProperty.analyse || {};
    const comp = selectedProperty.comparable || {};
    return (
      <div className="space-y-6">
        {analyse.secteurAnalysis && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-6 md:p-8 shadow-lg">
            <h3 className="text-2xl md:text-3xl font-black text-amber-900 mb-4 flex items-center gap-3">
              🎯 Analyse du Secteur
            </h3>
            <p className="text-gray-800 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
              {analyse.secteurAnalysis}
            </p>
          </div>
        )}

        {comp.evaluation_qualite && (
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-300 rounded-2xl p-6 md:p-8 shadow-lg">
            <h3 className="text-2xl md:text-3xl font-black text-purple-900 mb-4 flex items-center gap-3">
              🏘️ Comparables & Qualité d’évaluation
            </h3>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {comp.evaluation_qualite}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderRecommendations = () => {
    const r = selectedProperty.recommendations || {};
    if (!r) return null;
    return (
      <div className="bg-gradient-to-br from-lime-50 to-green-50 border-2 border-lime-300 rounded-2xl p-6 md:p-8 shadow-lg">
        <h3 className="text-2xl md:text-3xl font-black text-lime-900 mb-6 flex items-center gap-3">
          💡 Recommandations Stratégiques
        </h3>
        {r.ameliorationsValeur?.length > 0 && (
          <div className="mb-6">
            <p className="font-bold text-lime-800 mb-3 text-sm uppercase tracking-widest">
              🔨 Améliorations pour augmenter la valeur
            </p>
            <ul className="space-y-2">
              {r.ameliorationsValeur.map((item, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 text-sm md:text-base text-gray-800"
                >
                  <span className="text-lime-600 font-bold flex-shrink-0">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.optimisationRevenu?.length > 0 && (
          <div className="mb-6 pt-4 border-t border-lime-300">
            <p className="font-bold text-lime-800 mb-3 text-sm uppercase tracking-widest">
              💰 Optimisation des revenus
            </p>
            <ul className="space-y-2">
              {r.optimisationRevenu.map((item, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 text-sm md:text-base text-gray-800"
                >
                  <span className="text-lime-600 font-bold flex-shrink-0">
                    $
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.reduceExpenses?.length > 0 && (
          <div className="mb-6 pt-4 border-t border-lime-300">
            <p className="font-bold text-lime-800 mb-3 text-sm uppercase tracking-widest">
              📉 Réduction des dépenses
            </p>
            <ul className="space-y-2">
              {r.reduceExpenses.map((item, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 text-sm md:text-base text-gray-800"
                >
                  <span className="text-lime-600 font-bold flex-shrink-0">
                    ✂️
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.strategie && (
          <div className="mt-6 pt-4 border-t border-lime-300 bg-white p-4 rounded-lg">
            <p className="font-bold text-lime-800 mb-3 text-sm uppercase tracking-widest">
              📋 Stratégie complète
            </p>
            <p className="text-sm md:text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
              {r.strategie}
            </p>
          </div>
        )}

        {r.timing && (
          <div className="mt-4 bg-white p-4 rounded-lg border-2 border-amber-300">
            <p className="font-bold text-amber-800 mb-3 text-sm uppercase tracking-widest">
              ⏱️ Timing optimal
            </p>
            <p className="text-sm md:text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
              {r.timing}
            </p>
          </div>
        )}

        {r.venteMeilleuresChances && (
          <div className="mt-4 bg-white p-4 rounded-lg border-2 border-blue-300">
            <p className="font-bold text-blue-800 mb-3 text-sm uppercase tracking-widest">
              📅 Fenêtre de vente optimale
            </p>
            <p className="text-sm md:text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
              {r.venteMeilleuresChances}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <LoadingSpinner
        isLoading={loading}
        messages={loadingMessages[evaluationType]}
        estimatedTime={evaluationType === 'commercial' ? 60 : 25}
      />

      {/* QUOTA */}
      {quotaInfo && (
        <div
          className={`p-6 rounded-xl border-2 ${
            quotaInfo.remaining > 0
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-red-50 border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg">
                {quotaInfo.remaining > 0
                  ? '📊 Évaluations restantes'
                  : '❌ Quota atteint'}
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Plan:{' '}
                <span className="font-bold uppercase">{quotaInfo.plan}</span>
              </p>
            </div>
            <span className="text-3xl font-black">
              {quotaInfo.remaining}/{quotaInfo.limit}
            </span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-3 mb-3">
            <div
              className={`h-3 rounded-full transition-all ${
                quotaInfo.remaining > 0 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{
                width: `${
                  quotaInfo.limit > 0
                    ? ((quotaInfo.limit - quotaInfo.current) /
                        quotaInfo.limit) *
                      100
                    : 100
                }%`,
              }}
            />
          </div>
          <p
            className={`text-sm ${
              quotaInfo.remaining > 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {quotaInfo.remaining > 0
              ? `${quotaInfo.remaining} évaluation${
                  quotaInfo.remaining > 1 ? 's' : ''
                } restante${quotaInfo.remaining > 1 ? 's' : ''} ce mois`
              : `Réinitialisation ${quotaInfo.resetDate.toLocaleDateString(
                  'fr-CA'
                )}`}
          </p>
          {quotaInfo.plan === 'essai' &&
            quotaInfo.remaining === 0 &&
            !quotaInfo.isUnlimited && (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all"
              >
                ⬆️ Upgrader pour plus d'évaluations
              </button>
            )}
        </div>
      )}

      {/* TOGGLE TYPE */}
      <div className="flex gap-4 p-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-xl border border-indigo-300">
        {['residential', 'commercial'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setEvaluationType(type);
              setCurrentSlide(0);
              setShowForm(false);
              setSelectedProperty(null);
            }}
            disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
            className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
              evaluationType === type
                ? 'bg-white text-gray-900 shadow-lg border-2 border-indigo-500'
                : 'bg-transparent text-gray-700 hover:text-gray-900'
            } ${
              quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {type === 'residential' ? '🏠 Résidentiel' : '🏪 Commercial'}
          </button>
        ))}
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-8 border-b border-indigo-700/20">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-3xl font-black text-white mb-2">
                    {slides[currentSlide].icon} {slides[currentSlide].title}
                  </h2>
                  <p className="text-indigo-100">
                    {slides[currentSlide].description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setCurrentSlide(0);
                    setSlideErrors({});
                  }}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-300"
                    style={{ width: `${slideProgress}%` }}
                  />
                </div>
                <span className="text-white text-sm font-medium whitespace-nowrap">
                  {currentSlide + 1}/{slides.length}
                </span>
              </div>
            </div>

            <div className="px-8 py-8">
              <div className="mb-6">
                {slides[currentSlide].id === 'location' &&
                  renderLocationSlideResidential()}
                {slides[currentSlide].id === 'location-com' &&
                  renderLocationSlideCommercial()}
                {(slides[currentSlide].id === 'acquisition' ||
                  slides[currentSlide].id === 'acquisition-com') &&
                  renderAcquisitionSlide()}
                {slides[currentSlide].id === 'dimensions' &&
                  renderDimensionsSlideResidential()}
                {slides[currentSlide].id === 'dimensions-com' &&
                  renderDimensionsSlideCommercial()}
                {slides[currentSlide].id === 'condition' &&
                  renderConditionSlide()}
                {slides[currentSlide].id === 'condition-com' &&
                  renderConditionCommercialSlide()}
                {slides[currentSlide].id === 'amenities' &&
                  renderAmenitiesSlide()}
                {slides[currentSlide].id === 'specific-com' &&
                  renderSpecificSlideCommercial()}
                {slides[currentSlide].id === 'financial-com' &&
                  renderFinancialSlideCommercial()}
                {(slides[currentSlide].id === 'details' ||
                  slides[currentSlide].id === 'details-com') &&
                  renderDetailsSlide()}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6 text-red-700 text-sm">
                  <p className="font-semibold">❌ Erreur</p>
                  <p>{error}</p>
                </div>
              )}

              {Object.keys(slideErrors).length > 0 && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-6 text-orange-700 text-sm">
                  <p className="font-semibold">⚠️ Champs obligatoires</p>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(slideErrors).map(([field]) => {
                      const labels = {
                        ville: 'Ville',
                        proprietyType: 'Type de propriété',
                        prixAchat: "Prix d'achat",
                        anneeAchat: "Année d'achat",
                        anneeConstruction: 'Année de construction',
                        etatGeneral: 'État général',
                        revenuBrutAnnuel: 'Revenus bruts annuels',
                        depensesAnnuelles: 'Dépenses annuelles',
                      };
                      return (
                        <li key={field}>• {labels[field] || field}</li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-8 py-6 border-t border-gray-200 flex gap-3">
              {currentSlide > 0 && (
                <button
                  type="button"
                  onClick={previousSlide}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition"
                  disabled={loading}
                >
                  ← Précédent
                </button>
              )}
              <button
                type="button"
                onClick={nextSlide}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span> Traitement...
                  </span>
                ) : currentSlide === slides.length - 1 ? (
                  '✅ Évaluer la propriété'
                ) : (
                  'Suivant →'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CTA NO FORM */}
      {!showForm && !selectedProperty && !loading && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited}
            className={`px-16 py-4 font-black text-xl rounded-xl shadow-lg transform hover:-translate-y-1 transition-all w-full max-w-md mx-auto ${
              loading || (quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited)
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-indigo-400'
            }`}
          >
            {loading
              ? '🔄 Évaluation en cours...'
              : quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited
              ? '❌ Quota atteint'
              : '🚀 Nouvelle évaluation'}
          </button>
        </div>
      )}

      {/* RESULTS */}
      {selectedProperty && (
        <div ref={resultRef} className="space-y-6 md:space-y-8">
          {renderHeroValuation()}

          {evaluationType === 'residential' && (
            <>
              {renderResidentialAppreciation()}
              {renderResidentialQuartierAndComparables()}
              {renderResidentialFacteursPrix()}
            </>
          )}

          {evaluationType === 'commercial' && (
            <>
              {renderCommercialMetrics()}
              {renderCommercialSecteurAndComparables()}
              {renderCommercialFacteursPrix()}
            </>
          )}

          {renderRecommendations()}

          <div className="text-center py-6">
            <button
              type="button"
              onClick={() => {
                setSelectedProperty(null);
                setShowForm(false);
                setCurrentSlide(0);
              }}
              className="px-8 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
            >
              ← Nouvelle évaluation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


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
    <div className="relative min-h-screen bg-white overflow-hidden">
      <AnimatedBlob />

      {/* ==================== BACKGROUND DÉCORATIF SUBTIL ==================== */}
      <div className="pointer-events-none absolute inset-0">
        {/* Blobs animés */}
        <div className="blob-float-1 absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="blob-float-2 absolute top-1/4 right-[-6rem] h-80 w-80 rounded-full bg-sky-100/30 blur-3xl" />
        <div className="blob-float-3 absolute bottom-[-4rem] left-1/3 h-64 w-64 rounded-full bg-violet-100/25 blur-3xl" />

        {/* Motif radial très léger */}
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
          {/* Particle background for hero */}
          <ParticleBackground />

          {/* Badge */}
          <div className="relative z-10 inline-flex items-center gap-2 px-4 py-2 bg-indigo-100/60 border border-indigo-200 rounded-full mb-6 backdrop-blur-md w-fit mx-auto">
            <span className="text-xl">🚀</span>
            <span className="text-sm font-semibold text-indigo-700">
              Évaluation + Optimisation Immobilière par IA
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="relative z-10 text-3xl sm:text-5xl lg:text-7xl font-black text-gray-900 mb-6 leading-tight tracking-tight">
            Évaluez. Optimisez.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Augmentez vos revenus
            </span>
          </h1>

          {/* Subheadline */}
          <p className="relative z-10 text-lg sm:text-xl lg:text-2xl text-gray-600 max-w-3xl mx-auto mb-4 font-light">
            Plateforme IA complète pour immobilier résidentiel et commercial. Évaluations précises
            + recommandations d&apos;optimisation de loyers.
            <span className="block mt-2 font-bold text-gray-900">
              +18% de revenus en moyenne.
            </span>
          </p>

          {/* Trust Badges */}
          <div className="relative z-10 flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 mt-8 text-sm text-gray-600 mb-12">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">✅</span>
              <span>Données en direct</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">⚡</span>
              <span>Résultats en moins d&apos;une minute</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">🔒</span>
              <span>100% sécurisé</span>
            </div>
          </div>

          {/* CTA Button */}
          <div className="relative z-10 mb-12 flex gap-3 sm:gap-4 justify-center flex-wrap">
            <Link
              to="/register"
              className="inline-block px-6 sm:px-8 lg:px-10 py-3 sm:py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 text-white rounded-xl font-bold text-base sm:text-lg shadow-[0_18px_45px_rgba(79,70,229,0.35)] hover:shadow-[0_20px_60px_rgba(56,189,248,0.5)] transform hover:-translate-y-1 transition-all card-hover"
            >
              📊 Évaluer ma propriété
            </Link>
            <Link
              to="/register"
              className="inline-block px-6 sm:px-8 lg:px-10 py-3 sm:py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold text-base sm:text-lg hover:bg-indigo-50 transform hover:-translate-y-1 transition-all card-hover"
            >
              💰 Optimiser mes revenus
            </Link>
          </div>

          {/* Hero Visual */}
          <div className="relative z-10 mt-10 sm:mt-16">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-200/50 via-sky-200/40 to-emerald-200/40 rounded-3xl opacity-80 blur-xl" />
            <div className="relative rounded-3xl overflow-hidden border border-white/60 bg-white/80 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-gray-200/70 card-hover">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Card 1: Évaluation */}
                <div className="p-5 sm:p-6 bg-white/90 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-200/40 transition card-hover">
                  <div className="text-3xl sm:text-4xl mb-3">📊</div>
                  <h3 className="font-black text-gray-900 mb-2 text-lg sm:text-xl">
                    Évaluation complète
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3">
                    Valeur marchande de votre propriété
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-indigo-600 mb-2">
                    $585,000
                  </p>
                  <p className="text-xs text-gray-500">+15% depuis achat</p>
                </div>

                {/* Card 2: Optimisation */}
                <div className="p-5 sm:p-6 bg-gradient-to-br from-emerald-100/40 via-emerald-200/30 to-emerald-50/40 rounded-2xl border-2 border-emerald-300 shadow-lg shadow-emerald-200/40 card-hover">
                  <div className="text-3xl sm:text-4xl mb-3">💰</div>
                  <h3 className="font-black text-emerald-900 mb-2 text-lg sm:text-xl">
                    Revenu optimal
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-700 font-semibold mb-3">
                    Loyer réaliste et compétitif
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-700 mb-2">
                    $1,750/mois
                  </p>
                  <p className="text-xs text-emerald-600 font-semibold">
                    +$350/mois (+25%)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== FEATURES SECTION ==================== */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div
            className="fade-in-up mx-auto max-w-3xl text-center mb-12 sm:mb-16"
            style={{ animationDelay: '0s' }}
          >
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              Pourquoi choisir OptimiPlex?
            </h2>
            <p className="text-gray-600 text-base sm:text-lg">
              Une plateforme complète pour évaluer vos propriétés ET optimiser vos revenus locatifs, 
              qu&apos;elles soient résidentielles ou commerciales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: '📊',
                title: 'Évaluation Immobilière IA',
                description:
                  'Analyse complète de la valeur de vos propriétés basée sur données vérifiées et comparables locaux',
              },
              {
                icon: '💰',
                title: 'Optimisation de Loyers',
                description:
                  'Découvrez le loyer optimal pour vos propriétés résidentielles et commerciales basé sur le marché',
              },
              {
                icon: '🏠',
                title: 'Résidentiel & Commercial',
                description:
                  'Analyse complète pour immeubles multi-logements, maisons, condos, bureaux, retail et entrepôts',
              },
              {
                icon: '📈',
                title: 'Analyses Comparables',
                description:
                  'Justification détaillée avec propriétés similaires réellement vendues/louées',
              },
              {
                icon: '⚡',
                title: 'Ultra Rapide',
                description:
                  "Évaluation et optimisation complètes en moins d'une minute avec rapports détaillés",
              },
              {
                icon: '🎯',
                title: "Plan d'Action Complet",
                description:
                  'Recommandations stratégiques pour maximiser la valeur ET les revenus locatifs de vos biens',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="fade-in-up p-6 sm:p-8 rounded-2xl border border-gray-200 bg-white/80 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-200/40 transition-all group cursor-pointer backdrop-blur-xl glow-on-hover card-hover"
                style={{ animationDelay: `${0.15 * i}s` }}
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

        {/* ==================== TWO PILLARS SECTION ==================== */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2
            className="fade-in-up text-3xl sm:text-4xl font-black text-gray-900 text-center mb-12 sm:mb-16"
            style={{ animationDelay: '0s' }}
          >
            Deux outils puissants, une plateforme
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
            {/* PILLAR 1: ÉVALUATION */}
            <div className="fade-in-up" style={{ animationDelay: '0s' }}>
              <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-3xl border-2 border-indigo-300 shadow-lg shadow-indigo-200/40 card-hover">
                <div className="text-4xl sm:text-6xl mb-4 sm:mb-6">📊</div>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
                  Évaluation Immobilière
                </h3>
                <p className="text-gray-700 mb-6 leading-relaxed text-sm sm:text-base">
                  Découvrez la vraie valeur marchande de vos propriétés avec une analyse IA complète
                  basée sur données en temps réel.
                </p>

                <div className="space-y-3 mb-6 sm:mb-8">
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">
                        Analyse comparative de marché
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Comparables directs et tendances locales
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">
                        Évaluation par approche revenus
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Basée sur potentiel locatif actuel
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">
                        Rapport professionnel complet
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Détail des facteurs influençant la valeur
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  to="/register"
                  className="inline-block px-5 sm:px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all text-sm sm:text-base"
                >
                  Évaluer ma propriété →
                </Link>
              </div>
            </div>

            {/* PILLAR 2: OPTIMISATION */}
            <div className="fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="p-6 sm:p-8 bg-gradient-to-br from-emerald-50/50 to-green-50/50 rounded-3xl border-2 border-emerald-300 shadow-lg shadow-emerald-200/40 card-hover">
                <div className="text-4xl sm:text-6xl mb-4 sm:mb-6">💰</div>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
                  Optimisation de Loyers
                </h3>
                <p className="text-gray-700 mb-6 leading-relaxed text-sm sm:text-base">
                  Trouvez le loyer optimal pour vos unités résidentielles et commerciales avec
                  recommandations basées sur données marché.
                </p>

                <div className="space-y-3 mb-6 sm:mb-8">
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">
                        Analyse loyers comparables
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Propriétés similaires dans votre région
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">
                        Résidentiel & Commercial
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Maisons, condos, immeubles, bureaux, retail
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">
                        Stratégies de positionnement
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Comment attirer locataires au meilleur prix
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  to="/register"
                  className="inline-block px-5 sm:px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all text-sm sm:text-base"
                >
                  Optimiser mes revenus →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== HOW IT WORKS ==================== */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2
            className="fade-in-up text-3xl sm:text-4xl font-black text-gray-900 text-center mb-12 sm:mb-16"
            style={{ animationDelay: '0s' }}
          >
            Comment ça marche en 3 étapes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                step: '1️⃣',
                title: 'Créez compte gratuit',
                description:
                  "Inscription en 60 secondes. Aucune carte bancaire requise pour l'essai.",
              },
              {
                step: '2️⃣',
                title: 'Entrez détails propriété',
                description:
                  'Remplissez formulaire simple: type, localisation, revenus actuels, caractéristiques.',
              },
              {
                step: '3️⃣',
                title: 'Recevez rapport complet',
                description:
                  "Évaluation, recommandations de loyers, plan d'action détaillé en moins d'une minute.",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="fade-in-up relative"
                style={{ animationDelay: `${0.2 * i}s` }}
              >
                <div className="p-6 sm:p-8 bg-white/80 rounded-2xl border border-gray-200 text-center backdrop-blur-xl shadow-lg shadow-gray-200/60 card-hover glow-on-hover">
                  <div className="text-4xl sm:text-5xl mb-4">{step.step}</div>
                  <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-700 text-sm sm:text-base">{step.description}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:flex absolute top-12 -right-4 text-3xl text-indigo-300">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ==================== PRICING SECTION ==================== */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2
            className="fade-in-up text-3xl sm:text-4xl font-black text-gray-900 text-center mb-4"
            style={{ animationDelay: '0s' }}
          >
            Tarification simple & transparente
          </h2>
          <p
            className="fade-in-up text-lg sm:text-xl text-gray-600 text-center max-w-2xl mx-auto mb-12 sm:mb-16"
            style={{ animationDelay: '0.2s' }}
          >
            Pas de surprises. Pas de frais cachés. Cancellation n&apos;importe quand.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                name: 'Essai',
                price: 'Gratuit',
                description: 'Parfait pour débuter',
                features: [
                  '1 évaluation/mois',
                  '1 analyse loyer/mois',
                  'Résidentiel uniquement',
                  'Rapport standard',
                  'Support email',
                ],
                highlighted: false,
              },
              {
                name: 'Pro',
                price: '$29',
                period: '/mois',
                description: 'Pour propriétaires actifs',
                features: [
                  '5 évaluations/mois',
                  '5 optimisations loyer/mois',
                  'Résidentiel + commercial',
                  'Rapports détaillés + stratégie',
                  'Comparables avancés',
                  'Support prioritaire',
                  'Export PDF',
                ],
                highlighted: true,
              },
              {
                name: 'Growth',
                price: '$69',
                period: '/mois',
                description: 'Pour portefeuilles importants',
                features: [
                  'Évaluations illimitées',
                  'Optimisations illimitées',
                  'Résidentiel + commercial avancé',
                  'Rapports personnalisés',
                  'Alertes marché hebdo',
                  'Support 24/7 prioritaire',
                  'Analyse portefeuille',
                ],
                highlighted: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`fade-in-up rounded-2xl border p-6 sm:p-8 transition-all backdrop-blur-xl card-hover glow-on-hover ${
                  plan.highlighted
                    ? 'border-indigo-400 bg-gradient-to-b from-indigo-100/40 via-white/90 to-white shadow-2xl shadow-indigo-200/50 transform md:scale-[1.03]'
                    : 'border-gray-200 bg-white/80 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-200/40'
                }`}
                style={{ animationDelay: `${0.15 * i}s` }}
              >
                {plan.highlighted && (
                  <div className="mb-4 inline-block px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-full">
                    🌟 POPULAIRE
                  </div>
                )}
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-6">{plan.description}</p>
                <div className="mb-6 sm:mb-8">
                  <span className="text-3xl sm:text-4xl font-black text-gray-900">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-gray-600 text-sm sm:text-base">
                      {plan.period}
                    </span>
                  )}
                </div>
                <Link
                  to="/register"
                  className={`block w-full py-3 px-6 rounded-lg font-bold mb-6 sm:mb-8 text-center transition-all text-sm sm:text-base ${
                    plan.highlighted
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Commencer
                </Link>
                <ul className="space-y-2 sm:space-y-3">
                  {plan.features.map((feature, j) => (
                    <li
                      key={j}
                      className="flex items-center gap-2 sm:gap-3 text-gray-700 text-sm sm:text-base"
                    >
                      <span className="text-emerald-600">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== FAQ ==================== */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2
            className="fade-in-up text-3xl sm:text-4xl font-black text-gray-900 text-center mb-12 sm:mb-16"
            style={{ animationDelay: '0s' }}
          >
            Questions fréquentes
          </h2>

          <div className="space-y-4 sm:space-y-6">
            {[
              {
                q: 'Quelle est la différence entre Évaluation et Optimisation?',
                a: "Évaluation détermine la valeur marchande actuelle de votre propriété. Optimisation recommande le loyer idéal à demander pour maximiser revenus. Les deux utilisent IA et données.",
              },
              {
                q: 'Fonctionne-t-il pour propriétés commerciales?',
                a: 'Oui! Plans Pro+ incluent analyse pour immeubles à revenus, bureaux, retail et entrepôts. Algorithe est adapté pour chaque type.',
              },
              {
                q: 'Comment OptimiPlex évalue-t-elle une propriété?',
                a: 'Nous analysons comparables, revenus locatifs, condition, localisation, et appliquons ML pour prédire valeur actuelle. Vous voyez tous les facteurs influençant.',
              },
              {
                q: 'Quel est le taux de précision?',
                a: '85-92% dépendant région et données. Pour chaque recommandation, vous voyez score confiance exact et les propriétés comparables utilisées.',
              },
              {
                q: 'Puis-je annuler mon abonnement?',
                a: 'Oui, cancellation 1 click. Aucun engagement à long terme. Pas de frais supplémentaires pour annuler.',
              },
              {
                q: 'Mes données sont-elles sécurisées?',
                a: 'Absolument. Encryption AES-256, serveurs Firebase sécurisés, GDPR compliant. Vos données ne sont jamais vendues, partagées ou utilisées pour marketing.',
              },
            ].map((faq, i) => (
              <details
                key={i}
                className="fade-in-up group p-5 sm:p-6 bg-white/80 rounded-2xl border border-gray-200 cursor-pointer hover:border-indigo-300 transition backdrop-blur-xl glow-on-hover"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <summary className="flex items-center gap-3 font-black text-gray-900 text-base sm:text-lg list-none">
                  <span className="group-open:rotate-180 transition-transform text-indigo-500">
                    ▶
                  </span>
                  {faq.q}
                </summary>
                <p className="mt-3 sm:mt-4 text-gray-700 ml-7 sm:ml-8 text-sm sm:text-base">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ==================== FOOTER ==================== */}
        <footer className="border-t border-gray-200 bg-white/90 py-10 sm:py-12 mt-16 sm:mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
              <div className="text-center sm:text-left">
                <h4 className="font-black text-gray-900 mb-1 sm:mb-2 text-base sm:text-lg">
                  OptimiPlex
                </h4>
                <p className="text-xs sm:text-sm text-gray-600">
                  Évaluez et optimisez vos propriétés immobilières avec IA
                </p>
              </div>
              <div className="mt-4 sm:mt-0 text-center sm:text-right text-xs sm:text-sm">
                <p className="text-gray-600">
                  <a href="#" className="hover:text-gray-900 transition">
                    Contact
                  </a>
                  {' • '}
                  <a href="#" className="hover:text-gray-900 transition">
                    Conditions
                  </a>
                  {' • '}
                  <a href="#" className="hover:text-gray-900 transition">
                    Politique de confidentialité
                  </a>
                </p>
                <p className="text-gray-500 mt-3 sm:mt-4 text-[11px] sm:text-xs">
                  &copy; 2026 OptimiPlex. Tous droits réservés.
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