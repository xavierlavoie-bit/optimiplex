import React, { useState, useEffect, useMemo } from 'react';
import { getFirestore, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { X, Save, Mail, Eye, RotateCcw, Sparkles, FormInput, Code, Plus, Trash2 } from 'lucide-react';

// Mappage thème → couleur hexadécimale (pour le HTML généré)
const THEME_HEX = {
  indigo: '#4f46e5', blue: '#2563eb', sky: '#0284c7', cyan: '#0891b2',
  teal: '#0d9488', emerald: '#059669', green: '#16a34a', lime: '#65a30d',
  amber: '#d97706', orange: '#ea580c', red: '#dc2626', rose: '#e11d48',
  pink: '#db2777', fuchsia: '#c026d3', purple: '#9333ea', violet: '#7c3aed',
  slate: '#475569', gray: '#4b5563', zinc: '#52525b'
};

const SAMPLE_VARS = {
  clientName: 'Jean Tremblay',
  clientEmail: 'jean.tremblay@exemple.com',
  brokerName: 'Rebecca Côté',
  brokerEmail: 'rebecca@exemple.com',
  portalUrl: 'https://app.optimiplex.com/portal/exemple',
  fileName: 'Rapport_Bancaire_Tremblay.pdf',
  fileUrl: 'https://exemple.com/file.pdf',
  aiSummary: '- Bonne liquidité\n- Ratios ABD/ATD favorables\n- Faisable pour la propriété ciblée',
  teamName: 'Mon équipe'
};

// Définition des templates : pour chaque clé, on a un mode "simple" (formulaire) et un fallback "HTML avancé"
const TEMPLATES_HYPO = [
  {
    key: 'assignClient',
    label: 'Assignation — Email au client',
    description: 'Envoyé au client quand un courtier lui est assigné.',
    placeholders: ['clientName', 'brokerName', 'brokerEmail', 'portalUrl', 'teamName'],
    cta: { type: 'portal', urlPlaceholder: '{{portalUrl}}' }, // template a un bouton CTA fixe
    simple: {
      subject: 'Votre dossier a été confié à {{brokerName}}',
      heading: 'Excellente nouvelle, {{clientName}} !',
      body: 'Votre dossier de financement a été confié à notre expert(e) {{brokerName}}.\n\nPour que {{brokerName}} puisse commencer à travailler sur votre pré-approbation, merci de remplir ce formulaire sécurisé en cliquant sur le bouton ci-dessous.\n\nVous serez contacté(e) très bientôt.',
      ctaLabel: 'Accéder à mon portail sécurisé',
      signature: "L'équipe {{teamName}}"
    }
  },
  {
    key: 'assignBroker',
    label: 'Assignation — Email au courtier',
    description: 'Notification interne au courtier quand un nouveau dossier lui est assigné.',
    placeholders: ['brokerName', 'clientName', 'clientEmail', 'aiSummary', 'teamName'],
    cta: null,
    simple: {
      subject: '🎯 Nouveau dossier assigné : {{clientEmail}}',
      heading: 'Un nouveau dossier t\'a été assigné',
      body: 'Le client {{clientName}} ({{clientEmail}}) t\'a été attribué.\n\n🧠 Analyse IA :\n{{aiSummary}}\n\nConnecte-toi au CRM pour voir les détails et faire avancer le dossier.',
      signature: "{{teamName}}"
    }
  },
  {
    key: 'sendFile',
    label: 'Envoi de document au client',
    description: 'Email envoyé quand un courtier partage un document généré (rapport bancaire, etc.).',
    placeholders: ['clientName', 'brokerName', 'fileName', 'fileUrl', 'teamName'],
    cta: { type: 'file', urlPlaceholder: '{{fileUrl}}' },
    simple: {
      subject: 'Votre document : {{fileName}}',
      heading: 'Bonjour {{clientName}},',
      body: 'Voici le document {{fileName}} préparé par votre courtier hypothécaire.\n\nPour toute question, répondez simplement à ce courriel.',
      ctaLabel: 'Télécharger le document',
      signature: 'Cordialement,\n{{brokerName}} — {{teamName}}'
    }
  }
];

const TEMPLATES_IMMO = [
  {
    key: 'assignClientImmo',
    label: 'Assignation — Email au client',
    description: 'Envoyé au client quand un courtier immobilier lui est assigné.',
    placeholders: ['clientName', 'brokerName', 'teamName'],
    cta: null,
    simple: {
      subject: 'Votre projet immobilier est confié à {{brokerName}}',
      heading: 'Bonjour {{clientName}} !',
      body: 'Votre projet immobilier a été confié à notre expert(e) {{brokerName}}.\n\n{{brokerName}} vous contactera très prochainement pour discuter des prochaines étapes de votre transaction.',
      signature: "L'équipe {{teamName}}"
    }
  },
  {
    key: 'assignBrokerImmo',
    label: 'Assignation — Email au courtier',
    description: 'Notification interne au courtier immobilier.',
    placeholders: ['brokerName', 'clientName', 'clientEmail'],
    cta: null,
    simple: {
      subject: '🎯 Nouveau dossier immobilier : {{clientEmail}}',
      heading: 'Un nouveau dossier t\'a été assigné',
      body: 'Le client {{clientName}} ({{clientEmail}}) t\'a été attribué.\n\nConnecte-toi au CRM Immobilier pour voir les détails (Acheteur/Vendeur).',
      signature: ''
    }
  }
];

// === HELPERS ===

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Construit l'HTML final à partir des champs simples
function buildHtmlFromFields(fields, themeColor, ctaUrl) {
  const hex = THEME_HEX[themeColor] || THEME_HEX.indigo;

  const paragraphs = (fields.body || '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `  <p style="margin: 0 0 16px 0; line-height: 1.6;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  const cta = fields.ctaLabel && ctaUrl
    ? `\n  <div style="margin: 28px 0; text-align: center;">
    <a href="${ctaUrl}" style="display: inline-block; background: ${hex}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">${escapeHtml(fields.ctaLabel)}</a>
  </div>`
    : '';

  const heading = fields.heading
    ? `\n  <h2 style="color: ${hex}; margin: 0 0 16px 0; font-size: 22px; font-weight: 700;">${escapeHtml(fields.heading)}</h2>`
    : '';

  const signature = fields.signature
    ? `\n  <p style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; line-height: 1.5;">${escapeHtml(fields.signature).replace(/\n/g, '<br/>')}</p>`
    : '';

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #1f2937; background: #ffffff;">${heading}
${paragraphs}${cta}${signature}
</div>`;
}

function applyTemplatePreview(str, vars) {
  if (!str) return '';
  return String(str).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => (vars[key] != null ? vars[key] : `{{${key}}}`));
}


// === COMPONENT ===

export default function EmailTemplatesEditor({ adminUid, teamId, teamCollection, teamName, themeColor = 'indigo', onClose }) {
  const templates = teamCollection === 'teams_immo' ? TEMPLATES_IMMO : TEMPLATES_HYPO;
  const [savedTemplates, setSavedTemplates] = useState({});
  const [drafts, setDrafts] = useState({}); // { [key]: { subject, fields:{heading,body,ctaLabel,signature}, mode:'simple'|'advanced', html (only advanced) } }
  const [activeKey, setActiveKey] = useState(templates[0]?.key);
  const [savingKey, setSavingKey] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false); // toggle global "mode HTML avancé"
  const [activeField, setActiveField] = useState('body'); // pour insert placeholder

  // Charge depuis Firestore
  useEffect(() => {
    if (!adminUid || !teamId) return;
    const db = getFirestore();
    const teamRef = doc(db, 'users', adminUid, teamCollection, teamId);
    const unsub = onSnapshot(teamRef, (snap) => {
      const t = snap.exists() ? (snap.data().emailTemplates || {}) : {};
      setSavedTemplates(t);
      setDrafts(prev => {
        const next = { ...prev };
        templates.forEach(tpl => {
          if (!next[tpl.key]) {
            const saved = t[tpl.key];
            if (saved?.fields) {
              next[tpl.key] = {
                subject: saved.subject ?? tpl.simple.subject,
                fields: { ...tpl.simple, ...saved.fields },
                mode: saved.mode || 'simple',
                html: saved.html || ''
              };
            } else if (saved?.html) {
              // Template existant en mode HTML brut → on bascule en advanced
              next[tpl.key] = {
                subject: saved.subject ?? tpl.simple.subject,
                fields: { ...tpl.simple },
                mode: 'advanced',
                html: saved.html
              };
            } else {
              next[tpl.key] = {
                subject: tpl.simple.subject,
                fields: { ...tpl.simple },
                mode: 'simple',
                html: ''
              };
            }
          }
        });
        return next;
      });
    });
    return () => unsub();
  }, [adminUid, teamId, teamCollection]);

  const activeTpl = templates.find(t => t.key === activeKey);
  const draft = drafts[activeKey] || { subject: '', fields: {}, mode: 'simple', html: '' };

  // HTML rendu en live (depuis fields ou raw)
  const renderedHtml = useMemo(() => {
    if (draft.mode === 'advanced') return draft.html || '';
    return buildHtmlFromFields(
      draft.fields || {},
      themeColor,
      activeTpl?.cta?.urlPlaceholder || ''
    );
  }, [draft, themeColor, activeTpl]);

  const updateField = (field, value) => {
    setDrafts(prev => ({
      ...prev,
      [activeKey]: {
        ...prev[activeKey],
        fields: { ...(prev[activeKey]?.fields || {}), [field]: value }
      }
    }));
  };
  const updateSubject = (value) => {
    setDrafts(prev => ({ ...prev, [activeKey]: { ...prev[activeKey], subject: value } }));
  };
  const updateHtml = (value) => {
    setDrafts(prev => ({ ...prev, [activeKey]: { ...prev[activeKey], html: value } }));
  };

  const setMode = (mode) => {
    setDrafts(prev => ({
      ...prev,
      [activeKey]: {
        ...prev[activeKey],
        mode,
        // Si on passe en advanced, copier le HTML généré comme point de départ
        html: mode === 'advanced' && !prev[activeKey]?.html
          ? buildHtmlFromFields(prev[activeKey]?.fields || {}, themeColor, activeTpl?.cta?.urlPlaceholder || '')
          : prev[activeKey]?.html
      }
    }));
  };

  const handleSave = async () => {
    if (!adminUid || !teamId) {
      alert('Aucune équipe trouvée — impossible de sauvegarder.');
      return;
    }
    setSavingKey(activeKey);
    try {
      const db = getFirestore();
      const teamRef = doc(db, 'users', adminUid, teamCollection, teamId);
      const finalHtml = draft.mode === 'advanced'
        ? draft.html
        : buildHtmlFromFields(draft.fields || {}, themeColor, activeTpl?.cta?.urlPlaceholder || '');

      const payload = {
        subject: draft.subject || '',
        html: finalHtml,
        mode: draft.mode || 'simple',
        updatedAt: new Date().toISOString()
      };
      if (draft.mode === 'simple') {
        payload.fields = draft.fields || {};
      }

      await updateDoc(teamRef, { [`emailTemplates.${activeKey}`]: payload });
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la sauvegarde : ' + err.message);
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = () => {
    if (!window.confirm('Restaurer le template par défaut ? Tes modifications seront perdues.')) return;
    setDrafts(prev => ({
      ...prev,
      [activeKey]: {
        subject: activeTpl.simple.subject,
        fields: { ...activeTpl.simple },
        mode: 'simple',
        html: ''
      }
    }));
  };

  // Détection "dirty"
  const saved = savedTemplates[activeKey];
  const isDirty = useMemo(() => {
    if (!saved) {
      // Pas encore sauvegardé : dirty si différent des valeurs par défaut
      return draft.subject !== activeTpl?.simple.subject ||
             JSON.stringify(draft.fields) !== JSON.stringify(activeTpl?.simple) ||
             draft.mode !== 'simple';
    }
    if (saved.subject !== draft.subject) return true;
    if (saved.mode !== draft.mode) return true;
    if (draft.mode === 'advanced') return saved.html !== draft.html;
    return JSON.stringify(saved.fields) !== JSON.stringify(draft.fields);
  }, [saved, draft, activeTpl]);

  const insertPlaceholder = (placeholder) => {
    const tag = `{{${placeholder}}}`;
    if (draft.mode === 'advanced') {
      updateHtml((draft.html || '') + tag);
    } else if (activeField === 'subject') {
      updateSubject((draft.subject || '') + tag);
    } else {
      const cur = draft.fields?.[activeField] || '';
      updateField(activeField, cur + tag);
    }
  };

  if (!activeTpl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl h-[92vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-${themeColor}-500 to-${themeColor}-700 text-white flex items-center justify-center shadow-lg`}>
              <Mail size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">Templates d'emails</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-0.5">{teamName || 'Mon équipe'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvanced(v => !v)}
              title={showAdvanced ? 'Masquer le mode HTML avancé' : 'Activer le mode HTML avancé (pour utilisateurs avancés)'}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                showAdvanced ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {showAdvanced ? '✓ Mode HTML' : 'Mode HTML avancé'}
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <X size={22} />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar templates */}
          <aside className="w-72 border-r border-slate-200 bg-slate-50/60 overflow-y-auto p-3 shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 pt-2 pb-3">Templates</p>
            {templates.map(tpl => {
              const customSaved = !!savedTemplates[tpl.key];
              return (
                <button
                  key={tpl.key}
                  onClick={() => setActiveKey(tpl.key)}
                  className={`w-full text-left p-4 rounded-2xl mb-2 transition-all border-2 group ${
                    activeKey === tpl.key
                      ? `bg-${themeColor}-50 border-${themeColor}-200 shadow-sm`
                      : 'bg-white border-transparent hover:border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`font-black text-sm leading-tight ${activeKey === tpl.key ? `text-${themeColor}-800` : 'text-slate-800'}`}>
                      {tpl.label}
                    </span>
                    {customSaved && (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{tpl.description}</p>
                </button>
              );
            })}
          </aside>

          {/* Editor + Preview side by side */}
          <main className="flex-1 flex overflow-hidden">
            {/* LEFT — Editor */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200">
              {/* Toolbar */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  {draft.mode === 'simple' ? <FormInput size={14} /> : <Code size={14} />}
                  <span>{draft.mode === 'simple' ? 'Mode Simple' : 'Mode HTML'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {showAdvanced && (
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                      <button
                        onClick={() => setMode('simple')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          draft.mode === 'simple' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        Simple
                      </button>
                      <button
                        onClick={() => setMode('advanced')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          draft.mode === 'advanced' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        HTML
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleReset}
                    title="Restaurer le template par défaut"
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> Réinitialiser
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!isDirty || savingKey === activeKey}
                    className={`px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition-all ${
                      isDirty && savingKey !== activeKey
                        ? `bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white shadow-md hover:shadow-lg`
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Save size={16} />
                    {savingKey === activeKey ? 'Sauvegarde…' : (isDirty ? 'Sauvegarder' : '✓ Sauvegardé')}
                  </button>
                </div>
              </div>

              {/* Form fields */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {/* Subject */}
                <FormField label="Objet de l'email" hint="Ce que ton client voit dans sa boîte de réception">
                  <input
                    type="text"
                    value={draft.subject || ''}
                    onChange={e => updateSubject(e.target.value)}
                    onFocus={() => setActiveField('subject')}
                    className={`w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-${themeColor}-400 focus:ring-4 focus:ring-${themeColor}-50`}
                    placeholder="Ex: Votre dossier confié à {{brokerName}}"
                  />
                </FormField>

                {draft.mode === 'simple' ? (
                  <>
                    <FormField label="Titre principal" hint="Le grand titre en haut de l'email">
                      <input
                        type="text"
                        value={draft.fields?.heading || ''}
                        onChange={e => updateField('heading', e.target.value)}
                        onFocus={() => setActiveField('heading')}
                        className={`w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-${themeColor}-400 focus:ring-4 focus:ring-${themeColor}-50`}
                        placeholder="Bonjour {{clientName}} !"
                      />
                    </FormField>

                    <FormField label="Contenu de l'email" hint="Sépare tes paragraphes par une ligne vide. Tu peux utiliser des variables {{clientName}}, {{brokerName}}, etc.">
                      <textarea
                        value={draft.fields?.body || ''}
                        onChange={e => updateField('body', e.target.value)}
                        onFocus={() => setActiveField('body')}
                        rows={9}
                        className={`w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-700 leading-relaxed focus:outline-none focus:border-${themeColor}-400 focus:ring-4 focus:ring-${themeColor}-50`}
                        placeholder="Bonjour, votre dossier a été confié à..."
                      />
                    </FormField>

                    {activeTpl.cta && (
                      <FormField label="Texte du bouton d'action" hint="Le bouton coloré que ton client va cliquer">
                        <input
                          type="text"
                          value={draft.fields?.ctaLabel || ''}
                          onChange={e => updateField('ctaLabel', e.target.value)}
                          onFocus={() => setActiveField('ctaLabel')}
                          className={`w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-${themeColor}-400 focus:ring-4 focus:ring-${themeColor}-50`}
                          placeholder="Cliquer ici"
                        />
                        <p className="text-xs text-slate-400 mt-1.5 ml-1">Lien automatique : <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{activeTpl.cta.urlPlaceholder}</code></p>
                      </FormField>
                    )}

                    <FormField label="Signature" hint="Apparaît tout en bas, séparée par une ligne grise">
                      <textarea
                        value={draft.fields?.signature || ''}
                        onChange={e => updateField('signature', e.target.value)}
                        onFocus={() => setActiveField('signature')}
                        rows={2}
                        className={`w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-${themeColor}-400 focus:ring-4 focus:ring-${themeColor}-50`}
                        placeholder="L'équipe {{teamName}}"
                      />
                    </FormField>
                  </>
                ) : (
                  // ADVANCED MODE
                  <FormField label="HTML brut" hint="Pour utilisateurs avancés. Garde des styles inline pour la compatibilité email.">
                    <textarea
                      value={draft.html || ''}
                      onChange={e => updateHtml(e.target.value)}
                      rows={20}
                      className={`w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-mono text-xs text-slate-700 focus:outline-none focus:border-${themeColor}-400 focus:ring-4 focus:ring-${themeColor}-50 leading-relaxed`}
                      spellCheck={false}
                    />
                  </FormField>
                )}

                {/* Variables disponibles */}
                <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-amber-600" />
                    <span className="text-xs font-black uppercase tracking-wide text-amber-800">
                      Variables disponibles {draft.mode === 'simple' && `· clic = insère dans "${activeField === 'subject' ? 'Objet' : activeField === 'heading' ? 'Titre' : activeField === 'body' ? 'Contenu' : activeField === 'ctaLabel' ? 'Bouton' : 'Signature'}"`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTpl.placeholders.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => insertPlaceholder(p)}
                        className="px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-mono font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                      >
                        {`{{${p}}}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-700 mt-2">Les variables sont remplacées automatiquement par les vraies valeurs au moment de l'envoi.</p>
                </div>
              </div>
            </div>

            {/* RIGHT — Live preview */}
            <div className="w-[460px] shrink-0 bg-slate-100 flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-2 text-slate-600">
                <Eye size={16} />
                <span className="text-sm font-bold">Aperçu en direct</span>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
                  <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Objet</p>
                    <p className="font-bold text-slate-900 text-sm">{applyTemplatePreview(draft.subject, SAMPLE_VARS) || <span className="italic text-slate-400">(vide)</span>}</p>
                  </div>
                  <div
                    className="bg-white"
                    dangerouslySetInnerHTML={{ __html: applyTemplatePreview(renderedHtml, SAMPLE_VARS) }}
                  />
                </div>
                <p className="text-center text-[10px] text-slate-500 mt-4 leading-relaxed">
                  Aperçu avec données d'exemple :<br/>
                  <span className="font-mono">{Object.entries(SAMPLE_VARS).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(' · ')}</span>
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, hint, children }) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-black uppercase tracking-wide text-slate-700 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-2 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}
