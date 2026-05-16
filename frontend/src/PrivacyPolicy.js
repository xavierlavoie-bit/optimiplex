import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Mail } from 'lucide-react';

const LOGO_URL = 'https://i.ibb.co/tMbhC8Sy/Minimalist-Real-Estate-Logo-1.png';
const PRIVACY_EMAIL = 'info@optimiplex.com';
const LAST_UPDATED = '16 mai 2026';

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 mb-10">
      <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{title}</h2>
      <div className="space-y-4 text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav minimaliste */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="OptimiPlex" className="w-9 h-9 rounded-lg bg-white p-1 shadow-sm" />
            <span className="font-black text-slate-900 text-lg tracking-tight">OptimiPlex</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft size={16} /> Retour
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 mb-4">
            <ShieldCheck size={14} />
            <span className="text-xs font-black uppercase tracking-widest">Conforme à la Loi 25 du Québec</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-3">Politique de confidentialité</h1>
          <p className="text-slate-500 font-medium">Dernière mise à jour : {LAST_UPDATED}</p>
        </div>

        {/* Intro */}
        <div className="mb-12 p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-slate-700 leading-relaxed">
            OptimiPlex (« nous ») s'engage à protéger les renseignements personnels que vous nous confiez. La présente politique explique en termes clairs quels renseignements nous collectons, pourquoi, avec qui ils sont partagés, et quels sont vos droits en vertu de la <strong>Loi sur la protection des renseignements personnels dans le secteur privé (Loi 25, Québec)</strong>.
          </p>
        </div>

        {/* Sommaire */}
        <nav className="mb-12 p-5 rounded-2xl border border-slate-200 bg-white">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Sommaire</p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm font-semibold text-slate-700">
            {[
              ['responsable', '1. Responsable de la protection'],
              ['donnees', '2. Renseignements collectés'],
              ['finalites', '3. Finalités de la collecte'],
              ['consentement', '4. Consentement'],
              ['tiers', '5. Communication à des tiers'],
              ['transferts', '6. Hébergement et transferts'],
              ['conservation', '7. Durée de conservation'],
              ['droits', '8. Vos droits'],
              ['securite', '9. Mesures de sécurité'],
              ['cookies', '10. Témoins (cookies)'],
              ['incident', '11. Incident de confidentialité'],
              ['modifications', '12. Modifications'],
              ['contact', '13. Nous joindre'],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="hover:text-indigo-600 transition-colors">{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <Section id="responsable" title="1. Responsable de la protection des renseignements personnels">
          <p>
            Conformément à la Loi 25, OptimiPlex désigne une personne responsable de la protection des renseignements personnels. Pour toute question concernant le traitement de vos renseignements ou pour exercer vos droits :
          </p>
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
            <p className="font-bold text-slate-900 mb-1">Responsable de la protection des renseignements personnels</p>
            <p className="text-sm">OptimiPlex — Québec, Canada</p>
            <p className="text-sm">
              Courriel : <a href={`mailto:${PRIVACY_EMAIL}`} className="text-indigo-600 font-bold hover:underline">{PRIVACY_EMAIL}</a>
            </p>
          </div>
        </Section>

        <Section id="donnees" title="2. Renseignements que nous collectons">
          <p>Nous collectons uniquement les renseignements nécessaires à la prestation de notre service :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Compte utilisateur</strong> : adresse courriel, nom d'affichage, mot de passe haché (ou authentification Google), date de création, plan d'abonnement.</li>
            <li><strong>Profil optionnel</strong> : numéro de téléphone, entreprise, rôle, biographie — uniquement si vous choisissez de les fournir.</li>
            <li><strong>Données d'évaluation</strong> : adresses de propriétés analysées, paramètres saisis (loyers, dépenses, financement), résultats générés par l'IA.</li>
            <li><strong>Données de facturation</strong> : identifiants Stripe (jamais le numéro de carte complet), historique des transactions, crédits achetés.</li>
            <li><strong>Données techniques</strong> : journaux serveur (adresse IP, type de navigateur, horodatage) pour la sécurité et le débogage.</li>
            <li><strong>Trace de consentement</strong> : date, heure et version de la politique acceptée lors de l'inscription.</li>
          </ul>
          <p>Nous ne collectons aucun renseignement sensible (origine, opinions politiques, santé, biométrie, etc.).</p>
        </Section>

        <Section id="finalites" title="3. Pourquoi nous collectons ces renseignements">
          <p>Vos renseignements sont utilisés uniquement pour les finalités suivantes :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Créer et gérer votre compte;</li>
            <li>Générer les évaluations, optimisations et rapports demandés;</li>
            <li>Traiter les paiements et factures via Stripe;</li>
            <li>Vous répondre lorsque vous nous contactez;</li>
            <li>Assurer la sécurité de la plateforme (détection d'abus, journalisation);</li>
            <li>Respecter nos obligations légales.</li>
          </ul>
          <p>Vos renseignements ne sont <strong>jamais</strong> vendus, loués ni utilisés à des fins de marketing tiers.</p>
        </Section>

        <Section id="consentement" title="4. Consentement">
          <p>
            Lors de votre inscription, vous donnez un consentement libre, éclairé et explicite à la collecte et au traitement de vos renseignements aux fins décrites ci-dessus. Une trace horodatée de ce consentement est conservée dans votre compte.
          </p>
          <p>
            Vous pouvez <strong>retirer votre consentement à tout moment</strong> en supprimant votre compte depuis votre profil. La suppression entraîne l'effacement définitif de l'ensemble des renseignements vous concernant (sauf exceptions légales — voir section 7).
          </p>
        </Section>

        <Section id="tiers" title="5. Sous-traitants et communication à des tiers">
          <p>
            Pour offrir notre service, nous faisons appel à des sous-traitants soumis à des obligations contractuelles de confidentialité. Aucun de ces tiers n'utilise vos renseignements à d'autres fins que celles pour lesquelles nous les leur confions.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 font-black text-slate-700">Fournisseur</th>
                  <th className="text-left px-4 py-2 font-black text-slate-700">Rôle</th>
                  <th className="text-left px-4 py-2 font-black text-slate-700">Lieu de traitement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 font-bold">Google Firebase</td>
                  <td className="px-4 py-3">Authentification, base de données, stockage</td>
                  <td className="px-4 py-3">États-Unis</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-bold">Stripe</td>
                  <td className="px-4 py-3">Traitement des paiements</td>
                  <td className="px-4 py-3">États-Unis</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-bold">Anthropic (Claude API)</td>
                  <td className="px-4 py-3">Analyses générées par IA</td>
                  <td className="px-4 py-3">États-Unis</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Nous ne communiquons vos renseignements personnels à aucune autre entité, sauf si la loi nous y oblige (ex. : mandat judiciaire valide).
          </p>
        </Section>

        <Section id="transferts" title="6. Hébergement et transferts hors du Québec">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="font-bold text-slate-900 mb-2">⚠️ Communication de renseignements hors du Québec</p>
            <p className="text-sm">
              Vos renseignements personnels sont hébergés et traités <strong>aux États-Unis</strong> par nos fournisseurs d'infrastructure (Google Firebase, Stripe et Anthropic). En créant un compte, vous consentez à cette communication hors du Québec, conformément à l'article 17 de la Loi 25.
            </p>
          </div>
          <p>
            Avant de communiquer vos renseignements hors du Québec, nous avons effectué une évaluation des facteurs relatifs à la vie privée (EFVP) et avons conclu que les protections offertes par ces fournisseurs sont adéquates :
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Google Firebase</strong> : certifié SOC 2 Type II et ISO 27001, conforme au cadre du Data Privacy Framework (DPF) entre les États-Unis et l'Union européenne, chiffrement AES-256 au repos.</li>
            <li><strong>Stripe</strong> : certifié PCI DSS niveau 1 (la plus haute norme de l'industrie pour le paiement), conforme DPF.</li>
            <li><strong>Anthropic</strong> : ne conserve pas les données envoyées via l'API à des fins d'entraînement, certifié SOC 2 Type II.</li>
          </ul>
          <p>
            Nous limitons les renseignements transmis au strict nécessaire à la prestation du service et exigeons contractuellement de chaque fournisseur qu'il n'utilise vos données qu'aux fins pour lesquelles nous les lui confions.
          </p>
        </Section>

        <Section id="conservation" title="7. Durée de conservation">
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Compte actif</strong> : vos renseignements sont conservés tant que votre compte demeure actif.</li>
            <li><strong>Compte supprimé</strong> : vos données sont effacées <strong>immédiatement</strong> de nos systèmes lors de la suppression, sauf certaines données minimales que nous devons conserver pour des obligations comptables et fiscales (factures Stripe — 7 ans, en vertu de la Loi sur les impôts du Québec).</li>
            <li><strong>Journaux serveur</strong> : conservés au maximum 90 jours, puis purgés automatiquement.</li>
          </ul>
        </Section>

        <Section id="droits" title="8. Vos droits en vertu de la Loi 25">
          <p>Vous disposez en tout temps des droits suivants :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Droit d'accès</strong> : obtenir une copie des renseignements que nous détenons sur vous.</li>
            <li><strong>Droit de rectification</strong> : corriger un renseignement inexact ou incomplet.</li>
            <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format technologique structuré et couramment utilisé (JSON), pour les transférer ailleurs.</li>
            <li><strong>Droit de retrait du consentement</strong> : retirer votre consentement à tout moment.</li>
            <li><strong>Droit à la désindexation et à l'effacement</strong> : faire supprimer définitivement vos renseignements.</li>
          </ul>
          <p>
            Vous pouvez exercer ces droits directement depuis votre <Link to="/dashboard/profile" className="text-indigo-600 font-bold hover:underline">profil OptimiPlex</Link> (onglet « Confidentialité ») ou en écrivant au responsable à <a href={`mailto:${PRIVACY_EMAIL}`} className="text-indigo-600 font-bold hover:underline">{PRIVACY_EMAIL}</a>. Nous répondons dans un délai maximum de <strong>30 jours</strong>.
          </p>
          <p>
            Si nous refusons de donner suite à votre demande, vous pouvez porter plainte auprès de la <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold hover:underline">Commission d'accès à l'information du Québec</a>.
          </p>
        </Section>

        <Section id="securite" title="9. Mesures de sécurité">
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour protéger vos renseignements :
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Chiffrement en transit (TLS) et au repos (AES-256 via Firebase);</li>
            <li>Authentification forte (mot de passe haché, option Google OAuth);</li>
            <li>Accès aux données restreint au strict personnel autorisé (principe du moindre privilège);</li>
            <li>Journalisation des accès et surveillance continue;</li>
            <li>Sauvegardes chiffrées et géo-redondées par Google Firebase;</li>
            <li>Revue régulière des permissions et des sous-traitants.</li>
          </ul>
        </Section>

        <Section id="cookies" title="10. Témoins (cookies)">
          <p>
            OptimiPlex utilise uniquement des <strong>témoins strictement nécessaires</strong> au fonctionnement du service (session d'authentification Firebase, préférences locales). Nous n'utilisons aucun cookie de profilage, de publicité ni d'analyse tierce. Aucune bannière de consentement aux cookies n'est requise.
          </p>
        </Section>

        <Section id="incident" title="11. Incident de confidentialité">
          <p>
            En cas d'incident de confidentialité (perte, vol ou accès non autorisé à des renseignements personnels) susceptible de causer un préjudice sérieux, nous prendrons les mesures suivantes conformément à la Loi 25 :
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Notification rapide à la Commission d'accès à l'information du Québec;</li>
            <li>Notification aux personnes concernées dans les meilleurs délais;</li>
            <li>Inscription de l'incident dans notre registre interne;</li>
            <li>Mesures correctives pour prévenir la récurrence.</li>
          </ul>
        </Section>

        <Section id="modifications" title="12. Modifications de cette politique">
          <p>
            Nous pouvons modifier cette politique pour refléter des changements de service, de législation ou de pratiques. Toute modification importante vous sera notifiée par courriel ou par un avis bien visible dans l'application, au moins <strong>30 jours</strong> avant son entrée en vigueur. Vous serez invité à re-consentir si les finalités du traitement changent.
          </p>
          <p>
            La version courante est toujours disponible à l'adresse <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">optimiplex.com/confidentialite</code>. La date de la dernière mise à jour est indiquée en haut de cette page.
          </p>
        </Section>

        <Section id="contact" title="13. Nous joindre">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100">
            <Mail size={24} className="text-indigo-600 mb-3" />
            <p className="font-black text-slate-900 mb-2">Responsable de la protection des renseignements personnels</p>
            <p className="text-sm text-slate-700 mb-4">OptimiPlex — Québec, Canada</p>
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl transition-all"
            >
              <Mail size={16} /> {PRIVACY_EMAIL}
            </a>
          </div>
        </Section>

        <div className="mt-16 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            © 2026 OptimiPlex. Tous droits réservés.
          </p>
        </div>
      </main>
    </div>
  );
}
