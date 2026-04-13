import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { ShieldCheck, User, Phone, Briefcase, DollarSign, Home, CheckCircle, CreditCard, PieChart, TrendingUp } from 'lucide-react';
import axios from 'axios';

export default function ClientPortal() {
  const { leadId } = useParams();
  const [leadData, setLeadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    prenom: '', nom: '', telephone: '',
    statutEmploi: 'salarie', employeur: '', anneesService: '',
    // ACTIFS
    liquidites: '', reer: '', celi: '', immobilier_valeur: '', autres_actifs: '',
    // DETTES
    solde_cartes: '', pret_auto: '', pret_etudiant: '', autres_dettes: '',
    consentementCredit: false
  });

  useEffect(() => {
    const fetchLead = async () => {
      try {
        const db = getFirestore();
        const docRef = doc(db, 'leads_hypothecaires', leadId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setLeadData(docSnap.data());
      } catch (error) { console.error("Erreur:", error); }
      finally { setLoading(false); }
    };
    if (leadId) fetchLead();
  }, [leadId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      await axios.post(`${API_URL}/api/client/submit`, {
        leadId,
        formData,
        brokerEmail: leadData.assignedTo
      });
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la soumission. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  if (submitted) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <div className="bg-white max-w-md w-full p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
        <CheckCircle className="text-green-500 w-16 h-16 mx-auto mb-6" />
        <h2 className="text-3xl font-black text-slate-900 mb-2">Dossier complété !</h2>
        <p className="text-slate-600 mb-6 font-medium">Merci {formData.prenom}. Votre courtier <strong>{leadData?.assignedBrokerName}</strong> vient d'être notifié et analyse votre profil.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-indigo-900 mb-2 tracking-tight italic">OptimiPlex</h1>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold border border-emerald-100 uppercase tracking-widest">
            <ShieldCheck size={16} /> Portail Chiffré Sécurisé
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Section icon={<User className="text-indigo-600"/>} title="Identité & Emploi">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Prénom" value={formData.prenom} onChange={v => setFormData({...formData, prenom: v})} required />
              <Input label="Nom" value={formData.nom} onChange={v => setFormData({...formData, nom: v})} required />
              <Input label="Téléphone" type="tel" value={formData.telephone} onChange={v => setFormData({...formData, telephone: v})} required />
              <Input label="Employeur" value={formData.employeur} onChange={v => setFormData({...formData, employeur: v})} required />
            </div>
          </Section>

          <Section icon={<TrendingUp className="text-emerald-600"/>} title="Bilan des Actifs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Épargne / Liquidités ($)" icon={<DollarSign size={14}/>} value={formData.liquidites} onChange={v => setFormData({...formData, liquidites: v})} />
              <Input label="Placements REER ($)" icon={<PieChart size={14}/>} value={formData.reer} onChange={v => setFormData({...formData, reer: v})} />
              <Input label="Placements CELI ($)" icon={<PieChart size={14}/>} value={formData.celi} onChange={v => setFormData({...formData, celi: v})} />
              <Input label="Valeur Immobilière ($)" icon={<Home size={14}/>} value={formData.immobilier_valeur} onChange={v => setFormData({...formData, immobilier_valeur: v})} />
            </div>
          </Section>

          <Section icon={<CreditCard className="text-rose-500"/>} title="Engagements & Dettes">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Cartes de Crédit (Solde)" value={formData.solde_cartes} onChange={v => setFormData({...formData, solde_cartes: v})} />
              <Input label="Prêt Auto (Mensualité)" value={formData.pret_auto} onChange={v => setFormData({...formData, pret_auto: v})} />
              <Input label="Prêts Étudiants" value={formData.pret_etudiant} onChange={v => setFormData({...formData, pret_etudiant: v})} />
              <Input label="Autres Dettes" value={formData.autres_dettes} onChange={v => setFormData({...formData, autres_dettes: v})} />
            </div>
          </Section>

          <div className="bg-indigo-900 p-8 rounded-[2.5rem] shadow-2xl">
            <label className="flex items-start gap-4 mb-6 cursor-pointer text-white">
              <input required type="checkbox" checked={formData.consentementCredit} onChange={e => setFormData({...formData, consentementCredit: e.target.checked})} className="mt-1 w-6 h-6 rounded-lg border-none text-indigo-600 focus:ring-0" />
              <p className="text-sm font-bold opacity-90">J'autorise OptimiPlex et mon courtier à analyser ces données pour ma demande de financement.</p>
            </label>
            <button type="submit" disabled={isSubmitting} className="w-full bg-white text-indigo-900 p-6 rounded-3xl font-black text-xl hover:bg-indigo-50 transition-all flex justify-center items-center gap-3 active:scale-[0.98]">
              {isSubmitting ? "Traitement IA..." : "Finaliser mon Dossier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
      <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3 underline decoration-indigo-200 decoration-4 underline-offset-8">{icon}{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, type = "text", icon, required = false }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input required={required} type={type} value={value} onChange={e => onChange(e.target.value)} className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-800 ${icon ? 'pl-11' : ''}`} />
      </div>
    </div>
  );
}