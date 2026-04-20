import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  ShieldCheck, User, Phone, Briefcase, DollarSign, Home, 
  CheckCircle, CreditCard, PieChart, TrendingUp, Lock, UploadCloud, FileText, X as CloseIcon 
} from 'lucide-react';
import axios from 'axios';

export default function ClientPortal() {
  const { leadId } = useParams();
  const [leadData, setLeadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(''); // Pour rassurer le client pendant l'envoi long

  // État pour les fichiers attachés
  const [attachments, setAttachments] = useState([]);

  const [formData, setFormData] = useState({
    // IDENTITÉ
    prenom: '', nom: '', telephone: '',
    // EMPLOI & REVENUS
    statutEmploi: 'Temps plein', employeur: '', anneesService: '', revenuAnnuel: '',
    // ACTIFS
    liquidites: '', reer: '', celi: '', immobilier_valeur: '', autres_actifs: '',
    // DETTES
    solde_cartes: '', pret_auto: '', pret_etudiant: '', autres_dettes: '',
    // CONSENTEMENT
    consentementCredit: false
  });

  useEffect(() => {
    const fetchLead = async () => {
      try {
        const db = getFirestore();
        const docRef = doc(db, 'leads_hypothecaires', leadId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLeadData(data);
          if (data.clientDetails) {
            setFormData(prev => ({
              ...prev,
              prenom: data.clientDetails.prenom || '',
              nom: data.clientDetails.nom || '',
              telephone: data.clientDetails.telephone || ''
            }));
          }
        }
      } catch (error) { 
        console.error("Erreur:", error); 
      } finally { 
        setLoading(false); 
      }
    };
    if (leadId) fetchLead();
  }, [leadId]);

  // GESTION DES FICHIERS
  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    setAttachments(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUploadProgress('Chiffrement des données en cours...');

    try {
      const uploadedFiles = [];
      
      // 1. UPLOAD DES FICHIERS (Si présents)
      if (attachments.length > 0) {
        const storage = getStorage();
        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          setUploadProgress(`Envoi sécurisé du document ${i + 1} sur ${attachments.length}...`);
          
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          // Sauvegarde dans un dossier spécifique "client" pour le différencier des manuels du courtier
          const fileRef = storageRef(storage, `dossiers/${leadId}/client/${Date.now()}_${safeName}`);
          
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          
          uploadedFiles.push({
            name: file.name,
            url: url,
            size: file.size,
            uploadedAt: new Date().toISOString()
          });
        }
      }

      setUploadProgress('Finalisation du dossier...');

      // 2. ENVOI DES DONNÉES AU BACKEND
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      await axios.post(`${API_URL}/api/client/submit`, {
        leadId,
        formData,
        clientFiles: uploadedFiles, // <-- On envoie les URLs des fichiers
        brokerEmail: leadData.assignedTo
      });
      
      // 3. DÉCLENCHEMENT DE L'AGENT IA (En arrière-plan)
      try {
        // On n'attend pas la réponse (pas de 'await') pour ne pas faire patienter le client
        axios.post(`${API_URL}/api/agent/analyze-lead`, { 
          leadId: leadId,
          leadData: { 
            ...formData, 
            attachments: uploadedFiles.map(a => a.name) // L'agent aura besoin des noms de fichiers
          } 
        });
        console.log("Agent IA déclenché en arrière-plan.");
      } catch (agentError) {
        console.error("Erreur de lancement de l'Agent:", agentError);
        // On ne bloque pas la soumission si l'agent échoue
      }

      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la soumission. Veuillez vérifier votre connexion et réessayer.");
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
      <p className="font-bold text-slate-500 uppercase tracking-widest text-sm">Chargement sécurisé...</p>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <div className="bg-white max-w-md w-full p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
        <CheckCircle className="text-emerald-500 w-20 h-20 mx-auto mb-6" />
        <h2 className="text-3xl font-black text-slate-900 mb-2">Dossier transmis !</h2>
        <p className="text-slate-600 mb-6 font-medium">Merci {formData.prenom}. Vos informations ont été chiffrées et envoyées avec succès à <strong>{leadData?.assignedBrokerName || 'votre courtier'}</strong>.</p>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-center gap-2 text-slate-500 font-bold text-sm">
          <ShieldCheck size={18} className="text-emerald-500" /> Données protégées
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-indigo-950 mb-3 tracking-tight">Formulaire de Préqualification</h1>
          <p className="text-slate-500 font-medium max-w-xl mx-auto mb-6">Afin de procéder à l'analyse de votre capacité d'emprunt, veuillez compléter ce bilan financier en toute confidentialité.</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-black border border-emerald-200 uppercase tracking-widest">
            <ShieldCheck size={16} /> Connexion Chiffrée (SSL)
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* IDENTITÉ */}
          <Section icon={<User className="text-indigo-500"/>} title="Informations Personnelles">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input label="Prénom" value={formData.prenom} onChange={v => setFormData({...formData, prenom: v})} required placeholder="Ex: Jean" />
              <Input label="Nom de famille" value={formData.nom} onChange={v => setFormData({...formData, nom: v})} required placeholder="Ex: Tremblay" />
              <Input label="Numéro de téléphone" type="tel" value={formData.telephone} onChange={v => setFormData({...formData, telephone: v})} required placeholder="(555) 555-5555" />
            </div>
          </Section>

          {/* EMPLOI ET REVENUS */}
          <Section icon={<Briefcase className="text-blue-500"/>} title="Emploi & Revenus">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Select 
                label="Statut d'emploi" 
                value={formData.statutEmploi} 
                onChange={v => setFormData({...formData, statutEmploi: v})} 
                options={['Temps plein', 'Temps partiel', 'Travailleur autonome', 'Retraité', 'Sans emploi']} 
              />
              <Input label="Employeur actuel (ou nom d'entreprise)" value={formData.employeur} onChange={v => setFormData({...formData, employeur: v})} placeholder="Ex: Hydro-Québec" />
              <Input label="Années de service" type="number" value={formData.anneesService} onChange={v => setFormData({...formData, anneesService: v})} placeholder="Ex: 5" />
              <Input 
                label="Revenu Brut Annuel ($)" 
                type="number" 
                icon={<DollarSign size={16}/>} 
                value={formData.revenuAnnuel} 
                onChange={v => setFormData({...formData, revenuAnnuel: v})} 
                required 
                placeholder="Ex: 75000"
                highlight={true}
              />
            </div>
          </Section>

          {/* ACTIFS */}
          <Section icon={<TrendingUp className="text-emerald-500"/>} title="Bilan des Actifs (Ce que vous possédez)">
            <p className="text-sm text-slate-500 mb-5 font-medium">Estimez la valeur de vos avoirs. Laissez vide si non applicable.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input label="Compte chèque / Épargne ($)" icon={<DollarSign size={16}/>} value={formData.liquidites} onChange={v => setFormData({...formData, liquidites: v})} placeholder="Ex: 15000" />
              <Input label="Placements REER ($)" icon={<PieChart size={16}/>} value={formData.reer} onChange={v => setFormData({...formData, reer: v})} placeholder="Ex: 25000" />
              <Input label="Placements CELI ($)" icon={<PieChart size={16}/>} value={formData.celi} onChange={v => setFormData({...formData, celi: v})} placeholder="Ex: 10000" />
              <Input label="Valeur de votre propriété actuelle ($)" icon={<Home size={16}/>} value={formData.immobilier_valeur} onChange={v => setFormData({...formData, immobilier_valeur: v})} placeholder="Ex: 350000" />
            </div>
          </Section>

          {/* DETTES */}
          <Section icon={<CreditCard className="text-rose-500"/>} title="Engagements & Passifs (Ce que vous devez)">
            <p className="text-sm text-slate-500 mb-5 font-medium">Inscrivez les soldes actuels ou les paiements demandés. Laissez vide si non applicable.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input label="Solde total des Cartes de Crédit ($)" value={formData.solde_cartes} onChange={v => setFormData({...formData, solde_cartes: v})} placeholder="Ex: 2500" />
              {/* Changement de libellé pour le prêt auto */}
              <Input label="Paiement Mensuel Prêt Auto ($/mois)" value={formData.pret_auto} onChange={v => setFormData({...formData, pret_auto: v})} placeholder="Ex: 450" />
              <Input label="Solde Prêts Étudiants ($)" value={formData.pret_etudiant} onChange={v => setFormData({...formData, pret_etudiant: v})} placeholder="Ex: 8000" />
              <Input label="Autres Dettes / Marges ($)" value={formData.autres_dettes} onChange={v => setFormData({...formData, autres_dettes: v})} placeholder="Ex: 5000" />
            </div>
          </Section>

          {/* DOCUMENTS ATTACHÉS */}
          <Section icon={<FileText className="text-amber-500"/>} title="Documents justificatifs (Optionnel)">
            <p className="text-sm text-slate-500 mb-5 font-medium">
              Pour accélérer l'analyse de votre dossier, vous pouvez joindre des documents pertinents (ex: Talons de paie récents, avis de cotisation, relevés bancaires).
            </p>
            
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-100 hover:border-indigo-400 transition-all">
              <UploadCloud size={32} className="text-slate-400 mx-auto mb-3" />
              <label className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-50 hover:shadow-sm transition-all shadow-sm">
                Ajouter des fichiers
                <input type="file" multiple className="hidden" onChange={handleFileSelect} />
              </label>
              <p className="text-xs text-slate-400 mt-3 mt-2">Formats acceptés : PDF, JPG, PNG.</p>
            </div>

            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3 truncate">
                      <FileText size={16} className="text-indigo-500 shrink-0" />
                      <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                      <span className="text-xs text-slate-400 ml-2">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-rose-500 p-1 transition-colors shrink-0">
                      <CloseIcon size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* SOUMISSION */}
          <div className="bg-slate-900 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none">
              <Lock size={200} />
            </div>
            
            <label className="flex items-start gap-4 mb-8 cursor-pointer text-white relative z-10">
              <input 
                required 
                type="checkbox" 
                checked={formData.consentementCredit} 
                onChange={e => setFormData({...formData, consentementCredit: e.target.checked})} 
                className="mt-1 w-6 h-6 rounded-lg border-2 border-indigo-400 bg-slate-800 text-indigo-500 focus:ring-0 cursor-pointer shrink-0" 
              />
              <p className="text-sm font-medium text-slate-300 leading-relaxed">
                Je déclare que les informations fournies ci-dessus sont exactes. J'autorise OptimiPlex et le courtier assigné à collecter, utiliser et conserver ces renseignements dans le but d'analyser ma demande de prêt hypothécaire.
              </p>
            </label>
            
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full bg-indigo-500 text-white p-5 rounded-2xl font-black text-lg hover:bg-indigo-400 transition-all flex flex-col justify-center items-center gap-1 active:scale-[0.98] shadow-lg shadow-indigo-900/50 relative z-10"
            >
              {isSubmitting ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Transmission chiffrée en cours...</span>
                  </div>
                  <span className="text-xs font-medium text-indigo-200 mt-1">{uploadProgress}</span>
                </>
              ) : (
                <span className="flex items-center gap-3">
                  <ShieldCheck size={24} /> Transmettre mon dossier sécurisé
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Composant pour les blocs (Sections)
function Section({ icon, title, children }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
      <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

// Composant pour les champs textes/nombres
function Input({ label, value, onChange, type = "text", icon, required = false, placeholder = "", highlight = false }) {
  return (
    <div>
      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        {icon && <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${highlight ? 'text-indigo-600' : 'text-slate-400'}`}>{icon}</div>}
        <input 
          required={required} 
          type={type} 
          value={value} 
          onChange={e => onChange(e.target.value)} 
          placeholder={placeholder}
          className={`w-full p-3.5 rounded-xl outline-none transition-all font-bold text-slate-800 placeholder:text-slate-300 placeholder:font-medium
            ${icon ? 'pl-11' : ''} 
            ${highlight 
              ? 'bg-indigo-50 border-2 border-indigo-200 focus:border-indigo-500 focus:bg-white text-indigo-900' 
              : 'bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white'
            }`} 
        />
      </div>
    </div>
  );
}

// Nouveau composant pour les menus déroulants (Select)
function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
        {label}
      </label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-800 cursor-pointer appearance-none"
      >
        {options.map((opt, idx) => (
          <option key={idx} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}