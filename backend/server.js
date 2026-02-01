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

// ✅ IMPORTS FIRESTORE
const { getFirestore, collection, query, where, getDocs, FieldValue } = require('firebase-admin/firestore');

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
  'pro': 20,      // 5/mois
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

// ====================================================================
// 🧠 MIDDLEWARE : VÉRIFICATION QUOTA OU CRÉDITS
// ====================================================================
const checkQuotaOrCredits = async (req, res, next) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId requis' });
  }
  
  try {
    const now = new Date();
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const userData = userDoc.data();
    const userPlan = userData?.plan || 'essai';
    const creditsBalance = userData?.creditsBalance || 0;
    
    // 1. GESTION DU MOIS COURANT
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const quotaTracking = userData?.quotaTracking || { month: null, count: 0 };
    
    let monthlyCount = 0;
    
    // Reset du mois si nécessaire
    if (quotaTracking.month !== currentMonth) {
      console.log(`🔄 NOUVEAU MOIS: ${quotaTracking.month} → ${currentMonth} - RESET`);
      monthlyCount = 0;
      await userDocRef.update({
        quotaTracking: {
          month: currentMonth,
          count: 0,
          resetAt: admin.firestore.FieldValue.serverTimestamp()
        }
      });
    } else {
      monthlyCount = quotaTracking.count || 0;
    }
    
    // 2. VÉRIFICATION DES LIMITES
    const limit = PLAN_LIMITS[userPlan] || 1;
    console.log(`📊 Check: ${monthlyCount}/${limit} (Plan: ${userPlan}) | Crédits: ${creditsBalance}`);
    
    let consumptionMode = 'blocked'; // 'subscription', 'credit', ou 'blocked'

    // Cas A : Il reste du quota dans l'abonnement
    if (monthlyCount < limit) {
      consumptionMode = 'subscription';
    } 
    // Cas B : Quota épuisé, mais il reste des crédits
    else if (creditsBalance > 0) {
      consumptionMode = 'credit';
    }

    // 3. DÉCISION
    if (consumptionMode === 'blocked') {
      console.log(`❌ BLOQUÉ: Quota atteint et 0 crédit pour ${userId}`);
      return res.status(429).json({
        error: `Quota ${userPlan} atteint et aucun crédit disponible.`,
        code: 'QUOTA_EXCEEDED_NO_CREDITS',
        current: monthlyCount,
        limit: limit,
        credits: 0,
        upgradeUrl: '/dashboard/billing' 
      });
    }

    // On attache l'info à la requête pour l'utiliser plus tard
    req.quotaInfo = {
      mode: consumptionMode, // 'subscription' ou 'credit'
      currentMonth: currentMonth,
      userId: userId
    };
    
    console.log(`✅ AUTORISÉ via mode: [${consumptionMode.toUpperCase()}]`);
    next();
    
  } catch (error) {
    console.error('❌ Erreur checkQuotaOrCredits:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====================================================================
// 🛠️ HELPER : DÉDUIRE L'UTILISATION (APPELÉ APRÈS SUCCÈS IA)
// ====================================================================
const deductUsage = async (userId, quotaInfo) => {
  const userRef = db.collection('users').doc(userId);

  if (quotaInfo.mode === 'subscription') {
    // Incrémenter le compteur mensuel
    await userRef.update({
      'quotaTracking.count': admin.firestore.FieldValue.increment(1),
      'quotaTracking.month': quotaInfo.currentMonth, 
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`📉 Quota abonnement déduit pour ${userId}`);
  } 
  else if (quotaInfo.mode === 'credit') {
    // Décrémenter le solde de crédits
    await userRef.update({
      creditsBalance: admin.firestore.FieldValue.increment(-1),
      creditsUsageHistory: admin.firestore.FieldValue.arrayUnion({
        usedAt: new Date(),
        type: 'analysis_usage'
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`🪙 Crédit consommé pour ${userId}`);
  }
};


// ====================================================================
// 💳 STRIPE - ABONNEMENT
// ====================================================================
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { userId, userEmail, plan, priceId } = req.body;

    console.log('🔵 Tentative de création de session Abo:', { userId, plan });

    // 1. Validation de sécurité
    if (!priceId || !userId || !userEmail) {
      console.error('❌ Paramètres manquants pour Checkout:', { userId, userEmail, priceId });
      return res.status(400).json({ error: 'Paramètres manquants (userId, email ou prix)' });
    }

    // 2. Récupération ou création du client Stripe
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur Firestore introuvable' });
    }

    const userData = userDoc.data();
    let customerId = userData.stripeCustomerId;

    if (!customerId) {
      console.log(`🆕 Création d'un nouveau client Stripe pour : ${userEmail}`);
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUserId: userId, // Lié pour toujours dans Stripe
        }
      });
      customerId = customer.id;

      // Sauvegarde immédiate du Customer ID dans Firestore
      await userRef.update({ 
        stripeCustomerId: customerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      console.log(`🔄 Réutilisation du client Stripe existant : ${customerId}`);
    }

    // 3. Création de la session de paiement
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        }
      ],
      // Metadata au niveau de la SESSION (pour checkout.session.completed)
      metadata: {
        firebaseUserId: userId,
        plan: plan,
        type: 'subscription'
      },
      // Metadata au niveau de l'ABONNEMENT (pour invoice.paid et cycles futurs)
      subscription_data: {
        metadata: {
          firebaseUserId: userId,
          plan: plan
        }
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard/profile?success=true&sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/profile?canceled=true`,
    });

    console.log(`✅ Session Checkout créée : ${session.id}`);
    res.json({ sessionId: session.id, sessionUrl: session.url });

  } catch (error) {
    console.error('❌ Erreur critique création session Stripe:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// 💳 STRIPE - ACHAT CRÉDITS (ONE-TIME)
// ====================================================================
app.post('/api/stripe/create-checkout-session-credits', async (req, res) => {
  try {
    const { userId, userEmail, creditsPlan, priceId } = req.body;

    if (!userId || !userEmail || !creditsPlan || !priceId) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    // 1. Récupérer ou créer le client Stripe (Logique anti-doublon)
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    let customerId = userDoc.data()?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { firebaseUserId: userId }
      });
      customerId = customer.id;
      await userRef.update({ stripeCustomerId: customerId });
    }

    // 2. Créer la session avec le Customer ID existant
    const session = await stripe.checkout.sessions.create({
      customer: customerId, // Utilise le client unique
      payment_method_types: ['card'],
      mode: 'payment', // 'payment' pour un achat unique (crédits)
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      metadata: {
        firebaseUserId: userId,
        creditsPlan: creditsPlan,
        type: 'credits'
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard/profile?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/profile?canceled=true`,
    });

    res.json({ sessionId: session.id, sessionUrl: session.url });
  } catch (error) {
    console.error('❌ Erreur session crédits:', error);
    res.status(500).json({ error: error.message });
  }
});


// ====================================================================
// 🔄 STRIPE - WEBHOOK ROUTEUR
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
      case 'checkout.session.completed':
        const checkoutSession = event.data.object;
        if (checkoutSession.metadata?.type === 'credits') {
          await handleCreditsPayment(checkoutSession);
        } else {
          // On enregistre d'abord le Customer ID
          await db.collection('users').doc(checkoutSession.metadata.firebaseUserId).update({
            stripeCustomerId: checkoutSession.customer
          });
          await handleCheckoutSessionCompleted(checkoutSession);
        }
        break;
      case 'invoice.paid':
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const userId = subscription.metadata?.firebaseUserId; // Utilise l'optionnel chaining ?.
          
          // ✅ AJOUTE CETTE VÉRIFICATION
          if (!userId || typeof userId !== 'string') {
            console.error("❌ Erreur : invoice.paid reçu mais firebaseUserId est manquant dans les metadata");
            return res.status(200).json({ received: true, warning: "Missing userId" }); 
          }
          
          await db.collection('users').doc(userId).update({
            'quotaTracking.count': 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
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
// 📋 STRIPE - HISTORIQUE & PORTAIL
// ====================================================================
app.get('/api/stripe/billing-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userDoc = await db.collection('users').doc(userId).get();
    const stripeCustomerId = userDoc.data()?.stripeCustomerId;

    if (!stripeCustomerId) return res.json({ invoices: [] });

    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 20
    });

    res.json({ invoices: invoices.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stripe/create-portal-session', async (req, res) => {
  try {
    const { userId, returnUrl } = req.body;
    const userDoc = await db.collection('users').doc(userId).get();
    const stripeCustomerId = userDoc.data()?.stripeCustomerId;
    
    if (!stripeCustomerId) return res.status(400).json({ error: 'Pas de client Stripe trouvé' });

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/dashboard/profile`
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stripe/cancel-subscription', async (req, res) => {
  try {
    const { userId } = req.body;
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData.stripeCustomerId) {
      return res.status(400).json({ error: 'Aucun abonnement actif trouvé.' });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: userData.stripeCustomerId,
      status: 'active'
    });

    for (const sub of subscriptions.data) {
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    }

    res.json({ success: true, message: 'Abonnement annulé à la fin de la période.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ====================================================================
// 🔄 WEBHOOK LOGIQUE MÉTIER
// ====================================================================

// GESTION DES CRÉDITS
async function handleCreditsPayment(session) {
  try {
    const userId = session.metadata?.firebaseUserId;
    const rawPlan = session.metadata?.creditsPlan;

    // PROTECTION CRITIQUE : Empêche le crash du serveur si userId est vide
    if (!userId || typeof userId !== 'string') {
      console.error('❌ Erreur: firebaseUserId manquant ou invalide dans la session Stripe.');
      return; 
    }

    console.log(`🔍 Ajout de crédits pour User: ${userId}, Plan: ${rawPlan}`);

    const creditsPlan = rawPlan?.toLowerCase();
    const CREDITS_MAP = {
      'decouverte': 5,
      'chasseur': 25,
      'investisseur': 150
    };

    const creditsToAdd = CREDITS_MAP[creditsPlan] || 0;

    if (creditsToAdd === 0) {
      console.error(`❌ Plan "${creditsPlan}" non reconnu.`);
      return;
    }

    const userRef = db.collection('users').doc(userId);
    
    // Mise à jour atomique avec increment
    await userRef.update({
      creditsBalance: admin.firestore.FieldValue.increment(creditsToAdd),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastPurchase: {
        date: new Date(),
        type: 'credits',
        plan: creditsPlan,
        amount: creditsToAdd
      }
    });

    console.log(`✅ SUCCÈS: +${creditsToAdd} crédits pour ${userId}`);
  } catch (error) {
    console.error('❌ Erreur Firestore handleCreditsPayment:', error);
  }
}

// GESTION ABONNEMENT
async function handleSubscriptionCreated(subscription) {
  const userId = subscription.metadata?.firebaseUserId;
  const plan = subscription.metadata?.plan;
  
  if (!userId) {
    console.error("❌ Impossible de trouver le userId dans les metadata de la session");
    return;
  }

  await db.collection('users').doc(userId).update({
    plan: plan,
    usageCount: 0, // ✅ RÉINITIALISATION : Débloque l'utilisateur immédiatement
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    planStartDate: new Date(),
    subscriptionStatus: subscription.status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(`🚀 Plan ${plan} activé et quota réinitialisé pour l'utilisateur ${userId}`);
}

async function handleSubscriptionUpdated(subscription) {
  const stripeCustomerId = subscription.customer;
  const newPlan = subscription.metadata?.plan;

  const usersSnapshot = await db.collection('users').where('stripeCustomerId', '==', stripeCustomerId).limit(1).get();
  if (usersSnapshot.empty) return;
  const userId = usersSnapshot.docs[0].id;

  if (newPlan) {
    await db.collection('users').doc(userId).update({
      plan: newPlan,
      planStartDate: new Date(),
      subscriptionStatus: subscription.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else if (subscription.cancel_at_period_end) {
    await db.collection('users').doc(userId).update({
      subscriptionStatus: 'canceling',
      cancelDate: new Date(subscription.current_period_end * 1000)
    });
  } else {
    await db.collection('users').doc(userId).update({ subscriptionStatus: subscription.status });
  }
}

async function handleSubscriptionDeleted(subscription) {
  const stripeCustomerId = subscription.customer;
  const usersSnapshot = await db.collection('users').where('stripeCustomerId', '==', stripeCustomerId).limit(1).get();
  if (usersSnapshot.empty) return;

  await db.collection('users').doc(usersSnapshot.docs[0].id).update({
    plan: 'essai',
    subscriptionStatus: 'deleted',
    subscriptionId: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function handlePaymentSucceeded(invoice) {
  const customer = await stripe.customers.retrieve(invoice.customer);
  const usersSnapshot = await db.collection('users').where('email', '==', customer.email).limit(1).get();
  if (usersSnapshot.empty) return;

  await db.collection('users').doc(usersSnapshot.docs[0].id).update({
    planStartDate: new Date(),
    lastPaymentDate: new Date(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function handlePaymentFailed(invoice) {
  const customer = await stripe.customers.retrieve(invoice.customer);
  const usersSnapshot = await db.collection('users').where('email', '==', customer.email).limit(1).get();
  if (usersSnapshot.empty) return;
  await db.collection('users').doc(usersSnapshot.docs[0].id).update({ paymentStatus: 'failed' });
}

async function handleCheckoutSessionCompleted(session) {
    console.log('✅ Checkout session completed:', session.id);
}


// ====================================================================
// 🧠 FONCTION UTILITAIRE : GÉNÉRATEUR DE PROMPT SYSTÈME (ORIGINAL)
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

app.post('/api/pricing/optimizer-pro', checkQuotaOrCredits, async (req, res) => {
  try {
    const { 
      userId, // AJOUTÉ POUR LE MIDDLEWARE
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

    // ✅ NOUVELLE LOGIQUE : DÉDUIRE SELON LE MODE (CREDIT OU ABONNEMENT)
    await deductUsage(userId, req.quotaInfo);

    // On ajoute le mode utilisé à la réponse pour le frontend (optionnel)
    jsonResponse.meta = { paidWith: req.quotaInfo.mode };

    res.json(jsonResponse);
  } catch (error) {
    console.error('❌ Erreur Résidentiel:', error);
    res.status(500).json({ error: "Échec de l'analyse résidentielle", details: error.message });
  }
});


// ====================================================================
// 🏢 ENDPOINT : OPTIMISATEUR COMMERCIAL
// ====================================================================

app.post('/api/pricing/commercial-optimizer', checkQuotaOrCredits, async (req, res) => {
  try {
    const {
      userId, // AJOUTÉ POUR LE MIDDLEWARE
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
    
    // ✅ DÉDUIRE LE CRÉDIT OU LE QUOTA
    await deductUsage(userId, req.quotaInfo);
    
    jsonResponse.meta = { paidWith: req.quotaInfo.mode };
    
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
// 🏠 ENDPOINT : ESTIMATEUR DE VALEUR IMMOBILIÈRE
// ====================================================================

app.post('/api/property/valuation-estimator', checkQuotaOrCredits, async (req, res) => {
  try {
    const {
      userId,
      proprietyType,
      addresseComplete,
      ville,
      quartier,
      codePostal,
      prixAchat,
      anneeAchat,
      anneeConstruction,
      surfaceHabitee,
      surfaceLot,
      nombreChambres,
      nombreSallesBain,
      garage,
      sous_sol,
      etatGeneral,
      renobations,
      piscine,
      terrain_detail,
      notes_additionnelles
    } = req.body;

    // Validation
    if (!proprietyType || !ville || !prixAchat || !anneeAchat || !anneeConstruction) {
      return res.status(400).json({ 
        error: 'Paramètres obligatoires manquants',
        required: ['proprietyType', 'ville', 'prixAchat', 'anneeAchat', 'anneeConstruction']
      });
    }

    const now = new Date();
    const moisActuel = now.toLocaleString('fr-CA', { month: 'long' });
    const anneeActuelle = now.getFullYear();
    const ansAchatEcoules = anneeActuelle - anneeAchat;
    const ageConstruction = anneeActuelle - anneeConstruction;
    
    // Logique saisonnière
    let contexteSaisonnier = "Marché standard";
    if (['décembre', 'janvier', 'février'].includes(moisActuel)) {
        contexteSaisonnier = "Hiver (Inventaire bas, acheteurs sérieux uniquement)";
    } else if (['mars', 'avril', 'mai', 'juin'].includes(moisActuel)) {
        contexteSaisonnier = "Printemps (Saison de pointe, surenchère possible)";
    } else if (['juillet', 'août'].includes(moisActuel)) {
        contexteSaisonnier = "Été (Marché plus lent, vacances)";
    }

    console.log(`🏠 Évaluation V4 (Strict): ${proprietyType} à ${ville}, Saison: ${moisActuel}`);

    /**
     * PROMPT "ZERO-BIAS" & "NO-FICTION"
     */
    const valuationPrompt = `
Vous agissez en tant qu'évaluateur agréé (A.É.) senior membre de l'OEAQ.
Votre mandat est d'évaluer la "Valeur Marchande Réelle" d'une propriété.

CONTEXTE DE MARCHÉ:
- Date: ${moisActuel} ${anneeActuelle}
- Saison: ${contexteSaisonnier}
- Localisation: ${ville}, ${quartier || ''} ${codePostal ? `(Secteur CP: ${codePostal})` : ''}

CARACTÉRISTIQUES PHYSIQUES (BASE DE L'ÉVALUATION):
- Type: ${proprietyType}
- Adresse: ${addresseComplete || 'Non fournie'}
- Âge: Construit en ${anneeConstruction} (${ageConstruction} ans)
- Superficie: ${surfaceHabitee ? surfaceHabitee + ' pi² habitables' : 'Standard pour le type'}
- Terrain: ${surfaceLot ? surfaceLot + ' pi²' : 'Standard'} (${terrain_detail || ''})
- Configuration: ${nombreChambres || '?'} CC, ${nombreSallesBain || '?'} SDB
- Stationnement: ${garage > 0 ? `Garage ${garage} place(s)` : 'Extérieur seulement'}
- Sous-sol: ${sous_sol}
- État Global: ${etatGeneral.toUpperCase()}
- Rénovations: ${renobations && renobations.length > 0 ? renobations.join(', ') : 'Aucune rénovation majeure récente déclarée'}
- Facteurs: ${piscine ? 'Piscine' : 'Pas de piscine'}
- NOTES IMPORTANTES DU PROPRIÉTAIRE: "${notes_additionnelles || 'Aucune'}"

--- SÉPARATION STRICTE DES TÂCHES ---

TÂCHE 1: ÉVALUATION MARCHANDE (IGNOREZ LE PRIX D'ACHAT)
Basez-vous UNIQUEMENT sur les caractéristiques physiques ci-dessus et les données du marché (Centris/JLR).
ATTENTION: Ne regardez PAS le prix d'achat fourni plus bas pour cette étape. Les prix d'achats passés sont souvent biaisés (vente de succession, surenchère covid, vente rapide). Votre évaluation doit être indépendante.

TÂCHE 2: ANALYSE DE COMPARABLES
Trouvez un profil de comparable RÉEL vendu récemment.
INTERDICTION D'INVENTER UNE ADRESSE FICTIVE. Si vous n'avez pas l'adresse exacte d'un comparable vendu hier, décrivez le "Profil Type" vendu (ex: "Duplex standard secteur G1H, non rénové, vendu env. 450k$").

TÂCHE 3: CALCUL DE RENTABILITÉ (DONNÉES FINANCIÈRES)
Utilisez ces données UNIQUEMENT pour calculer le gain/perte, PAS pour influencer la valeur marchande:
- Acheté en: ${anneeAchat} (Il y a ${ansAchatEcoules} ans)
- Prix payé à l'époque: ${prixAchat}$

FORMAT JSON STRICT:
{
  "estimationActuelle": {
    "valeurBasse": [nombre],
    "valeurMoyenne": [nombre - Valeur marchande objective],
    "valeurHaute": [nombre],
    "confiance": "faible | moyenne | haute"
  },
  "analyse": {
    "appreciationTotale": [nombre $ (Moyenne - Prix Achat)],
    "appreciationAnnuelleMoyenne": [nombre $],
    "pourcentageGainTotal": [nombre sans %],
    "performanceMarche": "inférieure | égale | supérieure",
    "marketTrend": "vendeur | acheteur | équilibré",
    "analyseSecteur": "Analyse démographique et demande actuelle pour ${codePostal || ville}"
  },
  "facteursPrix": {
    "positifs": ["Liste points forts"],
    "negatifs": ["Liste points faibles"],
    "incertitudes": ["Données manquantes critiques (ex: toit, fenêtres)"]
  },
  "recommendations": {
    "renovationsRentables": ["Top 2 rénos payantes pour ce type de bien"],
    "strategieVente": "Conseil basé sur la saison ${moisActuel}"
  },
  "comparable": {
    "soldReference": "Description d'un profil de comparable vendu réel (Ex: 'Vente récente secteur X: Duplex similaire semi-rénové vendu 460k$'). NE PAS INVENTER D'ADRESSE.",
    "prixPiedCarreEstime": [nombre]
  }
}
`;

    // Température encore plus basse pour réduire la créativité (fiction)
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-5-20250929', 
      max_tokens: 3500,
      temperature: 0.1, 
      system: `Tu es un expert en évaluation immobilière (A.É.) au Québec. 
               Rigueur absolue. Pas d'hallucination.
               Si tu ne connais pas de vente spécifique récente, donne des statistiques de secteur agrégées plutôt que d'inventer une adresse.
               Tu es sceptique face au prix d'achat fourni : tu évalues la brique et le marché d'abord.`,
      messages: [{ role: 'user', content: valuationPrompt }]
    });

    const valuationResult = parseClaudeJSON(response.content[0].text);

    // --- Sauvegarde Firestore ---
    const evaluationRef = await db.collection('users').doc(userId).collection('evaluations').add({
      proprietyType,
      ville,
      quartier,
      codePostal: codePostal || null,
      addresseComplete,
      prixAchat,
      anneeAchat,
      anneeConstruction,
      result: valuationResult,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paidWith: req.quotaInfo.mode // Trace si payé par crédit ou sub
    });

    // ✅ DÉDUIRE LE CRÉDIT OU LE QUOTA
    await deductUsage(userId, req.quotaInfo);

    res.json({
      id: evaluationRef.id,
      ...valuationResult,
      meta: { paidWith: req.quotaInfo.mode }
    });

  } catch (error) {
    console.error('❌ Erreur Valuation:', error);
    res.status(500).json({ 
      error: "Échec de l'évaluation",
      details: error.message 
    });
  }
});

// ====================================================================
// 🏢 ENDPOINT : VALUATION COMMERCIALE (COMPLEXE)
// ====================================================================
app.post('/api/property/valuation-estimator-commercial', checkQuotaOrCredits, async (req, res) => {
  try {
    const {
      userId,
      proprietyType, // 'depanneur', 'immeuble_revenus', 'hotel', etc.
      typeCom, // Alternative name for proprietyType
      ville,
      quartier = '',
      addresseComplete = '',
      prixAchat,
      anneeAchat,
      anneeConstruction,
      surfaceTotale = 0,
      surfaceLocable = 0,
      
      // POUR IMMEUBLE À REVENUS
      nombreUnites,
      tauxOccupation,
      loyerMoyenParUnite,
      revenus_bruts_annuels,
      revenuBrutAnnuel, // Alternative name
      depenses_annuelles,
      depensesAnnuelles, // Alternative name
      
      // POUR HÔTEL
      nombreChambres,
      tauxOccupationHotel,
      tariffMoyenParNuit,
      
      // POUR COMMERCE GÉNÉRIQUE
      clienteleActive = 'stable',
      
      // GÉNÉRAL COMMERCIAL
      etatGeneral = 'bon',
      renovations = [],
      accessibilite = 'moyenne',
      parking = 0,
      terrain_detail = '',
      notes_additionnelles = ''
    } = req.body;

    // ✅ NORMALISATION - Gérer les deux noms de variables
    const finalProprieTyType = proprietyType || typeCom;
    const finalRevenusAnnuels = revenus_bruts_annuels || revenuBrutAnnuel;
    const finalDepenses = depenses_annuelles || depensesAnnuelles;

    // ✅ VALIDATIONS OBLIGATOIRES
    if (!finalProprieTyType || !ville || !prixAchat || !anneeAchat || !anneeConstruction) {
      return res.status(400).json({
        error: 'Paramètres obligatoires manquants',
        required: ['proprietyType', 'ville', 'prixAchat', 'anneeAchat', 'anneeConstruction'],
        received: { proprietyType, ville, prixAchat, anneeAchat, anneeConstruction }
      });
    }

    // ✅ VALIDATIONS SUPPLÉMENTAIRES SELON TYPE
    if (finalProprieTyType === 'immeuble_revenus') {
      if (!nombreUnites || !finalRevenusAnnuels || !finalDepenses) {
        return res.status(400).json({
          error: 'Données manquantes pour immeuble à revenus',
          required: ['nombreUnites', 'revenus_bruts_annuels (ou revenuBrutAnnuel)', 'depenses_annuelles (ou depensesAnnuelles)'],
          received: { nombreUnites, revenuBrutAnnuel, depensesAnnuelles, revenus_bruts_annuels, depenses_annuelles }
        });
      }
    }

    if (finalProprieTyType === 'hotel') {
      if (!nombreChambres || !tauxOccupationHotel || !tariffMoyenParNuit) {
        return res.status(400).json({
          error: 'Données manquantes pour hôtel',
          required: ['nombreChambres', 'tauxOccupationHotel', 'tariffMoyenParNuit'],
          received: { nombreChambres, tauxOccupationHotel, tariffMoyenParNuit }
        });
      }
    }

    if (['depanneur', 'restaurant', 'commerce'].includes(finalProprieTyType)) {
      if (!finalRevenusAnnuels || !finalDepenses) {
        return res.status(400).json({
          error: `Données manquantes pour ${finalProprieTyType}`,
          required: ['revenuBrutAnnuel', 'depensesAnnuelles'],
          received: { revenuBrutAnnuel, depensesAnnuelles }
        });
      }
    }

    console.log(`🏪 Évaluation Commerciale: ${finalProprieTyType} à ${ville}`);

    const anneeActuelle = new Date().getFullYear();
    const ansAchatEcoules = anneeActuelle - anneeAchat;
    const ageConstruction = anneeActuelle - anneeConstruction;

    // ============================================
    // CONSTRUCTION DU PROMPT SPÉCIFIQUE
    // ============================================

    let promptSpecifique = '';

    if (finalProprieTyType === 'immeuble_revenus') {
      const noi = finalRevenusAnnuels - finalDepenses;
      const ratioDepenses = (finalDepenses / finalRevenusAnnuels * 100).toFixed(1);
      
      promptSpecifique = `
DONNÉES FINANCIÈRES IMMEUBLE À REVENUS:
- Nombre d'unités: ${nombreUnites}
- Taux d'occupation: ${tauxOccupation}%
- Loyer moyen: $${loyerMoyenParUnite}/mois
- Revenus bruts annuels: $${finalRevenusAnnuels?.toLocaleString('fr-CA')}
- Dépenses annuelles: $${finalDepenses?.toLocaleString('fr-CA')}
- NOI annuel: $${noi?.toLocaleString('fr-CA')}
- Ratio dépenses: ${ratioDepenses}%
- Prix d'achat: $${prixAchat?.toLocaleString('fr-CA')}

ANALYSE:
1. Cap Rate = NOI / Prix d'achat = ${noi} / ${prixAchat} = ${((noi / prixAchat) * 100).toFixed(2)}%
2. Évaluer potentiel augmentation loyers (+5% = +$${Math.round(finalRevenusAnnuels * 0.05)}/an)
3. Identifier opportunités occupation (+ 1% occupation = +$${Math.round((finalRevenusAnnuels / 100))}/an)
4. Évaluer dépenses réelles vs marché
5. Projeter valeur dans 5-10 ans
`;
    }

    if (finalProprieTyType === 'hotel') {
      const revenuBrutHotel = nombreChambres * 365 * tauxOccupationHotel / 100 * tariffMoyenParNuit;
      const nuitees = Math.round(nombreChambres * 365 * tauxOccupationHotel / 100);
      const revpar = Math.round((revenuBrutHotel / (nombreChambres * 365)) * 100) / 100;
      
      promptSpecifique = `
DONNÉES FINANCIÈRES HÔTEL:
- Chambres: ${nombreChambres}
- Taux occupation: ${tauxOccupationHotel}%
- Tarif moyen/nuit: $${tariffMoyenParNuit}
- Revenu annuel estimé: $${Math.round(revenuBrutHotel)?.toLocaleString('fr-CA')}
- Nuitées annuelles: ${nuitees?.toLocaleString('fr-CA')}
- RevPAR: $${revpar}

ANALYSE:
1. Comparer RevPAR $${revpar} vs marché québécois (~$100-150 haut de gamme)
2. Évaluer saison: améliorer taux ${tauxOccupationHotel}% → 75%+ = +$${Math.round(revenuBrutHotel * 0.25)}/an
3. Analyser coûts exploitation (main-d'œuvre, énergie, etc.)
4. Identifier améliorations tarifaires ou packages
`;
    }

    if (['depanneur', 'restaurant', 'commerce'].includes(finalProprieTyType) && finalRevenusAnnuels) {
      const revenuNet = finalRevenusAnnuels - finalDepenses;
      const margeNette = ((revenuNet / finalRevenusAnnuels) * 100).toFixed(1);
      
      promptSpecifique = `
DONNÉES FINANCIÈRES COMMERCE:
- Type: ${finalProprieTyType}
- Revenu brut annuel: $${finalRevenusAnnuels?.toLocaleString('fr-CA')}
- Dépenses annuelles: $${finalDepenses?.toLocaleString('fr-CA')}
- Revenu net: $${revenuNet?.toLocaleString('fr-CA')}
- Marge nette: ${margeNette}%
- Santé clientèle: ${clienteleActive}

ANALYSE:
1. Évaluer stabilité revenus (croissance historique?)
2. Analyser marges: ${margeNette}% - benchmark industrie 10-20%
3. Identifier risques continuité clientèle (${clienteleActive})
4. Évaluer impact économique local
5. Estimer potentiel croissance vs marché
`;
    }

    // ============================================
    // PROMPT PRINCIPAL
    // ============================================

    const valuationPrompt = `
Vous êtes un évaluateur immobilier expert du marché québécois spécialisé en propriétés commerciales.
Estimez la valeur marchande actuelle basée sur les approches par le revenu et les comparables.

INFORMATIONS GÉNÉRALES:
- Type: ${finalProprieTyType}
- Localisation: ${ville}${quartier ? `, ${quartier}` : ''}
- Adresse: ${addresseComplete || 'Non spécifiée'}
- Surface totale: ${surfaceTotale || '?'} pi²
- Surface locable: ${surfaceLocable || '?'} pi²
- Prix d'achat: $${prixAchat?.toLocaleString('fr-CA')}
- Année d'achat: ${anneeAchat} (il y a ${ansAchatEcoules} ans)
- Année construction: ${anneeConstruction} (${ageConstruction} ans)
- État: ${etatGeneral}
- Rénovations: ${renovations && renovations.length > 0 ? renovations.join(', ') : 'Aucune'}
- Parking: ${parking || '?'} places
- Accessibilité: ${accessibilite || 'Non spécifiée'}

${promptSpecifique}

TÂCHES:
1. Analyser rentabilité actuelle et potentiel futur
2. Calculer métriques clés (Cap Rate, NOI, Cash-on-Cash, RevPAR si applicable)
3. Évaluer le marché commercial local de ${ville}
4. Identifier risques et opportunités spécifiques
5. Fournir valeur marchande réaliste ET fourchette (basse/haute)
6. Recommander stratégies d'optimisation

REPONSE EN JSON STRICT (pas de texte avant/après):
{
  "estimationActuelle": {
    "valeurBasse": [nombre $],
    "valeurMoyenne": [nombre $],
    "valeurHaute": [nombre $]
  },
  "metriquesCommerciales": {
    "capRate": [nombre % ou null],
    "noiAnnuel": [nombre $ ou null],
    "cashOnCash": [nombre % ou null],
    "revenuParSurfaceLocable": [nombre $/pi² ou null],
    "multiplicateurRevenu": [nombre ou null],
    "revpar": [nombre $ ou null]
  },
  "analyse": {
    "appreciationTotale": [nombre $],
    "appreciationAnnuelle": [nombre $],
    "pourcentageGain": [nombre %],
    "marketTrend": "haussier | baissier | stable",
    "rentabiliteActuelle": "très rentable | rentable | acceptable | faible",
    "risques": ["risque1", "risque2"],
    "opportunities": ["opportunité1", "opportunité2"],
    "secteurAnalysis": "description analyse secteur"
  },
  "facteurs_prix": {
    "augmentent": ["facteur1", "facteur2"],
    "diminuent": ["facteur1", "facteur2"],
    "neutre": ["facteur1"]
  },
  "recommendations": {
    "ameliorationsValeur": ["amélioration1"],
    "optimisationRevenu": ["stratégie1"],
    "reduceExpenses": ["réduction1"],
    "strategie": "description stratégie complète",
    "timing": "recommandation timing"
  },
  "comparable": {
    "proprietesCommerciales": [nombre],
    "prix_moyen": [nombre $/pi²],
    "prix_min": [nombre $/pi²],
    "prix_max": [nombre $/pi²],
    "evaluation_qualite": "description qualité"
  }
}
`;

    // ============================================
    // APPEL CLAUDE
    // ============================================

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      temperature: 0.3,
      system: `Vous êtes un évaluateur immobilier expert québécois avec 15+ ans d'expérience en commercial.
               Vous êtes spécialisé en Cap Rates, NOI, Cash-on-Cash, RevPAR et métriques commerciales.
               Répondez TOUJOURS avec du JSON valide, complet et bien structuré.
               Jamais de texte avant ou après le JSON.
               Si un champ ne s'applique pas, mettez null.`,
      messages: [{ role: 'user', content: valuationPrompt }]
    });

    const valuationResult = parseClaudeJSON(response.content[0].text);

    // ============================================
    // SAUVEGARDE FIRESTORE
    // ============================================

    const evaluationRef = await db.collection('users').doc(userId).collection('evaluations_commerciales').add({
      proprietyType: finalProprieTyType,
      ville,
      quartier,
      addresseComplete,
      prixAchat,
      anneeAchat,
      anneeConstruction,
      surfaceTotale,
      surfaceLocable,
      etatGeneral,
      renovations,
      accessibilite,
      parking,
      terrain_detail,
      notes_additionnelles,
      
      // Données spécifiques selon type
      ...(finalProprieTyType === 'immeuble_revenus' && {
        nombreUnites,
        tauxOccupation,
        loyerMoyenParUnite,
        revenus_bruts_annuels: finalRevenusAnnuels,
        depenses_annuelles: finalDepenses
      }),
      
      ...(finalProprieTyType === 'hotel' && {
        nombreChambres,
        tauxOccupationHotel,
        tariffMoyenParNuit
      }),
      
      ...(finalProprieTyType === 'commerce' && {
        revenus_bruts_annuels: finalRevenusAnnuels,
        depenses_annuelles: finalDepenses,
        clienteleActive
      }),
      
      // Résultats
      result: valuationResult,
      evaluationType: 'commercial',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paidWith: req.quotaInfo.mode // Trace si payé par crédit ou sub
    });

    // ✅ DÉDUIRE LE CRÉDIT OU LE QUOTA
    await deductUsage(userId, req.quotaInfo);

    console.log(`✅ Évaluation commerciale créée: ${evaluationRef.id}`);

    res.json({
      id: evaluationRef.id,
      ...valuationResult,
      meta: { paidWith: req.quotaInfo.mode }
    });

  } catch (error) {
    console.error('❌ Erreur Valuation Commerciale:', error);
    res.status(500).json({
      error: "Échec de l'évaluation commerciale",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


// ====================================================================
// ℹ️ GET QUOTA INFO (MIS À JOUR AVEC CRÉDITS)
// ====================================================================

app.get('/api/property/quota/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

    const userData = userDoc.data();
    const userPlan = userData?.plan || 'essai';
    const creditsBalance = userData?.creditsBalance || 0; // ✅ Récupération des crédits

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const quotaTracking = userData?.quotaTracking || { month: null, count: 0 };
    
    let monthlyCount = 0;

    if (quotaTracking.month !== currentMonth) {
      monthlyCount = 0;
      await db.collection('users').doc(userId).update({
        quotaTracking: { month: currentMonth, count: 0, resetAt: new Date() }
      }, { merge: true });
    } else {
      monthlyCount = quotaTracking.count || 0;
    }

    const limit = PLAN_LIMITS[userPlan] || 1;
    const remainingMonthly = Math.max(0, limit - monthlyCount);
    const isUnlimited = userPlan === 'growth' || userPlan === 'entreprise';

    res.json({
      remaining: isUnlimited ? 999 : remainingMonthly,
      credits: creditsBalance, // ✅ Ajouté à la réponse
      limit,
      current: monthlyCount,
      plan: userPlan,
      resetDate: monthEnd.toISOString(),
      isUnlimited,
      canGenerate: isUnlimited || remainingMonthly > 0 || creditsBalance > 0 // ✅ Flag utile pour le front
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ====================================================================
// 📊 GET : RÉCUPÉRER LES ÉVALUATIONS SAUVEGARDÉES
// ====================================================================

app.get('/api/property/evaluations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('evaluations')
      .orderBy('createdAt', 'desc')
      .get();

    const evaluations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(evaluations);
  } catch (error) {
    console.error('❌ Erreur GET evaluations:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// 🗑️ DELETE : SUPPRIMER UNE ÉVALUATION
// ====================================================================

app.delete('/api/property/evaluations/:userId/:evaluationId', async (req, res) => {
  try {
    const { userId, evaluationId } = req.params;
    
    await db
      .collection('users')
      .doc(userId)
      .collection('evaluations')
      .doc(evaluationId)
      .delete();

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur DELETE evaluation:', error);
    res.status(500).json({ error: error.message });
  }
});


// ====================================================================
// 🛠️ HELPER : PARSEUR JSON ROBUSTE
// ====================================================================

function parseClaudeJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw e;
  }
}


// ====================================================================
// 🚀 DÉMARRAGE
// ====================================================================

const PORT = process.env.PORT || 5001;
const path = require('path');

app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

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
  console.log(`🚀 SERVER OPTIMIPLEX LIVE (Port ${PORT}) - System Credits Actif`);
});