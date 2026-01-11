/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable jsx-a11y/anchor-is-valid */
// App.jsx - OPTIMIPLEX avec STRIPE INTÉGRÉ

import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { initializeApp } from 'firebase/app';
import { Eye, EyeOff } from 'lucide-react';
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
  where 
} from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';

const API_BASE_URL = process.env.REACT_BACKEND_URL || 'http://localhost:5001';

// Toujours afficher pour debug
console.log('📡 Frontend API URL:', API_BASE_URL);
console.log('📡 NODE_ENV:', process.env.NODE_ENV);
console.log('📡 VITE_BACKEND_URL env var:', process.env.REACT_BACKEND_URL);


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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full ${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 z-40`}>
        <div className="p-6 border-b border-gray-200">
          <Link to="/" className="flex items-center space-x-3">
            <img src="https://i.ibb.co/PBJSY9Z/generated-image12.png" alt="OptimiPlex Logo" className={`${sidebarOpen ? 'w-13 h-12' : 'w-8 h-8'} ${!sidebarOpen && 'mx-auto'}`} />
            {sidebarOpen && <span className="font-black text-gray-900 text-lg">OptimiPlex</span>}
          </Link>
        </div>

        <nav className="p-4 space-y-2">
          {[
            { id: 'overview', icon: '📊', label: 'Vue d\'ensemble' },
            { id: 'optimization', icon: '🎯', label: 'Optimiseur' },
            { id: 'profile', icon: '👤', label: 'Mon Profil' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === item.id
                  ? `bg-indigo-100 border border-indigo-300 text-indigo-700`
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span className="font-semibold">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-6 left-0 right-0 px-4 space-y-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all text-sm"
          >
            {sidebarOpen ? '◀ Réduire' : '▶'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-all text-sm font-semibold"
          >
            {sidebarOpen ? '🚪 Déconnexion' : '🚪'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>
        {/* Top Header */}
        <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="px-8 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-gray-900">
                {activeTab === 'profile' ? 'Mon Profil' : 
                 activeTab === 'optimization' ? 'Nouvelle Analyse' : 'Tableau de bord'}
              </h1>
              <p className="text-sm text-gray-600">
                {activeTab === 'profile' ? 'Gérez vos informations personnelles' : 'Bienvenue sur votre espace'}
              </p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900">{displayName}</p>
                <p className="text-xs text-indigo-600 font-semibold">{displayRole}</p>
              </div>
              <div className={`px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 border border-indigo-700 text-white shadow-md`}>
                <span className="font-bold text-sm">{planInfo[userPlan].name}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Plan Banner */}
        {activeTab !== 'profile' && (
          <div className="px-8 py-6">
            <div className={`p-6 rounded-xl bg-gradient-to-r from-indigo-100 to-blue-100 border border-indigo-300 flex items-center justify-between`}>
              <div>
                <h3 className={`text-lg font-black text-indigo-900`}>{planInfo[userPlan].name}</h3>
                <p className="text-sm text-indigo-700 mt-1">{planInfo[userPlan].price}</p>
              </div>
              {userPlan !== 'premium' && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className={`px-6 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-indigo-300 transition-all`}
                >
                  ⬆ Upgrader
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabs Content */}
        <div className="px-8 py-6 pb-20">
          {activeTab === 'overview' && (
            <OverviewTab userPlan={userPlan} user={user} setActiveTab={setActiveTab} />
          )}

          {activeTab === 'optimization' && (
            <OptimizationTab
              userPlan={userPlan}
              user={user}
              setUserPlan={setUserPlan}
              showUpgradeModal={showUpgradeModal}
              setShowUpgradeModal={setShowUpgradeModal}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileTab user={user} userProfile={userProfile} userPlan={userPlan} />
          )}
        </div>

        {/* MODAL UPGRADE avec STRIPE */}
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
function OverviewTab({ userPlan, user, setActiveTab }) {
  const [analyses, setAnalyses] = useState([]);
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    gainTotal: 0,
    gainMoyen: 0,
    loyerMoyen: 0,
    proprieteOptimisee: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!user) return;
      try {
        const db = getFirestore();
        const analysesRef = collection(db, 'users', user.uid, 'analyses');
        const q = query(analysesRef);
        const querySnapshot = await getDocs(q);

        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((a, b) => new Date(b.createdAt?.toDate?.() || b.timestamp) - new Date(a.createdAt?.toDate?.() || a.timestamp));

        setAnalyses(data);

        if (data.length > 0) {
          // ✅ CALCULS CORRECTS
          const gainTotal = data.reduce((sum, a) => {
            const gain = a.result?.recommandation?.gainannuel || 0;
            return sum + gain;
          }, 0);

          const loyerMoyen = data.reduce((sum, a) => {
            const loyer = a.proprietetype === 'residential' 
              ? (a.loyeractuel || 0)
              : (a.prixactuelpiedcarre * a.surfacepiedcarre || 0);
            return sum + loyer;
          }, 0) / data.length;

          const gainMoyen = gainTotal / data.length;

          const proprieteOptimisee = data.filter(a => {
            const optimal = a.result?.recommandation?.loyeroptimal || 0;
            const actuel = a.proprietetype === 'residential'
              ? a.loyeractuel
              : a.prixactuelpiedcarre;
            return optimal > actuel;
          }).length;

          setStats({
            totalAnalyses: data.length,
            gainTotal: Math.round(gainTotal),
            gainMoyen: Math.round(gainMoyen),
            loyerMoyen: Math.round(loyerMoyen),
            proprieteOptimisee
          });
        }
      } catch (err) {
        console.error('Erreur fetch analyses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, [user]);

  const handleDelete = async (analysisId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette analyse?')) return;

    setDeletingId(analysisId);
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'users', user.uid, 'analyses', analysisId));
      setAnalyses(analyses.filter(a => a.id !== analysisId));
    } catch (err) {
      console.error('Erreur suppression:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin text-4xl mb-4">🔄</div>
        <p className="text-slate-400">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Analyses totales', value: stats.totalAnalyses, icon: '📊', color: 'indigo' },
          { label: 'Gain annuel total', value: `$${stats.gainTotal}`, icon: '💰', color: 'emerald' },
          { label: 'Gain moyen', value: `$${stats.gainMoyen}`, icon: '📈', color: 'blue' },
          { label: 'Loyer moyen', value: `$${stats.loyerMoyen}`, icon: '🏠', color: 'gray' },
          { label: 'Propriétés optimisées', value: stats.proprieteOptimisee, icon: '✅', color: 'purple' }
        ].map((kpi, i) => (
          <div key={i} className={`p-6 bg-gradient-to-br from-${kpi.color}-100 to-${kpi.color}-200 rounded-xl border border-${kpi.color}-300 hover:border-${kpi.color}-400 transition-all shadow-sm`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className={`text-${kpi.color}-700 text-sm font-semibold mb-1`}>{kpi.label}</p>
                <h3 className="text-3xl font-black text-gray-900">{kpi.value}</h3>
              </div>
              <span className="text-3xl">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Historique détaillé */}
      {analyses.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-2xl font-black text-gray-900">📋 Vos analyses</h3>

          <div className="space-y-3">
            {analyses.map((analyse) => {
              // ✅ CALCULS PAR TYPE
              const isCommercial = analyse.proprietetype === 'commercial';
              const loyerActuel = isCommercial
                ? analyse.prixactuelpiedcarre * analyse.surfacepiedcarre
                : analyse.loyeractuel;

              const loyerOptimal = isCommercial
                ? (analyse.result?.recommandation?.loyeroptimal || analyse.prixactuelpiedcarre) * analyse.surfacepiedcarre
                : analyse.result?.recommandation?.loyeroptimal || analyse.loyeractuel;

              const gainAnnuel = analyse.result?.recommandation?.gainannuel || Math.round((loyerOptimal - loyerActuel) * (isCommercial ? 1 : 12));
              const gainMensuel = isCommercial ? Math.round(gainAnnuel / 12) : Math.round((loyerOptimal - loyerActuel));

              return (
                <div
                  key={analyse.id}
                  className="p-6 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-400 transition-all cursor-pointer group"
                  onClick={() => setSelectedAnalysis(analyse)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    {/* Titre */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">📝 Propriété</p>
                      <h4 className="font-black text-gray-900 text-lg group-hover:text-indigo-600 transition-colors">
                        {analyse.titre || (isCommercial ? analyse.typecommercial : analyse.typeappart)}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {analyse.ville} {analyse.quartier && `• ${analyse.quartier}`}
                      </p>
                    </div>

                    {/* Loyer actuel */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">💵 Loyer actuel</p>
                      <p className="font-black text-gray-900 text-lg">
                        ${isNaN(loyerActuel) ? 0 : Math.round(loyerActuel)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {isCommercial ? '/an' : '/mois'}
                      </p>
                    </div>

                    {/* Optimal */}
                    <div className="p-4 bg-emerald-100 rounded-lg border border-emerald-300">
                      <p className="text-xs text-emerald-700 mb-1 font-semibold">💹 Optimal</p>
                      <p className="font-black text-emerald-700 text-lg">
                        ${isNaN(loyerOptimal) ? 0 : Math.round(loyerOptimal)}
                      </p>
                      <p className="text-xs text-emerald-600 mt-1">
                        +${isNaN(gainMensuel) ? 0 : Math.round(gainMensuel)}
                      </p>
                    </div>

                    {/* Gain annuel */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">💰 Gain/an</p>
                      <p className="font-black text-gray-900 text-lg">
                        ${isNaN(gainAnnuel) ? 0 : Math.round(gainAnnuel)}
                      </p>
                    </div>

                    {/* Confiance */}
                    <div className="text-center p-3 bg-blue-100 rounded-lg border border-blue-300">
                      <p className="text-xs text-blue-700 mb-1 font-semibold">🤖 IA</p>
                      <p className="font-black text-blue-700 text-lg">
                        {analyse.result?.recommandation?.confiance || 85}%
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnalysis(analyse);
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
                        title="Voir détails"
                      >
                        👁️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(analyse.id);
                        }}
                        disabled={deletingId === analyse.id}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
                    {analyse.meuble && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Meublé</span>}
                    {analyse.balcon && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Balcon</span>}
                    {analyse.garage && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Garage</span>}
                    {analyse.climatise && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">Climatisé</span>}
                    {analyse.parking && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Parking</span>}
                    {analyse.ascenseur && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Ascenseur</span>}
                    {analyse.amenages && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Aménagé</span>}
                    <span className="text-xs text-gray-600 ml-auto">
                      {analyse.timestamp ? new Date(analyse.timestamp).toLocaleDateString('fr-CA') : 'N/A'} • {analyse.plan}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-12 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">Aucune analyse encore</h3>
          <p className="text-gray-600 mb-6">Commencez par analyser une de vos propriétés</p>
          <button
            onClick={() => setActiveTab('optimization')}
            className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
          >
            🚀 Lancer une analyse
          </button>
        </div>
      )}

      {/* MODAL DÉTAILS - VERSION COMPLÈTE */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto p-8 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-gray-900">📋 Détails de l'analyse</h3>
              <button
                onClick={() => setSelectedAnalysis(null)}
                className="text-3xl text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Info propriété */}
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 mb-6">
              <h4 className="font-black text-gray-900 text-lg mb-4">🏠 Propriété</h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="lg:col-span-2">
                  <p className="text-xs text-gray-600 mb-2">Titre</p>
                  <input
                    type="text"
                    defaultValue={selectedAnalysis.titre || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (selectedAnalysis.titre || '')) {
                        const db = getFirestore();
                        updateDoc(doc(db, 'users', user.uid, 'analyses', selectedAnalysis.id), {
                          titre: e.target.value
                        }).catch(err => console.error('Erreur update:', err));
                        selectedAnalysis.titre = e.target.value;
                      }
                    }}
                    className="w-full p-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Localisation</p>
                  <p className="text-gray-900 font-bold">{selectedAnalysis.ville} {selectedAnalysis.quartier && `• ${selectedAnalysis.quartier}`}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Type</p>
                  <p className="text-gray-900 font-bold">
                    {selectedAnalysis.proprietetype === 'residential' 
                      ? selectedAnalysis.typeappart 
                      : selectedAnalysis.typecommercial}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Plan</p>
                  <p className="text-gray-900 font-bold capitalize">{selectedAnalysis.plan}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Type propriété</p>
                  <p className="text-gray-900 font-bold capitalize">{selectedAnalysis.proprietetype}</p>
                </div>
              </div>
            </div>

            {/* Recommandation principale */}
            <div className="p-6 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-xl border border-emerald-300 mb-6">
              <h4 className="font-black text-emerald-900 text-lg mb-4">💡 Recommandation</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-emerald-700">Loyer optimal</p>
                  <p className="text-2xl font-black text-emerald-700">
                    ${selectedAnalysis.result?.recommandation?.loyeroptimal 
                      ? Math.round(selectedAnalysis.result.recommandation.loyeroptimal) 
                      : (selectedAnalysis.proprietetype === 'residential' 
                        ? selectedAnalysis.loyeractuel 
                        : selectedAnalysis.prixactuelpiedcarre)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Gain mensuel</p>
                  <p className="text-2xl font-black text-emerald-700">
                    +${selectedAnalysis.result?.recommandation?.gainmensuel 
                      ? Math.round(selectedAnalysis.result.recommandation.gainmensuel)
                      : 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Gain annuel</p>
                  <p className="text-2xl font-black text-emerald-700">
                    ${selectedAnalysis.result?.recommandation?.gainannuel 
                      ? Math.round(selectedAnalysis.result.recommandation.gainannuel)
                      : 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Confiance IA</p>
                  <p className="text-2xl font-black text-emerald-700">
                    {selectedAnalysis.result?.recommandation?.confiance || 85}%
                  </p>
                </div>
              </div>
            </div>

            {/* Justification */}
            {selectedAnalysis.result?.recommandation?.justification && selectedAnalysis.result.recommandation.justification.length > 0 && (
              <div className="p-6 bg-blue-100 rounded-xl border border-blue-300 mb-6">
                <h4 className="font-black text-blue-900 text-lg mb-4">✓ Justification</h4>
                <ul className="space-y-2">
                  {selectedAnalysis.result.recommandation.justification.map((item, i) => (
                    <li key={i} className="text-sm text-gray-800 flex gap-3">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Points clés */}
            {selectedAnalysis.result?.recommandation?.pointscles && selectedAnalysis.result.recommandation.pointscles.length > 0 && (
              <div className="p-6 bg-purple-100 rounded-xl border border-purple-300 mb-6">
                <h4 className="font-black text-purple-900 text-lg mb-4">• Points clés</h4>
                <ul className="space-y-2">
                  {selectedAnalysis.result.recommandation.pointscles.map((item, i) => (
                    <li key={i} className="text-sm text-gray-800 flex gap-3">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Considérations */}
            {selectedAnalysis.result?.recommandation?.considerations && selectedAnalysis.result.recommandation.considerations.length > 0 && (
              <div className="p-6 bg-amber-100 rounded-xl border border-amber-300 mb-6">
                <h4 className="font-black text-amber-900 text-lg mb-4">⚠️ Considérations</h4>
                <ul className="space-y-2">
                  {selectedAnalysis.result.recommandation.considerations.map((item, i) => (
                    <li key={i} className="text-sm text-gray-800 flex gap-3">
                      <span className="text-amber-600 font-bold">⚠️</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Prochaines étapes */}
            {selectedAnalysis.result?.recommandation?.prochainesetapes && selectedAnalysis.result.recommandation.prochainesetapes.length > 0 && (
              <div className="p-6 bg-green-100 rounded-xl border border-green-300 mb-6">
                <h4 className="font-black text-green-900 text-lg mb-4">🎯 Prochaines étapes</h4>
                <ol className="space-y-2">
                  {selectedAnalysis.result.recommandation.prochainesetapes.map((item, i) => (
                    <li key={i} className="text-sm text-gray-800 flex gap-3">
                      <span className="text-green-600 font-bold">{i + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Marketing Kit */}
            {selectedAnalysis.result?.marketingkit && (
              <div className="p-6 bg-pink-100 rounded-xl border border-pink-300 mb-6">
                <h4 className="font-black text-pink-900 text-lg mb-4">📢 Marketing Kit</h4>
                <div className="space-y-4">
                  {selectedAnalysis.result.marketingkit.titreannonce && (
                    <div>
                      <h5 className="font-bold text-pink-800 mb-2">📝 Titre annonce</h5>
                      <p className="text-gray-800 bg-white p-3 rounded-lg border border-pink-200 font-semibold">{selectedAnalysis.result.marketingkit.titreannonce}</p>
                    </div>
                  )}
                  {selectedAnalysis.result.marketingkit.descriptionaccroche && (
                    <div>
                      <h5 className="font-bold text-pink-800 mb-2">💬 Description accroche</h5>
                      <p className="text-gray-800 bg-white p-3 rounded-lg border border-pink-200">{selectedAnalysis.result.marketingkit.descriptionaccroche}</p>
                    </div>
                  )}
                  {selectedAnalysis.result.marketingkit.profillocataire && (
                    <div>
                      <h5 className="font-bold text-pink-800 mb-2">👥 Profil locataire idéal</h5>
                      <p className="text-gray-800 bg-white p-3 rounded-lg border border-pink-200">{selectedAnalysis.result.marketingkit.profillocataire}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Raisonnement IA */}
            {selectedAnalysis.result?.recommandation?.raisonnement && (
              <div className="p-6 bg-indigo-100 rounded-xl border border-indigo-300 mb-6">
                <h4 className="font-black text-indigo-900 text-lg mb-4">🤖 Raisonnement IA</h4>
                <p className="text-gray-800 leading-relaxed">{selectedAnalysis.result.recommandation.raisonnement}</p>
              </div>
            )}

            <button
              onClick={() => setSelectedAnalysis(null)}
              className="w-full mt-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition-all"
            >
              Fermer
            </button>
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
  const [quotaInfo, setQuotaInfo] = useState(null);
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

  const [formData, setFormData] = useState({
    titre: '',
    ville: 'Montréal',
    quartier: 'Plateau-Mont-Royal',
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
    { value: '312', label: '3 1/2 (2 chambres)' },
    { value: '412', label: '4 1/2 (3 chambres)' },
    { value: '512', label: '5 1/2 (4+ chambres)' }
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

  // ✅ CHARGER QUOTA AU DÉMARRAGE
  useEffect(() => {
    const fetchQuota = async () => {
      if (!user) return;

      try {
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const userPlanNow = userData?.plan || 'essai';

        let planStartDate = new Date();
        if (userData?.planStartDate) {
          if (userData.planStartDate.toDate) {
            planStartDate = userData.planStartDate.toDate();
          } else {
            planStartDate = new Date(userData.planStartDate);
          }
        }

        const monthStart = new Date(planStartDate);
        const monthEnd = new Date(planStartDate);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        console.log(`📅 Cycle: ${monthStart.toLocaleDateString('fr-CA')} → ${monthEnd.toLocaleDateString('fr-CA')}`);

        const analysesRef = collection(db, 'users', user.uid, 'analyses');
        const q = query(
          analysesRef,
          where('createdAt', '>=', monthStart),
          where('createdAt', '<', monthEnd)
        );

        const snapshot = await getDocs(q);

        const residentialAnalyses = snapshot.docs.filter(doc =>
          doc.data().proprietetype === 'residential'
        );
        const monthlyCount = residentialAnalyses.length;

        const limits = { essai: 1, pro: 5, growth: 999, entreprise: 999 };
        const limit = limits[userPlanNow] || 1;

        setQuotaInfo({
          current: monthlyCount,
          limit,
          remaining: limit - monthlyCount,
          plan: userPlanNow,
          resetDate: monthEnd
        });

        if (monthlyCount === 0 && userPlanNow !== 'essai') {
          console.log(`🎉 Nouveau plan ${userPlanNow} activé! Quota frais: ${limit} analyses`);
        }
      } catch (err) {
        console.error('❌ Erreur quota:', err);
        setQuotaInfo({
          current: 0,
          limit: 1,
          remaining: 1,
          plan: userPlan,
          resetDate: new Date()
        });
      }
    };

    fetchQuota();
  }, [user, userPlan]);

  const handleSubmit = async () => {
    const apartmentLabel = getApartmentLabel(formData.typeappart);
    const villeFinale = showCustomVille && customVille.trim()
      ? customVille.trim()
      : formData.ville;

    if (quotaInfo && quotaInfo.remaining <= 0) {
      setQuotaError(`🔒 Quota ${quotaInfo.plan} atteint! Réinitialisation ${quotaInfo.resetDate.toLocaleDateString('fr-CA')}`);
      return;
    }

    if (!villeFinale || !formData.loyeractuel || formData.loyeractuel < 1) {
      setError('Veuillez remplir tous les champs correctement');
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

      if (user) {
        const db = getFirestore();
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

      if (quotaInfo) {
        setQuotaInfo(prev => ({
          ...prev,
          current: prev.current + 1,
          remaining: prev.remaining - 1
        }));
      }

      setResult(response.data);
    } catch (err) {
      if (err.response?.status === 429) {
        setQuotaError(`🔒 ${err.response.data.error}`);
        if (quotaInfo) {
          setQuotaInfo({
            current: err.response.data.current,
            limit: err.response.data.limit,
            remaining: 0,
            resetDate: new Date(err.response.data.resetDate)
          });
        }
      } else {
        setError('Erreur: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('📊 QuotaInfo:', quotaInfo);
    console.log('👤 User:', user?.uid);
    console.log('📋 Plan:', userPlan);
  }, [quotaInfo, user, userPlan]);

  return (
    <div className="space-y-8">
      <LoadingSpinner isLoading={loading} messages={loadingMessages} />

      {quotaInfo && (
        <div className={`p-6 rounded-xl border-2 ${
          quotaInfo.remaining > 0
            ? 'bg-emerald-50 border-emerald-300'
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">
              {quotaInfo.remaining > 0 ? '📊 Analyses restantes' : '❌ Quota atteint'}
            </h3>
            <span className="text-2xl font-black">
              {quotaInfo.remaining}/{quotaInfo.limit}
            </span>
          </div>

          <div className="w-full bg-gray-300 rounded-full h-3 mb-3">
            <div
              className={`h-3 rounded-full transition-all ${
                quotaInfo.remaining > 0 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ width: `${quotaInfo.limit > 0 ? ((quotaInfo.limit - quotaInfo.remaining) / quotaInfo.limit) * 100 : 100}%` }}
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
          <label className="block text-sm font-semibold text-gray-700 mb-3">Ville</label>
          {!showCustomVille ? (
            <select
              value={formData.ville}
              onChange={(e) => {
                if (e.target.value === 'Autre') {
                  setShowCustomVille(true);
                } else {
                  setFormData({ ...formData, ville: e.target.value });
                }
              }}
              className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {villeOptions.map(v => <option key={v}>{v}</option>)}
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                value={customVille}
                onChange={(e) => setCustomVille(e.target.value)}
                placeholder="Entrez la ville..."
                className="flex-1 p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={() => { setShowCustomVille(false); setCustomVille(''); }}
                className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 font-semibold text-gray-900"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Quartier (optionnel)</label>
          <input
            value={formData.quartier}
            onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
            placeholder="Plateau-Mont-Royal..."
            className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Type</label>
          <select
            value={formData.typeappart}
            onChange={(e) => {
              console.log('✅ Select changé:', e.target.value);
              setFormData({
                ...formData,
                typeappart: e.target.value
              });
            }}
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
          <label className="block text-sm font-semibold text-gray-700 mb-3">Loyer actuel ($)</label>
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
          <label className="block text-sm font-semibold text-gray-700 mb-3">État du bien</label>
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
          disabled={loading || (quotaInfo && quotaInfo.remaining <= 0)}
          className={`px-16 py-4 font-black text-xl rounded-xl shadow-lg transform hover:-translate-y-1 transition-all w-full max-w-md mx-auto
            ${loading || (quotaInfo && quotaInfo.remaining <= 0)
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-indigo-400'
            }`}
        >
          {loading ? '🔄 Analyse en cours...' : quotaInfo?.remaining <= 0 ? '❌ Quota atteint' : '🚀 Analyser'}
        </button>
      </div>

      {result && (
        <div className="space-y-8 mt-8">
          {/* Header résumé */}
          <div className="p-8 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-2xl border-2 border-emerald-300 text-center">
            <h3 className="text-4xl font-black text-emerald-900 mb-2">
              ${result.recommandation?.loyeroptimal || 'N/A'}
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
          {result.recommandation?.justification && result.recommandation.justification.length > 0 && (
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
          {result.recommandation?.pointscles && result.recommandation.pointscles.length > 0 && (
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
          {result.recommandation?.considerations && result.recommandation.considerations.length > 0 && (
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
          {result.recommandation?.prochainesetapes && result.recommandation.prochainesetapes.length > 0 && (
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
  const [quotaInfo, setQuotaInfo] = useState(null);
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

  const [formData, setFormData] = useState({
    titre: '',
    ville: 'Montréal',
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

  const [customVille, setCustomVille] = useState('');
  const [showCustomVille, setShowCustomVille] = useState(false);
  const villeOptions = ['Montréal', 'Québec', 'Lévis', 'Laval', 'Longueuil', 'Gatineau', 'Sherbrooke', 'Autre'];

  const isCommercialBlocked = userPlan === 'essai' || userPlan === 'pro';

  // ✅ CHARGER QUOTA AU DÉMARRAGE
  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const userPlanNow = userData?.plan || 'essai';

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const analysesRef = collection(db, 'users', user.uid, 'analyses');
        const q = query(
          analysesRef,
          where('createdAt', '>=', monthStart),
          where('proprietetype', '==', 'commercial')
        );

        const snapshot = await getDocs(q);
        const monthlyCount = snapshot.size;

        const limits = { essai: 0, pro: 0, growth: 999, entreprise: 999 };
        const limit = limits[userPlanNow] || 0;

        setQuotaInfo({
          current: monthlyCount,
          limit,
          remaining: limit - monthlyCount,
          plan: userPlanNow,
          resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        });
      } catch (err) {
        console.error('Erreur quota:', err);
      }
    };

    if (user && !isCommercialBlocked) fetchQuota();
  }, [user, isCommercialBlocked]);

  const handleSubmit = async () => {
    const villeFinale = showCustomVille ? customVille : formData.ville;

    if (isCommercialBlocked) {
      setError('🔒 Commercial disponible à partir du plan Growth. Upgrader maintenant.');
      setShowUpgradeModal(true);
      return;
    }

    if (quotaInfo && quotaInfo.remaining <= 0) {
      setQuotaError(`🔒 Quota ${quotaInfo.plan} atteint! Réinitialisation ${quotaInfo.resetDate.toLocaleDateString('fr-CA')}`);
      return;
    }

    if (!villeFinale || formData.surfacepiedcarre < 100 || formData.prixactuelpiedcarre < 5) {
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
        titre: formData.titre || `${formData.typecommercial} - ${villeFinale}`,
        ville: villeFinale,
        surfacepiedcarre: parseInt(formData.surfacepiedcarre),
        prixactuelpiedcarre: parseFloat(formData.prixactuelpiedcarre),
        termebailans: parseInt(formData.termebailans)
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/pricing/commercial-optimizer`,
        { userId: user.uid, ...analysisData }
      );

      if (user) {
        const db = getFirestore();
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
        remaining: prev.remaining - 1
      }));

      setResult(response.data);
    } catch (err) {
      if (err.response?.status === 429) {
        setQuotaError(`🔒 ${err.response.data.error}`);
        setQuotaInfo({
          current: err.response.data.current,
          limit: err.response.data.limit,
          remaining: 0,
          resetDate: new Date(err.response.data.resetDate)
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

      {!isCommercialBlocked && quotaInfo && (
        <div className={`p-6 rounded-xl border-2 ${
          quotaInfo.remaining > 0
            ? 'bg-emerald-50 border-emerald-300'
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">
              {quotaInfo.remaining > 0 ? '📊 Analyses commerciales restantes' : '❌ Quota atteint'}
            </h3>
            <span className="text-2xl font-black">
              {quotaInfo.remaining}/{quotaInfo.limit}
            </span>
          </div>

          <div className="w-full bg-gray-300 rounded-full h-3 mb-3">
            <div
              className={`h-3 rounded-full transition-all ${
                quotaInfo.remaining > 0 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ width: `${quotaInfo.limit > 0 ? ((quotaInfo.limit - quotaInfo.remaining) / quotaInfo.limit) * 100 : 100}%` }}
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
        <div className="p-6 bg-red-100 border-2 border-red-400 rounded-xl">
          <p className="text-red-900 font-bold text-base">
            🔒 Plan non disponible pour Commercial<br />
            <span className="text-red-800 text-sm">Accès à partir de Growth ($69/mois)</span>
          </p>
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
          <label className="block text-sm font-semibold text-gray-700 mb-3">Ville</label>
          {!showCustomVille ? (
            <select
              value={formData.ville}
              onChange={(e) => {
                if (e.target.value === 'Autre') setShowCustomVille(true);
                else setFormData({ ...formData, ville: e.target.value });
              }}
              disabled={isCommercialBlocked}
              className="w-full p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
            >
              {villeOptions.map(v => <option key={v}>{v}</option>)}
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                value={customVille}
                onChange={(e) => setCustomVille(e.target.value)}
                placeholder="Entrez la ville..."
                className="flex-1 p-4 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={() => { setShowCustomVille(false); setCustomVille(''); }}
                className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 font-semibold text-gray-900"
              >
                ✕
              </button>
            </div>
          )}
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
          disabled={loading || isCommercialBlocked || (quotaInfo && quotaInfo.remaining <= 0)}
          className={`px-16 py-4 font-black text-xl rounded-xl shadow-lg transform hover:-translate-y-1 transition-all w-full max-w-md mx-auto
            ${loading || isCommercialBlocked || (quotaInfo && quotaInfo.remaining <= 0)
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-indigo-400'
            }`}
        >
          {loading ? '🔄 Analyse en cours...' : isCommercialBlocked ? '🔒 Commercial (Growth+)' : quotaInfo?.remaining <= 0 ? '❌ Quota atteint' : '🏢 Analyser Commercial'}
        </button>
      </div>

      {result && (
        <div className="space-y-8 mt-8">
          {/* Header résumé */}
          <div className="p-8 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-2xl border-2 border-emerald-300 text-center">
            <h3 className="text-4xl font-black text-emerald-900 mb-2">
              ${result.recommandation?.loyeroptimal || 'N/A'}/pi²/an
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
          {result.recommandation?.justification && result.recommandation.justification.length > 0 && (
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
          {result.recommandation?.pointscles && result.recommandation.pointscles.length > 0 && (
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
          {result.recommandation?.considerations && result.recommandation.considerations.length > 0 && (
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
          {result.recommandation?.prochainesetapes && result.recommandation.prochainesetapes.length > 0 && (
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
                src="https://i.ibb.co/PBJSY9Z/generated-image12.png"
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
              IA Immobilière révolutionnaire
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="relative z-10 text-5xl sm:text-7xl font-black text-gray-900 mb-6 leading-tight tracking-tight">
            Augmentez vos revenus locatifs
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              intelligemment
            </span>
          </h1>

          {/* Subheadline */}
          <p className="relative z-10 text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto mb-4 font-light">
            Analyse IA en temps réel. Recommandations basées sur données réelles Centris.
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
              <span className="text-2xl">🔒</span>
              <span>100% sécurisé & confidentiel</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-gray-200 backdrop-blur card-hover">
              <span className="text-2xl">⚡</span>
              <span>Résultats en moins d'1 minute</span>
            </div>
          </div>

          {/* CTA Button */}
          <div className="relative z-10 mb-12">
            <Link
              to="/register"
              className="inline-block px-8 sm:px-10 py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 text-white rounded-xl font-bold text-lg shadow-[0_18px_45px_rgba(79,70,229,0.35)] hover:shadow-[0_20px_60px_rgba(56,189,248,0.5)] transform hover:-translate-y-1 transition-all card-hover"
            >
              🎯 Commencer gratuitement
            </Link>
          </div>

          {/* Hero Visual */}
          <div className="relative z-10 mt-16">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-200/50 via-sky-200/40 to-emerald-200/40 rounded-3xl opacity-80 blur-xl" />
            <div className="relative rounded-3xl overflow-hidden border border-white/60 bg-white/80 backdrop-blur-2xl p-8 shadow-2xl shadow-gray-200/70 card-hover">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Card 1 */}
                <div className="p-6 bg-white/90 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-200/40 transition card-hover">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-sm text-gray-600 mb-2">Loyer actuel</p>
                  <p className="text-3xl font-black text-gray-900">$1,400</p>
                  <p className="text-xs text-gray-500 mt-2">/mois</p>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="text-4xl text-gray-400 animate-pulse">→</div>
                </div>

                {/* Card 2 */}
                <div className="p-6 bg-gradient-to-br from-emerald-100/40 via-emerald-200/30 to-emerald-50/40 rounded-2xl border-2 border-emerald-300 shadow-lg shadow-emerald-200/40 card-hover">
                  <div className="text-4xl mb-3">💰</div>
                  <p className="text-sm text-emerald-700 font-semibold mb-2">Potentiel optimal</p>
                  <p className="text-3xl font-black text-emerald-700">$1,750</p>
                  <p className="text-xs text-emerald-600 mt-2 font-semibold">+$350/mois</p>
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
              Une plateforme pensée pour les propriétaires et investisseurs qui veulent des décisions
              vraiment basées sur les données, pas sur l'intuition.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: '🤖',
                title: 'IA Propriétaire Immobilier',
                description: 'Algorithme spécialisé en optimisation de revenus résidentiels et commerciaux'
              },
              {
                icon: '📈',
                title: 'Analyse Marché en Temps Réel',
                description: 'Données Centris actualisées quotidiennement pour recommandations précises'
              },
              {
                icon: '⚡',
                title: 'Ultra Rapide',
                description: 'Analyse complète en moins d\'une minute. Pas d\'appels, pas d\'attente.'
              },
              {
                icon: '📊',
                title: 'Comparables Verified',
                description: 'Justification détaillée basée sur propriétés similaires vendues'
              },
              {
                icon: '🛡️',
                title: 'Données Sécurisées',
                description: 'Encryption de bout en bout. Vos données propriétaires jamais partagées.'
              },
              {
                icon: '🎯',
                title: 'Stratégie Complète',
                description: 'Pas juste un chiffre: plan d\'action détaillé pour maximiser revenus'
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

        {/* ==================== HOW IT WORKS ==================== */}
        <section className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="fade-in-up text-4xl font-black text-gray-900 text-center mb-16" style={{ animationDelay: '0s' }}>
            3 étapes pour +18% de revenus
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1️⃣',
                title: 'Créez compte gratuit',
                description: 'Inscription en 60 secondes. Aucune carte bancaire requise.'
              },
              {
                step: '2️⃣',
                title: 'Analysez propriété',
                description: 'Entrez détails de votre immeuble. L\'IA génère rapport en moins d\'une minute.'
              },
              {
                step: '3️⃣',
                title: 'Implémentez recommandations',
                description: 'Recevez plan d\'action détaillé. Appliquez stratégie et voyez résultats.'
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
                { end: 18, label: 'Augmentation revenus', suffix: '%' },
                { end: 48, label: 'Note moyenne utilisateurs', suffix: '★' },
                { end: 1240, label: 'Propriétés analysées', suffix: '+' },
                { end: 42, label: 'Gains potentiels identifiés', suffix: 'M+' }
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
                    ) : stat.suffix.includes('M') ? (
                      <>
                        $<CounterAnimation end={stat.end} duration={2500} />
                        M+
                      </>
                    ) : stat.suffix.includes('+') ? (
                      <>
                        <CounterAnimation end={1240} duration={2500} />+
                      </>
                    ) : (
                      <>
                        +<CounterAnimation end={stat.end} duration={2500} />%
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
            Témoignages
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Marie L.',
                title: 'Propriétaire, Montréal',
                comment: 'J\'ai augmenté mon loyer de $150/mois en 3 semaines. Exactement ce que prédit OptimiPlex!',
                rating: 5
              },
              {
                name: 'Jean D.',
                title: 'Investisseur immobilier',
                comment: 'Outil essentiel. Analyse vs courtiers coûte 10x plus cher. Résultats similaires.',
                rating: 5
              },
              {
                name: 'Sophie M.',
                title: 'Gestionnaire immobilier',
                comment: 'Permet à nos clients de faire décisions data-driven. Vraiment révolutionnaire.',
                rating: 5
              }
            ].map((testimonial, i) => (
              <div
                key={i}
                className="fade-in-up p-8 bg-white/80 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-200/40 transition backdrop-blur-xl card-hover glow-on-hover"
                style={{ animationDelay: `${0.15 * i}s` }}
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <span key={j} className="text-xl text-amber-400">⭐</span>
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
            Pas de surprises. Pas de frais cachés. Cancel n'importe quand.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Essai',
                price: 'Gratuit',
                description: 'Parfait pour débuter',
                features: [
                  '1 analyse/mois',
                  'Données Centris',
                  'Rapport complet',
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
                  '5 analyses/mois',
                  'Données Centris temps réel',
                  'Rapport + stratégie',
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
                  'Analyses illimitées',
                  'Résidentiel + commercial',
                  'Rapports avancés',
                  'Support 24/7',
                  'API access'
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
                  to="/login"
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
                q: 'Comment OptimiPlex détecte-t-il le prix optimal?',
                a: 'Nous analysons les données Centris de propriétés similaires vendues/louées, comparables directs, trends de marché local, et appliquons ML pour prédire prix optimal dans 30 jours.'
              },
              {
                q: 'Quel est le taux de précision?',
                a: '85-92% dépendant de la région et disponibilité données. Pour chaque recommandation, vous voyez le score confiance exact.'
              },
              {
                q: 'Puis-je annuler n\'importe quand?',
                a: 'Oui. Aucun engagement. Vous pouvez annuler abonnement 1 click à n\'importe quel moment.'
              },
              {
                q: 'Mes données sont-elles sécurisées?',
                a: 'Absolument. Encryption AES-256, serveurs Firebase, GDPR compliant. Vos données propriétaires jamais vendues ou partagées.'
              },
              {
                q: 'Fonctionne-t-il pour propriétés commerciales?',
                a: 'Oui! Plans Growth+ incluent analyse commerciale (bureaux, retail, entrepôts).'
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
                  Optimisez vos revenus immobiliers avec IA
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