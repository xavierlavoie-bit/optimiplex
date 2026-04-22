import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Mail, Briefcase, Clock, ArrowLeft, Trash2, Search, AlertCircle, 
  TrendingUp, Phone, ChevronRight, DollarSign, PieChart, MapPin, FileText, 
  Printer, Send, BrainCircuit, CheckCircle, Download, Loader2, Bot, FileDown, X as CloseIcon, Plus, UploadCloud, Paperclip, Sparkles, Maximize2, RefreshCw, LogOut, ShieldAlert
} from 'lucide-react';

// Export manquant pour éviter les erreurs dans App.js
export const isUserBroker = (userEmail) => true;

// Helpers
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
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false); 
  const [currentUser, setCurrentUser] = useState(null);
  
  // États pour gérer le profil utilisateur et son équipe depuis Firestore
  const [userProfile, setUserProfile] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null); 
  const [isPrinting, setIsPrinting] = useState(false);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  // Authentification : on écoute simplement App.js
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthResolved(true);
      if (!user) {
        setIsProfileLoading(false);
        setUserProfile(null);
        setTeamData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 🚀 NOUVELLE LOGIQUE : Récupération intelligente de l'équipe (Admin ou Invité)
  useEffect(() => {
    if (!authResolved || !currentUser) return;

    const db = getFirestore();
    let unsubUser = () => {};
    let unsubAccess = () => {};
    let unsubTeam = () => {};

    // 1. Charger le rôle local
    unsubUser = onSnapshot(doc(db, 'users', currentUser.uid), (userDoc) => {
      setUserProfile(userDoc.exists() ? userDoc.data() : { role: 'courtier' });
    });

    if (currentUser.email) {
      // 2. Vérifier si l'utilisateur a été invité par un Admin (via team_access)
      const accessRef = doc(db, 'team_access', currentUser.email.toLowerCase());
      
      unsubAccess = onSnapshot(accessRef, (accessDoc) => {
        // Nettoyer l'ancienne écoute d'équipe si on change
        unsubTeam(); 

        if (accessDoc.exists()) {
          // 🎉 L'utilisateur (ex: Xav) a une invitation ! On le branche sur l'équipe de l'Admin
          const accessData = accessDoc.data();
          const teamRef = doc(db, 'users', accessData.adminUid, 'teams', accessData.teamId);
          
          unsubTeam = onSnapshot(teamRef, (teamDoc) => {
            if (teamDoc.exists()) {
              setTeamData({ id: teamDoc.id, ...teamDoc.data() });
            } else {
              setTeamData(null);
            }
            setIsProfileLoading(false);
          });

        } else {
          // 👑 Pas d'invitation ? On vérifie s'il a sa propre équipe (ex: c'est toi, l'Admin)
          const myTeamsRef = collection(db, 'users', currentUser.uid, 'teams');
          
          unsubTeam = onSnapshot(myTeamsRef, (snapshot) => {
            if (!snapshot.empty) {
              setTeamData({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            } else {
              setTeamData(null);
            }
            setIsProfileLoading(false);
          });
        }
      });
    } else {
       setIsProfileLoading(false);
    }

    return () => {
      unsubUser();
      unsubAccess();
      unsubTeam();
    };
  }, [authResolved, currentUser]);


  // Récupération des leads (Filtrés en mémoire par teamId)
  useEffect(() => {
    if (!authResolved || !currentUser || !teamData?.id) return; 
    
    const db = getFirestore();
    const leadsCollection = collection(db, 'leads_hypothecaires');
    
    const unsubscribe = onSnapshot(leadsCollection, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        const leadData = doc.data();
        if (leadData.teamId === teamData.id) {
           data.push({ id: doc.id, ...leadData });
        }
      });
      
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      const safeData = data.map(lead => ({
        ...lead,
        status: lead.status || 'nouveau'
      }));

      setLeads(safeData);
      
      if (selectedLead) {
        const updatedSelectedLead = safeData.find(l => l.id === selectedLead.id);
        if (updatedSelectedLead) setSelectedLead(updatedSelectedLead);
      }
      
      setLoading(false); // <--- Le chargement s'arrête ici une fois les leads récupérés
    }, (error) => {
      console.error("Erreur Firestore (Leads):", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authResolved, currentUser, teamData]);


  // Actions sur les Leads
  const handleAssignLead = async (lead, brokerEmail) => {
    if (!brokerEmail || !currentUser || !teamData) return;
    
    const assignedBroker = teamData.brokers?.find(b => b.email === brokerEmail);
    if (!assignedBroker) return alert("Courtier non trouvé dans cette équipe.");

    try {
      const db = getFirestore();
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      
      const leadRef = doc(db, 'leads_hypothecaires', lead.id);
      await updateDoc(leadRef, {
        assignedTo: assignedBroker.email,
        assignedBrokerName: assignedBroker.name,
        status: 'assigne'
      });

      try {
        await axios.post(`${API_URL}/api/broker/assign`, {
          leadId: lead.id,
          brokerEmail: assignedBroker.email,
          brokerName: assignedBroker.name,
          clientEmail: lead.clientEmail,
          aiSummary: lead.aiSummary || "Dossier ajouté manuellement - en attente du bilan client."
        });
        alert(`✅ Dossier assigné avec succès à ${assignedBroker.name}. Les courriels ont été envoyés !`);
      } catch (e) {
         console.log("Mode démo: Assignation locale réussie, API Backend ignorée.");
      }
      
      if (selectedLead && selectedLead.id === lead.id) setSelectedLead(null); 
    } catch (err) {
      console.error("Erreur d'assignation:", err);
      alert("❌ Erreur lors de l'assignation.");
    }
  };

  const handleChangeStatus = async (id, status) => {
    if (!currentUser) return;
    try {
      const db = getFirestore();
      const leadRef = doc(db, 'leads_hypothecaires', id);
      await updateDoc(leadRef, { status });
    } catch (err) {
      console.error("Erreur de statut:", err);
    }
  };

  const handleDeleteLead = async (id) => {
    if (!currentUser) return;
    if (window.confirm("Voulez-vous supprimer définitivement ce dossier ?")) {
      try {
        const db = getFirestore();
        const leadRef = doc(db, 'leads_hypothecaires', id);
        await deleteDoc(leadRef);
        if (selectedLead?.id === id) setSelectedLead(null);
      } catch (err) {
        console.error("Erreur lors de la suppression:", err);
        alert("Erreur lors de la suppression du dossier.");
      }
    }
  };

  const handleAddLeadSubmit = async (e, formData) => {
    e.preventDefault();
    if (!currentUser || !teamData?.id) return alert("Erreur d'équipe.");
    try {
      const db = getFirestore();
      const leadsCollection = collection(db, 'leads_hypothecaires');
      await addDoc(leadsCollection, {
        teamId: teamData.id, 
        clientEmail: formData.email,
        clientDetails: { prenom: formData.prenom, nom: formData.nom, telephone: formData.telephone },
        evaluationData: { ville: formData.ville },
        status: 'nouveau',
        clientFormCompleted: false,
        createdAt: serverTimestamp(),
        source: 'ajout_manuel_crm'
      });
      setIsAddingLead(false);
    } catch (err) {
      console.error("Erreur ajout manuel:", err);
      alert("❌ Erreur lors de l'ajout du dossier.");
    }
  };

  const filteredLeads = leads.filter(l => {
    const term = searchTerm.toLowerCase();
    const email = l.clientEmail || '';
    const nom = l.clientDetails?.nom || '';
    const prenom = l.clientDetails?.prenom || '';
    return email.toLowerCase().includes(term) || nom.toLowerCase().includes(term) || prenom.toLowerCase().includes(term);
  });

  // =========================================================
  // GESTION DES ÉCRANS DE CHARGEMENT SÉPARÉS
  // =========================================================

  // 1. Chargement du profil et de l'autorisation
  if (!authResolved || isProfileLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="font-black text-indigo-600 uppercase tracking-widest text-sm">Connexion au Portail...</p>
      </div>
    );
  }

  // 2. Connecté mais pas d'utilisateur
  if (!currentUser) {
       return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-6">
          <AlertCircle size={60} className="text-red-500 mb-4" />
          <h2 className="text-3xl font-black text-slate-800">Non authentifié</h2>
        </div>
      );
  }

  // 3. Connecté, profil chargé, MAIS l'équipe n'existe pas / pas d'accès
  if (currentUser && !teamData) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-6">
          <ShieldAlert size={60} className="text-amber-500 mb-4" />
          <h2 className="text-3xl font-black text-slate-800">Compte en attente</h2>
          <p className="text-slate-500 mt-2 max-w-md mb-6">
            Votre compte n'a pas encore été associé à une équipe. 
            Demandez à votre administrateur de vous envoyer une invitation.
          </p>
          <button onClick={() => navigate('/dashboard/overview')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-xl font-bold transition-colors">
              Retour au Dashboard
          </button>
        </div>
      );
  }

  // 4. L'équipe est trouvée, on attend juste de récupérer les leads
  if (loading) {
     return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="font-black text-indigo-600 uppercase tracking-widest text-sm">Chargement des dossiers...</p>
      </div>
    );
  }

  if (isPrinting && selectedLead) {
    return <BankReportPrintView lead={selectedLead} onBack={() => setIsPrinting(false)} team={teamData} />;
  }

  const rawThemeColor = teamData?.themeColor || teamData?.Themecolor || 'indigo';
  const themeColor = rawThemeColor.toLowerCase();

  const isAdmin = userProfile?.role?.toLowerCase() === 'admin' || teamData?.role?.toLowerCase() === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans print:hidden">
      <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-40 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className={`bg-${themeColor}-600 p-2.5 rounded-xl text-white shadow-lg flex items-center justify-center font-black`}>
              {teamData.logoInitials || <BrainCircuit size={24} />}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                {teamData.name} <span className={`text-${themeColor}-600`}>CRM</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Connecté : {isAdmin ? 'Administrateur' : 'Courtier'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-2.5 text-slate-300" size={18} />
            <input 
              placeholder="Rechercher un client..." 
              className={`pl-10 pr-4 py-2 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-${themeColor}-100 w-72 font-bold transition-all`} 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          
          {isAdmin && (
            <button 
              onClick={() => setIsTeamModalOpen(true)}
              className={`flex items-center gap-2 bg-white border border-${themeColor}-200 text-${themeColor}-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors hover:bg-${themeColor}-50`}
            >
              <Users size={18} /> Équipe
            </button>
          )}

          <button 
            onClick={() => setIsAddingLead(true)}
            className={`flex items-center gap-2 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors`}
          >
            <Plus size={18} /> Ajouter client
          </button>
          
          <div className="h-8 w-px bg-slate-200 mx-2"></div>
          
          <button onClick={() => navigate('/dashboard/overview')} className="text-slate-400 hover:text-slate-600 transition-colors" title="Quitter le CRM">
             <LogOut size={20} className="rotate-180" />
          </button>
        </div>
      </header>

      <div className="flex-1 p-8 overflow-x-auto flex gap-6 max-w-[1800px] mx-auto w-full">
        <BoardColumn title="📥 À Assigner" count={filteredLeads.filter(l => l.status === 'nouveau').length} themeColor={themeColor}>
          {filteredLeads.filter(l => l.status === 'nouveau').map(lead => (
             <LeadCard key={lead.id} lead={lead} team={teamData} onClick={() => setSelectedLead(lead)} onAssign={handleAssignLead} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

        <BoardColumn title="⏳ Attente Bilan" count={filteredLeads.filter(l => (l.status === 'assigne' || l.status === 'en_cours') && !l.clientFormCompleted).length} highlight themeColor={themeColor}>
          {filteredLeads.filter(l => (l.status === 'assigne' || l.status === 'en_cours') && !l.clientFormCompleted).map(lead => (
             <LeadCard key={lead.id} lead={lead} team={teamData} onClick={() => setSelectedLead(lead)} onStatusChange={handleChangeStatus} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

        <BoardColumn title="🧠 Prêt pour Banque" count={filteredLeads.filter(l => (l.status === 'assigne' || l.status === 'en_cours') && l.clientFormCompleted).length} themeColor={themeColor}>
          {filteredLeads.filter(l => (l.status === 'assigne' || l.status === 'en_cours') && l.clientFormCompleted).map(lead => (
             <LeadCard key={lead.id} lead={lead} team={teamData} onClick={() => setSelectedLead(lead)} onStatusChange={handleChangeStatus} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

        <BoardColumn title="🎉 Financés" count={filteredLeads.filter(l => l.status === 'complete').length} themeColor={themeColor}>
          {filteredLeads.filter(l => l.status === 'complete').map(lead => (
             <LeadCard key={lead.id} lead={lead} team={teamData} onClick={() => setSelectedLead(lead)} onStatusChange={handleChangeStatus} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>
      </div>

      {selectedLead && (
        <DetailModal 
          lead={selectedLead} 
          team={teamData}
          onClose={() => setSelectedLead(null)} 
          onStatusChange={handleChangeStatus} 
          onAssign={handleAssignLead}
          onGenerateReport={() => setIsPrinting(true)}
        />
      )}

      {isAddingLead && (
        <AddLeadModal onClose={() => setIsAddingLead(false)} onSubmit={handleAddLeadSubmit} themeColor={themeColor} />
      )}

      {isTeamModalOpen && (
        <TeamManagementModal 
          team={teamData} 
          onClose={() => setIsTeamModalOpen(false)} 
          themeColor={themeColor} 
          currentUserUid={currentUser.uid} 
        />
      )}
    </div>
  );
}

function TeamManagementModal({ team, onClose, themeColor, currentUserUid }) {
  const [newBrokerName, setNewBrokerName] = useState('');
  const [newBrokerEmail, setNewBrokerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newBrokerName.trim() || !newBrokerEmail.trim()) return;
    setIsSubmitting(true);
    
    const emailLower = newBrokerEmail.toLowerCase();

    try {
      const db = getFirestore();
      
      // 1. Ajouter le courtier à la liste d'affichage de l'équipe
      const teamRef = doc(db, 'users', currentUserUid, 'teams', team.id);
      await updateDoc(teamRef, {
        brokers: arrayUnion({ name: newBrokerName, email: emailLower })
      });
      
      // 2. 🚀 CRÉER LA CLÉ D'ACCÈS POUR QUE XAV PUISSE SE CONNECTER !
      const accessRef = doc(db, 'team_access', emailLower);
      await setDoc(accessRef, {
        teamId: team.id,
        adminUid: currentUserUid,
        role: 'courtier',
        addedAt: serverTimestamp()
      });
      
      setNewBrokerName('');
      setNewBrokerEmail('');
      alert("✅ Membre ajouté avec succès ! Il a maintenant accès à votre équipe.");
    } catch (err) {
      console.error("Erreur ajout membre:", err);
      alert("❌ Erreur lors de l'ajout.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (brokerToRemove) => {
    if (!window.confirm(`Retirer ${brokerToRemove.name} de l'équipe et bloquer son accès ?`)) return;
    try {
      const db = getFirestore();
      
      // 1. Retirer de la liste
      const teamRef = doc(db, 'users', currentUserUid, 'teams', team.id);
      await updateDoc(teamRef, {
        brokers: arrayRemove(brokerToRemove)
      });

      // 2. 🚀 SUPPRIMER LA CLÉ D'ACCÈS
      const accessRef = doc(db, 'team_access', brokerToRemove.email.toLowerCase());
      await deleteDoc(accessRef);

    } catch (err) {
      console.error("Erreur suppression membre:", err);
      alert("❌ Erreur lors de la suppression.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
        <div className={`p-6 bg-${themeColor}-600 flex justify-between items-center text-white`}>
          <div>
            <h2 className="text-xl font-black">Gestion de l'équipe</h2>
            <p className="text-xs font-medium opacity-80 mt-1">{team.name} - Ajouter des courtiers</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <CloseIcon size={24}/>
          </button>
        </div>
        
        <div className="p-8">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Membres Actuels</h3>
          <div className="space-y-3 mb-8 max-h-48 overflow-y-auto pr-2">
            {team.brokers && team.brokers.length > 0 ? team.brokers.map((broker, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <p className="font-bold text-sm text-slate-800">{broker.name}</p>
                  <p className="text-xs text-slate-500">{broker.email}</p>
                </div>
                <button onClick={() => handleRemoveMember(broker)} className="text-rose-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            )) : (
              <p className="text-sm text-slate-500 italic">Aucun membre dans l'équipe pour le moment.</p>
            )}
          </div>

          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 border-t border-slate-100 pt-6">Ajouter un membre</h3>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nom du courtier</label>
                <input required type="text" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 focus:ring-2 focus:ring-${themeColor}-100 text-sm`} placeholder="Ex: Alex" value={newBrokerName} onChange={e => setNewBrokerName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Adresse Courriel</label>
                <input required type="email" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 focus:ring-2 focus:ring-${themeColor}-100 text-sm`} placeholder="alex@email.com" value={newBrokerEmail} onChange={e => setNewBrokerEmail(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className={`w-full py-3 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50`}>
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={18}/> Envoyer l'invitation</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onSubmit, themeColor }) {
  const [formData, setFormData] = useState({ prenom: '', nom: '', email: '', telephone: '', ville: '' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-900">Ajouter un dossier</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">Saisie manuelle d'un nouveau client</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <CloseIcon size={24}/>
          </button>
        </div>
        
        <form onSubmit={(e) => onSubmit(e, formData)} className="p-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Prénom</label>
              <input required type="text" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 focus:ring-2 focus:ring-${themeColor}-100`} placeholder="Jean" value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Nom</label>
              <input required type="text" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 focus:ring-2 focus:ring-${themeColor}-100`} placeholder="Tremblay" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1">Adresse Courriel *</label>
            <input required type="email" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 focus:ring-2 focus:ring-${themeColor}-100`} placeholder="jean.tremblay@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Téléphone</label>
              <input type="tel" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 focus:ring-2 focus:ring-${themeColor}-100`} placeholder="(555) 555-5555" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Ville (Optionnel)</label>
              <input type="text" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 focus:ring-2 focus:ring-${themeColor}-100`} placeholder="Saguenay" value={formData.ville} onChange={e => setFormData({...formData, ville: e.target.value})} />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
              Annuler
            </button>
            <button type="submit" className={`px-8 py-3 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white font-black rounded-xl shadow-lg shadow-${themeColor}-200 transition-all flex items-center gap-2`}>
              <Plus size={18}/> Créer le dossier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BoardColumn({ title, count, children, highlight, themeColor }) {
  return (
    <div className={`rounded-[2rem] p-5 border flex flex-col min-w-[350px] w-[350px] shrink-0 h-[calc(100vh-140px)] ${highlight ? `bg-${themeColor}-50/50 border-${themeColor}-200` : 'bg-slate-200/40 border-slate-200/50'}`}>
      <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mb-5 px-2 flex justify-between items-center shrink-0">
        {title}
        <span className={`px-2.5 py-1 rounded-lg text-sm shadow-sm border ${highlight ? `bg-${themeColor}-600 text-white border-${themeColor}-600` : 'bg-white text-slate-700 border-slate-200'}`}>
          {count}
        </span>
      </h2>
      <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-4 hide-scrollbar">
        {children}
      </div>
    </div>
  );
}

function LeadCard({ lead, team, onClick, onAssign, onStatusChange, onDelete }) {
  const { address } = getLeadPropertyInfo(lead);
  const broker = team?.brokers?.find(b => b.email === lead.assignedTo) || { name: 'Non assigné' };
  const rawThemeColor = team?.themeColor || team?.Themecolor || 'indigo';
  const themeColor = rawThemeColor.toLowerCase();

  const isWaiting = (lead.status === 'assigne' || lead.status === 'en_cours') && !lead.clientFormCompleted;
  const isGenerating = lead.documentStatus === 'generation_en_cours';

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

      {lead.assignedTo && (
        <div className={`absolute left-0 top-6 bottom-6 w-1.5 rounded-r-full bg-${themeColor}-500`}></div>
      )}

      <div className="pl-2">
        <div className="flex justify-between items-start mb-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            {lead.createdAt?.toDate ? new Date(lead.createdAt.toDate()).toLocaleDateString('fr-CA') : 'Maintenant'}
          </p>
          {lead.assignedTo && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md bg-${themeColor}-50 text-${themeColor}-700`}>
              {broker.name.split(' ')[0]}
            </span>
          )}
        </div>
        
        <h3 className="font-black text-slate-900 truncate text-lg leading-tight mb-2">
          {lead.clientDetails?.prenom ? `${lead.clientDetails.prenom} ${lead.clientDetails.nom}` : lead.clientEmail}
        </h3>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2 mb-2">
            {isWaiting ? (
              <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-200">
                <Clock size={12} className="animate-pulse" /> Bilan manquant
              </div>
            ) : lead.clientFormCompleted ? (
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200">
                <CheckCircle size={12} /> Bilan complété
              </div>
            ) : null}

            {isGenerating && (
                <div className={`inline-flex items-center gap-1.5 bg-${themeColor}-50 text-${themeColor}-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-${themeColor}-200`}>
                    <Loader2 size={12} className="animate-spin" /> Génération docs...
                </div>
            )}
        </div>

        {address !== 'Adresse non fournie' && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <MapPin size={12} className={`text-${themeColor}-400 shrink-0`}/>
            <span className="truncate">{address}</span>
          </div>
        )}
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
              {team?.brokers?.map(b => (
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

function DetailModal({ lead, team, onClose, onAssign, onGenerateReport }) {
  const { address, price } = getLeadPropertyInfo(lead);
  const broker = team?.brokers?.find(b => b.email === lead.assignedTo) || { name: 'Non assigné', email: '' };
  
  const rawThemeColor = team?.themeColor || team?.Themecolor || 'indigo';
  const themeColor = rawThemeColor.toLowerCase();

  const isReadyForBank = lead.clientFormCompleted || true; 
  const isGenerating = lead.documentStatus === 'generation_en_cours';

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); uploadFiles(Array.from(e.dataTransfer.files)); };
  const handleFileInput = (e) => { uploadFiles(Array.from(e.target.files)); };

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    if (!getAuth().currentUser) return;
    setIsUploading(true);
    
    const db = getFirestore();
    const storage = getStorage();
    const uploadedFilesData = [];

    try {
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileRef = storageRef(storage, `dossiers/${lead.id}/manuels/${Date.now()}_${safeName}`);
        await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(fileRef);
        
        uploadedFilesData.push({
          name: file.name,
          url: downloadUrl,
          size: file.size,
          uploadedAt: new Date().toISOString()
        });
      }

      const leadRef = doc(db, 'leads_hypothecaires', lead.id);
      await updateDoc(leadRef, {
        manualFiles: arrayUnion(...uploadedFilesData)
      });
      
      setIsReanalyzing(true);
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      try {
          await axios.post(`${API_URL}/api/agent/reanalyze-lead`, { leadId: lead.id });
      } catch (e) {
          console.log("Mode sans API: Fichier uploadé avec succès, API IA ignorée pour le test.");
      }

    } catch (error) {
      console.error("Erreur upload ou analyse manuelle:", error);
      alert("Erreur lors du traitement du fichier. Vérifiez vos règles Firebase Storage.");
    } finally {
      setIsUploading(false);
      setIsReanalyzing(false);
    }
  };

  const handleSendGeneratedFile = async (file) => {
    if (!window.confirm(`Envoyer le document "${file.name}" à ${lead.clientEmail} ?`)) return;
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      await axios.post(`${API_URL}/api/broker/send-file`, {
        leadId: lead.id,
        email: lead.clientEmail,
        fileName: file.name,
        fileUrl: file.url,
        brokerName: broker.name,
        brokerEmail: broker.email
      });
      alert("✅ Document envoyé avec succès !");
    } catch (err) {
      console.error(err);
      alert("❌ Mode Démo: Impossible de contacter le serveur d'envoi de courriels.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-50 w-full max-w-6xl max-h-[94vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative z-50">
        
        {/* HEADER MODAL */}
        <div className={`p-8 text-white flex justify-between items-start shrink-0 relative overflow-hidden transition-colors ${lead.assignedTo ? `bg-${themeColor}-600` : 'bg-slate-800'}`}>
          <div className="relative z-10 w-full">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h2 className="text-4xl font-black tracking-tight">{lead.clientDetails?.prenom || 'Nouveau'} {lead.clientDetails?.nom || 'Lead'}</h2>
                  {isReadyForBank && <span className="bg-white/20 backdrop-blur-md text-white text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest border border-white/30">Dossier Complet</span>}
                  
                  {isReadyForBank && (
                    <button onClick={onGenerateReport} className="ml-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                      <Printer size={14} /> PDF Préqualification
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-6 text-white/80 text-sm font-bold mt-3">
                  <p className="flex items-center gap-2"><Mail size={16} /> {lead.clientEmail}</p>
                  {lead.clientDetails?.telephone && <p className="flex items-center gap-2"><Phone size={16} /> {lead.clientDetails.telephone}</p>}
                </div>
              </div>
              
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
                    {team?.brokers?.map(b => <option key={b.email} value={b.email}>{b.name}</option>)}
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
        <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">📍 Propriété Ciblée</p>
               <p className="text-slate-900 font-bold flex items-center gap-2 text-lg mb-2">
                 <MapPin size={18} className={`text-${themeColor}-500`}/> {address}
               </p>
               {price && (
                 <p className={`text-${themeColor}-700 text-sm font-black bg-${themeColor}-50 inline-block px-3 py-1.5 rounded-lg border border-${themeColor}-100`}>
                   Valeur estimée : {Number(price).toLocaleString('fr-CA')} $
                 </p>
               )}
            </div>

            <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-500" /> Bilan Actifs / Passifs
              </h3>
              {!lead.clientFormCompleted && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-center mb-4">
                  <Clock size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="font-bold text-xs">Bilan complet manquant. Voici les données préliminaires :</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Salaire/Revenu" val={lead.clientDetails?.salaire || lead.financialData?.revenu || lead.clientDetails?.revenuAnnuel} color="slate" />
                <StatBox label="Épargne/Cash" val={lead.clientDetails?.liquidites || lead.financialData?.mise_de_fonds} color="emerald" />
                <StatBox label="REER/CELI" val={(Number(lead.clientDetails?.reer||0) + Number(lead.clientDetails?.celi||0))} color="emerald" />
                <StatBox label="Dettes (Auto/Cartes)" val={(Number(lead.clientDetails?.pret_auto||0) + Number(lead.clientDetails?.solde_cartes||0))} color="rose" />
              </div>
            </section>

            {/* INTEGRATION DE LA SECTION AGENT IA */}
            <AgentAnalysisSection lead={lead} isReanalyzing={isReanalyzing} broker={broker} themeColor={themeColor} />
            
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <h3 className="text-slate-800 font-black text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <FileText size={24} className={`text-${themeColor}-500`} /> Documents Client (PDF & Excel)
                </h3>
                
                {isGenerating ? (
                    <div className={`flex flex-col items-center justify-center py-8 gap-5 bg-${themeColor}-50/50 rounded-2xl border border-${themeColor}-100`}>
                        <div className="relative">
                            <Loader2 size={48} className={`animate-spin text-${themeColor}-500`} />
                        </div>
                        <p className={`text-sm font-bold text-${themeColor}-900 animate-pulse text-center max-w-sm`}>
                            Génération du PDF et Excel en cours...
                        </p>
                    </div>
                ) : lead.documentStatus === 'completed' && lead.generatedFiles?.length > 0 ? (
                    <div className="space-y-3">
                        {lead.generatedFiles.map((file, i) => (
                            <div key={i} className={`flex items-center justify-between p-4 bg-${themeColor}-50 rounded-xl hover:bg-${themeColor}-100 hover:shadow-md transition-all border border-${themeColor}-100`}>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                        <FileDown className={`text-${themeColor}-600`} size={20} />
                                    </div>
                                    <span className={`font-bold text-sm text-${themeColor}-950 block`}>{file.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a href={file.url} download target="_blank" rel="noreferrer" className={`bg-${themeColor}-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-${themeColor}-700 transition-colors`}>
                                      <Download size={14} /> <span className="hidden sm:inline">Télécharger</span>
                                  </a>
                                  <button onClick={() => handleSendGeneratedFile(file)} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors">
                                      <Send size={14} /> <span className="hidden sm:inline">Envoyer</span>
                                  </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                        <FileText size={32} className="mb-2 opacity-20" />
                        <p className="font-bold text-sm">Les documents apparaîtront ici après la soumission du client.</p>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <h3 className="text-slate-800 font-black text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <Paperclip size={24} className="text-slate-500" /> Fichiers additionnels
                </h3>

                {(lead.clientFiles?.length > 0 || lead.manualFiles?.length > 0) && (
                  <div className="mb-8 space-y-4">
                    {/* Fichiers Client */}
                    {lead.clientFiles && lead.clientFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Fournis par le client</p>
                        {lead.clientFiles.map((file, i) => (
                           <a key={`client-${i}`} href={file.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors">
                              <div className="flex items-center gap-3 truncate">
                                <Paperclip size={16} className="text-emerald-500 shrink-0" />
                                <span className="text-sm font-bold text-emerald-900 truncate">{file.name}</span>
                              </div>
                              <Download size={16} className="text-emerald-600 hover:text-emerald-800 shrink-0" />
                            </a>
                        ))}
                      </div>
                    )}

                    {/* Fichiers Courtier */}
                    {lead.manualFiles && lead.manualFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ajoutés par le courtier</p>
                        {lead.manualFiles.map((file, i) => (
                           <a key={`manual-${i}`} href={file.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                              <div className="flex items-center gap-3 truncate">
                                <Paperclip size={16} className="text-slate-400 shrink-0" />
                                <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                              </div>
                              <Download size={16} className="text-slate-400 hover:text-indigo-600 shrink-0" />
                            </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Dropzone */}
                <div 
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${isDragging ? `border-${themeColor}-500 bg-${themeColor}-50 scale-[1.02]` : 'border-slate-300 bg-slate-50 hover:bg-slate-100'} ${isUploading || isReanalyzing ? 'opacity-50 pointer-events-none' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 size={32} className={`text-${themeColor}-500 animate-spin mb-3`} />
                      <p className="text-sm font-bold text-slate-600">Envoi du fichier...</p>
                    </div>
                  ) : isReanalyzing ? (
                    <div className="flex flex-col items-center">
                      <Bot size={32} className={`text-${themeColor}-500 animate-bounce mb-3`} />
                      <p className="text-sm font-bold text-slate-600">L'IA re-vérifie le dossier...</p>
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={40} className={`mx-auto mb-3 transition-colors ${isDragging ? `text-${themeColor}-500` : 'text-slate-400'}`} />
                      <p className="text-sm font-bold text-slate-700 mb-1">Glissez-déposez vos fichiers ici</p>
                      <p className="text-xs text-slate-500 mb-4">ou</p>
                      
                      <label className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-50 hover:shadow-sm transition-all shadow-sm">
                        Parcourir les fichiers
                        <input type="file" multiple className="hidden" onChange={handleFileInput} />
                      </label>
                    </>
                  )}
                </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentAnalysisSection({ lead, isReanalyzing, broker, themeColor }) {
  const [editableNarrative, setEditableNarrative] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isGeneratingMail, setIsGeneratingMail] = useState(false);
  const [mailPreview, setMailPreview] = useState(null); 
  
  const analysis = lead?.agentAnalysis;

  useEffect(() => {
    if (analysis?.narrative) {
      setEditableNarrative(analysis.narrative);
    }
  }, [analysis]);

  const saveNarrativeToFirestore = async () => {
    if (!getAuth().currentUser) return;
    try {
      const db = getFirestore();
      const leadRef = doc(db, 'leads_hypothecaires', lead.id);
      await updateDoc(leadRef, {
        'agentAnalysis.narrative': editableNarrative
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du narratif:", e);
    }
  };

  const handleAskAI = async () => {
    if (!chatInput.trim()) return;
    setIsGeneratingMail(true);
    
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      const response = await axios.post(`${API_URL}/api/agent/draft-email`, {
        leadId: lead.id,
        instruction: chatInput,
        missingDocs: analysis?.missing_documents || []
      });
      setMailPreview(response.data.draft);
      setChatInput('');
    } catch (err) {
      console.log("Mode sans API: Création d'un brouillon factice pour le test.");
      setMailPreview(`<p>Bonjour ${lead.clientDetails?.prenom || 'Client'},</p><p>Pourriez-vous me fournir les documents suivants pour votre financement ?</p><ul><li>Talons de paie récents</li></ul><p>Merci,<br/>${broker.name}</p>`);
      setChatInput('');
    } finally {
      setIsGeneratingMail(false);
    }
  };

  const confirmAndSend = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      await axios.post(`${API_URL}/api/broker/send-followup`, {
        leadId: lead.id,
        email: lead.clientEmail,
        subject: "Action requise : Documents pour votre hypothèque",
        htmlContent: mailPreview,
        brokerName: broker.name, 
        brokerEmail: broker.email
      });
      alert("📧 Courriel envoyé avec succès !");
      setMailPreview(null);
    } catch (err) {
      alert("Erreur lors de l'envoi (API non connectée dans ce test).");
    }
  };

  const getConfidenceBadge = (score) => {
    switch (score) {
      case 'Haute': return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm"><CheckCircle size={14}/> Confiance Haute</span>;
      case 'Moyenne': return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm"><AlertCircle size={14}/> Confiance Moyenne</span>;
      case 'Basse': return <span className="bg-rose-100 text-rose-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm"><AlertCircle size={14}/> Confiance Basse</span>;
      default: return null;
    }
  };

  return (
    <>
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <BrainCircuit size={16} className={`text-${themeColor}-500`} /> Analyse IA du dossier
          </h3>
          {isReanalyzing && <RefreshCw size={14} className={`text-${themeColor}-400 animate-spin`} />}
        </div>

        {isReanalyzing ? (
           <div className={`bg-${themeColor}-50/50 rounded-2xl p-6 text-center border border-${themeColor}-100 border-dashed`}>
            <Loader2 className={`animate-spin mx-auto mb-3 text-${themeColor}-500`} size={28} />
            <p className={`text-sm font-bold text-${themeColor}-900`}>Re-vérification en cours...</p>
            <p className={`text-xs mt-1 text-${themeColor}-500`}>L'IA analyse le nouveau document.</p>
          </div>
        ) : !analysis ? (
           <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100 border-dashed">
            <Loader2 className={`animate-spin mx-auto mb-3 text-${themeColor}-400`} size={28} />
            <p className={`text-sm font-bold text-${themeColor}-900`}>En attente d'analyse...</p>
            <p className="text-xs mt-1 text-slate-500">L'Agent s'activera automatiquement après soumission de documents.</p>
          </div>
        ) : (
          <div 
            onClick={() => setIsModalOpen(true)}
            className={`bg-gradient-to-br from-${themeColor}-50 to-white border border-${themeColor}-100 rounded-2xl p-5 hover:shadow-md hover:border-${themeColor}-300 transition-all cursor-pointer group relative`}
          >
            <div className={`absolute top-2 right-2 text-${themeColor}-300 group-hover:text-${themeColor}-500 transition-colors`}>
              <Maximize2 size={16} />
            </div>
            
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className={`text-${themeColor}-500`} />
                <span className={`font-bold text-${themeColor}-950 text-sm`}>Rapport prêt</span>
              </div>
              {getConfidenceBadge(analysis.confidence_score)}
            </div>

            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-4">
              {analysis.narrative}
            </p>

            {analysis.received_documents && analysis.received_documents.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {analysis.received_documents.slice(0, 2).map((doc, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                    <CheckCircle size={12} className="shrink-0" /> <span className="truncate max-w-[120px]">{doc}</span>
                  </div>
                ))}
                {analysis.received_documents.length > 2 && (
                  <div className="flex items-center text-[10px] font-bold text-emerald-600 px-1">
                    +{analysis.received_documents.length - 2} autres
                  </div>
                )}
              </div>
            )}

            {analysis.missing_documents && analysis.missing_documents.length > 0 ? (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-2 rounded-lg mb-3 border border-rose-100 w-fit">
                <AlertCircle size={14} /> {analysis.missing_documents.length} document(s) manquant(s)
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg mb-3 border border-emerald-100 w-fit">
                <CheckCircle size={14} /> Dossier Complet
              </div>
            )}

            <div className={`text-xs font-black text-${themeColor}-600 uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform`}>
              Ouvrir le rapport complet & Assistant <ChevronRight size={14} />
            </div>
          </div>
        )}
      </div>

      {isModalOpen && analysis && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className={`bg-gradient-to-r from-${themeColor}-900 to-${themeColor}-800 p-6 sm:p-8 flex justify-between items-center shrink-0`}>
              <div className="flex items-center gap-4 text-white">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
                  <Bot size={28} className={`text-${themeColor}-100`} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Audit & Assistant IA</h2>
                  <p className={`text-${themeColor}-200 text-sm font-medium`}>Analyse automatisée et communication</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors shrink-0">
                <CloseIcon size={24}/>
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">Conformité</h4>
                    {getConfidenceBadge(analysis.confidence_score)}
                  </div>
                  
                  {analysis.received_documents && analysis.received_documents.length > 0 && (
                    <div className="mb-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                      <p className="text-sm text-emerald-700 font-black mb-3 flex items-center gap-2">
                        <CheckCircle size={18} /> Pièces justificatives validées :
                      </p>
                      <ul className="space-y-2">
                        {analysis.received_documents.map((doc, idx) => (
                          <li key={idx} className="text-xs font-bold text-emerald-800 flex items-start gap-2 bg-white p-2 rounded-lg shadow-sm border border-emerald-100/50">
                            <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                            <span>{doc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.missing_documents && analysis.missing_documents.length > 0 ? (
                    <div className="flex-1 bg-rose-50/50 p-5 rounded-xl border border-rose-100">
                      <p className="text-sm text-rose-700 font-black mb-4 flex items-center gap-2">
                        <AlertCircle size={18} /> Actions requises (Adjointe) :
                      </p>
                      <ul className="space-y-3">
                        {analysis.missing_documents.map((doc, idx) => (
                          <li key={idx} className="text-sm text-slate-700 flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm border border-rose-100/50 leading-relaxed">
                            <span className="text-rose-500 mt-0.5 font-black shrink-0">•</span>
                            <span>{doc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="flex-1 bg-emerald-50 text-emerald-800 p-6 rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-center gap-3">
                      <CheckCircle size={40} className="text-emerald-500 mb-2" />
                      <p className="font-black text-lg">Dossier complet.</p>
                      <p className="text-emerald-700 text-sm font-medium">Les pièces justificatives semblent correspondre aux déclarations financières.</p>
                    </div>
                  )}
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="mb-4 border-b border-slate-100 pb-4">
                    <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                      <FileText size={18} className={`text-${themeColor}-500`} />
                      Narratif de recommandation
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Ce texte est éditable. Modifiez-le avant la génération du PDF.
                    </p>
                  </div>
                  
                  <textarea
                    value={editableNarrative}
                    onChange={(e) => setEditableNarrative(e.target.value)}
                    onBlur={saveNarrativeToFirestore} 
                    className={`w-full flex-1 min-h-[200px] p-4 text-sm text-slate-700 bg-slate-50/80 border border-slate-200 rounded-xl focus:border-${themeColor}-500 focus:ring-4 focus:ring-${themeColor}-50 focus:bg-white outline-none resize-none transition-all leading-relaxed`}
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-4">
                <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Send size={18} className={`text-${themeColor}-500`} /> Assistant Courriel (Suivi Client)
                </h4>
                
                {mailPreview ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 animate-in slide-in-from-bottom-4">
                    <p className="text-xs font-black text-amber-700 uppercase mb-3 flex items-center gap-2">
                      <Bot size={14} /> Aperçu du courriel IA (En attente d'approbation)
                    </p>
                    <div 
                      className="bg-white p-5 rounded-xl border border-amber-100 text-sm text-slate-700 mb-5 prose max-h-60 overflow-y-auto shadow-sm"
                      dangerouslySetInnerHTML={{ __html: mailPreview }}
                    />
                    <div className="flex flex-wrap gap-3">
                      <button onClick={confirmAndSend} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm">
                        <CheckCircle size={18}/> Approuver et Envoyer via SendGrid
                      </button>
                      <button onClick={() => setMailPreview(null)} className="text-slate-500 font-bold text-sm px-4 py-2.5 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all">
                        Annuler / Re-formuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <input 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ex: Rédige un mail poli pour demander les talons de paie..."
                      className={`w-full bg-slate-50 border border-slate-200 p-4 pr-36 rounded-2xl outline-none focus:ring-4 focus:ring-${themeColor}-50 focus:border-${themeColor}-400 focus:bg-white transition-all font-medium text-sm text-slate-700`}
                    />
                    <button 
                      onClick={handleAskAI}
                      disabled={isGeneratingMail}
                      className={`absolute right-2 top-2 bottom-2 bg-${themeColor}-600 text-white px-5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-${themeColor}-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm`}
                    >
                      {isGeneratingMail ? <Loader2 className="animate-spin" size={16} /> : <><Sparkles size={16}/> Rédiger</>}
                    </button>
                  </div>
                )}
                <p className="text-[10px] font-bold text-slate-400 mt-3 text-center">
                  L'IA intégrera automatiquement la liste des documents manquants. Un humain doit approuver l'envoi.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatBox({ label, val, color }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    rose: 'bg-rose-50 border-rose-100 text-rose-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-900'
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
 * VUE D'IMPRESSION : RAPPORT BANCAIRE COMPLET
 * ============================================================================
 */
function BankReportPrintView({ lead, team, onBack }) {
  const { address, price } = getLeadPropertyInfo(lead);
  const client = lead.clientDetails || {};
  
  const revenuBrut = Number(client.salaire || lead.financialData?.revenu || client.revenuAnnuel || 0);
  const dettesMensuelles = (Number(client.pret_auto || 0)) + (Number(client.solde_cartes || 0) * 0.03);
  const valeurProp = Number(price || 0);
  const miseFonds = Number(client.liquidites || lead.financialData?.mise_de_fonds || 0);
  const hypothequeEstimee = valeurProp - miseFonds;
  
  const paiementMensuelEstime = hypothequeEstimee > 0 ? (hypothequeEstimee * 0.0055) : 0; 
  
  const abd = revenuBrut > 0 ? ((paiementMensuelEstime * 12) / revenuBrut * 100).toFixed(1) : 'N/A';
  const atd = revenuBrut > 0 ? (((paiementMensuelEstime + dettesMensuelles) * 12) / revenuBrut * 100).toFixed(1) : 'N/A';
  
  const rawThemeColor = team?.themeColor || team?.Themecolor || 'indigo';
  const themeColor = rawThemeColor.toLowerCase();

  const exportToWord = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Rapport Optimiplex</title></head><body>";
    const footer = "</body></html>";
    const content = document.getElementById('report-content').innerHTML;
    const sourceHTML = header + content + footer;

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
      <div className="print:hidden bg-slate-900 text-white px-8 py-4 sticky top-0 z-50 flex justify-between items-center shadow-xl">
         <button onClick={onBack} className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-800 px-4 py-2 rounded-xl transition-all font-bold text-sm">
            <ArrowLeft size={18} /> Retour au dossier
         </button>
         <div className="flex items-center gap-4">
           <button onClick={exportToWord} className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl transition-all font-black uppercase tracking-widest text-xs shadow-lg active:scale-95">
              <Download size={16} /> Exporter en Word
           </button>
           <button onClick={() => window.print()} className={`flex items-center gap-3 bg-${themeColor}-500 hover:bg-${themeColor}-400 text-white px-6 py-2.5 rounded-xl transition-all font-black uppercase tracking-widest text-xs shadow-lg active:scale-95`}>
              <Printer size={16} /> Imprimer (PDF)
           </button>
         </div>
      </div>

      <div id="report-content" className="bg-white text-black p-12 max-w-[21cm] mx-auto mt-8 shadow-2xl print:shadow-none print:max-w-full print:w-full print:mt-0 print:p-0">
        <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">{team?.name || 'Optimiplex'}</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Résumé de dossier de financement</p>
          </div>
          <div className="text-right text-sm font-medium">
            <p>Date : {new Date().toLocaleDateString('fr-CA')}</p>
            <p>Réf : {lead.id.substring(0, 8).toUpperCase()}</p>
            <p className="font-bold mt-2">Courtier : {lead.assignedBrokerName || 'Non assigné'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 mb-10">
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

        <div className="bg-slate-50 p-6 rounded-lg mb-10 border border-slate-200">
          <h2 className="text-lg font-black uppercase mb-6 text-center">Indicateurs de Performance (Estimés)</h2>
          <div className="grid grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col items-center justify-center shadow-sm">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-3 font-bold">Amortissement Brut (ABD)</p>
              <p className={`text-4xl font-black text-${themeColor}-950`}>{abd}%</p>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col items-center justify-center shadow-sm">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-3 font-bold">Amortissement Total (ATD)</p>
              <p className={`text-4xl font-black text-${themeColor}-950`}>{atd}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}