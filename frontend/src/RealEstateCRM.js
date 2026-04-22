import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios';
import {
  Users, Mail, ArrowLeft, Trash2, Search, AlertCircle,
  Phone, ChevronRight, MapPin, FileText, Printer, Send, 
  BrainCircuit, CheckCircle, Download, Loader2, Bot, FileDown, 
  X as CloseIcon, Plus, UploadCloud, Paperclip, Sparkles, Maximize2, 
  RefreshCw, LogOut, ShieldAlert, Home, Key, FileSignature, Building, Camera, RefreshCcw,
  Settings, Palette, Image as ImageIcon, Check
} from 'lucide-react';

// Helpers
const getLeadPropertyInfo = (lead) => {
  const address = lead.propertyDetails?.address || lead.adressePropriete || 'Adresse non fournie';
  const price = lead.propertyDetails?.price || lead.budget || null;
  const type = lead.propertyDetails?.type || 'Propriété';
  return { address, price, type };
};

export default function RealEstateCRM() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false); 
  const [currentUser, setCurrentUser] = useState(null);
  
  const [userProfile, setUserProfile] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null); 
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    try {
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
    } catch (e) {
      setCurrentUser({ uid: 'mock-user', email: 'courtier@immobilier.com' });
      setAuthResolved(true);
    }
  }, []);

  useEffect(() => {
    if (!authResolved || !currentUser) return;

    try {
      const db = getFirestore();
      let unsubUser = () => {};
      let unsubAccess = () => {};
      let unsubTeam = () => {};

      unsubUser = onSnapshot(doc(db, 'users', currentUser.uid), (userDoc) => {
        setUserProfile(userDoc.exists() ? userDoc.data() : { role: 'courtier' });
      });

      if (currentUser.email) {
        const accessRef = doc(db, 'team_access_immo', currentUser.email.toLowerCase());
        
        unsubAccess = onSnapshot(accessRef, (accessDoc) => {
          unsubTeam(); 

          if (accessDoc.exists()) {
            const accessData = accessDoc.data();
            const teamRef = doc(db, 'users', accessData.adminUid, 'teams_immo', accessData.teamId);
            
            unsubTeam = onSnapshot(teamRef, (teamDoc) => {
              if (teamDoc.exists()) {
                setTeamData({ id: teamDoc.id, adminUid: accessData.adminUid, ...teamDoc.data() });
              } else {
                setTeamData(null);
              }
              setIsProfileLoading(false);
            });
          } else {
            const myTeamsRef = collection(db, 'users', currentUser.uid, 'teams_immo');
            unsubTeam = onSnapshot(myTeamsRef, (snapshot) => {
              if (!snapshot.empty) {
                setTeamData({ id: snapshot.docs[0].id, adminUid: currentUser.uid, ...snapshot.docs[0].data() });
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

      return () => { unsubUser(); unsubAccess(); unsubTeam(); };
    } catch(e) {
      setIsProfileLoading(false);
    }
  }, [authResolved, currentUser]);

  useEffect(() => {
    if (!authResolved || !currentUser || !teamData?.id) {
       setLoading(false);
       return; 
    }
    
    try {
      const db = getFirestore();
      const leadsCollection = collection(db, 'leads_immobiliers');
      
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

        setLeads(data);
        if (selectedLead) {
          const updatedSelectedLead = data.find(l => l.id === selectedLead.id);
          if (updatedSelectedLead) setSelectedLead(updatedSelectedLead);
        }
        setLoading(false);
      }, (error) => {
        console.error("Erreur Firestore (Leads Immo):", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch(e) {
      setLoading(false);
    }
  }, [authResolved, currentUser, teamData, selectedLead]);

  const handleAssignLead = async (lead, brokerEmail) => {
    if (!brokerEmail || !currentUser || !teamData) return;
    const assignedBroker = teamData.brokers?.find(b => b.email === brokerEmail);
    if (!assignedBroker) return alert("Courtier non trouvé.");

    try {
      const db = getFirestore();
      const leadRef = doc(db, 'leads_immobiliers', lead.id);
      await updateDoc(leadRef, { 
        assignedTo: assignedBroker.email, 
        assignedBrokerName: assignedBroker.name, 
        status: 'preparation' 
      });

      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      await axios.post(`${API_URL}/api/immo/assign`, {
         leadId: lead.id,
         brokerEmail: assignedBroker.email,
         brokerName: assignedBroker.name,
         clientEmail: lead.clientEmail
      });
      alert(`✅ Dossier immobilier assigné avec succès à ${assignedBroker.name}.`);
    } catch (err) {
      console.error("Erreur assignation immo:", err);
      alert("Erreur lors de l'assignation. Vérifiez la console.");
    }
  };

  const handleChangeStatus = async (id, status) => {
    try {
      const db = getFirestore();
      const leadRef = doc(db, 'leads_immobiliers', id);
      await updateDoc(leadRef, { status });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLead = async (id) => {
    if (window.confirm("Voulez-vous supprimer définitivement ce dossier immobilier ?")) {
      try {
        const db = getFirestore();
        await deleteDoc(doc(db, 'leads_immobiliers', id));
        if (selectedLead?.id === id) setSelectedLead(null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddLeadSubmit = async (e, formData) => {
    e.preventDefault();
    const newLead = {
      teamId: teamData?.id, 
      clientEmail: formData.email,
      clientDetails: { prenom: formData.prenom, nom: formData.nom, telephone: formData.telephone, type: formData.clientType },
      propertyDetails: { address: formData.address, price: formData.price, type: formData.propertyType },
      status: 'nouveau',
      createdAt: serverTimestamp(),
      source: 'ajout_manuel_immo',
      clientFiles: [],
      aiTasks: {} // Prépare l'objet pour stocker les résultats de l'Agent
    };

    try {
      const db = getFirestore();
      await addDoc(collection(db, 'leads_immobiliers'), newLead);
      setIsAddingLead(false);
    } catch (err) {
      console.error(err);
      alert("Erreur ajout de dossier");
    }
  };

  const filteredLeads = leads.filter(l => {
    const term = searchTerm.toLowerCase();
    const email = l.clientEmail || '';
    const nom = l.clientDetails?.nom || '';
    const prenom = l.clientDetails?.prenom || '';
    const address = l.propertyDetails?.address || '';
    return email.toLowerCase().includes(term) || nom.toLowerCase().includes(term) || prenom.toLowerCase().includes(term) || address.toLowerCase().includes(term);
  });

  if (!authResolved || isProfileLoading || loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600 mb-4" size={48} /></div>;
  }

  if (currentUser && !teamData) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-6">
          <ShieldAlert size={60} className="text-amber-500 mb-4" />
          <h2 className="text-3xl font-black text-slate-800">Aucune équipe Immobilière</h2>
          <p className="text-slate-500 mt-2 max-w-md mb-6">
            Votre compte n'est pas associé à une équipe immobilière (teams_immo). 
            Demandez à votre admin de vous inviter dans ce CRM.
          </p>
          <button onClick={() => window.location.href='/dashboard'} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-xl font-bold transition-colors">
              Retour au Dashboard
          </button>
        </div>
      );
  }

  const themeColor = teamData?.themeColor?.toLowerCase() || 'blue';
  const isAdmin = currentUser && teamData && teamData.adminUid === currentUser.uid;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans print:hidden text-slate-800">
      <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-40 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {teamData?.logoUrl ? (
              <img src={teamData.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-xl bg-white shadow-sm border border-slate-200" />
            ) : (
              <div className={`bg-${themeColor}-600 p-2.5 rounded-xl text-white shadow-lg flex items-center justify-center font-black`}>
                <Home size={24} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                {teamData?.name || 'Immo'} <span className={`text-${themeColor}-600`}>CRM</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Courtage Immobilier
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-2.5 text-slate-300" size={18} />
            <input 
              placeholder="Rechercher (Client, Adresse)..." 
              className={`pl-10 pr-4 py-2 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-${themeColor}-100 w-72 font-bold transition-all`} 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <button 
            onClick={() => setIsTeamModalOpen(true)}
            className={`flex items-center gap-2 bg-white border border-${themeColor}-200 text-${themeColor}-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors hover:bg-${themeColor}-50`}
          >
            <Users size={18} /> Équipe Immo
          </button>

          {isAdmin && (
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className={`flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors hover:bg-slate-50`}
              title="Réglages du CRM"
            >
              <Settings size={18} />
            </button>
          )}

          <button 
            onClick={() => setIsAddingLead(true)}
            className={`flex items-center gap-2 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors`}
          >
            <Plus size={18} /> Nouveau Client
          </button>

          <div className="h-8 w-px bg-slate-200 mx-2"></div>
          <button 
            onClick={() => window.location.href = '/dashboard'} 
            className="text-slate-400 hover:text-slate-600 transition-colors" 
            title="Retour au Dashboard"
          >
            <LogOut size={20} className="rotate-180" />
          </button>
        </div>
      </header>

      <div className="flex-1 p-8 overflow-x-auto flex gap-6 max-w-[1800px] mx-auto w-full">
        <BoardColumn title="📥 Nouveaux Prospects" count={filteredLeads.filter(l => l.status === 'nouveau').length} themeColor={themeColor}>
          {filteredLeads.filter(l => l.status === 'nouveau').map(lead => (
             <LeadCard key={lead.id} lead={lead} team={teamData} onClick={() => setSelectedLead(lead)} onAssign={handleAssignLead} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

        <BoardColumn title="📋 Évaluation / Préparation DV" count={filteredLeads.filter(l => l.status === 'preparation').length} highlight themeColor={themeColor}>
          {filteredLeads.filter(l => l.status === 'preparation').map(lead => (
             <LeadCard key={lead.id} lead={lead} team={teamData} onClick={() => setSelectedLead(lead)} onStatusChange={handleChangeStatus} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

        <BoardColumn title="📸 En Marché / Visites" count={filteredLeads.filter(l => l.status === 'en_marche').length} themeColor={themeColor}>
          {filteredLeads.filter(l => l.status === 'en_marche').map(lead => (
             <LeadCard key={lead.id} lead={lead} team={teamData} onClick={() => setSelectedLead(lead)} onStatusChange={handleChangeStatus} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>

        <BoardColumn title="🤝 Offre Acceptée (PA)" count={filteredLeads.filter(l => l.status === 'offre_acceptee').length} themeColor={themeColor}>
          {filteredLeads.filter(l => l.status === 'offre_acceptee').map(lead => (
             <LeadCard key={lead.id} lead={lead} team={teamData} onClick={() => setSelectedLead(lead)} onStatusChange={handleChangeStatus} onDelete={handleDeleteLead} />
          ))}
        </BoardColumn>
        
        <BoardColumn title="🎉 Vendu / Chez Notaire" count={filteredLeads.filter(l => l.status === 'vendu').length} themeColor={themeColor}>
          {filteredLeads.filter(l => l.status === 'vendu').map(lead => (
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
        />
      )}

      {isAddingLead && <AddLeadModal onClose={() => setIsAddingLead(false)} onSubmit={handleAddLeadSubmit} themeColor={themeColor} />}

      {isTeamModalOpen && (
        <TeamManagementModal 
          team={teamData} 
          onClose={() => setIsTeamModalOpen(false)} 
          themeColor={themeColor} 
          currentUserUid={currentUser.uid} 
          isAdmin={isAdmin}
        />
      )}

      {isSettingsModalOpen && isAdmin && (
        <TeamSettingsModal 
          team={teamData} 
          onClose={() => setIsSettingsModalOpen(false)} 
          themeColor={themeColor} 
          currentUserUid={currentUser.uid} 
        />
      )}
    </div>
  );
}

function TeamSettingsModal({ team, onClose, themeColor, currentUserUid }) {
  const [name, setName] = useState(team.name || '');
  const [color, setColor] = useState(team.themeColor || 'blue');
  const [logoUrl, setLogoUrl] = useState(team.logoUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const colors = ['slate', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'red', 'orange', 'amber', 'emerald', 'teal', 'cyan', 'sky'];

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `teams_immo_logos/${team.id}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setLogoUrl(downloadURL);
    } catch (error) {
      console.error("Erreur d'upload Storage:", error);
      alert("❌ Une erreur est survenue lors de l'envoi du logo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const db = getFirestore();
      const teamRef = doc(db, 'users', team.adminUid || currentUserUid, 'teams_immo', team.id);
      await updateDoc(teamRef, {
        name: name,
        themeColor: color,
        logoUrl: logoUrl
      });
      onClose();
    } catch (error) {
      console.error("Erreur sauvegarde team:", error);
      alert("❌ Erreur lors de la sauvegarde.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white text-slate-800 w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
        <div className={`p-6 bg-slate-800 flex justify-between items-center text-white`}>
          <div className="flex items-center gap-3">
            <Settings size={24} className={`text-${themeColor}-400`} />
            <div>
              <h2 className="text-xl font-black">Réglages du CRM</h2>
              <p className="text-xs font-medium opacity-80 mt-1">Personnalisation de l'équipe</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <CloseIcon size={24}/>
          </button>
        </div>
        
        <form onSubmit={handleSave} className="p-8 space-y-6">
          
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Nom de l'équipe</label>
            <input required type="text" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900 font-bold`} placeholder="Ex: Optimiplex Immo" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Logo de l'équipe</label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative group rounded-xl overflow-hidden border border-slate-200">
                   <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain bg-white" />
                   <button type="button" onClick={() => setLogoUrl('')} className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Trash2 size={16} />
                   </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                  <ImageIcon size={24} />
                </div>
              )}
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-${themeColor}-400 hover:bg-${themeColor}-50/50 transition-colors`}>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading}/>
                  {isUploading ? (
                    <><Loader2 size={18} className={`animate-spin text-${themeColor}-600`} /> <span className={`text-sm font-bold text-${themeColor}-600`}>Envoi...</span></>
                  ) : (
                    <><UploadCloud size={18} className="text-slate-500"/> <span className="text-sm font-bold text-slate-600">Choisir une image...</span></>
                  )}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-2"><Palette size={14}/> Couleur du CRM</label>
            <div className="flex flex-wrap gap-3">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full bg-${c}-600 shadow-sm flex items-center justify-center transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : ''}`}
                >
                  {color === c && <Check size={16} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
            <button type="submit" disabled={isSaving} className={`px-8 py-3 bg-${color}-600 hover:bg-${color}-700 text-white font-black rounded-xl shadow-lg transition-all flex items-center gap-2`}>
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18}/>}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TeamManagementModal({ team, onClose, themeColor, currentUserUid, isAdmin }) {
  const [newBrokerName, setNewBrokerName] = useState('');
  const [newBrokerEmail, setNewBrokerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newBrokerName.trim() || !newBrokerEmail.trim()) return;
    setIsSubmitting(true);
    
    const emailLower = newBrokerEmail.toLowerCase();
    const adminUid = team.adminUid || currentUserUid; 

    try {
      const db = getFirestore();
      const teamRef = doc(db, 'users', adminUid, 'teams_immo', team.id);
      await updateDoc(teamRef, {
        brokers: arrayUnion({ name: newBrokerName, email: emailLower })
      });
      const accessRef = doc(db, 'team_access_immo', emailLower);
      await setDoc(accessRef, {
        teamId: team.id,
        adminUid: adminUid,
        role: 'courtier',
        addedAt: serverTimestamp()
      });
      
      setNewBrokerName('');
      setNewBrokerEmail('');
      alert("✅ Membre ajouté avec succès au CRM Immobilier !");
    } catch (err) {
      console.error("Erreur ajout membre:", err);
      alert("❌ Erreur lors de l'ajout. Vérifiez vos permissions Firebase.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (brokerToRemove) => {
    if (!window.confirm(`Retirer ${brokerToRemove.name} de l'équipe immobilière et bloquer son accès ?`)) return;
    try {
      const db = getFirestore();
      const adminUid = team.adminUid || currentUserUid;
      const teamRef = doc(db, 'users', adminUid, 'teams_immo', team.id);
      await updateDoc(teamRef, {
        brokers: arrayRemove(brokerToRemove)
      });
      const accessRef = doc(db, 'team_access_immo', brokerToRemove.email.toLowerCase());
      await deleteDoc(accessRef);
    } catch (err) {
      console.error("Erreur suppression membre:", err);
      alert("❌ Erreur lors de la suppression.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white text-slate-800 w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
        <div className={`p-6 bg-${themeColor}-600 flex justify-between items-center text-white`}>
          <div>
            <h2 className="text-xl font-black">Équipe Immobilière</h2>
            <p className="text-xs font-medium opacity-80 mt-1">{team.name}</p>
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
                {isAdmin && (
                  <button onClick={() => handleRemoveMember(broker)} className="text-rose-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )) : (
              <p className="text-sm text-slate-500 italic">Aucun membre dans l'équipe pour le moment.</p>
            )}
          </div>

          {isAdmin && (
            <>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 border-t border-slate-100 pt-6">Ajouter un courtier immobilier</h3>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nom du courtier</label>
                    <input required type="text" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900`} placeholder="Ex: Alex" value={newBrokerName} onChange={e => setNewBrokerName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Adresse Courriel</label>
                    <input required type="email" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900`} placeholder="alex@email.com" value={newBrokerEmail} onChange={e => setNewBrokerEmail(e.target.value)} />
                  </div>
                </div>
                <button type="submit" disabled={isSubmitting} className={`w-full py-3 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2`}>
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={18}/> Envoyer l'invitation IMMO</>}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onSubmit, themeColor }) {
  const [formData, setFormData] = useState({ prenom: '', nom: '', email: '', telephone: '', address: '', price: '', clientType: 'Vendeur', propertyType: 'Maison unifamiliale' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white text-slate-800 w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-900">Nouveau Dossier Immobilier</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">Saisie d'un nouveau vendeur ou acheteur</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <CloseIcon size={24}/>
          </button>
        </div>
        
        <form onSubmit={(e) => onSubmit(e, formData)} className="p-8 space-y-5 text-slate-800">
          <div className="flex gap-4 mb-2">
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer font-bold transition-all ${formData.clientType === 'Vendeur' ? `bg-${themeColor}-50 border-${themeColor}-500 text-${themeColor}-700` : 'bg-white border-slate-200 text-slate-500'}`}>
              <input type="radio" name="type" className="hidden" checked={formData.clientType === 'Vendeur'} onChange={() => setFormData({...formData, clientType: 'Vendeur'})} />
              <Home size={18}/> Vendeur
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer font-bold transition-all ${formData.clientType === 'Acheteur' ? `bg-${themeColor}-50 border-${themeColor}-500 text-${themeColor}-700` : 'bg-white border-slate-200 text-slate-500'}`}>
              <input type="radio" name="type" className="hidden" checked={formData.clientType === 'Acheteur'} onChange={() => setFormData({...formData, clientType: 'Acheteur'})} />
              <Key size={18}/> Acheteur
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Prénom</label>
              <input required type="text" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900`} placeholder="Jean" value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Nom</label>
              <input required type="text" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900`} placeholder="Tremblay" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Courriel</label>
              <input required type="email" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900`} placeholder="email@client.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Téléphone</label>
              <input type="tel" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900`} placeholder="(514) 555-5555" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1">{formData.clientType === 'Vendeur' ? 'Adresse de la propriété' : 'Quartiers recherchés'}</label>
            <input type="text" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900`} placeholder="Ex: 123 rue Principale..." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">{formData.clientType === 'Vendeur' ? 'Prix demandé estimé' : 'Budget maximum'}</label>
              <input type="number" className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900`} placeholder="Ex: 450000" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Type de propriété</label>
              <select className={`w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-${themeColor}-500 text-slate-900`} value={formData.propertyType} onChange={e => setFormData({...formData, propertyType: e.target.value})}>
                <option>Maison unifamiliale</option>
                <option>Condo</option>
                <option>Plex (Revenus)</option>
                <option>Chalet / Secondaire</option>
                <option>Commercial</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
            <button type="submit" className={`px-8 py-3 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white font-black rounded-xl shadow-lg transition-all`}>Créer le dossier</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BoardColumn({ title, count, children, highlight, themeColor }) {
  return (
    <div className={`rounded-[2rem] p-5 border flex flex-col min-w-[350px] w-[350px] shrink-0 h-[calc(100vh-140px)] ${highlight ? `bg-${themeColor}-50/50 border-${themeColor}-200` : 'bg-slate-200/40 border-slate-200/50'}`}>
      <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.15em] mb-5 px-2 flex justify-between items-center shrink-0">
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
  const { address, price } = getLeadPropertyInfo(lead);
  const broker = team?.brokers?.find(b => b.email === lead.assignedTo) || { name: 'Non assigné' };
  const themeColor = team?.themeColor?.toLowerCase() || 'blue';
  const isVendeur = lead.clientDetails?.type === 'Vendeur';

  return (
    <div 
      onClick={onClick}
      className={`bg-white p-5 rounded-[1.5rem] border hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative group flex flex-col gap-3 border-slate-200`}
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }} 
        className="absolute top-4 right-5 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all z-10"
      >
        <Trash2 size={16}/>
      </button>

      {lead.assignedTo && <div className={`absolute left-0 top-6 bottom-6 w-1.5 rounded-r-full bg-${themeColor}-500`}></div>}

      <div className="pl-2">
        <div className="flex justify-between items-start mb-2">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${isVendeur ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {isVendeur ? 'Vendeur' : 'Acheteur'}
          </span>
          {lead.assignedTo && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md bg-${themeColor}-50 text-${themeColor}-700`}>
              {broker.name.split(' ')[0]}
            </span>
          )}
        </div>
        
        <h3 className="font-black text-slate-900 truncate text-lg leading-tight mb-1">
          {lead.clientDetails?.prenom ? `${lead.clientDetails.prenom} ${lead.clientDetails.nom}` : lead.clientEmail}
        </h3>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-2">
          <MapPin size={12} className={`text-${themeColor}-400 shrink-0`}/>
          <span className="truncate">{address}</span>
        </div>

        {price && (
          <div className="text-sm font-black text-slate-700 bg-slate-50 inline-block px-2 py-1 rounded border border-slate-100">
            {Number(price).toLocaleString('fr-CA')} $
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
              <option value="" disabled>Associer à un courtier...</option>
              {team?.brokers?.map(b => <option key={b.email} value={b.email}>{b.name}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Étape:</span>
            <div onClick={e => e.stopPropagation()}>
              <select 
                value={lead.status} 
                onChange={(e) => onStatusChange(lead.id, e.target.value)}
                className="bg-slate-100 text-[10px] font-black uppercase tracking-tighter p-1.5 rounded-lg border-none outline-none cursor-pointer text-slate-700"
              >
                <option value="preparation">Préparation DV</option>
                <option value="en_marche">En marché</option>
                <option value="offre_acceptee">Offre Acceptée</option>
                <option value="vendu">Vendu</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailModal({ lead, team, onClose, onAssign, onStatusChange }) {
  const { address, price, type } = getLeadPropertyInfo(lead);
  const broker = team?.brokers?.find(b => b.email === lead.assignedTo) || { name: 'Non assigné', email: '' };
  const themeColor = team?.themeColor?.toLowerCase() || 'blue';
  const isVendeur = lead.clientDetails?.type === 'Vendeur';

  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [isAnalyzingMain, setIsAnalyzingMain] = useState(false);

  const handleFullAnalysis = async (currentLead) => {
    setIsAnalyzingMain(true);
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      await axios.post(`${API_URL}/api/immo/agent/analyze-lead`, {
        leadId: currentLead.id,
        leadData: currentLead
      });
    } catch (e) {
      console.error("Erreur Agent Analyse Principale:", e);
    } finally {
      setIsAnalyzingMain(false);
    }
  };

  const handleFileUpload = async (e, docTitle) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingDoc(docTitle === "Autre" ? "Autre" : docTitle);

    try {
      const storage = getStorage();
      const storageRef = ref(storage, `leads_immobiliers/${lead.id}/${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const db = getFirestore();
      const leadRef = doc(db, 'leads_immobiliers', lead.id);

      const newFileObj = {
        name: file.name,
        url: downloadURL,
        type: docTitle, 
        uploadedAt: new Date().toISOString()
      };

      await updateDoc(leadRef, {
        clientFiles: arrayUnion(newFileObj)
      });

      const updatedLead = { ...lead, clientFiles: [...(lead.clientFiles || []), newFileObj] };
      handleFullAnalysis(updatedLead);
    } catch (error) {
      console.error("Erreur d'upload Storage:", error);
      alert("❌ Une erreur est survenue lors de l'envoi du fichier.");
    } finally {
      setUploadingDoc(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-slate-50 text-slate-800 w-full max-w-6xl max-h-[94vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative z-50">
        
        {/* 🚀 LISIBILITÉ: Header épuré, fond blanc, texte foncé pour une lisibilité parfaite */}
        <div className="p-8 bg-white border-b border-slate-200 flex justify-between items-start shrink-0 relative overflow-hidden">
          <div className="relative z-10 w-full">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${isVendeur ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                    {isVendeur ? 'Mandat de Vente' : 'Mandat de Recherche'}
                  </span>
                  <h2 className="text-4xl font-black tracking-tight text-slate-900">{lead.clientDetails?.prenom} {lead.clientDetails?.nom}</h2>
                </div>
                <div className="flex flex-wrap gap-6 text-slate-500 text-sm font-bold mt-3">
                  <p className="flex items-center gap-2"><Mail size={16} /> {lead.clientEmail}</p>
                  {lead.clientDetails?.telephone && <p className="flex items-center gap-2"><Phone size={16} /> {lead.clientDetails.telephone}</p>}
                </div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dossier géré par</p>
                {lead.assignedTo ? (
                  <p className="font-bold text-lg text-slate-800">{broker.name}</p>
                ) : (
                  <select 
                    onChange={(e) => onAssign(lead, e.target.value)}
                    defaultValue=""
                    className="bg-white text-slate-900 px-3 py-1.5 rounded-lg text-xs font-black uppercase outline-none border border-slate-200"
                  >
                    <option value="" disabled>Choisir...</option>
                    {team?.brokers?.map(b => <option key={b.email} value={b.email}>{b.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-colors relative z-10 ml-4 shrink-0 text-slate-400">
            <CloseIcon size={28}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 text-slate-800">
          
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">📍 Détails de la Propriété</p>
               
               <div className="space-y-4">
                 <div className="flex items-start gap-3">
                   <MapPin size={20} className={`text-${themeColor}-500 mt-1`}/>
                   <div>
                     <p className="text-xs font-bold text-slate-400">Adresse</p>
                     <p className="text-slate-900 font-bold text-base">{address}</p>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 pt-2">
                   <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <p className="text-xs font-bold text-slate-400 mb-1">Type</p>
                     <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                       <Building size={14} className="text-slate-500"/> {type}
                     </p>
                   </div>
                   <div className={`bg-${themeColor}-50 p-3 rounded-xl border border-${themeColor}-100`}>
                     <p className={`text-xs font-bold text-${themeColor}-600 mb-1`}>{isVendeur ? 'Prix demandé' : 'Budget Max'}</p>
                     <p className={`text-sm font-black text-${themeColor}-900`}>
                       {price ? `${Number(price).toLocaleString('fr-CA')} $` : 'À déterminer'}
                     </p>
                   </div>
                 </div>
               </div>
            </div>

            <RealEstateAgentSection lead={lead} themeColor={themeColor} isAnalyzingMain={isAnalyzingMain} onAnalyze={handleFullAnalysis} />
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                  <h3 className="text-slate-800 font-black text-lg flex items-center gap-2">
                      <Paperclip size={24} className="text-slate-500" /> Gestion Documentaire
                  </h3>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Cliquer ou déposer</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocDropzone 
                    title="Déclaration du Vendeur (DV)" icon={<FileSignature/>} themeColor={themeColor} 
                    onUpload={handleFileUpload} isUploading={uploadingDoc === "Déclaration du Vendeur (DV)"} 
                    uploadedFiles={lead.clientFiles?.filter(f => f.type === "Déclaration du Vendeur (DV)")} 
                  />
                  <DocDropzone 
                    title="Certificat de Localisation" icon={<MapPin/>} themeColor={themeColor} 
                    onUpload={handleFileUpload} isUploading={uploadingDoc === "Certificat de Localisation"} 
                    uploadedFiles={lead.clientFiles?.filter(f => f.type === "Certificat de Localisation")} 
                  />
                  <DocDropzone 
                    title="Rapport d'Inspection" icon={<Search/>} themeColor={themeColor} 
                    onUpload={handleFileUpload} isUploading={uploadingDoc === "Rapport d'Inspection"} 
                    uploadedFiles={lead.clientFiles?.filter(f => f.type === "Rapport d'Inspection")} 
                  />
                  <DocDropzone 
                    title="Photos de la propriété" icon={<Camera/>} themeColor={themeColor} 
                    onUpload={handleFileUpload} isUploading={uploadingDoc === "Photos de la propriété"} 
                    uploadedFiles={lead.clientFiles?.filter(f => f.type === "Photos de la propriété")} 
                  />
                </div>

                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-slate-400" /> Autres documents liés au dossier
                  </h4>
                  
                  <div className="space-y-3">
                    {lead.clientFiles?.filter(f => !["Déclaration du Vendeur (DV)", "Certificat de Localisation", "Rapport d'Inspection", "Photos de la propriété"].includes(f.type)).map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`p-2 bg-${themeColor}-100 rounded-lg text-${themeColor}-600 shrink-0`}>
                            <FileText size={16} />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">{new Date(file.uploadedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className={`p-2 text-slate-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors shrink-0`}>
                          <Download size={18} />
                        </a>
                      </div>
                    ))}
                    
                    <label className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-${themeColor}-400 hover:bg-${themeColor}-50/50 transition-colors`}>
                      <input type="file" className="hidden" onChange={e => handleFileUpload(e, "Autre")} disabled={uploadingDoc === "Autre"}/>
                      {uploadingDoc === "Autre" ? (
                        <><Loader2 size={18} className={`animate-spin text-${themeColor}-600`} /> <span className={`text-sm font-bold text-${themeColor}-600`}>Envoi du document en cours...</span></>
                      ) : (
                        <><Plus size={18} className="text-slate-500"/> <span className="text-sm font-bold text-slate-600">Ajouter un document libre (PDF, Excel, etc.)</span></>
                      )}
                    </label>
                  </div>
                </div>

            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
               <h3 className="text-slate-800 font-black text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <CheckCircle size={24} className={`text-${themeColor}-500`} /> Suivi des Conditions (Promesse d'achat)
               </h3>
               <div className="space-y-3">
                 <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                   <input type="checkbox" className={`w-5 h-5 accent-${themeColor}-600 rounded`} />
                   <span className="font-bold text-sm text-slate-700">Preuve de financement reçue (Lettre hypothécaire)</span>
                 </label>
                 <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                   <input type="checkbox" className={`w-5 h-5 accent-${themeColor}-600 rounded`} />
                   <span className="font-bold text-sm text-slate-700">Inspection réalisée</span>
                 </label>
                 <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                   <input type="checkbox" className={`w-5 h-5 accent-${themeColor}-600 rounded`} />
                   <span className="font-bold text-sm text-slate-700">Déclaration du vendeur signée et reconnue</span>
                 </label>
               </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

function DocDropzone({ title, icon, themeColor, onUpload, isUploading, uploadedFiles }) {
  const hasFiles = uploadedFiles && uploadedFiles.length > 0;

  return (
    <label className={`border-2 ${hasFiles ? 'border-solid border-emerald-400 bg-emerald-50' : 'border-dashed border-slate-200'} rounded-2xl p-4 text-center hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer group flex flex-col items-center justify-center min-h-[100px] relative overflow-hidden`}>
      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={(e) => onUpload(e, title)} disabled={isUploading} />
      
      <div className={`${hasFiles ? 'text-emerald-500' : 'text-slate-400 group-hover:text-' + themeColor + '-500'} mb-2 transition-colors relative z-10 pointer-events-none flex flex-col items-center`}>
        {isUploading ? (
          <Loader2 size={24} className={`animate-spin text-${themeColor}-600`} />
        ) : (
          hasFiles ? <CheckCircle size={24} /> : React.cloneElement(icon, { size: 24 })
        )}
      </div>

      <p className={`text-xs font-bold ${hasFiles ? 'text-emerald-700' : 'text-slate-600'} relative z-10 pointer-events-none`}>
        {isUploading ? 'Envoi...' : (hasFiles ? 'Fichier ajouté' : title)}
      </p>

      {hasFiles && !isUploading && (
        <p className="text-[9px] text-emerald-600/80 font-bold mt-1 max-w-[150px] truncate relative z-10">
          {uploadedFiles[0].name}
        </p>
      )}
    </label>
  );
}

// ============================================================================
// 🧠 AGENT IA - SESSIONS INTÉGRÉES POUR L'IMMOBILIER
// ============================================================================
function RealEstateAgentSection({ lead, themeColor, isAnalyzingMain, onAnalyze }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [aiResponse, setAiResponse] = useState('');
  
  // Gère uniquement le loader local
  const [generatingTasks, setGeneratingTasks] = useState({});
  
  const analysis = lead.agentAnalysis;

  const handleAITask = async (taskType, forceRegenerate = false) => {
    // Si la tâche est déjà en cours d'exécution, on empêche le clic
    if (generatingTasks[taskType]) return;

    // 🚀 PERSISTANCE FIRESTORE: Si le résultat existe déjà et qu'on ne force pas la régénération
    if (!forceRegenerate && lead.aiTasks && lead.aiTasks[taskType]) {
        setActiveTask(taskType);
        setAiResponse(lead.aiTasks[taskType]);
        setIsModalOpen(true);
        return;
    }

    // 🚀 Début de la génération (ou régénération)
    setGeneratingTasks(prev => ({ ...prev, [taskType]: true }));
    
    // Si on a forcé la régénération alors que le modal est ouvert, on affiche un petit message de chargement
    if (forceRegenerate) {
       setAiResponse('');
    } else {
       setActiveTask(taskType);
       setIsModalOpen(true); // Ouvre le modal immédiatement pour voir le "Loader"
    }

    let instructionText = '';
    if (taskType === 'dv') { instructionText = "TÂCHE SPÉCIFIQUE : Fais un audit strict et professionnel de la Déclaration du Vendeur (DV). S'il manque des documents, signale-le."; }
    if (taskType === 'mls') { instructionText = "TÂCHE SPÉCIFIQUE : Génère une description MLS/Centris très vendeuse, moderne et attrayante pour cette propriété."; }
    if (taskType === 'inspection') { instructionText = "TÂCHE SPÉCIFIQUE : Fais une synthèse claire du rapport d'inspection avec les travaux urgents et ceux à prévoir."; }
    if (taskType === 'email') { instructionText = "TÂCHE SPÉCIFIQUE : Rédige un courriel de suivi professionnel et rassurant à envoyer au client concernant l'avancement de son dossier."; }

    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      
      const res = await axios.post(`${API_URL}/api/immo/agent/run-task`, {
        leadId: lead.id,
        leadData: lead,
        instruction: instructionText
      }, { timeout: 90000 }); 
      
      let finalResult = res.data.result;
      if (!finalResult || finalResult.trim() === '') {
         finalResult = `
            <div class="p-4 bg-rose-50 rounded-xl border border-rose-200 text-slate-800">
               <h3 class="text-rose-800 font-bold mb-2">Erreur d'analyse</h3>
               <p class="text-rose-700 text-sm">L'Agent IA n'a pas renvoyé de texte.</p>
            </div>
         `;
      }
      
      // 🚀 SAUVEGARDE FIRESTORE : On enregistre le texte de l'IA dans le dossier "lead"
      const db = getFirestore();
      await updateDoc(doc(db, 'leads_immobiliers', lead.id), {
        [`aiTasks.${taskType}`]: finalResult
      });

      // Met à jour la vue du modal
      setAiResponse(finalResult);
      
    } catch (e) {
      console.error(e);
      setAiResponse("<p style='color: red; font-weight: bold;'>Erreur de communication avec l'Agent IA (Délai d'attente dépassé ou erreur serveur).</p>");
    } finally {
      setGeneratingTasks(prev => ({ ...prev, [taskType]: false }));
    }
  };

  const renderTaskButton = (type, icon, label) => {
    const isGenerating = generatingTasks[type];
    const isDone = lead.aiTasks && lead.aiTasks[type];
    
    return (
      <button 
        onClick={() => handleAITask(type)} 
        disabled={isGenerating}
        className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${
          isDone 
            ? `bg-emerald-900/40 border border-emerald-700/50 hover:bg-emerald-900/60 text-white` 
            : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white'
        }`}
      >
        <span className="text-sm font-bold flex items-center gap-2">
          {isGenerating ? <Loader2 size={16} className={`animate-spin text-${themeColor}-400`} /> : icon}
          {label}
        </span>
        
        {isGenerating && <span className={`text-xs font-bold text-${themeColor}-400 animate-pulse`}>Génération...</span>}
        {isDone && !isGenerating && <span className="text-xs font-bold text-emerald-400 flex items-center gap-1"><CheckCircle size={14}/> Consulter</span>}
        {!isDone && !isGenerating && <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />}
      </button>
    );
  };

  return (
    <>
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-lg relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <BrainCircuit size={100} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 bg-${themeColor}-500/20 rounded-lg text-${themeColor}-400`}>
              <Bot size={24} />
            </div>
            <div>
              <h3 className="font-black text-lg">Agent IA Immobilier</h3>
              <p className="text-xs text-slate-400">Claude 3.5 Sonnet - Mode Session</p>
            </div>
          </div>

          {analysis && (
            // 🚀 FADE-IN : Apparition douce lors du chargement initial pour éviter un flash agressif
            <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl mb-6 shadow-inner relative animate-in fade-in slide-in-from-bottom-4 duration-500">
              {isAnalyzingMain && (
                 <div className="absolute top-2 right-2 flex items-center gap-2 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-600 shadow-md">
                    <Loader2 size={12} className={`animate-spin text-${themeColor}-400`} />
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Mise à jour...</span>
                 </div>
              )}
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className={`text-${themeColor}-400`}/> Synthèse du Dossier
                </h4>
                <div className="flex items-center gap-2">
                  <button onClick={() => onAnalyze(lead)} disabled={isAnalyzingMain} className="text-slate-400 hover:text-white transition-colors" title="Actualiser l'analyse">
                    <RefreshCw size={14} className={isAnalyzingMain ? "animate-spin" : ""} />
                  </button>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-700/50 text-slate-300 border border-slate-600">
                    Confiance : {analysis.confidence_score || 'N/A'}
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-slate-300 mb-4 leading-relaxed whitespace-pre-wrap">
                {analysis.narrative}
              </p>
              
              {analysis.received_documents && analysis.received_documents.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-3">
                  <p className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-2"><CheckCircle size={14}/> Documents validés au dossier :</p>
                  <ul className="text-xs text-emerald-300 list-disc pl-4 space-y-1">
                    {analysis.received_documents.map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.missing_documents && analysis.missing_documents.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                  <p className="text-xs font-bold text-rose-400 mb-2 flex items-center gap-2"><AlertCircle size={14}/> Documents manquants :</p>
                  <ul className="text-xs text-rose-300 list-disc pl-4 space-y-1">
                    {analysis.missing_documents.map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!analysis && lead.agentStatus !== 'completed' && (
            <button 
              onClick={() => onAnalyze(lead)} 
              disabled={isAnalyzingMain}
              className={`w-full mb-6 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors flex justify-center items-center gap-2`}
            >
              {isAnalyzingMain ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
              {isAnalyzingMain ? "L'Agent analyse les documents..." : "Demander une analyse complète du dossier"}
            </button>
          )}

          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Outils Génératifs (Arrière-plan)</h4>
          <div className="space-y-3">
            {renderTaskButton('dv', <FileSignature size={16} className={`text-${themeColor}-400`}/>, "Auditer la Déclaration (DV)")}
            {renderTaskButton('mls', <Sparkles size={16} className="text-amber-400"/>, "Générer texte MLS / Centris")}
            {renderTaskButton('inspection', <Search size={16} className="text-emerald-400"/>, "Synthétiser Rapport d'Inspection")}
            {renderTaskButton('email', <Mail size={16} className="text-blue-400"/>, "Rédiger un courriel de suivi")}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          {/* 🚀 MODAL BLOQUÉ: max-h-[90vh] et overflow caché à la racine */}
          <div className="bg-white text-slate-800 w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className={`bg-slate-800 p-6 flex justify-between items-center text-white shrink-0`}>
              <div className="flex items-center gap-3">
                <Bot size={24} className={`text-${themeColor}-400`} />
                <h2 className="text-xl font-black">Résultat de l'Outil IA</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                <CloseIcon size={24}/>
              </button>
            </div>
            
            {/* 🚀 ZONE DÉFILANTE: L'overflow-y-auto est ici pour ne pas écraser le bouton fermer en bas */}
            <div className="p-8 bg-slate-50 flex-1 overflow-y-auto relative">
              {generatingTasks[activeTask] || !aiResponse ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 opacity-60 py-20">
                  <Loader2 size={40} className={`animate-spin text-${themeColor}-600`} />
                  <p className="font-bold text-sm text-slate-600">L'Agent consulte le dossier et rédige...</p>
                </div>
              ) : (
                <div 
                  className="max-w-none text-slate-700 text-sm leading-relaxed 
                             [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-slate-900 [&_h3]:mb-3 [&_h3]:mt-6 [&_h3:first-child]:mt-0 [&_h3]:border-b [&_h3]:border-slate-200 [&_h3]:pb-2
                             [&_p]:mb-4
                             [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul_li]:mb-1
                             [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol_li]:mb-1
                             [&_strong]:text-slate-900 [&_strong]:font-bold"
                  dangerouslySetInnerHTML={{ __html: aiResponse }}
                />
              )}
            </div>
            
            {/* 🚀 FOOTER FIXE: Toujours visible */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
               <button 
                 onClick={() => handleAITask(activeTask, true)} 
                 disabled={generatingTasks[activeTask]}
                 className={`px-4 py-2.5 rounded-xl font-bold text-${themeColor}-600 hover:bg-${themeColor}-50 transition-colors flex items-center gap-2`}
               >
                 <RefreshCcw size={16} className={generatingTasks[activeTask] ? "animate-spin" : ""} /> Régénérer
               </button>
               
               <div className="flex gap-3">
                 <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Fermer</button>
                 <button onClick={() => setIsModalOpen(false)} disabled={generatingTasks[activeTask]} className={`px-6 py-2.5 rounded-xl font-bold text-white bg-${themeColor}-600 hover:bg-${themeColor}-700 shadow-md flex items-center gap-2 disabled:opacity-50`}>
                   <CheckCircle size={18} /> Approuver
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}