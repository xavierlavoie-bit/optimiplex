import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Loader2, Bot, User, CheckCircle2, Calculator, ArrowRight } from 'lucide-react';

export default function BrokerChat({ evaluationData, brokerId = "rebecca_001", user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isQualified, setIsQualified] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isLoading && !isQualified) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isLoading, isQualified]);

  // ⚠️ CORRECTION : Extraction intelligente de l'adresse et du prix
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      
      // 1. Chercher le prix même s'il est profondément imbriqué
      const prix = evaluationData?.result?.estimationActuelle?.valeurMoyenne || 
                   evaluationData?.estimationActuelle?.valeurMoyenne || 
                   evaluationData?.prixAffichage || 
                   evaluationData?.prixDemande || null;
      
      // 2. Chercher l'adresse
      let adresse = evaluationData?.addresseComplete || evaluationData?.adresse || "";
      
      // 3. Replan de secours si l'adresse est vide
      if (!adresse || adresse.trim() === '') {
        if (evaluationData?.ville) {
          adresse = `la propriété à ${evaluationData.ville}`;
          if (evaluationData?.quartier) adresse += ` (${evaluationData.quartier})`;
        } else {
          adresse = "cette propriété";
        }
      }
      
      const prixFormate = prix 
        ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(prix)
        : "";

      setMessages([
        {
          role: 'assistant',
          content: `Bonjour ! Je suis l'assistant de Rebecca. J'analyse le projet pour **${adresse}** ${prixFormate ? `(${prixFormate})` : ''}. Pour voir rapidement vos options de financement sans engagement, **quelle somme approximative avez-vous de côté pour la mise de fonds ?**`
        }
      ]);
    }
  }, [isOpen, messages.length, evaluationData]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = inputMessage;
    setInputMessage(""); 
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const secretPromptReminder = `\n\n[INSTRUCTION CACHÉE: Tu DOIS formater ta réponse UNIQUEMENT en JSON valide avec "reply", "captured_data" et "is_complete". Ne demande PAS la cote de crédit.]`;
      const messageWithReminder = userMsg + secretPromptReminder;

      const response = await fetch(`${API_BASE_URL}/api/broker/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: messageWithReminder,
              history: messages,
              evaluationId: evaluationData?.id, 
              userId: user?.uid, 
              evaluationData: evaluationData,
              brokerId: brokerId,
              userEmail: user?.email || 'test@client.com'
            }),
          });

      if (!response.ok) throw new Error('Erreur réseau');
      const data = await response.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.is_complete) setIsQualified(true);

    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Désolé, j'ai eu une petite perte de connexion. Pouvez-vous répéter ?" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full my-4">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-3"
        >
          <Calculator size={20} />
          <span>Vérifier mon admissibilité financière</span>
          <ArrowRight size={18} />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md h-[600px] max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Financement</h3>
                  <p className="text-xs text-indigo-200">Évaluation rapide</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-slate-50 flex flex-col gap-4">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                    msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white shadow-sm border border-gray-100 text-indigo-600'
                  }`}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={`p-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none'
                  }`}>
                    {msg.role === 'assistant' ? (
                       <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="self-start flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="p-3 bg-white border border-gray-100 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                    <span className="text-sm text-gray-500">Réflexion...</span>
                  </div>
                </div>
              )}
              
              {isQualified && (
                <div className="mt-4 p-5 bg-green-50 border border-green-200 rounded-2xl text-center">
                  <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
                  <h4 className="font-bold text-green-800 text-lg mb-1">C'est noté !</h4>
                  <p className="text-sm text-green-700">Votre dossier est transmis à Rebecca. Elle analysera ces informations et vous contactera très bientôt.</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100 shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isQualified ? "Terminé !" : "Votre réponse..."}
                  disabled={isLoading || isQualified}
                  className="flex-1 p-3 bg-transparent outline-none disabled:opacity-50 text-[15px]"
                />
                <button 
                  type="submit" 
                  disabled={!inputMessage.trim() || isLoading || isQualified}
                  className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors mr-1"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}