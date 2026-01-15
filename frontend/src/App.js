/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable jsx-a11y/anchor-is-valid */
// App.jsx - OPTIMIPLEX avec STRIPE INTÉGRÉ

import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { initializeApp } from 'firebase/app';
import { Eye, EyeOff, Menu, ChevronRight,Trash2, X } from 'lucide-react';
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
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 border border-gray-200">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-3xl font-black text-gray-900">⬆️ Upgrader votre plan</h3>
          <button
            onClick={() => setShowUpgradeModal(false)}
            className="text-3xl text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[
            { key: 'essai', name: 'Essai', price: 'Gratuit', features: ['1 analyse/mois', 'Résidentiel basique'] },
            { key: 'pro', name: 'Pro', price: '$29/mois', features: ['5 analyses/mois', 'Résidentiel + extras', 'Support email'] },
            { key: 'growth', name: 'Growth', price: '$69/mois', features: ['Analyses illimitées', 'Résidentiel + Commercial', 'Support prioritaire'] },
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
              ]
            }
          ].map(({ key, name, price, features }) => {
            const isDowngrade = 
              (key === 'essai' && userPlan !== 'essai') ||                    
              (key === 'pro' && (userPlan === 'growth' || userPlan === 'entreprise')) ||
              (key === 'growth' && userPlan === 'entreprise');
            
            return (
              <div
                key={key}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all group ${
                  userPlan === key
                    ? 'bg-indigo-100 border-indigo-400 shadow-lg shadow-indigo-200'
                    : isDowngrade
                    ? 'bg-gray-100 border-gray-400 opacity-60 cursor-not-allowed'
                    : 'bg-gray-50 border-gray-200 hover:border-indigo-400 hover:shadow-md'
                }`}
              >
                <h4 className="text-xl font-black text-gray-900 mb-2">{name}</h4>
                <p className="text-2xl font-bold text-indigo-600 mb-4">{price}</p>
                <ul className="space-y-2 text-sm text-gray-700 mb-4">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-emerald-600">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {userPlan === key ? (
                  <div className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-center shadow-md">
                    Plan actuel ✅
                  </div>
                ) : isDowngrade ? (
                  <div className="w-full py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-lg text-center font-semibold text-sm shadow-md">
                    🔒 Downgrade via annulation
                  </div>
                ) : key === 'entreprise' ? (
                  /* ✅ BOUTON EMAIL INFO@OPTIMIPLEX.COM */
                  <button 
                        onClick={() => {
                          // ✅ 1. Copie email pré-rempli
                          const emailContent = `Bonjour équipe Optimiplex,

                              Je suis intéressé par une **solution sur mesure** adaptée à mes besoins spécifiques:

                              👤 Mon profil actuel:
                              • Plan: ${userPlan === 'pro' ? 'Pro ($29)' : userPlan === 'growth' ? 'Growth ($69)' : 'Essai'}
                              • Email: ${user.email}
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
                      ${user.email}`;

                          navigator.clipboard.writeText(emailContent);
                          
                          // ✅ 2. Ouvre Gmail (Brave friendly)
                          window.open('https://mail.google.com/mail/?view=cm&fs=1&to=info@optimiplex.com&su=Demande+Plan+Entreprise&body=' + encodeURIComponent(emailContent), '_blank');
                          
                          setShowUpgradeModal(false);
                        }}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold shadow-lg hover:shadow-xl hover:from-amber-600 hover:to-orange-600 transition-all transform hover:-translate-y-0.5"
                      >
                        📧 Contacter info@optimiplex.com (Gmail)
                      </button>

                ) : (
                  <StripeCheckoutButton 
                    plan={key} 
                    planInfo={planInfo} 
                    user={user} 
                    setUserPlan={setUserPlan}
                    setShowUpgradeModal={setShowUpgradeModal}
                  />
                )}
              </div>
            );
          })}
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

  // ============================================
  // CHARGER LES ANALYSES
  // ============================================
  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!user?.uid) return;
      try {
        const db = getFirestore();
        const analysesRef = collection(db, 'users', user.uid, 'analyses');
        const q = query(analysesRef);
        const querySnapshot = await getDocs(q);

        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.timestamp);
          const dateB = b.createdAt?.toDate?.() || new Date(b.timestamp);
          return dateB - dateA;
        });

        setAnalyses(data);

        // Calculer les stats
        if (data.length > 0) {
          let totalVal = 0;
          let totalGains = 0;
          let evaluationCount = 0;
          let optimizationCount = 0;

          data.forEach(analyse => {
            // Compte les types
            if (analyse.result?.estimationActuelle) {
              evaluationCount++;
              totalVal += analyse.result.estimationActuelle.valeurMoyenne || 0;
            }
            
            if (analyse.result?.recommandation) {
              optimizationCount++;
              totalGains += analyse.result.recommandation.gainannuel || 0;
            }
          });

          setStats({
            totalProperties: data.length,
            totalValuation: Math.round(totalVal),
            totalGainsPotential: Math.round(totalGains),
            evaluations: evaluationCount,
            optimizations: optimizationCount
          });
        }
      } catch (err) {
        console.error('Erreur fetch analyses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, [user?.uid]);

  // ============================================
  // SUPPRIMER UNE ANALYSE
  // ============================================
  const handleDelete = async (analysisId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette analyse?')) return;

    setDeletingId(analysisId);
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'users', user.uid, 'analyses', analysisId));
      setAnalyses(analyses.filter(a => a.id !== analysisId));
    } catch (err) {
      console.error('Erreur suppression:', err);
      alert('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================
  // FORMAT CURRENCY
  // ============================================
  const formatCurrency = (value) => {
    if (!value || isNaN(value)) return '0';
    return Math.round(value).toLocaleString('fr-CA');
  };

  // ============================================
  // DÉTERMINER LE TYPE D'ANALYSE
  // ============================================
  const getAnalysisType = (analyse) => {
    if (analyse.result?.estimationActuelle?.valeurMoyenne) return 'valuation';
    if (analyse.result?.recommandation?.loyeroptimal) return 'optimization';
    return 'unknown';
  };

  // ============================================
  // GET PROPERTY TYPE ICON
  // ============================================
  const getPropertyIcon = (type) => {
    const icons = {
      unifamilial: '🏠',
      jumelee: '🏘️',
      duplex: '🏢',
      triplex: '🏢',
      condo: '🏙️',
      immeuble_revenus: '🏗️',
      residential: '🏠',
      commercial: '🏪'
    };
    return icons[type] || '🏠';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <div className="animate-spin text-5xl mb-4">🔄</div>
          <p className="text-gray-600 text-lg">Chargement de vos analyses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ==================== HEADER ==================== */}
      <div>
        <h1 className="text-4xl font-black text-gray-900 mb-2">📊 Vue d'ensemble</h1>
        <p className="text-gray-600 text-lg">Résumé de vos évaluations et optimisations immobilières</p>
      </div>

      {/* ==================== STATS CARDS ==================== */}
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

      {/* ==================== QUICK START ==================== */}
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

      {/* ==================== ANALYSES LIST ==================== */}
      {stats.totalProperties > 0 && (
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-6">📋 Vos analyses récentes</h2>

          <div className="space-y-4">
            {analyses.map((analyse) => {
              const analysisType = getAnalysisType(analyse);
              const isValuation = analysisType === 'valuation';
              const isOptimization = analysisType === 'optimization';

              return (
                <div
                  key={analyse.id}
                  className={`rounded-2xl p-6 border-2 transition-all hover:shadow-lg hover:-translate-y-1 ${
                    isValuation
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 hover:border-blue-400'
                      : isOptimization
                      ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 hover:border-emerald-400'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* TYPE BADGE + TITLE */}
                    <div className="md:col-span-3">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getPropertyIcon(analyse.proprietetype)}</span>
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
                      <h3 className="font-black text-gray-900 text-lg">
                        {analyse.titre || (analyse.proprietetype === 'residential' 
                          ? analyse.typeappart 
                          : analyse.typecommercial)}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        📍 {analyse.ville} {analyse.quartier && `• ${analyse.quartier}`}
                      </p>
                    </div>

                    {/* ÉVALUATION - Valeur estimée */}
                    {isValuation && (
                      <>
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Valeur estimée</p>
                          <p className="text-2xl font-black text-blue-600">
                            ${formatCurrency(analyse.result?.estimationActuelle?.valeurMoyenne)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Plage: ${formatCurrency(analyse.result?.estimationActuelle?.valeurBasse)} - ${formatCurrency(analyse.result?.estimationActuelle?.valeurHaute)}
                          </p>
                        </div>

                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Appréciation</p>
                          <p className="text-2xl font-black text-blue-600">
                            +{analyse.result?.analyse?.pourcentageGain || 0}%
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Depuis achat</p>
                        </div>

                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Confiance IA</p>
                          <p className="text-2xl font-black text-blue-600">
                            {analyse.result?.recommandation?.confiance || 85}%
                          </p>
                        </div>
                      </>
                    )}

                    {/* OPTIMISATION - Loyer optimal */}
                    {isOptimization && (
                      <>
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Loyer optimal</p>
                          <p className="text-2xl font-black text-emerald-600">
                            ${formatCurrency(analyse.result?.recommandation?.loyeroptimal)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">/mois</p>
                        </div>

                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Gain mensuel</p>
                          <p className="text-2xl font-black text-emerald-600">
                            +${formatCurrency(analyse.result?.recommandation?.gainmensuel)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">vs actuel</p>
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
                    <div className="md:col-span-1 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedAnalysis(analyse)}
                        className={`p-2 rounded-lg transition-all ${
                          isValuation
                            ? 'text-blue-600 hover:bg-blue-100'
                            : 'text-emerald-600 hover:bg-emerald-100'
                        }`}
                        title="Voir détails"
                      >
                        <Eye size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(analyse.id)}
                        disabled={deletingId === analyse.id}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>

                  {/* DATE */}
                  <div className="mt-4 pt-4 border-t border-gray-300/40">
                    <p className="text-xs text-gray-500">
                      📅 {analyse.createdAt?.toDate?.().toLocaleDateString('fr-CA') || new Date(analyse.timestamp).toLocaleDateString('fr-CA')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== INFO CARDS ==================== */}
      {stats.totalProperties > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          {/* ABOUT VALUATIONS */}
          <div className="bg-white rounded-2xl p-6 border-2 border-blue-200 shadow-md hover:shadow-lg transition-all">
            <h3 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span>📊</span> À propos des Évaluations
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4 text-sm">
              Découvrez la vraie valeur marchande de vos propriétés basée sur les données Centris, les comparables locaux et les tendances du marché.
            </p>
            <ul className="space-y-2 text-xs text-gray-600">
              <li>✓ Analyse comparative de marché</li>
              <li>✓ Évaluation par approche revenus</li>
              <li>✓ Rapport professionnel détaillé</li>
              <li>✓ Appréciation et historique</li>
            </ul>
          </div>

          {/* ABOUT OPTIMIZATION */}
          <div className="bg-white rounded-2xl p-6 border-2 border-emerald-200 shadow-md hover:shadow-lg transition-all">
            <h3 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span>💰</span> À propos de l'Optimisation
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4 text-sm">
              Trouvez le loyer optimal pour vos propriétés résidentielles et commerciales pour maximiser vos revenus.
            </p>
            <ul className="space-y-2 text-xs text-gray-600">
              <li>✓ Analyse loyers comparables</li>
              <li>✓ Support résidentiel & commercial</li>
              <li>✓ Stratégies de positionnement</li>
              <li>✓ Gains potentiels calculés</li>
            </ul>
          </div>
        </div>
      )}

      {/* ==================== MODAL DÉTAILS ==================== */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-3xl">
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

            <div className="p-8 space-y-6">
              {/* PROPRIÉTÉ INFO */}
              <div className={`rounded-2xl p-6 border-2 ${
                getAnalysisType(selectedAnalysis) === 'valuation'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <h4 className="font-black text-gray-900 text-lg mb-4 flex items-center gap-2">
                  <span>{getPropertyIcon(selectedAnalysis.proprietetype)}</span> Propriété
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">Localisation</p>
                    <p className="text-gray-900 font-bold">{selectedAnalysis.ville}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">Quartier</p>
                    <p className="text-gray-900 font-bold">{selectedAnalysis.quartier || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">Type</p>
                    <p className="text-gray-900 font-bold">
                      {selectedAnalysis.proprietetype === 'residential'
                        ? selectedAnalysis.typeappart
                        : selectedAnalysis.typecommercial}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">Date analyse</p>
                    <p className="text-gray-900 font-bold">
                      {selectedAnalysis.createdAt?.toDate?.().toLocaleDateString('fr-CA') || new Date(selectedAnalysis.timestamp).toLocaleDateString('fr-CA')}
                    </p>
                  </div>
                </div>
              </div>

              {/* ÉVALUATION DETAILS */}
              {getAnalysisType(selectedAnalysis) === 'valuation' && (
                <>
                  <div className="bg-gradient-to-r from-blue-100 to-cyan-100 rounded-2xl p-6 border-2 border-blue-300">
                    <h4 className="font-black text-blue-900 text-lg mb-4">💎 Estimation de valeur</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-blue-700 font-semibold mb-2">Valeur moyenne</p>
                        <p className="text-2xl font-black text-blue-700">
                          ${formatCurrency(selectedAnalysis.result?.estimationActuelle?.valeurMoyenne)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 font-semibold mb-2">Valeur basse</p>
                        <p className="text-2xl font-black text-blue-700">
                          ${formatCurrency(selectedAnalysis.result?.estimationActuelle?.valeurBasse)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 font-semibold mb-2">Valeur haute</p>
                        <p className="text-2xl font-black text-blue-700">
                          ${formatCurrency(selectedAnalysis.result?.estimationActuelle?.valeurHaute)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 font-semibold mb-2">Appréciation</p>
                        <p className="text-2xl font-black text-blue-700">
                          +{selectedAnalysis.result?.analyse?.pourcentageGain || 0}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedAnalysis.result?.analyse?.quartierAnalysis && (
                    <div className="bg-indigo-50 rounded-2xl p-6 border-2 border-indigo-200">
                      <h4 className="font-black text-indigo-900 text-lg mb-3">📍 Analyse du quartier</h4>
                      <p className="text-gray-800 leading-relaxed">{selectedAnalysis.result.analyse.quartierAnalysis}</p>
                    </div>
                  )}

                  {selectedAnalysis.result?.comparable?.evaluationQualite && (
                    <div className="bg-purple-50 rounded-2xl p-6 border-2 border-purple-200">
                      <h4 className="font-black text-purple-900 text-lg mb-3">🏘️ Comparables</h4>
                      <p className="text-gray-800 leading-relaxed">{selectedAnalysis.result.comparable.evaluationQualite}</p>
                    </div>
                  )}

                  {selectedAnalysis.result?.recommendations?.strategie && (
                    <div className="bg-green-50 rounded-2xl p-6 border-2 border-green-200">
                      <h4 className="font-black text-green-900 text-lg mb-3">🎯 Stratégie d'investissement</h4>
                      <p className="text-gray-800 leading-relaxed">{selectedAnalysis.result.recommendations.strategie}</p>
                    </div>
                  )}
                </>
              )}

              {/* OPTIMISATION DETAILS */}
              {getAnalysisType(selectedAnalysis) === 'optimization' && (
                <>
                  <div className="bg-gradient-to-r from-emerald-100 to-green-100 rounded-2xl p-6 border-2 border-emerald-300">
                    <h4 className="font-black text-emerald-900 text-lg mb-4">💰 Recommandation d'optimisation</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-emerald-700 font-semibold mb-2">Loyer optimal</p>
                        <p className="text-2xl font-black text-emerald-700">
                          ${formatCurrency(selectedAnalysis.result?.recommandation?.loyeroptimal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-emerald-700 font-semibold mb-2">Gain mensuel</p>
                        <p className="text-2xl font-black text-emerald-700">
                          +${formatCurrency(selectedAnalysis.result?.recommandation?.gainmensuel)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-emerald-700 font-semibold mb-2">Gain annuel</p>
                        <p className="text-2xl font-black text-emerald-700">
                          +${formatCurrency(selectedAnalysis.result?.recommandation?.gainannuel)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-emerald-700 font-semibold mb-2">Confiance IA</p>
                        <p className="text-2xl font-black text-emerald-700">
                          {selectedAnalysis.result?.recommandation?.confiance || 85}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedAnalysis.result?.recommandation?.raisonnement && (
                    <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
                      <h4 className="font-black text-blue-900 text-lg mb-3">🤖 Raisonnement IA</h4>
                      <p className="text-gray-800 leading-relaxed">{selectedAnalysis.result.recommandation.raisonnement}</p>
                    </div>
                  )}

                  {selectedAnalysis.result?.marketingkit?.titreannonce && (
                    <div className="bg-pink-50 rounded-2xl p-6 border-2 border-pink-200">
                      <h4 className="font-black text-pink-900 text-lg mb-4">📢 Marketing Kit</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-pink-700 font-semibold mb-1">Titre annonce</p>
                          <p className="text-gray-800 font-bold">{selectedAnalysis.result.marketingkit.titreannonce}</p>
                        </div>
                        {selectedAnalysis.result.marketingkit.descriptionaccroche && (
                          <div>
                            <p className="text-xs text-pink-700 font-semibold mb-1">Description</p>
                            <p className="text-gray-800">{selectedAnalysis.result.marketingkit.descriptionaccroche}</p>
                          </div>
                        )}
                        {selectedAnalysis.result.marketingkit.profillocataire && (
                          <div>
                            <p className="text-xs text-pink-700 font-semibold mb-1">Profil locataire idéal</p>
                            <p className="text-gray-800">{selectedAnalysis.result.marketingkit.profillocataire}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3">
              <button
                onClick={() => setSelectedAnalysis(null)}
                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition-all"
              >
                Fermer
              </button>
              <button
                onClick={() => handleDelete(selectedAnalysis.id)}
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
      '512': '5 1/2'
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
            
            // Calculer la date de réinitialisation (même jour du mois prochain)
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

  return (
    <div className="space-y-8">
      <LoadingSpinner isLoading={loading} messages={loadingMessages} />

      {/* ✅ QUOTA INFO CARD - AVEC LOGS DE DEBUG */}
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
                onClick={() => { setShowCustomVille(false); setCustomVille(''); setFormData({ ...formData, ville: '' }); }}
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
            onChange={(e) => setFormData({ ...formData, loyeractuel: parseInt(e.target.value) || 1400 })}
            min="500"
            max="5000"
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

      {result && (
        <div className="space-y-8 mt-8">
          {/* Header résumé */}
          <div className="p-8 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-2xl border-2 border-emerald-300 text-center">
            <h3 className="text-4xl font-black text-emerald-900 mb-2">
              ${Math.round(result.recommandation?.loyeroptimal || 0)}
            </h3>
            <p className="text-emerald-800 text-lg mb-6">Loyer optimal recommandé</p>

            <div className="flex flex-wrap justify-center gap-8">
              <div>
                <div className="font-black text-2xl text-emerald-700">
                  +${Math.round((result.recommandation?.loyeroptimal - formData.loyeractuel) / 12) || 0}
                </div>
                <div className="text-emerald-600 text-sm">par mois</div>
              </div>

              <div>
                <div className="font-black text-2xl text-emerald-700">
                  ${Math.round(result.recommandation?.loyeroptimal - formData.loyeractuel) || 0}
                </div>
                <div className="text-emerald-600 text-sm">par année</div>
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
    essai: 0,
    pro: 0,
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

  const isCommercialBlocked = userPlan === 'essai' || userPlan === 'pro';

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
            
            // Calculer la date de réinitialisation (même jour du mois prochain)
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
          remaining: 0,
          limit: 0,
          current: 0,
          plan: 'essai',
          resetDate: new Date(),
          isUnlimited: false
        });
      }
    };

    if (user?.uid && !isCommercialBlocked) {
      loadQuota();
    }
  }, [user?.uid, isCommercialBlocked]);

  const handleSubmit = async () => {
    if (isCommercialBlocked) {
      setError('🔒 Commercial disponible à partir du plan Growth. Upgrader maintenant.');
      setShowUpgradeModal(true);
      return;
    }

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
        `${API_BASE_URL}/api/pricing/commercial-optimizer`,
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
          proprietetype: 'commercial',
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

  return (
    <div className="space-y-8">
      <LoadingSpinner isLoading={loading} messages={loadingMessages} />

      {/* ✅ QUOTA INFO CARD - AVEC LOGS DE DEBUG */}
      {!isCommercialBlocked && quotaInfo && (
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
              ? `${quotaInfo.remaining} analyse${quotaInfo.remaining > 1 ? 's' : ''} commerciale${quotaInfo.remaining > 1 ? 's' : ''} restante${quotaInfo.remaining > 1 ? 's' : ''} ce mois`
              : `Réinitialisation ${quotaInfo.resetDate.toLocaleDateString('fr-CA')}`
            }
          </p>
         
        </div>
      )}

      {quotaError && (
        <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 font-semibold">
          {quotaError}
        </div>
      )}

      {isCommercialBlocked && (
        <div className="p-6 bg-gradient-to-r from-red-100 to-red-50 rounded-xl border-2 border-red-400">
          <p className="text-red-900 font-bold text-base mb-2">
            🔒 Plan non disponible pour Commercial
          </p>
          <p className="text-red-800 text-sm mb-4">Accès à partir de Growth ($69/mois)</p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-lg hover:shadow-lg transition-all"
          >
            💎 Upgrader maintenant
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-8 bg-gray-100 rounded-xl border border-gray-300">
        <div className="lg:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">📝 Titre du local (optionnel)</label>
          <input
            value={formData.titre}
            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
            placeholder="Ex: Bureau Centre-ville, Retail Laurier..."
            disabled={isCommercialBlocked}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Type de local</label>
          <select
            value={formData.typecommercial}
            onChange={(e) => setFormData({ ...formData, typecommercial: e.target.value })}
            disabled={isCommercialBlocked}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
          >
            {typeCommercialOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Quartier (optionnel)</label>
          <input
            value={formData.quartier}
            onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
            placeholder="Centre-ville, Plateau, Griffintown..."
            disabled={isCommercialBlocked}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">🏙️ Ville</label>
          <input
            type="text"
            value={formData.ville}
            onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
            placeholder="Ex: Montréal, Québec, Lévis..."
            disabled={isCommercialBlocked}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Surface (pi²)</label>
          <input
            type="number"
            value={formData.surfacepiedcarre}
            onChange={(e) => setFormData({ ...formData, surfacepiedcarre: parseInt(e.target.value) || 2000 })}
            min="100"
            disabled={isCommercialBlocked}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Prix actuel ($/pi²/an)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={formData.prixactuelpiedcarre}
              onChange={(e) => setFormData({ ...formData, prixactuelpiedcarre: parseFloat(e.target.value) || 18 })}
              step="0.5"
              min="5"
              disabled={isCommercialBlocked}
              className="flex-1 p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
            />
            <div className="flex items-center px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold">
              $/pi²
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Visibilité du local</label>
          <select
            value={formData.visibilite}
            onChange={(e) => setFormData({ ...formData, visibilite: e.target.value })}
            disabled={isCommercialBlocked}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
          >
            {visibiliteOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Terme du bail (ans)</label>
          <input
            type="number"
            value={formData.termebailans}
            onChange={(e) => setFormData({ ...formData, termebailans: parseInt(e.target.value) || 3 })}
            min="1"
            max="10"
            disabled={isCommercialBlocked}
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
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
                className="flex items-center p-3 bg-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-200 transition-colors border border-indigo-300 disabled:opacity-50"
              >
                <input
                  type="checkbox"
                  checked={formData[item.key]}
                  onChange={(e) => setFormData({ ...formData, [item.key]: e.target.checked })}
                  disabled={isCommercialBlocked}
                  className="w-4 h-4 text-indigo-600 rounded disabled:opacity-50"
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

      <div className="text-center">
        <button
          onClick={handleSubmit}
          disabled={loading || isCommercialBlocked || (quotaInfo && quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited)}
          className={`px-16 py-4 font-black text-xl rounded-xl shadow-lg transform hover:-translate-y-1 transition-all w-full max-w-md mx-auto
            ${loading || isCommercialBlocked || (quotaInfo && quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited)
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-indigo-400'
            }`}
        >
          {loading ? '🔄 Analyse en cours...' : isCommercialBlocked ? '🔒 Commercial (Growth+)' : quotaInfo?.remaining <= 0 && !quotaInfo?.isUnlimited ? '❌ Quota atteint' : '🏢 Analyser Commercial'}
        </button>
      </div>

      {result && (
        <div className="space-y-8 mt-8">
          
          {/* Header résumé */}
          <div className="p-8 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-2xl border-2 border-emerald-300 text-center">
            <h3 className="text-4xl font-black text-emerald-900 mb-2">
              ${(result.recommandation?.loyeroptimal || 0).toFixed(2)}/pi²/an
            </h3>
            <p className="text-emerald-800 text-lg mb-6">Loyer optimal recommandé</p>

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


// ====================================================================
// 🏠 COMPOSANT : ESTIMATEUR DE VALEUR IMMOBILIÈRE
// ====================================================================

function PropertyValuationTab({ 
  user, 
  userPlan, 
  setUserPlan,
  showUpgradeModal, 
  setShowUpgradeModal 
}) {
  // ============================================
  // STATE - GESTION DES ÉTATS
  // ============================================
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  
  const [quotaInfo, setQuotaInfo] = useState({
    remaining: 0,
    limit: 1,
    current: 0,
    plan: 'essai',
    resetDate: new Date(),
    isUnlimited: false
  });
  
  const [error, setError] = useState('');
  const [quotaError, setQuotaError] = useState('');
  const [slideErrors, setSlideErrors] = useState({});
  
  const resultRef = React.useRef(null);

  // ============================================
  // MESSAGES DE CHARGEMENT
  // ============================================
  const loadingMessages = [
    '🔍 Analyse de la propriété...',
    '📊 Récupération des données du marché...',
    '🤖 IA prédit la valeur actuelle...',
    '📈 Calcul de l\'appréciation...',
    '💰 Génération du rapport...',
    '✅ Finalisation de l\'évaluation...'
  ];

  // ============================================
  // LIMITES DE QUOTA PAR PLAN
  // ============================================
  const PLAN_LIMITS = {
    essai: 1,
    pro: 5,
    growth: 999,
    entreprise: 999
  };

  // ============================================
  // DONNÉES DU FORMULAIRE
  // ============================================
  const [formData, setFormData] = useState({
    titre: '',
    proprietyType: 'unifamilial',
    ville: '',
    quartier: '',
    addresseComplete: '',
    prixAchat: '',
    anneeAchat: new Date().getFullYear() - 5,
    anneeConstruction: 1990,
    surfaceHabitee: '',
    surfaceLot: '',
    nombreChambres: 3,
    nombreSallesBain: 2,
    stationnements: 0,
    sous_sol: 'finished',
    etatGeneral: 'bon',
    renovations: [],
    piscine: false,
    terrasse: false,
    chauffageRadiant: false,
    climatisation: false,
    fireplace: false,
    sauna: false,
    cinema: false,
    salleSport: false,
    nombreLogements: 4,
    terrain_detail: '',
    notes_additionnelles: ''
  });

  // ============================================
  // CONFIGURATION DES SLIDES
  // ============================================
  const slides = [
    {
      id: 'location',
      title: 'Localisation',
      description: 'Où se situe votre propriété?',
      icon: '📍',
      required: ['ville'],
      fields: ['titre', 'proprietyType', 'ville', 'quartier', 'addresseComplete']
    },
    {
      id: 'acquisition',
      title: 'Acquisition',
      description: 'Informations d\'achat',
      icon: '💰',
      required: ['prixAchat', 'anneeAchat'],
      fields: ['prixAchat', 'anneeAchat', 'anneeConstruction']
    },
    {
      id: 'dimensions',
      title: 'Dimensions',
      description: 'Taille et surface',
      icon: '📏',
      required: [],
      fields: ['surfaceHabitee', 'surfaceLot', 'nombreChambres', 'nombreSallesBain', 'stationnements']
    },
    {
      id: 'condition',
      title: 'État et condition',
      description: 'Caractéristiques de la propriété',
      icon: '🏗️',
      required: [],
      fields: ['sous_sol', 'etatGeneral']
    },
    {
      id: 'amenities',
      title: 'Aménagements premium',
      description: 'Équipements spéciaux',
      icon: '✨',
      required: [],
      fields: ['amenities']
    },
    {
      id: 'details',
      title: 'Détails additionnels',
      description: 'Informations complémentaires',
      icon: '📝',
      required: [],
      fields: ['terrain_detail', 'notes_additionnelles']
    }
  ];

  // ============================================
  // AMÉNAGEMENTS DISPONIBLES
  // ============================================
  const amenagements = [
    { key: 'piscine', label: 'Piscine', icon: '🏊' },
    { key: 'terrasse', label: 'Terrasse', icon: '🏡' },
    { key: 'chauffageRadiant', label: 'Chauffage radiant', icon: '🌡️' },
    { key: 'climatisation', label: 'Climatisation', icon: '❄️' },
    { key: 'fireplace', label: 'Foyer', icon: '🔥' },
    { key: 'sauna', label: 'Sauna', icon: '🧖' },
    { key: 'cinema', label: 'Salle cinéma', icon: '🎬' },
    { key: 'salleSport', label: 'Salle sport', icon: '💪' }
  ];

  // ============================================
  // TYPES DE PROPRIÉTÉS
  // ============================================
  const propertyTypes = [
    { value: 'unifamilial', label: 'Unifamilial', icon: '🏠' },
    { value: 'jumelee', label: 'Jumelée', icon: '🏘️' },
    { value: 'duplex', label: 'Duplex', icon: '🏢' },
    { value: 'triplex', label: 'Triplex', icon: '🏢' },
    { value: 'immeuble_revenus', label: 'Immeuble à revenus', icon: '🏗️' },
    { value: 'condo', label: 'Condo', icon: '🏙️' }
  ];

  // ============================================
  // ÉTATS DE CONDITIONS
  // ============================================
  const etatsGeneraux = [
    { value: 'excellent', label: 'Excellent', icon: '⭐', color: 'emerald' },
    { value: 'bon', label: 'Bon', icon: '👍', color: 'green' },
    { value: 'moyen', label: 'Moyen', icon: '➖', color: 'yellow' },
    { value: 'faible', label: 'Faible', icon: '⚠️', color: 'orange' },
    { value: 'necessite_renovation', label: 'Nécessite rénovation', icon: '🔨', color: 'red' }
  ];

  // ============================================
  // TYPES DE SOUS-SOL
  // ============================================
  const typesUnderground = [
    { value: 'none', label: 'Aucun', icon: '❌' },
    { value: 'unfinished', label: 'Non aménagé', icon: '🪨' },
    { value: 'partial', label: 'Partiellement aménagé', icon: '🔨' },
    { value: 'finished', label: 'Complètement aménagé', icon: '✅' }
  ];

  // ============================================
  // HELPER: Format property type label
  // ============================================
  const formatPropertyType = (type) => {
    if (!type) return 'Unknown';
    const typeObj = propertyTypes.find(p => p.value === type);
    return typeObj ? typeObj.label : type.charAt(0).toUpperCase() + type.slice(1);
  };

  // ============================================
  // HELPER: Safe format currency
  // ============================================
  const formatCurrency = (value) => {
    if (!value && value !== 0) return 'N/A';
    return Number(value).toLocaleString('fr-CA');
  };

  // ============================================
  // HELPER: Check if Pro Plan
  // ============================================
  const isProPlan = quotaInfo.plan === 'pro' || quotaInfo.plan === 'premium' || quotaInfo.plan === 'growth' || quotaInfo.plan === 'entreprise';

  // ============================================
  // EFFECT: Charger les données au démarrage
  // ============================================
  useEffect(() => {
    const loadData = async () => {
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
        console.log('📊 Données utilisateur Firestore:', userData);

        const userPlan = userData.plan || 'essai';
        const planLimit = PLAN_LIMITS[userPlan] || PLAN_LIMITS['essai'];

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        let quotaCount = 0;
        let resetDate = new Date();

        if (userData.quotaTracking) {
          const trackingMonth = userData.quotaTracking.month || '';
          
          if (trackingMonth === currentMonth) {
            quotaCount = userData.quotaTracking.count || 0;
            resetDate = userData.quotaTracking.resetAt?.toDate ? userData.quotaTracking.resetAt.toDate() : new Date(userData.nextResetDate);
          } else {
            console.log('🔄 Réinitialisation du quota (nouveau mois)');
            quotaCount = 0;
            resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            
            await updateDoc(doc(db, 'users', user.uid), {
              'quotaTracking.count': 0,
              'quotaTracking.month': currentMonth,
              'quotaTracking.resetAt': resetDate
            });
          }
        } else {
          resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          await updateDoc(doc(db, 'users', user.uid), {
            'quotaTracking.count': 0,
            'quotaTracking.month': currentMonth,
            'quotaTracking.resetAt': resetDate
          });
        }

        const remaining = Math.max(0, planLimit - quotaCount);

        setQuotaInfo({
          remaining: remaining,
          limit: planLimit,
          current: quotaCount,
          plan: userPlan,
          resetDate: resetDate,
          isUnlimited: planLimit >= 999
        });

        console.log('✅ Quota chargé:', {
          plan: userPlan,
          current: quotaCount,
          limit: planLimit,
          remaining: remaining,
          resetDate: resetDate.toLocaleDateString('fr-CA')
        });

        const analysesRef = collection(db, 'users', user.uid, 'analyses');
        const snapshot = await getDocs(analysesRef);
        const evaluations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProperties(evaluations);

      } catch (error) {
        console.error('❌ Erreur chargement données:', error);
        setQuotaInfo({
          remaining: 0,
          limit: 1,
          current: 0,
          plan: 'essai',
          resetDate: new Date(),
          isUnlimited: false
        });
      }
    };

    if (user?.uid) {
      loadData();
    }
  }, [user?.uid]);

  // ============================================
  // EFFET: Mettre à jour la barre de progression
  // ============================================
  useEffect(() => {
    const progress = ((currentSlide + 1) / slides.length) * 100;
    setSlideProgress(progress);
  }, [currentSlide, slides.length]);

  // ============================================
  // FONCTION: Valider le slide actuel
  // ============================================
  const validateCurrentSlide = () => {
    const slide = slides[currentSlide];
    const newErrors = {};

    slide.required.forEach(field => {
      if (!formData[field] || formData[field] === '') {
        newErrors[field] = 'Ce champ est obligatoire';
      }
    });

    setSlideErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // FONCTION: Aller au slide suivant
  // ============================================
  const goToNextSlide = () => {
    if (validateCurrentSlide()) {
      if (currentSlide < slides.length - 1) {
        setCurrentSlide(currentSlide + 1);
        setSlideErrors({});
      }
    }
  };

  // ============================================
  // FONCTION: Aller au slide précédent
  // ============================================
  const goToPrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
      setSlideErrors({});
    }
  };

  // ============================================
  // FONCTION: Soumettre l'évaluation
  // ============================================
  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateCurrentSlide()) {
      return;
    }

    if (!formData.prixAchat || !formData.anneeAchat || !formData.ville) {
      setError('🚨 Remplissez tous les champs obligatoires');
      return;
    }

    if (quotaInfo.remaining <= 0 && !quotaInfo.isUnlimited) {
      setError(`❌ Limite d'évaluations atteinte pour le plan ${quotaInfo.plan}`);
      return;
    }

    setLoading(true);
    setError('');
    setQuotaError('');
    setSelectedProperty(null);

    try {
      const response = await axios.post('/api/property/valuation-estimator', {
        userId: user.uid,
        titre: formData.titre,
        proprietyType: formData.proprietyType,
        ville: formData.ville,
        quartier: formData.quartier,
        addresseComplete: formData.addresseComplete,
        prixAchat: parseInt(formData.prixAchat),
        anneeAchat: formData.anneeAchat,
        anneeConstruction: formData.anneeConstruction,
        surfaceHabitee: formData.surfaceHabitee ? parseInt(formData.surfaceHabitee) : null,
        surfaceLot: formData.surfaceLot ? parseInt(formData.surfaceLot) : null,
        nombreChambres: parseInt(formData.nombreChambres),
        nombreSallesBain: parseInt(formData.nombreSallesBain),
        stationnements: formData.stationnements ? parseInt(formData.stationnements) : 0,
        sous_sol: formData.sous_sol,
        etatGeneral: formData.etatGeneral,
        renovations: formData.renovations,
        piscine: formData.piscine,
        terrasse: formData.terrasse,
        chauffageRadiant: formData.chauffageRadiant,
        climatisation: formData.climatisation,
        fireplace: formData.fireplace,
        sauna: formData.sauna,
        cinema: formData.cinema,
        salleSport: formData.salleSport,
        nombreLogements: formData.proprietyType === 'immeuble_revenus' ? parseInt(formData.nombreLogements) : null,
        terrain_detail: formData.terrain_detail,
        notes_additionnelles: formData.notes_additionnelles
      });

      console.log('🎉 Réponse API complète:', response.data);

      const db = getFirestore();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const analysesRef = collection(db, 'users', user.uid, 'analyses');
      const docRef = await addDoc(analysesRef, {
        titre: formData.titre,
        proprietyType: formData.proprietyType,
        ville: formData.ville,
        quartier: formData.quartier,
        addresseComplete: formData.addresseComplete,
        prixAchat: parseInt(formData.prixAchat),
        anneeAchat: formData.anneeAchat,
        anneeConstruction: formData.anneeConstruction,
        surfaceHabitee: formData.surfaceHabitee ? parseInt(formData.surfaceHabitee) : null,
        surfaceLot: formData.surfaceLot ? parseInt(formData.surfaceLot) : null,
        nombreChambres: parseInt(formData.nombreChambres),
        nombreSallesBain: parseInt(formData.nombreSallesBain),
        stationnements: formData.stationnements ? parseInt(formData.stationnements) : 0,
        sous_sol: formData.sous_sol,
        etatGeneral: formData.etatGeneral,
        renovations: formData.renovations,
        piscine: formData.piscine,
        terrasse: formData.terrasse,
        chauffageRadiant: formData.chauffageRadiant,
        climatisation: formData.climatisation,
        fireplace: formData.fireplace,
        sauna: formData.sauna,
        cinema: formData.cinema,
        salleSport: formData.salleSport,
        nombreLogements: formData.proprietyType === 'immeuble_revenus' ? parseInt(formData.nombreLogements) : null,
        terrain_detail: formData.terrain_detail,
        notes_additionnelles: formData.notes_additionnelles,
        result: response.data,
        createdAt: now
      });

      await updateDoc(doc(db, 'users', user.uid), {
        'quotaTracking.count': increment(1),
        'quotaTracking.month': currentMonth
      });

      const newProperty = {
        id: docRef.id,
        titre: formData.titre,
        proprietyType: formData.proprietyType,
        ville: formData.ville,
        quartier: formData.quartier,
        addresseComplete: formData.addresseComplete,
        prixAchat: parseInt(formData.prixAchat),
        anneeAchat: formData.anneeAchat,
        anneeConstruction: formData.anneeConstruction,
        surfaceHabitee: formData.surfaceHabitee ? parseInt(formData.surfaceHabitee) : null,
        surfaceLot: formData.surfaceLot ? parseInt(formData.surfaceLot) : null,
        nombreChambres: parseInt(formData.nombreChambres),
        nombreSallesBain: parseInt(formData.nombreSallesBain),
        stationnements: formData.stationnements ? parseInt(formData.stationnements) : 0,
        sous_sol: formData.sous_sol,
        etatGeneral: formData.etatGeneral,
        renovations: formData.renovations,
        piscine: formData.piscine,
        terrasse: formData.terrasse,
        chauffageRadiant: formData.chauffageRadiant,
        climatisation: formData.climatisation,
        fireplace: formData.fireplace,
        sauna: formData.sauna,
        cinema: formData.cinema,
        salleSport: formData.salleSport,
        nombreLogements: formData.proprietyType === 'immeuble_revenus' ? parseInt(formData.nombreLogements) : null,
        terrain_detail: formData.terrain_detail,
        notes_additionnelles: formData.notes_additionnelles,
        result: response.data,
        createdAt: now
      };

      setProperties([newProperty, ...properties]);
      
      setQuotaInfo(prev => ({
        ...prev,
        current: prev.current + 1,
        remaining: Math.max(0, prev.remaining - 1)
      }));

      setSelectedProperty(newProperty);
      setShowForm(false);
      setCurrentSlide(0);

      setFormData({
        titre: '',
        proprietyType: 'unifamilial',
        ville: '',
        quartier: '',
        addresseComplete: '',
        prixAchat: '',
        anneeAchat: new Date().getFullYear() - 5,
        anneeConstruction: 1990,
        surfaceHabitee: '',
        surfaceLot: '',
        nombreChambres: 3,
        nombreSallesBain: 2,
        stationnements: 0,
        sous_sol: 'finished',
        etatGeneral: 'bon',
        renovations: [],
        piscine: false,
        terrasse: false,
        chauffageRadiant: false,
        climatisation: false,
        fireplace: false,
        sauna: false,
        cinema: false,
        salleSport: false,
        nombreLogements: 4,
        terrain_detail: '',
        notes_additionnelles: ''
      });

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);

    } catch (error) {
      console.error('❌ Erreur complète:', error);
      if (error.response?.status === 429) {
        setQuotaError(error.response.data.error || 'Quota atteint');
      } else {
        setError(error.response?.data?.error || 'Erreur lors de l\'évaluation');
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FONCTION: Supprimer une évaluation
  // ============================================
  const deleteProperty = async (propertyId) => {
    if (!window.confirm('Confirmer la suppression?')) return;
    try {
      const db = getFirestore();
      
      await deleteDoc(doc(db, 'users', user.uid, 'analyses', propertyId));
      
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      await updateDoc(doc(db, 'users', user.uid), {
        'quotaTracking.count': increment(-1),
        'quotaTracking.month': currentMonth
      });

      setProperties(properties.filter(p => p.id !== propertyId));
      setSelectedProperty(null);
      
      setQuotaInfo(prev => ({
        ...prev,
        current: Math.max(0, prev.current - 1),
        remaining: prev.remaining + 1
      }));
      
      alert('✅ Évaluation supprimée');
    } catch (error) {
      console.error('Erreur:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  // ============================================
  // 🔒 PLAN ESSAI - BLOQUÉ
  // ============================================
  if (!isProPlan) {
    return (
      <div className="space-y-6 p-8">
        <LoadingSpinner 
          isLoading={loading} 
          messages={loadingMessages} 
        />

        <div className="p-8 bg-gradient-to-r from-indigo-100 to-indigo-50 rounded-2xl border-2 border-indigo-300 text-center">
          <h2 className="text-3xl font-black text-indigo-900 mb-3">🔒 Plan Pro Requis</h2>
          <p className="text-indigo-800 text-lg mb-6">
            L'évaluation immobilière est disponible à partir du plan <span className="font-bold">Pro ($29/mois)</span>
          </p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="px-12 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black text-lg rounded-xl hover:shadow-lg transform hover:-translate-y-1 transition-all"
          >
            💎 Upgrader maintenant
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDU PRINCIPAL
  // ============================================
  return (
    <div className="space-y-8">
      <LoadingSpinner 
        isLoading={loading} 
        messages={loadingMessages} 
      />

      {/* QUOTA INFO CARD */}
      {quotaInfo && !selectedProperty && (
        <div className={`p-6 rounded-xl border-2 transition-all ${
          quotaInfo.remaining > 0
            ? 'bg-emerald-50 border-emerald-300'
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg">
                {quotaInfo.remaining > 0 ? '📊 Évaluations restantes' : '❌ Quota atteint'}
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
              ? `${quotaInfo.remaining} évaluation${quotaInfo.remaining > 1 ? 's' : ''} restante${quotaInfo.remaining > 1 ? 's' : ''} ce mois`
              : `Réinitialisation ${quotaInfo.resetDate.toLocaleDateString('fr-CA')}`
            }
          </p>
        </div>
      )}

      {/* BOUTON NOUVELLE ÉVALUATION */}
      {!selectedProperty && !showForm && (
        <div className="text-center">
          <button
            onClick={() => {
              setShowForm(true);
              setCurrentSlide(0);
              setSlideErrors({});
            }}
            className="px-12 py-4 font-black text-xl rounded-xl shadow-lg transform hover:-translate-y-1 transition-all bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-indigo-400"
          >
            ➕ Nouvelle évaluation
          </button>
        </div>
      )}

      {/* FORMULAIRE AVEC SLIDES */}
      {showForm && !selectedProperty && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* HEADER DU FORMULAIRE */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 text-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-black">{slides[currentSlide].icon} {slides[currentSlide].title}</h2>
                  <p className="text-indigo-100 text-sm mt-1">{slides[currentSlide].description}</p>
                </div>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setCurrentSlide(0);
                    setSlideErrors({});
                  }}
                  className="text-indigo-200 hover:text-white text-2xl font-bold transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* BARRE DE PROGRESSION */}
              <div className="w-full bg-indigo-500/30 rounded-full h-2">
                <div
                  className="h-2 bg-white rounded-full transition-all duration-300"
                  style={{ width: `${slideProgress}%` }}
                />
              </div>
              <p className="text-indigo-100 text-xs mt-2">{currentSlide + 1} / {slides.length}</p>
            </div>

            {/* CONTENU DES SLIDES */}
            <div className="overflow-y-auto flex-1">
              <div className="px-8 py-8">
                
                {/* SLIDE 0: LOCALISATION */}
                {currentSlide === 0 && (
                  <div className="space-y-6">
                    {/* CHAMP TITRE */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Titre de la propriété <span className="text-gray-400 text-xs">(optionnel)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.titre}
                        onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                        placeholder="Ex: Belle maison au Plateau, Condo Griffintown, Triplex Vanier..."
                        className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Type de propriété <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-3">
                        {propertyTypes.map(type => (
                          <button
                            key={type.value}
                            onClick={() => {
                              setFormData({ 
                                ...formData, 
                                proprietyType: type.value,
                                nombreLogements: type.value === 'immeuble_revenus' ? 4 : formData.nombreLogements
                              });
                              setSlideErrors({...slideErrors, proprietyType: ''});
                            }}
                            className={`p-4 rounded-xl border-2 font-semibold transition-all text-center ${
                              formData.proprietyType === type.value
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'
                            }`}
                          >
                            <span className="text-2xl block mb-1">{type.icon}</span>
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formData.proprietyType === 'immeuble_revenus' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Nombre de logements <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          value={formData.nombreLogements}
                          onChange={(e) => setFormData({ ...formData, nombreLogements: parseInt(e.target.value) || 4 })}
                          min="4"
                          max="200"
                          className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Ville <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ville}
                        onChange={(e) => {
                          setFormData({ ...formData, ville: e.target.value });
                          setSlideErrors({...slideErrors, ville: ''});
                        }}
                        placeholder="Ex: Montréal, Québec, Lévis..."
                        className={`w-full p-4 bg-white border-2 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                          slideErrors.ville ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {slideErrors.ville && <p className="text-red-500 text-xs mt-1">{slideErrors.ville}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Quartier <span className="text-gray-400 text-xs">(optionnel)</span></label>
                      <input
                        type="text"
                        value={formData.quartier}
                        onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                        placeholder="Ex: Plateau, Griffintown, Outremont..."
                        className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Adresse complète <span className="text-gray-400 text-xs">(optionnel)</span></label>
                      <input
                        type="text"
                        value={formData.addresseComplete}
                        onChange={(e) => setFormData({ ...formData, addresseComplete: e.target.value })}
                        placeholder="123 rue Example, Montréal..."
                        className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* SLIDE 1: ACQUISITION */}
                {currentSlide === 1 && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Prix d'achat <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={formData.prixAchat}
                          onChange={(e) => {
                            setFormData({ ...formData, prixAchat: e.target.value });
                            setSlideErrors({...slideErrors, prixAchat: ''});
                          }}
                          placeholder="500000"
                          className={`flex-1 p-4 bg-white border-2 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                            slideErrors.prixAchat ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        <div className="flex items-center px-6 bg-indigo-50 border-2 border-indigo-300 rounded-lg text-indigo-700 font-black text-xl">
                          $
                        </div>
                      </div>
                      {slideErrors.prixAchat && <p className="text-red-500 text-xs mt-1">{slideErrors.prixAchat}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Année d'achat <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.anneeAchat}
                        onChange={(e) => {
                          setFormData({ ...formData, anneeAchat: parseInt(e.target.value) });
                          setSlideErrors({...slideErrors, anneeAchat: ''});
                        }}
                        min="1950"
                        max={new Date().getFullYear()}
                        className={`w-full p-4 bg-white border-2 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                          slideErrors.anneeAchat ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {slideErrors.anneeAchat && <p className="text-red-500 text-xs mt-1">{slideErrors.anneeAchat}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Année de construction <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        value={formData.anneeConstruction}
                        onChange={(e) => setFormData({ ...formData, anneeConstruction: parseInt(e.target.value) })}
                        min="1850"
                        max={new Date().getFullYear()}
                        className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* SLIDE 2: DIMENSIONS */}
                {currentSlide === 2 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Surface habitée (pi²) <span className="text-gray-400 text-xs">(optionnel)</span></label>
                        <input
                          type="number"
                          value={formData.surfaceHabitee}
                          onChange={(e) => setFormData({ ...formData, surfaceHabitee: e.target.value })}
                          placeholder="2000"
                          className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Surface du lot (pi²) <span className="text-gray-400 text-xs">(optionnel)</span></label>
                        <input
                          type="number"
                          value={formData.surfaceLot}
                          onChange={(e) => setFormData({ ...formData, surfaceLot: e.target.value })}
                          placeholder="8000"
                          className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Chambres <span className="text-gray-400 text-xs">(optionnel)</span></label>
                        <input
                          type="number"
                          value={formData.nombreChambres}
                          onChange={(e) => setFormData({ ...formData, nombreChambres: parseInt(e.target.value) })}
                          min="1"
                          className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-center font-bold text-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Salles de bain <span className="text-gray-400 text-xs">(optionnel)</span></label>
                        <input
                          type="number"
                          value={formData.nombreSallesBain}
                          onChange={(e) => setFormData({ ...formData, nombreSallesBain: parseInt(e.target.value) })}
                          min="1"
                          className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-center font-bold text-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Stationnements <span className="text-gray-400 text-xs">(optionnel)</span></label>
                        <input
                          type="number"
                          value={formData.stationnements}
                          onChange={(e) => setFormData({ ...formData, stationnements: parseInt(e.target.value) || 0 })}
                          min="0"
                          max="10"
                          className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-center font-bold text-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SLIDE 3: CONDITION */}
                {currentSlide === 3 && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">État du sous-sol <span className="text-gray-400 text-xs">(optionnel)</span></label>
                      <div className="grid grid-cols-2 gap-3">
                        {typesUnderground.map(type => (
                          <button
                            key={type.value}
                            onClick={() => setFormData({ ...formData, sous_sol: type.value })}
                            className={`p-4 rounded-xl border-2 font-semibold transition-all text-center ${
                              formData.sous_sol === type.value
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'
                            }`}
                          >
                            <span className="text-2xl block mb-1">{type.icon}</span>
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">État général de la propriété <span className="text-gray-400 text-xs">(optionnel)</span></label>
                      <div className="space-y-2">
                        {etatsGeneraux.map(etat => (
                          <button
                            key={etat.value}
                            onClick={() => setFormData({ ...formData, etatGeneral: etat.value })}
                            className={`w-full p-4 rounded-xl border-2 font-semibold transition-all text-left flex items-center gap-3 ${
                              formData.etatGeneral === etat.value
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'
                            }`}
                          >
                            <span className="text-2xl">{etat.icon}</span>
                            {etat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* SLIDE 4: AMÉNAGEMENTS */}
                {currentSlide === 4 && (
                  <div className="space-y-6">
                    <p className="text-gray-600 text-sm">Sélectionnez les aménagements premium de votre propriété <span className="text-gray-400 text-xs">(optionnel)</span></p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {amenagements.map(item => (
                        <button
                          key={item.key}
                          onClick={() => setFormData({ ...formData, [item.key]: !formData[item.key] })}
                          className={`p-4 rounded-xl border-2 font-semibold transition-all text-center flex flex-col items-center gap-2 ${
                            formData[item.key]
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'
                          }`}
                        >
                          <span className="text-2xl">{item.icon}</span>
                          <span className="text-xs">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SLIDE 5: DÉTAILS ADDITIONNELS */}
                {currentSlide === 5 && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Détails du terrain <span className="text-gray-400 text-xs">(optionnel)</span></label>
                      <textarea
                        value={formData.terrain_detail}
                        onChange={(e) => setFormData({ ...formData, terrain_detail: e.target.value })}
                        placeholder="Terrain arrière, accès à l'eau, vue panoramique, dépendances..."
                        rows="4"
                        className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Notes additionnelles <span className="text-gray-400 text-xs">(optionnel)</span></label>
                      <textarea
                        value={formData.notes_additionnelles}
                        onChange={(e) => setFormData({ ...formData, notes_additionnelles: e.target.value })}
                        placeholder="Rénovations récentes, améliorations futures envisagées, problèmes connus..."
                        rows="4"
                        className="w-full p-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                      />
                    </div>

                    <div className="p-4 bg-indigo-50 rounded-xl border-2 border-indigo-300">
                      <p className="text-sm text-indigo-800">
                        <span className="font-bold">💡 Conseil:</span> Plus d'informations = meilleure évaluation!
                      </p>
                    </div>
                  </div>
                )}

                {/* ERREUR D'API */}
                {error && (
                  <div className="p-4 bg-red-100 border-2 border-red-300 rounded-lg text-red-700 font-semibold">
                    {error}
                  </div>
                )}

                {quotaError && (
                  <div className="p-4 bg-red-100 border-2 border-red-300 rounded-lg text-red-700 font-semibold">
                    {quotaError}
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER: BOUTONS DE NAVIGATION */}
            <div className="bg-gray-50 px-8 py-6 border-t-2 border-gray-200 flex gap-3 justify-between">
              <button
                onClick={goToPrevSlide}
                disabled={currentSlide === 0}
                className={`px-8 py-3 font-bold rounded-lg transition-all ${
                  currentSlide === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                ← Précédent
              </button>

              <div className="flex gap-2">
                {slides.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentSlide ? 'bg-indigo-600 w-8' : 'bg-gray-300 w-2'
                    }`}
                  />
                ))}
              </div>

              {currentSlide < slides.length - 1 ? (
                <button
                  onClick={goToNextSlide}
                  className="px-8 py-3 font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                >
                  Suivant →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || quotaInfo.remaining <= 0}
                  className={`px-8 py-3 font-bold rounded-lg transition-all ${
                    loading || quotaInfo.remaining <= 0
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {loading ? '🔄 Évaluation...' : '✅ Évaluer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RÉSULTATS DE L'ÉVALUATION */}
      {selectedProperty && selectedProperty.result && (
        <div ref={resultRef} className="space-y-6">
          {/* HERO SECTION AVEC TITRE */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                {selectedProperty?.titre && (
                  <h2 className="text-3xl font-black text-indigo-600 mb-2">{selectedProperty.titre}</h2>
                )}
                <h3 className="text-4xl font-black text-gray-900 mb-2">✅ Évaluation complète</h3>
                <p className="text-gray-600 text-lg">Analyse détaillée par l'IA pour {selectedProperty?.ville}</p>
              </div>
              <button
                onClick={() => setSelectedProperty(null)}
                className="text-2xl font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* PROPRIÉTÉ INFO */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Type</p>
                <p className="text-lg font-black text-gray-900 mt-2">
                  {formatPropertyType(selectedProperty?.proprietyType)}
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Ville</p>
                <p className="text-lg font-black text-gray-900 mt-2">{selectedProperty?.ville || 'N/A'}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Prix d'achat</p>
                <p className="text-lg font-black text-green-600 mt-2">${formatCurrency(selectedProperty?.prixAchat)}</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Année d'achat</p>
                <p className="text-lg font-black text-gray-900 mt-2">{selectedProperty?.anneeAchat || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* VALEUR ESTIMÉE */}
          <div className="bg-emerald-500 rounded-2xl p-8 text-white shadow-lg">
            <p className="text-emerald-100 text-sm font-semibold uppercase tracking-widest">💰 Valeur estimée actuelle</p>
            <p className="text-5xl font-black mt-3 mb-6">${formatCurrency(selectedProperty?.result?.estimationActuelle?.valeurMoyenne)}</p>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/20 rounded-xl p-4">
                <p className="text-emerald-100 text-sm font-semibold">Valeur basse</p>
                <p className="font-black text-xl mt-2">${formatCurrency(selectedProperty?.result?.estimationActuelle?.valeurBasse)}</p>
              </div>
              <div className="bg-white/20 rounded-xl p-4">
                <p className="text-emerald-100 text-sm font-semibold">Valeur haute</p>
                <p className="font-black text-xl mt-2">${formatCurrency(selectedProperty?.result?.estimationActuelle?.valeurHaute)}</p>
              </div>
              <div className="bg-white/20 rounded-xl p-4">
                <p className="text-emerald-100 text-sm font-semibold">Gain potentiel</p>
                <p className="font-black text-xl mt-2">{selectedProperty?.result?.analyse?.pourcentageGain || 'N/A'}%</p>
              </div>
            </div>
          </div>

          {/* ANALYSE DU QUARTIER */}
          {selectedProperty?.result?.analyse?.quartierAnalysis && (
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <h4 className="font-black text-2xl text-gray-900 mb-4">📍 Analyse du quartier</h4>
              <p className="text-gray-700 leading-relaxed text-base">{selectedProperty.result.analyse.quartierAnalysis}</p>
            </div>
          )}

          {/* ÉVALUATION COMPARABLE */}
          {selectedProperty?.result?.comparable?.evaluationQualite && (
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <h4 className="font-black text-2xl text-gray-900 mb-4">📊 Comparables du marché</h4>
              <p className="text-gray-700 leading-relaxed text-base">{selectedProperty.result.comparable.evaluationQualite}</p>
            </div>
          )}

          {/* RECOMMANDATIONS */}
          {selectedProperty?.result?.recommendations && (
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <h4 className="font-black text-2xl text-gray-900 mb-6">💡 Recommandations</h4>
              <div className="space-y-4">
                {selectedProperty.result.recommendations.strategie && (
                  <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500">
                    <p className="font-black text-blue-900 mb-2">🎯 Stratégie d'investissement</p>
                    <p className="text-gray-700 leading-relaxed">{selectedProperty.result.recommendations.strategie}</p>
                  </div>
                )}
                {selectedProperty.result.recommendations.venteMeilleuresChances && (
                  <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500">
                    <p className="font-black text-green-900 mb-2">📅 Meilleures chances de vente</p>
                    <p className="text-gray-700 leading-relaxed">{selectedProperty.result.recommendations.venteMeilleuresChances}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DÉTAILS SUPPLÉMENTAIRES */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {selectedProperty?.surfaceHabitee && (
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">📐 Surface habitée</p>
                <p className="text-3xl font-black text-gray-900 mt-3">{formatCurrency(selectedProperty.surfaceHabitee)}</p>
                <p className="text-gray-500 text-xs mt-1">pi²</p>
              </div>
            )}
            {selectedProperty?.nombreChambres && (
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">🛏️ Chambres</p>
                <p className="text-3xl font-black text-gray-900 mt-3">{selectedProperty.nombreChambres}</p>
              </div>
            )}
            {selectedProperty?.nombreSallesBain && (
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">🚿 Salles de bain</p>
                <p className="text-3xl font-black text-gray-900 mt-3">{selectedProperty.nombreSallesBain}</p>
              </div>
            )}
            {selectedProperty?.stationnements !== undefined && selectedProperty?.stationnements >= 0 && (
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">🅿️ Stationnements</p>
                <p className="text-3xl font-black text-gray-900 mt-3">{selectedProperty.stationnements}</p>
              </div>
            )}
          </div>

          {/* AMÉNAGEMENTS SÉLECTIONNÉS */}
          {(selectedProperty?.piscine || selectedProperty?.terrasse || selectedProperty?.chauffageRadiant || 
            selectedProperty?.climatisation || selectedProperty?.fireplace || selectedProperty?.sauna || 
            selectedProperty?.cinema || selectedProperty?.salleSport) && (
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <h4 className="font-black text-2xl text-gray-900 mb-6">✨ Aménagements premium</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedProperty?.piscine && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 text-center">
                    <span className="text-3xl block mb-2">🏊</span><span className="font-semibold text-gray-700">Piscine</span>
                  </div>
                )}
                {selectedProperty?.terrasse && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-center">
                    <span className="text-3xl block mb-2">🏡</span><span className="font-semibold text-gray-700">Terrasse</span>
                  </div>
                )}
                {selectedProperty?.chauffageRadiant && (
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 text-center">
                    <span className="text-3xl block mb-2">🌡️</span><span className="font-semibold text-gray-700">Chauffage radiant</span>
                  </div>
                )}
                {selectedProperty?.climatisation && (
                  <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200 text-center">
                    <span className="text-3xl block mb-2">❄️</span><span className="font-semibold text-gray-700">Climatisation</span>
                  </div>
                )}
                {selectedProperty?.fireplace && (
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200 text-center">
                    <span className="text-3xl block mb-2">🔥</span><span className="font-semibold text-gray-700">Foyer</span>
                  </div>
                )}
                {selectedProperty?.sauna && (
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 text-center">
                    <span className="text-3xl block mb-2">🧖</span><span className="font-semibold text-gray-700">Sauna</span>
                  </div>
                )}
                {selectedProperty?.cinema && (
                  <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 text-center">
                    <span className="text-3xl block mb-2">🎬</span><span className="font-semibold text-gray-700">Salle cinéma</span>
                  </div>
                )}
                {selectedProperty?.salleSport && (
                  <div className="bg-pink-50 rounded-lg p-4 border border-pink-200 text-center">
                    <span className="text-3xl block mb-2">💪</span><span className="font-semibold text-gray-700">Salle sport</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DELETE BUTTON */}
          <div className="text-center pb-8">
            <button
              onClick={() => deleteProperty(selectedProperty.id)}
              className="px-8 py-3 bg-red-600 text-white font-black rounded-lg hover:bg-red-700 transition-all"
            >
              🗑️ Supprimer cette évaluation
            </button>
          </div>
        </div>
      )}

      {/* LISTE DES ÉVALUATIONS PRÉCÉDENTES */}
      {!selectedProperty && properties.length > 0 && !showForm && (
        <div className="space-y-6">
          <h3 className="text-3xl font-black text-gray-900">📋 Mes évaluations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <div
                key={property.id}
                onClick={() => setSelectedProperty(property)}
                className="rounded-2xl border-2 border-gray-300 bg-white hover:border-indigo-500 cursor-pointer transition-all transform hover:scale-105 hover:shadow-lg p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    {property?.titre && (
                      <p className="text-indigo-600 font-black text-sm mb-1">{property.titre}</p>
                    )}
                    <h4 className="font-black text-lg text-gray-900">
                      {formatPropertyType(property?.proprietyType)}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">{property?.ville || 'N/A'}</p>
                  </div>
                  <span className="text-4xl">🏠</span>
                </div>

                <div className="bg-green-50 rounded-lg p-3 mb-3 border border-green-200">
                  <p className="text-xs text-gray-500">Prix d'achat</p>
                  <div className="text-lg font-black text-green-600">${formatCurrency(property?.prixAchat)}</div>
                </div>

                {property?.result?.estimationActuelle?.valeurMoyenne && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-200">
                    <p className="text-xs text-gray-500">Valeur estimée:</p>
                    <p className="font-black text-blue-600">${formatCurrency(property.result.estimationActuelle.valeurMoyenne)}</p>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-3">
                  📅 {property?.createdAt ? new Date(property.createdAt).toLocaleDateString('fr-CA') : 'N/A'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MESSAGE VIDE */}
      {!selectedProperty && properties.length === 0 && !showForm && (
        <div className="p-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 text-center">
          <p className="text-gray-600 text-xl font-bold">Aucune évaluation pour le moment.</p>
          <p className="text-gray-500 text-sm mt-3">Commencez par créer votre première évaluation! 🚀</p>
        </div>
      )}
    </div>
  );
}


// ============================================
// 🏠 HOME PAGE (Code existant inchangé)
// ============================================

//--- ANIMATION HOME PAGE --- 

function CounterAnimation({ end, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      if (typeof end === 'number') {
        setCount(Math.floor(end * progress));
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  const formatValue = () => {
    if (typeof end === 'string') {
      if (end.includes('%')) return `+${count}%`;
      if (end.includes('★')) return `${(count / 10).toFixed(1)}★`;
      if (end.includes('+')) return `${count.toLocaleString()}+`;
      if (end.includes('M')) return `$${(count / 10).toFixed(1)}M+`;
    }
    return count.toLocaleString();
  };

  return <span ref={ref}>{formatValue()}</span>;
}

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
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition">
              <img
                src="https://i.ibb.co/tMbhC8Sy/Minimalist-Real-Estate-Logo-1.png"
                alt="OptimiPlex Logo"
                className="w-16 h-16 rounded-xl shadow-lg shadow-indigo-200/40 bg-white/90 p-1"
              />
              <span className="font-black text-gray-900 text-3xl hidden sm:inline tracking-tight">
                OptimiPlex
              </span>
            </Link>

            <nav className="flex items-center space-x-4">
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
                className="px-6 py-2 text-gray-700 hover:text-gray-900 font-semibold transition"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-indigo-300/40 transition-all"
              >
                Commencer
              </Link>
            </nav>
          </div>
        </header>

        {/* ==================== HERO SECTION ==================== */}
        <section className="relative min-h-[900px] max-w-7xl mx-auto px-6 py-20 sm:py-28 text-center flex flex-col justify-center">
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
          <h1 className="relative z-10 text-5xl sm:text-7xl font-black text-gray-900 mb-6 leading-tight tracking-tight">
            Évaluez. Optimisez.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Augmentez vos revenus
            </span>
          </h1>

          {/* Subheadline */}
          <p className="relative z-10 text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto mb-4 font-light">
            Plateforme IA complète pour immobilier résidentiel et commercial. Évaluations précises + recommandations d'optimisation de loyers.
            <span className="block mt-2 font-bold text-gray-900">
              +18% de revenus en moyenne.
            </span>
          </p>

          {/* Trust Badges */}
          <div className="relative z-10 flex flex-col sm:flex-row justify-center gap-6 mt-8 text-sm text-gray-600 mb-12">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">✅</span>
              <span>Données Centris en direct</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">⚡</span>
              <span>Résultats en moins d'1 minute</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">🔒</span>
              <span>100% sécurisé</span>
            </div>
          </div>

          {/* CTA Button */}
          <div className="relative z-10 mb-12 flex gap-4 justify-center flex-wrap">
            <Link
              to="/register"
              className="inline-block px-8 sm:px-10 py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 text-white rounded-xl font-bold text-lg shadow-[0_18px_45px_rgba(79,70,229,0.35)] hover:shadow-[0_20px_60px_rgba(56,189,248,0.5)] transform hover:-translate-y-1 transition-all card-hover"
            >
              📊 Évaluer ma propriété
            </Link>
            <Link
              to="/register"
              className="inline-block px-8 sm:px-10 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold text-lg hover:bg-indigo-50 transform hover:-translate-y-1 transition-all card-hover"
            >
              💰 Optimiser mes revenus
            </Link>
          </div>

          {/* Hero Visual */}
          <div className="relative z-10 mt-16">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-200/50 via-sky-200/40 to-emerald-200/40 rounded-3xl opacity-80 blur-xl" />
            <div className="relative rounded-3xl overflow-hidden border border-white/60 bg-white/80 backdrop-blur-2xl p-8 shadow-2xl shadow-gray-200/70 card-hover">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Évaluation */}
                <div className="p-6 bg-white/90 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-200/40 transition card-hover">
                  <div className="text-4xl mb-3">📊</div>
                  <h3 className="font-black text-gray-900 mb-2">Évaluation complète</h3>
                  <p className="text-sm text-gray-600 mb-3">Valeur marchande de votre propriété</p>
                  <p className="text-3xl font-black text-indigo-600 mb-2">$585,000</p>
                  <p className="text-xs text-gray-500">+15% depuis achat</p>
                </div>

                {/* Card 2: Optimisation */}
                <div className="p-6 bg-gradient-to-br from-emerald-100/40 via-emerald-200/30 to-emerald-50/40 rounded-2xl border-2 border-emerald-300 shadow-lg shadow-emerald-200/40 card-hover">
                  <div className="text-4xl mb-3">💰</div>
                  <h3 className="font-black text-emerald-900 mb-2">Revenu optimal</h3>
                  <p className="text-sm text-emerald-700 font-semibold mb-3">Loyer réaliste et compétitif</p>
                  <p className="text-3xl font-black text-emerald-700 mb-2">$1,750/mois</p>
                  <p className="text-xs text-emerald-600 font-semibold">+$350/mois (+25%)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== FEATURES SECTION ==================== */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-20">
          <div className="fade-in-up mx-auto max-w-3xl text-center mb-16" style={{ animationDelay: '0s' }}>
            <h2 className="text-4xl font-black text-gray-900 mb-4">
              Pourquoi choisir OptimiPlex?
            </h2>
            <p className="text-gray-600">
              Une plateforme complète pour évaluer vos propriétés ET optimiser vos revenus locatifs, 
              qu'elles soient résidentielles ou commerciales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: '📊',
                title: 'Évaluation Immobilière IA',
                description: 'Analyse complète de la valeur de vos propriétés basée sur données Centris vérifiées et comparables locaux'
              },
              {
                icon: '💰',
                title: 'Optimisation de Loyers',
                description: 'Découvrez le loyer optimal pour vos propriétés résidentielles et commerciales basé sur le marché'
              },
              {
                icon: '🏠',
                title: 'Résidentiel & Commercial',
                description: 'Analyse complète pour immeubles multi-logements, maisons, condos, bureaux, retail et entrepôts'
              },
              {
                icon: '📈',
                title: 'Analyses Comparables',
                description: 'Justification détaillée avec propriétés similaires réellement vendues/louées sur Centris'
              },
              {
                icon: '⚡',
                title: 'Ultra Rapide',
                description: 'Évaluation et optimisation complètes en moins d\'une minute avec rapports détaillés'
              },
              {
                icon: '🎯',
                title: 'Plan d\'Action Complet',
                description: 'Recommandations stratégiques pour maximiser la valeur ET les revenus locatifs de vos biens'
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="fade-in-up p-8 rounded-2xl border border-gray-200 bg-white/80 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-200/40 transition-all group cursor-pointer backdrop-blur-xl glow-on-hover card-hover"
                style={{ animationDelay: `${0.15 * i}s` }}
              >
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-100/60 border border-indigo-200 text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== TWO PILLARS SECTION ==================== */}
        <section className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="fade-in-up text-4xl font-black text-gray-900 text-center mb-16" style={{ animationDelay: '0s' }}>
            Deux outils puissants, une plateforme
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* PILLAR 1: ÉVALUATION */}
            <div className="fade-in-up" style={{ animationDelay: '0s' }}>
              <div className="p-8 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-3xl border-2 border-indigo-300 shadow-lg shadow-indigo-200/40 card-hover">
                <div className="text-6xl mb-6">📊</div>
                <h3 className="text-3xl font-black text-gray-900 mb-4">Évaluation Immobilière</h3>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  Découvrez la vraie valeur marchande de vos propriétés avec une analyse IA complète basée sur données Centris en temps réel.
                </p>
                
                <div className="space-y-3 mb-8">
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900">Analyse comparative de marché</p>
                      <p className="text-sm text-gray-600">Comparables directs et tendances locales</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900">Évaluation par approche revenus</p>
                      <p className="text-sm text-gray-600">Basée sur potentiel locatif actuel</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900">Rapport professionnel complet</p>
                      <p className="text-sm text-gray-600">Détail des facteurs influençant la valeur</p>
                    </div>
                  </div>
                </div>

                <Link
                  to="/register"
                  className="inline-block px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all"
                >
                  Évaluer ma propriété →
                </Link>
              </div>
            </div>

            {/* PILLAR 2: OPTIMISATION */}
            <div className="fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="p-8 bg-gradient-to-br from-emerald-50/50 to-green-50/50 rounded-3xl border-2 border-emerald-300 shadow-lg shadow-emerald-200/40 card-hover">
                <div className="text-6xl mb-6">💰</div>
                <h3 className="text-3xl font-black text-gray-900 mb-4">Optimisation de Loyers</h3>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  Trouvez le loyer optimal pour vos unités résidentielles et commerciales avec recommandations basées sur données marché.
                </p>
                
                <div className="space-y-3 mb-8">
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900">Analyse loyers comparables</p>
                      <p className="text-sm text-gray-600">Propriétés similaires dans votre région</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900">Résidentiel & Commercial</p>
                      <p className="text-sm text-gray-600">Maisons, condos, immeubles, bureaux, retail</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 font-black text-xl mt-1">✓</span>
                    <div>
                      <p className="font-bold text-gray-900">Stratégies de positionnement</p>
                      <p className="text-sm text-gray-600">Comment attirer locataires au meilleur prix</p>
                    </div>
                  </div>
                </div>

                <Link
                  to="/register"
                  className="inline-block px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all"
                >
                  Optimiser mes revenus →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== HOW IT WORKS ==================== */}
        <section className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="fade-in-up text-4xl font-black text-gray-900 text-center mb-16" style={{ animationDelay: '0s' }}>
            Comment ça marche en 3 étapes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1️⃣',
                title: 'Créez compte gratuit',
                description: 'Inscription en 60 secondes. Aucune carte bancaire requise pour l\'essai.'
              },
              {
                step: '2️⃣',
                title: 'Entrez détails propriété',
                description: 'Remplissez formulaire simple: type, localisation, revenus actuels, caractéristiques.'
              },
              {
                step: '3️⃣',
                title: 'Recevez rapport complet',
                description: 'Évaluation, recommandations de loyers, plan d\'action détaillé en moins d\'une minute.'
              }
            ].map((step, i) => (
              <div
                key={i}
                className="fade-in-up relative"
                style={{ animationDelay: `${0.2 * i}s` }}
              >
                <div className="p-8 bg-white/80 rounded-2xl border border-gray-200 text-center backdrop-blur-xl shadow-lg shadow-gray-200/60 card-hover glow-on-hover">
                  <div className="text-5xl mb-4">{step.step}</div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-700">
                    {step.description}
                  </p>
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

        {/* ==================== PROOF SECTION ==================== */}
        <section className="bg-gradient-to-r from-indigo-50/70 via-sky-50/50 to-transparent py-20 my-20">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="fade-in-up text-4xl font-black text-gray-900 text-center mb-16" style={{ animationDelay: '0s' }}>
              Résultats vérifiés de nos utilisateurs
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { end: 2840, label: 'Propriétés évaluées', suffix: '+' },
                { end: 18, label: 'Augmentation revenus moyenne', suffix: '%' },
                { end: 48, label: 'Note moyenne utilisateurs', suffix: '★' },
                { end: 98, label: 'Utilisateurs satisfaits', suffix: '%' }
              ].map((stat, i) => (
                <div
                  key={i}
                  className="fade-in-up text-center p-8 bg-white/80 rounded-2xl border border-gray-200 shadow-lg shadow-gray-200/60 backdrop-blur-xl card-hover glow-on-hover"
                  style={{ animationDelay: `${0.15 * i}s` }}
                >
                  <p className="text-4xl font-black text-indigo-600 mb-2 whitespace-nowrap">
                    {stat.suffix.includes('★') ? (
                      <>
                        <CounterAnimation end={stat.end} duration={2500} />
                        <span>★</span>
                      </>
                    ) : stat.suffix === '+' ? (
                      <>
                        <CounterAnimation end={2840} duration={2500} />+
                      </>
                    ) : (
                      <>
                        <CounterAnimation end={stat.end} duration={2500} />%
                      </>
                    )}
                  </p>
                  <p className="text-gray-700 font-semibold">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== TESTIMONIALS ==================== */}
        <section className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="fade-in-up text-4xl font-black text-gray-900 text-center mb-16" style={{ animationDelay: '0s' }}>
            Témoignages d'utilisateurs
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Marie L.',
                title: 'Propriétaire, Montréal',
                comment: 'L\'évaluation m\'a montré que mon triplex était évalué 15% au-dessus du marché. Grâce aux recommandations, j\'ai augmenté mon loyer de $150/mois.',
                rating: 5
              },
              {
                name: 'Jean D.',
                title: 'Investisseur immobilier',
                comment: 'Bon outil pour analyser rapidement mes propriétés. Les données Centris sont fiables. Quelques fonctionnalités manquantes pour vraiment avancé.',
                rating: 4
              },
              {
                name: 'Sophie M.',
                title: 'Gestionnaire immobilier',
                comment: 'Permet à mes clients de faire décisions data-driven. Les rapports sont professionnels et bien présentés. Support excellent.',
                rating: 5
              },
              {
                name: 'Pierre G.',
                title: 'Propriétaire, Québec',
                comment: 'Rapport détaillé sur ma maison en location. Les comparables m\'ont aidé à négocier un meilleur loyer. Vraiment satisfait.',
                rating: 5
              },
              {
                name: 'Claudette R.',
                title: 'Retraitée, Laval',
                comment: 'Simple à utiliser même pour quelqu\'un pas technologique. L\'optimisation loyer était très utile. Recommande!',
                rating: 4
              },
              {
                name: 'Luc T.',
                title: 'Développeur immobilier',
                comment: 'Outil pratique et complet. Les données sont actuelles. Le prix est raisonnable pour ce qu\'on reçoit.',
                rating: 4
              }
            ].map((testimonial, i) => (
              <div
                key={i}
                className="fade-in-up p-8 bg-white/80 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-200/40 transition backdrop-blur-xl card-hover glow-on-hover"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <span 
                      key={j} 
                      className={`text-lg ${j < testimonial.rating ? 'text-amber-400' : 'text-gray-300'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">
                  "{testimonial.comment}"
                </p>
                <p className="font-black text-gray-900">
                  {testimonial.name}
                </p>
                <p className="text-sm text-gray-600">
                  {testimonial.title}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== PRICING SECTION ==================== */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="fade-in-up text-4xl font-black text-gray-900 text-center mb-4" style={{ animationDelay: '0s' }}>
            Tarification simple & transparente
          </h2>
          <p className="fade-in-up text-xl text-gray-600 text-center max-w-2xl mx-auto mb-16" style={{ animationDelay: '0.2s' }}>
            Pas de surprises. Pas de frais cachés. Cancellation n'importe quand.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                  'Support email'
                ],
                highlighted: false
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
                  'Export PDF'
                ],
                highlighted: true
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
                  'API access',
                  'Analyse portefeuille'
                ],
                highlighted: false
              }
            ].map((plan, i) => (
              <div
                key={i}
                className={`fade-in-up rounded-2xl border p-8 transition-all backdrop-blur-xl card-hover glow-on-hover ${
                  plan.highlighted
                    ? 'border-indigo-400 bg-gradient-to-b from-indigo-100/40 via-white/90 to-white shadow-2xl shadow-indigo-200/50 transform scale-[1.03]'
                    : 'border-gray-200 bg-white/80 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-200/40'
                }`}
                style={{ animationDelay: `${0.15 * i}s` }}
              >
                {plan.highlighted && (
                  <div className="mb-4 inline-block px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-full">
                    🌟 POPULAIRE
                  </div>
                )}
                <h3 className="text-2xl font-black text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  {plan.description}
                </p>
                <div className="mb-8">
                  <span className="text-4xl font-black text-gray-900">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-gray-600">
                      {plan.period}
                    </span>
                  )}
                </div>
                <Link
                  to="/register"
                  className={`block w-full py-3 px-6 rounded-lg font-bold mb-8 text-center transition-all ${
                    plan.highlighted
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Commencer
                </Link>
                <ul className="space-y-3">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-gray-700">
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
        <section className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="fade-in-up text-4xl font-black text-gray-900 text-center mb-16" style={{ animationDelay: '0s' }}>
            Questions fréquentes
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'Quelle est la différence entre Évaluation et Optimisation?',
                a: 'Évaluation détermine la valeur marchande actuelle de votre propriété. Optimisation recommande le loyer idéal à demander pour maximiser revenus. Les deux utilisent IA et données Centris.'
              },
              {
                q: 'Fonctionne-t-il pour propriétés commerciales?',
                a: 'Oui! Plans Pro+ incluent analyse pour immeubles à revenus, bureaux, retail et entrepôts. Algorithe est adapté pour chaque type.'
              },
              {
                q: 'Comment OptimiPlex évalue-t-elle une propriété?',
                a: 'Nous analysons comparables Centris, revenus locatifs, condition, localisation, et appliquons ML pour prédire valeur actuelle. Vous voyez tous les facteurs influençant.'
              },
              {
                q: 'Quel est le taux de précision?',
                a: '85-92% dépendant région et données. Pour chaque recommandation, vous voyez score confiance exact et les propriétés comparables utilisées.'
              },
              {
                q: 'Puis-je annuler mon abonnement?',
                a: 'Oui, cancellation 1 click. Aucun engagement à long terme. Pas de frais supplémentaires pour annuler.'
              },
              {
                q: 'Mes données sont-elles sécurisées?',
                a: 'Absolument. Encryption AES-256, serveurs Firebase sécurisés, GDPR compliant. Vos données ne sont jamais vendues, partagées ou utilisées pour marketing.'
              }
            ].map((faq, i) => (
              <details
                key={i}
                className="fade-in-up group p-6 bg-white/80 rounded-2xl border border-gray-200 cursor-pointer hover:border-indigo-300 transition backdrop-blur-xl glow-on-hover"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <summary className="flex items-center gap-3 font-black text-gray-900 text-lg list-none">
                  <span className="group-open:rotate-180 transition-transform text-indigo-500">▶</span>
                  {faq.q}
                </summary>
                <p className="mt-4 text-gray-700 ml-8">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ==================== FOOTER ==================== */}
        <footer className="border-t border-gray-200 bg-white/90 py-12 mt-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between">
              <div>
                <h4 className="font-black text-gray-900 mb-2">OptimiPlex</h4>
                <p className="text-sm text-gray-600">
                  Évaluez et optimisez vos propriétés immobilières avec IA
                </p>
              </div>
              <div className="mt-6 sm:mt-0 text-center sm:text-right">
                <p className="text-sm text-gray-600">
                  <a href="#" className="hover:text-gray-900 transition">Contact</a>
                  {' • '}
                  <a href="#" className="hover:text-gray-900 transition">Conditions</a>
                  {' • '}
                  <a href="#" className="hover:text-gray-900 transition">Politique de confidentialité</a>
                </p>
                <p className="text-xs text-gray-500 mt-4">&copy; 2026 OptimiPlex. Tous droits réservés.</p>
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