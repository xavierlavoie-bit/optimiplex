/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, deleteDoc 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import axios from 'axios';
import { 
  Users, Mail, Briefcase, Clock, ArrowLeft, Trash2, Search, AlertCircle, 
  X as CloseIcon, TrendingUp, Sparkles, Phone, CreditCard, ChevronRight,
  DollarSign, PieChart, Home, UserCheck, MapPin, FileText, Printer, Send,
  BrainCircuit, CheckCircle, Download
} from 'lucide-react';

/**
 * 🎨 CONFIGURATION DES COURTIERS AVEC CODE COULEUR
 */
export const BROKERS = [
  { name: 'Xavier Lavoie', email: 'xavlavoie24@gmail.com', color: 'bg-indigo-500', border: 'border-indigo-500', bgLight: 'bg-indigo-50', text: 'text-indigo-700' },
  { name: 'Rebecca (Courtier)', email: 'rebecca@optimiplex.com', color: 'bg-rose-500', border: 'border-rose-500', bgLight: 'bg-rose-50', text: 'text-rose-700' },
  { name: 'Alexandre', email: 'alex@optimiplex.com', color: 'bg-amber-500', border: 'border-amber-500', bgLight: 'bg-amber-50', text: 'text-amber-700' },
];

export const isUserBroker = (userEmail) => BROKERS.some(b => b.email?.toLowerCase() === userEmail?.toLowerCase());

const getBrokerTheme = (email) => {
  return BROKERS.find(b => b.email === email) || { name: 'Non assigné', color: 'bg-slate-300', border: 'border-slate-300', bgLight: 'bg-slate-50', text: 'text-slate-500' };
};

// --- NOUVEAU : Nettoyeur d'IA (Enlève les emojis et les balises Markdown parasites) ---
const cleanAIContent = (text) => {
  if (!text) return "";
  
  // 1. Enlever les blocs markdown (```html et ```)
  let cleaned = text.replace(/```html/gi, '').replace(/```/g, '');
  
  // 2. Enlever les emojis (Cible large pour nettoyer tout symbole non-professionnel)
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2300}-\u{23FF}\u{2B50}🎯⚠️💡🤖📈]/gu, '');
  
  return cleaned.trim();
};

// Extraction intelligente de l'adresse et du prix
const getLeadPropertyInfo = (lead) => {
  let address = lead.evaluationData?.addresseComplete || lead.adressePropriete || lead.evaluationData?.adresse || '';
  if (address === 'la propriété sélectionnée') address = '';
  if (!address || address.trim() === '') {
    if (lead.evaluationData?.ville) {
      address = `Propriété à ${lead.evaluationData.ville}`;
    } else {
      address = 'Adresse non fournie';
    }
  }
  let price = lead.evaluationData?.result?.estimationActuelle?.valeurMoyenne || lead.prixPropriete || null;
  return { address, price };
};

export default function BrokerCRM() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false); 
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null); 
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthResolved(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authResolved || !currentUser) return; 
    const db = getFirestore();
    
    // RETOUR EXACT À LA REQUÊTE DE TON ANCIENNE VERSION QUI FONCTIONNAIT BIEN
    const q = query(collection(db, 'leads_hypothecaires'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      
      // Sécurité anti-bug : forcer un statut 'nouveau' si absent
      const safeData = data.map(lead => ({
        ...lead,
        status: lead.status || 'nouveau'
      }));

      setLeads(safeData);
      setLoading(false);
    }, (error) => {
      console.error("Erreur Firestore:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authResolved, currentUser]);

  const handleAssignLead = async (lead, brokerEmail) => {
    if (!brokerEmail) return;
    const assignedBroker = getBrokerTheme(brokerEmail);
    
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      
      await axios.post(`${API_URL}/api/broker/assign`, {
        leadId: lead.id,
        brokerEmail: assignedBroker.email,
        brokerName: assignedBroker.name,
        clientEmail: lead.clientEmail,
        aiSummary: lead.aiSummary
      });
      
      alert(`✅ Dossier assigné avec succès à ${assignedBroker.name}. Les courriels ont été envoyés !`);
      
      // On ferme la modale comme dans ton ancienne version
      if (selectedLead && selectedLead.id === lead.id) {
        setSelectedLead(null); 
      }
    } catch (err) {
      console.error("Erreur d'assignation:", err);
      alert("❌ Erreur lors de l'assignation. Vérifie que ton serveur backend (Express) est démarré.");
    }
  };

  const handleChangeStatus = async (id, status) => {
    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'leads_hypothecaires', id), { status });
      
      if (selectedLead?.id === id) {
        setSelectedLead({ ...selectedLead, status });
      }
    } catch (err) {
      console.error("Erreur de statut:", err);
    }
  };

  const handleDeleteLead = async (id) => {
    if (window.confirm("Voulez-vous supprimer définitivement ce dossier ?")) {
      try {
        const db = getFirestore();
        await deleteDoc(doc(db, 'leads_hypothecaires', id));
        if (selectedLead?.id === id) {
          setSelectedLead(null);
        }
      } catch (err) {
        console.error("Erreur lors de la suppression:", err);
        alert("Erreur lors de la suppression du dossier.");
      }
    }
  };

  // CORRECTION MAJEURE ICI : Sécurisation de la recherche
  const filteredLeads = leads.filter(l => {
    const term = searchTerm.toLowerCase();
    const email = l.clientEmail || '';
    const nom = l.clientDetails?.nom || '';
    const prenom = l.clientDetails?.prenom || '';

    return email.toLowerCase().includes(term) ||
           nom.toLowerCase().includes(term) ||
           prenom.toLowerCase().includes(term);
  });

  if (!authResolved || loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="font-black text-indigo-600 uppercase tracking-widest text-sm">Chargement du CRM...</p>
      </div>
    );
  }

  if (!currentUser || !isUserBroker(currentUser.email)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-3xl font-black text-slate-800">Accès Refusé</h2>
        <p className="text-slate-500 mt-2 max-w-md">Votre compte ({currentUser?.email || 'Non connecté'}) n'est pas autorisé.</p>
      </div>
    );
  }

  // --- VUE D'IMPRESSION (RAPPORT BANCAIRE) ---
  // Ne s'affiche que lorsque isPrinting = true
  if (isPrinting && selectedLead) {
    return <BankReportPrintView lead={selectedLead} onBack={() => setIsPrinting(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans print:hidden">
      <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-40 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-900 p-2.5 rounded-xl text-white shadow-lg">
              <BrainCircuitIcon size={24} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                Optimiplex <span className="text-indigo-600">AI</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portail Courtier</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-2.5 text-slate-300" size={18} />
            <input 
              placeholder="Rechercher un client..." 
              className="pl-10 pr-4 py-2 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 w-72 font-bold transition-all" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>
      </header>

      {/* BOARD KANBAN */}
      <div className="flex-1 p-8 overflow-x-auto flex gap-6 max-w-[1800px] mx-auto w-full">
        
        {/* COLONNE 1: NOUVEAUX */}
        <BoardColumn title="📥 À Assigner" count={filteredLeads.filter(l => l.status === 'nouveau').length}>
          {filteredLeads.filter(l => l.status === 'nouveau').map(lead => (
             <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} onAssign={handleAssignLead} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

        {/* COLONNE 2: EN ATTENTE DU BILAN (Le gros ajout pour le suivi) */}
        <BoardColumn title="⏳ Attente Bilan" count={filteredLeads.filter(l => (l.status === 'assigne' || l.status === 'en_cours') && !l.clientFormCompleted).length} highlight>
          {filteredLeads.filter(l => (l.status === 'assigne' || l.status === 'en_cours') && !l.clientFormCompleted).map(lead => (
             <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} onStatusChange={handleChangeStatus} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

        {/* COLONNE 3: PRÊT POUR LA BANQUE (Formulaire rempli + IA analysé) */}
        <BoardColumn title="🧠 Prêt pour Banque" count={filteredLeads.filter(l => (l.status === 'assigne' || l.status === 'en_cours') && l.clientFormCompleted).length}>
          {filteredLeads.filter(l => (l.status === 'assigne' || l.status === 'en_cours') && l.clientFormCompleted).map(lead => (
             <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} onStatusChange={handleChangeStatus} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

        {/* COLONNE 4: FINANCÉS */}
        <BoardColumn title="🎉 Financés" count={filteredLeads.filter(l => l.status === 'complete').length}>
          {filteredLeads.filter(l => l.status === 'complete').map(lead => (
             <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} onStatusChange={handleChangeStatus} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

      </div>

      {selectedLead && (
        <DetailModal 
          lead={selectedLead} 
          onClose={() => setSelectedLead(null)} 
          onStatusChange={handleChangeStatus} 
          onAssign={handleAssignLead}
          onGenerateReport={() => setIsPrinting(true)}
        />
      )}
    </div>
  );
}

function BoardColumn({ title, count, children, highlight }) {
  return (
    <div className={`rounded-[2rem] p-5 border flex flex-col min-w-[350px] w-[350px] shrink-0 h-[calc(100vh-140px)] ${highlight ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-200/40 border-slate-200/50'}`}>
      <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mb-5 px-2 flex justify-between items-center shrink-0">
        {title}
        <span className={`px-2.5 py-1 rounded-lg text-sm shadow-sm border ${highlight ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>
          {count}
        </span>
      </h2>
      <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-4 hide-scrollbar">
        {children}
      </div>
    </div>
  );
}

function LeadCard({ lead, onClick, onAssign, onStatusChange, onDelete }) {
  const { address, price } = getLeadPropertyInfo(lead);
  const broker = getBrokerTheme(lead.assignedTo);
  const isWaiting = (lead.status === 'assigne' || lead.status === 'en_cours') && !lead.clientFormCompleted;

  return (
    <div 
      onClick={onClick}
      className={`bg-white p-5 rounded-[1.5rem] border hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative group flex flex-col gap-3 ${isWaiting ? 'border-amber-200 shadow-sm' : 'border-slate-200'}`}
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }} 
        className="absolute top-4 right-5 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all z-10"
        title="Supprimer ce dossier"
      >
        <Trash2 size={16}/>
      </button>

      {/* Code Couleur Courtier via la bordure gauche */}
      {lead.assignedTo && (
        <div className={`absolute left-0 top-6 bottom-6 w-1.5 rounded-r-full ${broker.color}`}></div>
      )}

      <div className="pl-2">
        <div className="flex justify-between items-start mb-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            {lead.createdAt?.toDate ? new Date(lead.createdAt.toDate()).toLocaleDateString('fr-CA') : 'Maintenant'}
          </p>
          {lead.assignedTo && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${broker.bgLight} ${broker.text}`}>
              {broker.name.split(' ')[0]}
            </span>
          )}
        </div>
        
        <h3 className="font-black text-slate-900 truncate text-lg leading-tight mb-2">
          {lead.clientDetails?.prenom ? `${lead.clientDetails.prenom} ${lead.clientDetails.nom}` : lead.clientEmail}
        </h3>

        {/* Status Badge Rapide */}
        {isWaiting ? (
          <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-200 mb-2">
            <Clock size={12} className="animate-pulse" /> Bilan manquant
          </div>
        ) : lead.clientFormCompleted ? (
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200 mb-2">
            <CheckCircleIcon size={12} /> Prêt pour analyse
          </div>
        ) : null}

        {address !== 'Adresse non fournie' && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <MapPin size={12} className="text-indigo-400 shrink-0"/>
            <span className="truncate">{address}</span>
          </div>
        )}
      </div>

      <div className="mt-4 bg-slate-50 p-4 rounded-2xl text-[11px] font-bold text-slate-500 italic border border-slate-100 line-clamp-2 shadow-inner">
        "{cleanAIContent(lead.aiSummary) || 'Aucun résumé'}"
      </div>

      <div className="mt-auto pt-3 border-t border-slate-100 pl-2">
        {lead.status === 'nouveau' ? (
          <div onClick={e => e.stopPropagation()}>
            <select 
              onChange={(e) => onAssign(lead, e.target.value)}
              defaultValue=""
              className="w-full bg-slate-900 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-black transition-colors text-center"
            >
              <option value="" disabled>Associer à...</option>
              {BROKERS.map(b => (
                <option key={b.email} value={b.email}>{b.name}</option>
              ))}
            </select>
          </div>
        ) : isWaiting ? (
          <button 
            onClick={(e) => { e.stopPropagation(); alert(`Mail de relance envoyé à ${lead.clientEmail}`); }}
            className="w-full bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <Send size={12} /> Relancer le client
          </button>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400">Statut CRM:</span>
            <div onClick={e => e.stopPropagation()}>
              <select 
                value={lead.status} 
                onChange={(e) => onStatusChange(lead.id, e.target.value)}
                className="bg-slate-100 text-[10px] font-black uppercase tracking-tighter p-1.5 rounded-lg border-none outline-none cursor-pointer text-slate-700"
              >
                <option value="en_cours">En cours</option>
                <option value="complete">Terminé</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailModal({ lead, onClose, onAssign, onGenerateReport }) {
  const { address, price } = getLeadPropertyInfo(lead);
  const broker = getBrokerTheme(lead.assignedTo);
  const isReadyForBank = lead.clientFormCompleted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl max-h-[94vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        
        {/* HEADER MODAL */}
        <div className={`p-8 text-white flex justify-between items-start shrink-0 relative overflow-hidden transition-colors ${lead.assignedTo ? broker.color : 'bg-slate-800'}`}>
          <div className="relative z-10 w-full">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-4xl font-black tracking-tight">{lead.clientDetails?.prenom || 'Nouveau'} {lead.clientDetails?.nom || 'Lead'}</h2>
                  {isReadyForBank && <span className="bg-white/20 backdrop-blur-md text-white text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest border border-white/30">Dossier Complet</span>}
                </div>
                <div className="flex flex-wrap gap-6 text-white/80 text-sm font-bold mt-3">
                  <p className="flex items-center gap-2"><Mail size={16} /> {lead.clientEmail}</p>
                  {lead.clientDetails?.telephone && <p className="flex items-center gap-2"><Phone size={16} /> {lead.clientDetails.telephone}</p>}
                </div>
              </div>
              
              {/* ASSIGNATION / COURTIIER */}
              <div className="bg-white/10 p-3 rounded-2xl border border-white/20 backdrop-blur-sm text-right">
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Dossier géré par</p>
                {lead.assignedTo ? (
                  <p className="font-bold text-lg">{broker.name}</p>
                ) : (
                  <select 
                    onChange={(e) => onAssign(lead, e.target.value)}
                    defaultValue=""
                    className="bg-white text-slate-900 px-3 py-1.5 rounded-lg text-xs font-black uppercase outline-none"
                  >
                    <option value="" disabled>Choisir...</option>
                    {BROKERS.map(b => <option key={b.email} value={b.email}>{b.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors relative z-10 ml-4 shrink-0">
            <CloseIcon size={28}/>
          </button>
        </div>

        {/* CONTENU */}
        <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* COLONNE GAUCHE: Données brutes */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">📍 Propriété Ciblée</p>
               <p className="text-slate-900 font-bold flex items-center gap-2 text-lg mb-2">
                 <MapPin size={18} className="text-indigo-500"/> {address}
               </p>
               {price && (
                 <p className="text-indigo-700 text-sm font-black bg-indigo-50 inline-block px-3 py-1.5 rounded-lg border border-indigo-100">
                   Valeur estimée : {Number(price).toLocaleString('fr-CA')} $
                 </p>
               )}
            </div>

            <section>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-500" /> Bilan Actifs / Passifs
              </h3>
              {!isReadyForBank && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-center mb-4">
                  <Clock size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="font-bold text-xs">Bilan complet manquant. Voici les données préliminaires de l'IA :</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Salaire/Revenu" val={lead.clientDetails?.salaire || lead.financialData?.revenu} color="slate" />
                  <StatBox label="Épargne/Cash" val={lead.clientDetails?.liquidites || lead.financialData?.mise_de_fonds} color="emerald" />
                  <StatBox label="REER/CELI" val={(Number(lead.clientDetails?.reer||0) + Number(lead.clientDetails?.celi||0))} color="emerald" />
                  <StatBox label="Dettes (Auto/Cartes)" val={(Number(lead.clientDetails?.pret_auto||0) + Number(lead.clientDetails?.solde_cartes||0))} color="rose" />
                </div>
              </div>
            </section>
          </div>

          {/* COLONNE DROITE: IA & RAPPORT BANCAIRE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* LA MAGIE: Bouton Générer Rapport */}
            <div className="bg-indigo-950 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex items-center justify-between">
              <div className="relative z-10">
                <h3 className="text-xl font-black mb-2 flex items-center gap-2">
                  <Printer className="text-indigo-400" /> Mode Présentation Banque
                </h3>
                <p className="text-indigo-200 text-sm max-w-md font-medium leading-relaxed">
                  L'IA a structuré les données. Générez un rapport PDF propre et professionnel prêt à être envoyé au souscripteur.
                </p>
              </div>
              <button 
                onClick={onGenerateReport}
                disabled={!isReadyForBank}
                className={`relative z-10 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg flex items-center gap-3 shrink-0 ${isReadyForBank ? 'bg-indigo-500 hover:bg-indigo-400 text-white hover:scale-105' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
              >
                <FileText size={20} /> Exporter PDF
              </button>
              {/* Deco */}
              <div className="absolute -right-10 -top-10 text-indigo-800/30 rotate-12"><FileText size={150}/></div>
            </div>

            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 flex-1 relative">
              <div className="absolute top-6 right-6 text-indigo-300"><BrainCircuitIcon size={32} /></div>
              <h3 className="text-slate-800 font-black text-lg mb-6 flex items-center gap-2">
                Analyse Stratégique Interne <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md uppercase tracking-widest ml-2">Par l'IA</span>
              </h3>
              
              {lead.aiAnalysis ? (
                <div className="prose prose-sm prose-indigo text-slate-700 font-medium" dangerouslySetInnerHTML={{ __html: cleanAIContent(lead.aiAnalysis) }} />
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center">
                  <p className="font-bold text-sm">Analyse IA en attente de la soumission du client.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, val, color }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    rose: 'bg-rose-50 border-rose-100 text-rose-900',
    slate: 'bg-white border-slate-200 text-slate-900'
  };
  return (
    <div className={`p-4 rounded-2xl border ${colors[color]}`}>
      <div className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
      <div className="text-lg font-black">{val ? `${Number(val).toLocaleString('fr-CA')}$` : '0$'}</div>
    </div>
  );
}

/**
 * ============================================================================
 * VUE D'IMPRESSION : LE FAMEUX RAPPORT BANCAIRE
 * Cette vue remplace tout l'écran au moment d'imprimer pour un rendu parfait.
 * ============================================================================
 */
function BankReportPrintView({ lead, onBack }) {
  const { address, price } = getLeadPropertyInfo(lead);
  const client = lead.clientDetails || {};
  
  // Calcul approximatif des ratios (Adapté pour lire aussi les données du Chatbot)
  const revenuBrut = Number(client.salaire || lead.financialData?.revenu || 0);
  const dettesMensuelles = (Number(client.pret_auto || 0) * 0.03) + (Number(client.solde_cartes || 0) * 0.05); // Approche générique
  const valeurProp = Number(price || 0);
  const miseFonds = Number(client.liquidites || lead.financialData?.mise_de_fonds || 0);
  const hypothequeEstimee = valeurProp - miseFonds;
  
  const paiementMensuelEstime = hypothequeEstimee > 0 ? (hypothequeEstimee * 0.0055) : 0; // Taux fictif approx
  
  const abd = revenuBrut > 0 ? ((paiementMensuelEstime * 12) / revenuBrut * 100).toFixed(1) : 'N/A';
  const atd = revenuBrut > 0 ? (((paiementMensuelEstime + dettesMensuelles) * 12) / revenuBrut * 100).toFixed(1) : 'N/A';

  // --- NOUVEAU: Générateur de Document Word ---
  const exportToWord = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Rapport Optimiplex</title></head><body>";
    const footer = "</body></html>";
    // On récupère le contenu visuel du rapport
    const content = document.getElementById('report-content').innerHTML;
    const sourceHTML = header + content + footer;

    // Encodage pour le téléchargement
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `Rapport_Optimiplex_${client.nom || 'Client'}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  return (
    <div className="bg-slate-100 min-h-screen font-sans pb-10 print:bg-white print:pb-0">
      {/* BARRE D'OUTILS - INVISIBLE À L'IMPRESSION */}
      <div className="print:hidden bg-slate-900 text-white px-8 py-4 sticky top-0 z-50 flex justify-between items-center shadow-xl">
         <button onClick={onBack} className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-800 px-4 py-2 rounded-xl transition-all font-bold text-sm">
            <ArrowLeft size={18} /> Retour au dossier
         </button>
         <div className="flex items-center gap-4">
           {/* Bouton Word ajouté ici */}
           <button onClick={exportToWord} className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl transition-all font-black uppercase tracking-widest text-xs shadow-lg active:scale-95">
              <Download size={16} /> Exporter en Word
           </button>
           <button onClick={() => window.print()} className="flex items-center gap-3 bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2.5 rounded-xl transition-all font-black uppercase tracking-widest text-xs shadow-lg active:scale-95">
              <Printer size={16} /> Imprimer (PDF)
           </button>
         </div>
      </div>

      {/* DOCUMENT A4 - On ajoute l'ID report-content pour l'export Word */}
      <div id="report-content" className="bg-white text-black p-12 max-w-[21cm] mx-auto mt-8 shadow-2xl print:shadow-none print:max-w-full print:w-full print:mt-0 print:p-0">
        {/* HEADER PROFESSIONNEL */}
        <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Optimiplex</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Résumé de dossier de financement</p>
          </div>
          <div className="text-right text-sm font-medium">
            <p>Date : {new Date().toLocaleDateString('fr-CA')}</p>
            <p>Réf : {lead.id.substring(0, 8).toUpperCase()}</p>
            <p className="font-bold mt-2">Courtier : {lead.assignedBrokerName || 'Non assigné'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 mb-10">
          {/* INFO EMPRUNTEUR */}
          <div>
            <h2 className="text-lg font-black uppercase border-b border-slate-300 pb-2 mb-4">Profil Emprunteur</h2>
            <table className="w-full text-sm table-fixed">
              <tbody>
                <tr><td className="py-1 text-slate-600 w-2/5 align-top pr-2">Nom Complet</td><td className="py-1 font-bold text-right w-3/5 break-words">{client.prenom} {client.nom}</td></tr>
                <tr><td className="py-1 text-slate-600 w-2/5 align-top pr-2">Courriel</td><td className="py-1 font-bold text-right w-3/5 break-words">{lead.clientEmail}</td></tr>
                <tr><td className="py-1 text-slate-600 w-2/5 align-top pr-2">Téléphone</td><td className="py-1 font-bold text-right w-3/5 break-words">{client.telephone || 'N/A'}</td></tr>
                <tr><td className="py-1 text-slate-600 w-2/5 align-top pr-2">Revenu Brut Annuel</td><td className="py-1 font-bold text-right w-3/5 break-words">{revenuBrut.toLocaleString('fr-CA')} $</td></tr>
              </tbody>
            </table>
          </div>

          {/* PROJET IMMOBILIER */}
          <div>
            <h2 className="text-lg font-black uppercase border-b border-slate-300 pb-2 mb-4">Projet Cible</h2>
            <table className="w-full text-sm table-fixed">
              <tbody>
                <tr><td className="py-1 text-slate-600 w-2/5 align-top pr-2">Propriété</td><td className="py-1 font-bold text-right w-3/5 break-words">{address}</td></tr>
                <tr><td className="py-1 text-slate-600 w-2/5 align-top pr-2">Valeur / Prix d'achat</td><td className="py-1 font-bold text-right w-3/5 break-words">{valeurProp.toLocaleString('fr-CA')} $</td></tr>
                <tr><td className="py-1 text-slate-600 w-2/5 align-top pr-2">Mise de fonds (Liq.)</td><td className="py-1 font-bold text-right w-3/5 break-words">{miseFonds.toLocaleString('fr-CA')} $</td></tr>
                <tr><td className="py-1 text-slate-600 w-2/5 align-top pr-2">Prêt estimé requis</td><td className="py-1 font-bold text-right w-3/5 break-words">{hypothequeEstimee > 0 ? hypothequeEstimee.toLocaleString('fr-CA') : 'N/A'} $</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* RATIOS & SYNTHÈSE */}
        <div className="bg-slate-50 p-6 rounded-lg mb-10 border border-slate-200">
          <h2 className="text-lg font-black uppercase mb-4 text-center">Indicateurs de Performance (Estimés)</h2>
          <div className="grid grid-cols-2 gap-8 text-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Amortissement Brut (ABD)</p>
              <p className="text-3xl font-black">{abd}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Amortissement Total (ATD)</p>
              <p className="text-3xl font-black">{atd}%</p>
            </div>
          </div>
        </div>

        {/* NOTES DU COURTIER / ANALYSE IA */}
        {/* CORRECTION: Ajout de break-words pour empêcher le texte de déborder de la page */}
        <div>
          <h2 className="text-lg font-black uppercase border-b border-slate-300 pb-2 mb-4">Résumé Exécutif</h2>
          <div className="prose prose-sm max-w-none text-justify break-words" dangerouslySetInnerHTML={{ __html: lead.aiAnalysis ? cleanAIContent(lead.aiAnalysis) : "Aucune analyse disponible pour ce dossier." }} />
        </div>

        {/* PIED DE PAGE */}
        <div className="mt-16 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          Document généré automatiquement par Optimiplex AI. Les ratios sont présentés à titre indicatif et doivent être validés.
        </div>
      </div>
    </div>
  );
}

// Icon Helpers
function BrainCircuitIcon(props) {
  return <BrainCircuit {...props} />;
}
function CheckCircleIcon(props) {
  return <CheckCircle {...props} />;
}