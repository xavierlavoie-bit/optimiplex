import React, { useState, useEffect } from 'react';
import { Calculator, ArrowRight, X, Home, DollarSign, Send, CheckCircle, ShieldCheck, User, Mail, Phone } from 'lucide-react';

export default function BrokerChat({ evaluationData, brokerId = "rebecca_001", user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: user?.email || '',
    telephone: ''
  });

  // Extraction intelligente de l'adresse et du prix
  const prix = evaluationData?.result?.estimationActuelle?.valeurMoyenne || 
               evaluationData?.estimationActuelle?.valeurMoyenne || 
               evaluationData?.prixAffichage || 
               evaluationData?.prixDemande || null;
  
  let adresse = evaluationData?.addresseComplete || evaluationData?.adresse || "";
  
  if (!adresse || adresse.trim() === '') {
    if (evaluationData?.ville) {
      adresse = `Propriété à ${evaluationData.ville}`;
    } else {
      adresse = "Propriété sélectionnée";
    }
  }
  
  const prixFormate = prix 
    ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(prix)
    : "Sur demande";

  // Réinitialiser l'état quand on ferme/ouvre
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setIsSubmitted(false), 300);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      
      // Envoi de la requête au backend (qui va créer le dossier ET envoyer le courriel)
      const response = await fetch(`${API_URL}/api/broker/quick-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData,
          evaluationData: evaluationData || {},
          adresse,
          prix: prixFormate, // On envoie le prix formaté pour le courriel
          brokerId
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la communication avec le serveur');
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error("Erreur lors de l'envoi de la demande:", error);
      alert("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full my-4 font-sans">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-sm py-4 px-8 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 hover:-translate-y-0.5"
        >
          <Calculator size={18} />
          <span>Analyser mon admissibilité</span>
          <ArrowRight size={18} />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* EN-TÊTE */}
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1 text-indigo-600 font-bold text-sm uppercase tracking-widest">
                  <ShieldCheck size={18} />
                  <span>Demande Sécurisée</span>
                </div>
                <h3 className="font-black text-2xl text-slate-900 tracking-tight">Pré-qualification</h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-2 hover:bg-slate-200 rounded-full transition-colors relative z-10"
              >
                <X size={24} />
              </button>
              <div className="absolute -right-6 -top-6 text-indigo-50 opacity-50 rotate-12 pointer-events-none">
                <Calculator size={120} />
              </div>
            </div>

            {/* CONTENU */}
            <div className="p-8">
              {isSubmitted ? (
                <div className="text-center py-8">
                  <CheckCircle size={64} className="text-emerald-500 mx-auto mb-6" />
                  <h4 className="font-black text-2xl text-slate-900 mb-3">Demande transmise !</h4>
                  <p className="text-slate-500 font-medium leading-relaxed mb-8">
                    Votre courtier a bien reçu votre demande pour cette propriété. Vous recevrez très bientôt un courriel contenant votre accès sécurisé pour compléter votre dossier.
                  </p>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-8 rounded-xl transition-colors"
                  >
                    Fermer la fenêtre
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* RÉCAPITULATIF PROPRIÉTÉ */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3">Propriété ciblée</p>
                    <div className="flex items-start gap-3 mb-2">
                      <Home size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                      <p className="font-bold text-slate-800 leading-tight">{adresse}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <DollarSign size={18} className="text-emerald-600 shrink-0" />
                      <p className="font-black text-emerald-700">{prixFormate}</p>
                    </div>
                  </div>

                  {/* FORMULAIRE */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><User size={16}/></div>
                        <input 
                          required 
                          type="text" 
                          placeholder="Prénom" 
                          value={formData.prenom}
                          onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-colors font-medium text-slate-800"
                        />
                      </div>
                      <input 
                        required 
                        type="text" 
                        placeholder="Nom" 
                        value={formData.nom}
                        onChange={(e) => setFormData({...formData, nom: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-colors font-medium text-slate-800"
                      />
                    </div>
                    
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Mail size={16}/></div>
                      <input 
                        required 
                        type="email" 
                        placeholder="Adresse courriel" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-colors font-medium text-slate-800"
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={16}/></div>
                      <input 
                        required 
                        type="tel" 
                        placeholder="Numéro de téléphone" 
                        value={formData.telephone}
                        onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-colors font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  {/* BOUTON SOUMETTRE */}
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg py-4 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Envoi en cours...
                      </span>
                    ) : (
                      <>
                        <Send size={20} />
                        Envoyer ma demande
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-4">
                    Sans engagement • Confidentiel
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}