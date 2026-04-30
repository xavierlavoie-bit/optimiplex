import React from 'react';
import { Lock, Mail, ArrowLeft, Sparkles } from 'lucide-react';

export const SUPER_ADMIN_EMAIL = 'xavlavoie24@gmail.com';

// crmType: 'broker' (hypothécaire) | 'immo' (immobilier)
// - super admin a toujours accès
// - sinon : check le flag spécifique au CRM (crmAccessBroker / crmAccessImmo)
// - fallback legacy : si l'ancien flag global crmAccess est true, on l'accepte (rétrocompat)
export const hasCrmAccess = (currentUser, userProfile, crmType = 'broker') => {
  if (!currentUser) return false;
  if ((currentUser.email || '').toLowerCase().trim() === SUPER_ADMIN_EMAIL) return true;
  if (!userProfile) return false;
  const specificField = crmType === 'immo' ? 'crmAccessImmo' : 'crmAccessBroker';
  if (userProfile[specificField] === true) return true;
  return false;
};

export default function CrmPaywall({ currentUser, userProfile, crmName = 'CRM' }) {
  const isPending = userProfile?.subscriptionStatus === 'incomplete' || userProfile?.subscriptionStatus === 'past_due';
  const contactEmail = 'contact@optimiplex.com';
  const subject = encodeURIComponent(`Soumission ${crmName} — abonnement par seats`);
  const body = encodeURIComponent(
    `Bonjour,\n\nJe souhaite obtenir une soumission pour ${crmName} Optimiplex.\n\n` +
    `Compte courriel : ${currentUser?.email || ''}\n` +
    `Nombre de courtiers prévus : \nNom de la compagnie : \n\nMerci.`
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-10 sm:p-14 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-br from-amber-100 to-pink-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

          <div className="relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg mb-6">
              <Lock size={28} />
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight mb-3">
              Accès au {crmName} verrouillé
            </h1>

            {isPending ? (
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                Votre paiement est en cours de traitement. L'accès sera activé automatiquement dès la confirmation Stripe — habituellement quelques secondes après le paiement.
              </p>
            ) : (
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                Le {crmName} est réservé aux équipes avec un abonnement actif. Contacte-nous pour recevoir une soumission personnalisée selon le nombre de courtiers de ton équipe.
              </p>
            )}

            <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-6 mb-8">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles size={20} className="text-amber-500 mt-1 shrink-0" />
                <div>
                  <h3 className="font-black text-slate-900 mb-1">Tarification par seat</h3>
                  <p className="text-sm text-slate-600">
                    Tu paies pour le nombre exact de courtiers de ton équipe. Pas de frais cachés, pas d'engagement long terme.
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-700 ml-8">
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Pipeline de leads centralisé</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Communication client automatisée</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Personnalisation aux couleurs de ta brand</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Support prioritaire</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`mailto:${contactEmail}?subject=${subject}&body=${body}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
              >
                <Mail size={18} />
                Demander une soumission
              </a>
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft size={18} />
                Retour au Dashboard
              </button>
            </div>

            {currentUser?.email && (
              <p className="text-xs text-slate-400 mt-6 text-center">
                Connecté en tant que <span className="font-bold text-slate-500">{currentUser.email}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
