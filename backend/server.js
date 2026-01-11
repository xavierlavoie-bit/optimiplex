require('dotenv').config();

const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'ANTHROPIC_API_KEY',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ ERREUR: ${envVar} manquante`);
    process.exit(1);
  }
}

console.log('✅ Variables d\'environnement validées');

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// ✅ AJOUTEZ CES IMPORTS
const { getFirestore, collection, query, where, getDocs } = require('firebase-admin/firestore');

const app = express();




// Middleware Stripe WEBHOOK (avant bodyParser JSON)
app.use('/api/stripe/webhook', express.raw({type: 'application/json'}));

// Configuration CORS permissive pour le développement local
const allowedOrigins = [
  'https://optimiplex.com',
  'https://www.optimiplex.com',
  'https://app.optimiplex.com',
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqué: ${origin}`);
      callback(new Error('CORS Policy Violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
  maxAge: 86400
}));

app.use(express.json());

const PLAN_LIMITS = {
  'essai': 1,    // 1/mois
  'pro': 5,      // 5/mois
  'growth': 999, // Illimité
  'entreprise': 999
};


// Initialisation du client Claude
const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'votre_cle_ici'
});

// Initialisation Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

const checkQuota = async (req, res, next) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId requis' });
  }
  
  try {
    const now = new Date();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const userData = userDoc.data();
    const userPlan = userData?.plan || 'essai';
    
    // ✅ Déterminer le mois courant (ex: "2026-01")
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // ✅ Récupérer le quota tracking existant
    const quotaTracking = userData?.quotaTracking || { month: null, count: 0 };
    
    let monthlyCount = 0;
    
    // ✅ SI NOUVEAU MOIS → RESET LE QUOTA
    if (quotaTracking.month !== currentMonth) {
      console.log(`🔄 NOUVEAU MOIS: ${quotaTracking.month} → ${currentMonth} - RESET`);
      monthlyCount = 0;
      
      // Sauvegarder le reset en Firestore
      await db.collection('users').doc(userId).update({
        quotaTracking: {
          month: currentMonth,
          count: 0,
          resetAt: admin.firestore.FieldValue.serverTimestamp()
        }
      });
    } else {
      // Même mois : utiliser le quota sauvegardé
      monthlyCount = quotaTracking.count || 0;
    }
    
    // ✅ Vérifier si quota atteint
    const PLAN_LIMITS = {
      'essai': 1,
      'pro': 5,
      'growth': 999,
      'entreprise': 999
    };
    
    const limit = PLAN_LIMITS[userPlan] || 1;
    console.log(`📊 Quota: ${monthlyCount}/${limit} pour plan "${userPlan}"`);
    
    if (monthlyCount >= limit) {
      console.log(`❌ QUOTA ATTEINT pour ${userId}`);
      return res.status(429).json({
        error: `Quota ${userPlan} atteint (${limit}/mois)`,
        current: monthlyCount,
        limit: limit,
        remaining: 0,
        resetDate: monthEnd
      });
    }
    
    // ✅ Quota OK → Autoriser la requête
    req.quotaInfo = {
      current: monthlyCount,
      limit: limit,
      remaining: limit - monthlyCount,
      month: currentMonth,
      plan: userPlan,
      resetDate: monthEnd
    };
    
    console.log(`✅ OK: ${req.quotaInfo.remaining} analyse(s) restante(s)`);
    next();
    
  } catch (error) {
    console.error('❌ Erreur checkQuota:', error);
    res.status(500).json({ error: error.message });
  }
};


// ====================================================================
// 💳 STRIPE - CRÉER SESSION CHECKOUT
// ====================================================================
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { userId, userEmail, plan, priceId } = req.body;
    
    console.log('🔵 Création session:', { userId, userEmail, plan, priceId });

    if (!priceId || !userId || !userEmail) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: {
        firebaseUserId: userId,
        plan: plan  // ✅ IMPORTANT!
      }
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.FRONTEND_URL}/dashboard/profile?success=true&sessionId=${'{CHECKOUT_SESSION_ID}'}`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/profile?canceled=true`,
      // ✅ FORCER les métadonnées sur la subscription
      subscription_data: {
        metadata: {
          firebaseUserId: userId,
          plan: plan  // ✅ Le nouveau plan!
        }
      }
    });

    console.log('✅ Session créée:', { sessionId: session.id, plan });
    
    res.json({
      sessionId: session.id,
      sessionUrl: session.url
    });

  } catch (error) {
    console.error('❌ Erreur création session:', error);
    res.status(500).json({ error: error.message });
  }
});




// ====================================================================
// 🔄 STRIPE - WEBHOOK
// ====================================================================
app.post('/api/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('📨 Webhook reçu:', event.type);
  } catch (error) {
    console.error('❌ Signature invalide:', error.message);
    return res.status(400).send(`Webhook signature verification failed: ${error.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log('📝 Webhook ignoré:', event.type);
    }
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});


// ====================================================================
// 📋 STRIPE - HISTORIQUE DE FACTURATION
// ====================================================================
app.get('/api/stripe/billing-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Récupérer l'ID client Stripe depuis Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const stripeCustomerId = userDoc.data()?.stripeCustomerId;

    if (!stripeCustomerId) {
      return res.json({ invoices: [] });
    }

    // Récupérer les factures
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 20
    });

    res.json({ invoices: invoices.data });
  } catch (error) {
    console.error('Erreur facturation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ❌ STRIPE - ANNULER ABONNEMENT

// PORTAIL CLIENT STRIPE (ajoutez après cancel-subscription)
app.post('/api/stripe/create-portal-session', async (req, res) => {
  try {
    const { userId, returnUrl } = req.body;
    
    console.log('🔗 Portail client pour:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    const stripeCustomerId = userDoc.data()?.stripeCustomerId;
    
    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'Pas de client Stripe trouvé' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/dashboard/profile`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Erreur portail:', error);
    res.status(500).json({ error: error.message });
  }
});


// PORTAIL CLIENT STRIPE (ajoutez après cancel-subscription)
app.post('/api/stripe/create-portal-session', async (req, res) => {
  try {
    const { userId, returnUrl } = req.body;
    
    console.log('🔗 Portail client pour:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    const stripeCustomerId = userDoc.data()?.stripeCustomerId;
    
    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'Pas de client Stripe trouvé' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/dashboard/profile`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Erreur portail:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stripe/cancel-subscription', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // ✅ PROTECTION : Ne downgrade QUE via Stripe annulation
    if (!userData.stripeCustomerId) {
      return res.status(400).json({ 
        error: 'Aucun abonnement actif trouvé. Contactez support@optimiplx.com' 
      });
    }

    // Annulation Stripe (inchangé)
    const subscriptions = await stripe.subscriptions.list({
      customer: userData.stripeCustomerId,
      status: 'active'
    });

    for (const sub of subscriptions.data) {
      await stripe.subscriptions.update(sub.id, {
        cancel_at_period_end: true
      });
    }

    // ✅ NE DOWNSHIFT PAS immédiatement Firestore
    // Attendre webhook subscription.deleted

    res.json({ 
      success: true, 
      message: 'Abonnement annulé. Plan Essai fin période actuelle. Support si problème.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ====================================================================
// 🔄 WEBHOOK HANDLERS
// ====================================================================
// ✅ HANDLER SOUSCRIPTION CRÉÉE (RESET QUOTA!)
async function handleSubscriptionCreated(subscription) {
  try {
    console.log('🆕 Subscription created:', subscription.id);

    const userId = subscription.metadata?.firebaseUserId;
    const plan = subscription.metadata?.plan;

    if (!userId) {
      console.error('❌ Pas de userId valide:', subscription.metadata);
      return;
    }

    // ✅ PLAN + DATE SOUSCRIPTION = TODAY = RESET QUOTA
    await db.collection('users').doc(userId).update({
      plan: plan,
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      planStartDate: new Date(),  // ✅ TODAY = Quota reset!
      subscriptionStatus: subscription.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`✅ Plan ${plan} activé pour ${userId}`);
    console.log(`📊 Quota reset le ${new Date().toLocaleDateString('fr-CA')}`);

  } catch (error) {
    console.error('❌ Erreur handleSubscriptionCreated:', error);
  }
}


// ✅ HANDLER SOUSCRIPTION MISE À JOUR (UPGRADE!)
async function handleSubscriptionUpdated(subscription) {
  try {
    const stripeCustomerId = subscription.customer;
    const newStatus = subscription.status;
    const newPlan = subscription.metadata?.plan;  // ✅ Récupérer le nouveau plan

    console.log(`📝 subscription.updated - Customer: ${stripeCustomerId}, Status: ${newStatus}, Plan: ${newPlan}`);

    // Récupérer user via customerId
    const usersSnapshot = await db
      .collection('users')
      .where('stripeCustomerId', '==', stripeCustomerId)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log('⚠️ Pas de user trouvé pour update');
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;

    // ✅ SI UPGRADE : mettre à jour plan + resetDate
    if (newPlan) {
      console.log(`⬆️ UPGRADE DÉTECTÉ: ${userDoc.data().plan} → ${newPlan}`);
      
      await db.collection('users').doc(userId).update({
        plan: newPlan,  // ✅ METS À JOUR LE PLAN!
        planStartDate: new Date(),  // ✅ RESET QUOTA!
        subscriptionStatus: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Plan ${newPlan} activé pour ${userId} - Quota reset!`);
    }
    // ✅ SI ANNULATION (cancel_at_period_end)
    else if (subscription.cancel_at_period_end) {
      await db.collection('users').doc(userId).update({
        subscriptionStatus: 'canceling',
        cancelDate: new Date(subscription.current_period_end * 1000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`⚠️ Annulation programmée pour ${userId}`);
    }
    // Autre update (status change, etc)
    else {
      await db.collection('users').doc(userId).update({
        subscriptionStatus: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`📝 Status mis à jour: ${newStatus} pour ${userId}`);
    }

  } catch (error) {
    console.error('❌ ERREUR handleSubscriptionUpdated:', error);
  }
}



async function handleSubscriptionDeleted(subscription) {
  try {
    const stripeCustomerId = subscription.customer;
    
    console.log('🗑️ subscription.deleted - Customer ID:', stripeCustomerId);

    // ✅ SOLUTION : Trouver user via stripeCustomerId dans Firestore
    const usersSnapshot = await db.collection('users')
      .where('stripeCustomerId', '==', stripeCustomerId)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.error('❌ Aucun user trouvé pour customer:', stripeCustomerId);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;

    console.log('✅ User trouvé:', userId);

    // ✅ Downgrade automatique
    await db.collection('users').doc(userId).update({
      plan: 'essai',
      subscriptionStatus: 'deleted',
      subscriptionId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ ✅ PLAN DOWNSHIFT AUTO:', userId, '→ essai');
  } catch (error) {
    console.error('❌ ERREUR deleted:', error);
  }
}


// ✅ HANDLER PAIEMENT RÉUSSI
async function handlePaymentSucceeded(invoice) {
  try {
    console.log('💳 Payment succeeded for:', invoice.customer);

    // Récupérer le customer Stripe
    const customer = await stripe.customers.retrieve(invoice.customer);
    const userEmail = customer.email;

    // Trouver l'user par email
    const userSnapshot = await db
      .collection('users')
      .where('email', '==', userEmail)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      console.log('⚠️ User not found for email:', userEmail);
      return;
    }

    const userId = userSnapshot.docs[0].id;

    // ✅ SAUVEGARDER DATE DE PAIEMENT (renouvellement quota!)
    await db.collection('users').doc(userId).update({
      planStartDate: new Date(),
      lastPaymentDate: new Date(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ planStartDate set pour ${userId} - Reset quota le ${new Date().toLocaleDateString('fr-CA')}`);

  } catch (error) {
    console.error('❌ Erreur handlePaymentSucceeded:', error);
  }
}

// ✅ HANDLER PAIEMENT ÉCHOUÉ
async function handlePaymentFailed(invoice) {
  try {
    console.log('❌ Payment failed for:', invoice.customer);

    const customer = await stripe.customers.retrieve(invoice.customer);
    const userEmail = customer.email;

    const userSnapshot = await db
      .collection('users')
      .where('email', '==', userEmail)
      .limit(1)
      .get();

    if (userSnapshot.empty) return;

    const userId = userSnapshot.docs[0].id;

    await db.collection('users').doc(userId).update({
      paymentStatus: 'failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`⚠️ Paiement échoué pour ${userId}`);

  } catch (error) {
    console.error('❌ Erreur handlePaymentFailed:', error);
  }
}

// ✅ HANDLER SOUSCRIPTION CRÉÉE
async function handleSubscriptionCreated(subscription) {
  try {
    console.log('🆕 Subscription created:', subscription.id);

    const userId = subscription.metadata?.firebaseUserId;
    const plan = subscription.metadata?.plan;

    if (!userId) {
      console.error('❌ Pas de userId valide:', subscription.metadata);
      return;
    }

    // ✅ PLAN + DATE SOUSCRIPTION
    await db.collection('users').doc(userId).update({
      plan: plan,
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      planStartDate: new Date(),  // ✅ Date initiale!
      subscriptionStatus: subscription.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`✅ Plan ${plan} set pour ${userId} - Reset quota le ${new Date().toLocaleDateString('fr-CA')}`);

  } catch (error) {
    console.error('❌ Erreur handleSubscriptionCreated:', error);
  }
}


// ====================================================================
// 🧠 FONCTION UTILITAIRE : GÉNÉRATEUR DE PROMPT SYSTÈME
// ====================================================================

const getSystemPrompt = (type) => {
  const strictRules = `
YOU MUST RESPOND WITH VALID JSON ONLY. NO TEXT BEFORE OR AFTER.

RESPONSE FORMAT (camelCase MANDATORY):
{
  "location": {"ville": "string", "quartier": "string"},
  "propertytype": "string",
  "marketanalysis": {
    "sources": ["source"],
    "listingssimilaires": 0,
    "moyennemarche": 0,
    "mediane": 0,
    "fourchette": [0, 0],
    "tendance30j": 0,
    "occupation": 0
  },
  "recommandation": {
    "loyeroptimal": 0,
    "gainmensuel": 0,
    "gainannuel": 0,
    "confiance": 0,
    "pourcentageaugmentation": 0,
    "justification": ["point"],
    "pointscles": ["strategy"],
    "considerations": ["risk"],
    "prochainesetapes": ["step"],
    "raisonnement": "text"
  },
  "marketingkit": {
    "titreannonce": "title",
    "descriptionaccroche": "pitch",
    "profillocataire": "profile"
  }
}

CRITICAL:
- ONLY camelCase (loyeroptimal NOT loyer_optimal)
- ALL numbers as numbers (22 NOT "22 CAD")
- NO extra fields, NO nested structures beyond this format
- If cannot match format: return {}
`;

  if (type === 'residential') {
    return strictRules + `
Specialized in residential rental (Montreal, Quebec regions).
Analyze using the JSON structure above ONLY.`;
  }

  if (type === 'commercial') {
    return strictRules + `
Specialized in commercial (Office, Retail, Industrial).
Analyze using the JSON structure above ONLY.
Values: loyeroptimal = $/sqft/year, gainmensuel and gainannuel = total dollars.`;
  }

  return strictRules;
};


// ====================================================================
// 🏠 ENDPOINT : OPTIMISATEUR RÉSIDENTIEL
// ====================================================================

app.post('/api/pricing/optimizer-pro', checkQuota, async (req, res) => {
  try {
    const { 
      proprietetype,
      ville,
      quartier,
      typeappart,      // ← typeappart existe ICI
      loyeractuel,
      titre,
      etat,
      meuble,
      balcon,
      garage,
      animaux,
      climatise,
      chauffage,
      stationnement,
      laverie,
      gym,
      piscine
    } = req.body; 

    // ✅ DÉPLACER CETTE MAP ICI (à l'intérieur du endpoint)
    const appartmentLabels = {
      '112': '1 1/2 (Studio)',
      '312': '3 1/2 (2 chambres)',
      '412': '4 1/2 (3 chambres)',
      '512': '5 1/2 (4+ chambres)'
    };

    const typeappartLabel = appartmentLabels[typeappart] || typeappart;

    console.log(`📤 Backend reçoit typeappart = ${typeappart}`);
    console.log(`🏠 Analyse Résidentielle: ${ville} - ${typeappartLabel}`);

    const extrasList = [
      meuble ? 'Entièrement meublé' : null,
      balcon ? 'Balcon privé' : null,
      // ... reste des extras
    ].filter(Boolean).join(', ');

    const userPrompt = `
ANALYSE CIBLE :
- Bien : ${typeappartLabel} à ${ville}, quartier ${quartier || 'Non spécifié'}.
- Loyer Actuel : $${loyeractuel}/mois
- Extras : ${extrasList || 'Standard'}

⚠️ IMPORTANT: Analyse UNIQUEMENT pour un ${typeappartLabel}.
`;

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2500,
      temperature: 0.2,
      system: getSystemPrompt('residential'),
      messages: [{ role: 'user', content: userPrompt }]
    });

    const jsonResponse = parseClaudeJSON(response.content[0].text);

    // =======================================================
    // ✅ CORRECTION : SAUVEGARDER L'UTILISATION DU QUOTA ICI
    // =======================================================
    const { userId } = req.body;
    // On récupère le mois calculé par le middleware checkQuota ou on le recalcule
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await db.collection('users').doc(userId).update({
      'quotaTracking.count': admin.firestore.FieldValue.increment(1), // +1 au compteur
      'quotaTracking.month': currentMonth, // S'assure que le mois est le bon
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`📈 Quota incrémenté pour ${userId}`);
    // =======================================================

    res.json(jsonResponse);
  } catch (error) {
    console.error('❌ Erreur Résidentiel:', error);
    res.status(500).json({ error: "Échec de l'analyse résidentielle", details: error.message });
  }
});


// ====================================================================
// 🏢 ENDPOINT : OPTIMISATEUR COMMERCIAL
// ====================================================================

app.post('/api/pricing/commercial-optimizer', checkQuota, async (req, res) => {
  try {
    const {
      ville,
      quartier,
      typecommercial,
      surfacepiedcarre,
      prixactuelpiedcarre,
      termebailans,
      visibilite,
      parking,
      ascenseur,
      acceshandicape,
      amenages
    } = req.body;

    // ✅ MAP (même pattern que résidentiel)
    const commercialLabels = {
      'office': 'Bureau',
      'warehouse': 'Entrepôt',
      'retail': 'Retail'
    };

    const typecommercialLabel = commercialLabels[typecommercial] || typecommercial;

    console.log(`📤 Backend reçoit typecommercial = ${typecommercial}`);
    console.log(`🏢 Analyse Commerciale: ${ville} - ${typecommercialLabel}`);

    // ✅ EXTRAS (même pattern que résidentiel - null au lieu de '')
    const extrasList = [
      parking ? 'Parking inclus' : null,
      ascenseur ? 'Ascenseur' : null,
      acceshandicape ? 'Accès universel' : null,
      amenages ? 'Déjà aménagé' : null
    ].filter(Boolean).join(', ');

    // ✅ PROMPT
    const userPrompt = `
CONTEXTE DU BIEN :
- Type : ${typecommercialLabel}
- Localisation : ${ville}${quartier ? `, ${quartier}` : ''}
- Surface : ${surfacepiedcarre} pi²
- Loyer actuel : $${prixactuelpiedcarre}/pi²/an
- Visibilité : ${visibilite}
- Terme bail : ${termebailans} ans
- Atouts : ${extrasList || 'Standard'}

MISSION :
1. Analyse LoopNet/Centris/LesPac pour un ${typecommercialLabel} à ${ville}
2. Prix optimal au pied carré pour ce TYPE précis
3. Incitatifs (Mois gratuits, budget travaux)

⚠️ IMPORTANT: Analyse UNIQUEMENT pour un ${typecommercialLabel}.
Réponds uniquement avec un JSON valide et complet.
`;

    console.log('📋 Prompt envoyé à Claude:', userPrompt);

    // ✅ CLAUDE
    // CORRECTION : Augmentation de max_tokens de 2500 à 8000
    // L'analyse commerciale est verbeuse, 2500 tokens coupait le JSON au milieu.
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000, // Augmenté pour éviter le JSON tronqué
      temperature: 0.1,
      system: getSystemPrompt('commercial'),
      messages: [{ role: 'user', content: userPrompt }]
    });

    // Vérification de sécurité pour voir si la réponse a été tronquée par l'API
    if (response.stop_reason === 'max_tokens') {
      console.warn('⚠️ ATTENTION : La réponse de Claude a atteint la limite de tokens !');
    }

    // ✅ PARSING
    const jsonResponse = parseClaudeJSON(response.content[0].text);
    res.json(jsonResponse);

  } catch (error) {
    console.error('❌ Erreur Commercial:', error);
    // On logue le contenu brut s'il existe pour le débogage
    if (error.response && error.response.content) {
        console.error('Contenu reçu (partiel):', error.response.content[0].text);
    }
    
    res.status(500).json({ 
      error: "Échec de l'analyse commerciale", 
      details: error.message 
    });
  }
});



// ====================================================================
// 🛠️ HELPER : PARSEUR JSON ROBUSTE
// ====================================================================

function parseClaudeJSON(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Aucun bloc JSON trouvé");
  } catch (e) {
    console.error("Erreur de parsing JSON brut:", text);
    return {
      error: "Erreur de formatage IA",
      raw_text: text,
      fallback_message: "L'analyse est complexe, veuillez réessayer."
    };
  }
}

// ====================================================================
// 🚀 DÉMARRAGE
// ====================================================================

const PORT = process.env.PORT || 5001;

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message);
  if (err.message.includes('CORS')) {
    return res.status(403).json({ error: 'CORS Policy Violation' });
  }
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Server Error' : err.message
  });
});

app.listen(PORT, () => {
  console.log(`
🚀 SERVER OPTIMIPLEX LIVE (Port ${PORT})
====================================================
✅ COMPATIBILITÉ FRONTEND : ASSURÉE
✅ MOTEUR IA : CLAUDE 3 SONNET
✅ PAIEMENTS STRIPE : CONFIGURÉS

ENDPOINTS ACTIFS :
1. POST /api/pricing/optimizer-pro (Résidentiel)
2. POST /api/pricing/commercial-optimizer (Commercial)
3. POST /api/stripe/create-checkout-session
4. GET /api/stripe/billing-history/:userId
5. POST /api/stripe/cancel-subscription
6. POST /api/stripe/webhook

====================================================
  `);
});