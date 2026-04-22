require('dotenv').config();

const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'ANTHROPIC_API_KEY',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

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
const sgMail = require('@sendgrid/mail');
// Configure la clé API (Assure-toi d'ajouter SENDGRID_API_KEY dans ton fichier .env)
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
  'pro': 30,      // 30/mois
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

const AGENT_ID = "agent_011Ca2d3uqW4zba9WzXBCRkA";
const ENVIRONMENT_ID = "env_01UiWPrYorVekqe94veDT5Dd";

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
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId manquant' });
    }

    // 1. Récupérer l'utilisateur dans Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const userData = userDoc.data();
    
    // 2. Vérifier s'il a bien un stripeCustomerId
    if (!userData.stripeCustomerId) {
       return res.status(400).json({ error: 'Aucun client Stripe associé à cet utilisateur.' });
    }

    // 3. Créer la session de portail
    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/`, // Où revenir après avoir géré l'abonnement
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error('Erreur lors de la création du portail Stripe:', error);
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

// PROMPT SYSTÈME CHATBOT IMMOBILIER QUÉBEC
// ====================================================================
// 🏠 ENDPOINT : OPTIMISATEUR RÉSIDENTIEL
// ====================================================================

app.post('/api/pricing/optimizer-pro', checkQuotaOrCredits, async (req, res) => {
  try {
    const { 
      userId,
      proprietetype,
      ville,
      quartier,
      typeappart,
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

    // Mapping des étiquettes d'appartements
    const appartmentLabels = {
      '112': '1 1/2 (Studio)',
      '312': '3 1/2 (2 chambres)',
      '412': '4 1/2 (3 chambres)',
      '512': '5 1/2 (4+ chambres)'
    };

    const typeappartLabel = appartmentLabels[typeappart] || typeappart;
    
    // Construction de la liste des extras pour le prompt
    const extrasList = [
      meuble ? 'Entièrement meublé' : null,
      balcon ? 'Balcon privé' : null,
      garage ? 'Garage intérieur' : null,
      climatise ? 'Climatisation' : null,
      gym ? 'Accès Gym' : null,
      piscine ? 'Piscine' : null,
      stationnement ? 'Stationnement inclus' : null,
    ].filter(Boolean).join(', ');

    console.log(`🏠 Analyse Résidentielle demandée pour: ${ville} (${typeappartLabel})`);

    // 1. Définition de l'outil de recherche (activé pour tous car service payé par crédit)
    const tools = [
      {
        name: "web_search",
        description: "Recherche en temps réel les loyers comparables sur Centris, Zumper, Louer.ca et Kijiji pour une ville et un quartier précis au Québec.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "La requête de recherche (ex: 'loyer moyen 4 1/2 Plateau Mont-Royal 2025')" }
          },
          required: ["query"]
        }
      }
    ];

    const systemPrompt = `
      ${getSystemPrompt('residential')}
      
      INSTRUCTIONS SUPPLÉMENTAIRES :
      - Tu AS accès à Internet via l'outil 'web_search'.
      - Utilise-le systématiquement pour trouver des comparables réels à ${ville} dans le secteur ${quartier || 'global'}.
      - Analyse spécifiquement les données de Centris et des sites d'annonces locaux.
      - Ton objectif est de déterminer si le loyer de $${loyeractuel} est sous le marché ou optimal.
    `;

    const userPrompt = `
      ANALYSE CIBLE :
      - Type : ${typeappartLabel}
      - Ville : ${ville}
      - Quartier : ${quartier || 'Non spécifié'}
      - Loyer Actuel : $${loyeractuel}/mois
      - État du bien : ${etat || 'Standard'}
      - Extras inclus : ${extrasList || 'Standard'}

      RECHERCHE : Trouve les comparables actuels pour ce type de bien dans ce secteur précis pour justifier ton analyse.
    `;

    const messages = [{ role: 'user', content: userPrompt }];

    // 2. Premier appel à Claude avec les outils
    let response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      temperature: 0.1, // Basse température pour plus de précision sur les outils
      system: systemPrompt,
      tools: tools,
      messages: messages
    });

    // 3. Gestion du cycle Tool Use (Recherche Internet)
    let iterations = 0;
    const maxIterations = 3;

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;
      const toolResults = [];
      const toolCalls = response.content.filter(c => c.type === 'tool_use');

      for (const toolCall of toolCalls) {
        if (toolCall.name === 'web_search') {
          const query = toolCall.input.query;
          console.log(`🔍 Optimizer Pro recherche [Itération ${iterations}]: ${query}`);

          let searchDataStr = "Aucun résultat trouvé.";
          try {
            const searchResponse = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: { 
                "X-API-KEY": process.env.SERPER_API_KEY || "", 
                "Content-Type": "application/json" 
              },
              body: JSON.stringify({ q: query, gl: "ca", hl: "fr" })
            });
            const data = await searchResponse.json();
            
            // Formatage des résultats pour Claude
            const formattedResults = data.organic?.slice(0, 5).map(r => 
              `Titre: ${r.title}\nLien: ${r.link}\nDescription: ${r.snippet}`
            ).join('\n\n');
            
            searchDataStr = formattedResults || "Pas de résultats pertinents trouvés.";
          } catch (e) {
            console.error("Erreur Serper API:", e);
            searchDataStr = "Erreur technique lors de la recherche en direct.";
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: searchDataStr
          });
        }
      }

      // On ajoute l'appel assistant et les résultats au fil des messages
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      // Appel suivant (on continue de passer tools pour permettre à Claude de rebondir)
      response = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: systemPrompt,
        tools: tools,
        messages: messages
      });
    }

    // 4. Sécurité finale : Si on s'arrête sur un tool_use (limite atteinte), on force la synthèse
    if (response.stop_reason === 'tool_use') {
      console.log("⚠️ Limite d'itérations Optimizer Pro atteinte.");
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ 
        role: 'user', 
        content: "Synthétise maintenant ton analyse finale basée sur ces recherches sans faire de nouvelle recherche." 
      });
      
      response = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: systemPrompt,
        messages: messages
      });
    }

    // 5. Analyse finale et parsing JSON
    const finalContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    if (!finalContent || finalContent.trim() === "") {
      throw new Error("Claude n'a pas retourné de contenu textuel exploitable.");
    }

    const jsonResponse = parseClaudeJSON(finalContent);

    // 6. Déduction des crédits/usage
    await deductUsage(userId, req.quotaInfo);

    // Métadonnées pour le frontend
    jsonResponse.meta = { 
      paidWith: req.quotaInfo.mode,
      searchUsed: iterations > 0 
    };

    res.json(jsonResponse);

  } catch (error) {
    console.error('❌ Erreur Optimizer Pro:', error);
    res.status(500).json({ error: "Échec de l'analyse immobilière", details: error.message });
  }
});

// ====================================================================
// 🏢 ENDPOINT : OPTIMISATEUR COMMERCIAL
// ====================================================================

app.post('/api/pricing/commercial-optimizer', checkQuotaOrCredits, async (req, res) => {
  try {
    const {
      userId,
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

    // Mapping des types commerciaux
    const commercialLabels = {
      'office': 'Bureau',
      'warehouse': 'Entrepôt',
      'retail': 'Espace Commercial (Retail)'
    };

    const typecommercialLabel = commercialLabels[typecommercial] || typecommercial;

    // Construction de la liste des atouts
    const extrasList = [
      parking ? 'Stationnement inclus' : null,
      ascenseur ? 'Ascenseur' : null,
      acceshandicape ? 'Accès universel' : null,
      amenages ? 'Déjà aménagé' : null
    ].filter(Boolean).join(', ');

    console.log(`🏢 Analyse Commerciale demandée : ${ville} - ${typecommercialLabel}`);

    // 1. Définition de l'outil de recherche (Scraping LoopNet, Centris, JLR)
    const tools = [
      {
        name: "web_search",
        description: "Recherche en temps réel les loyers commerciaux (prix au pi²) sur LoopNet, Centris, Spacelist et les sites de courtiers commerciaux pour une ville et un quartier précis au Québec.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "La requête de recherche (ex: 'loyer bureau pi2 Montréal Saint-Laurent 2025')" }
          },
          required: ["query"]
        }
      }
    ];

    const systemPrompt = `
      ${getSystemPrompt('commercial')}
      
      INSTRUCTIONS SUPPLÉMENTAIRES SUR L'ACCÈS WEB :
      - Tu AS accès à Internet via l'outil 'web_search'.
      - Utilise-le pour valider les prix au pied carré à ${ville} pour un ${typecommercialLabel}.
      - Analyse spécifiquement les données de LoopNet, Centris Commercial et Spacelist.
      - Ton objectif est de déterminer le loyer optimal au pied carré (net ou brut) et les incitatifs (TIA, mois gratuits).
      - Réponds uniquement avec un JSON valide et complet.
    `;

    const userPrompt = `
      CONTEXTE DU BIEN :
      - Type : ${typecommercialLabel}
      - Localisation : ${ville}${quartier ? `, ${quartier}` : ''}
      - Surface : ${surfacepiedcarre} pi²
      - Loyer actuel : $${prixactuelpiedcarre}/pi²/an
      - Visibilité : ${visibilite}
      - Terme bail : ${termebailans} ans
      - Atouts : ${extrasList || 'Standard'}

      RECHERCHE : Trouve les comparables de loyer au pi² pour ce type de bien dans ce secteur précis.
    `;

    const messages = [{ role: 'user', content: userPrompt }];

    // 2. Premier appel à Claude avec détection d'outils
    let response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      temperature: 0.1,
      system: systemPrompt,
      tools: tools,
      messages: messages
    });

    // 3. Boucle de gestion des outils (Recherche itérative)
    let iterations = 0;
    const maxIterations = 3;

    // On boucle tant que Claude demande des outils ET qu'on n'a pas dépassé la limite
    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;
      const toolResults = [];
      const toolCalls = response.content.filter(c => c.type === 'tool_use');

      for (const toolCall of toolCalls) {
        let searchDataStr = "Outil non supporté ou erreur.";
        
        if (toolCall.name === 'web_search') {
          const query = toolCall.input.query;
          console.log(`🔍 Commercial Optimizer recherche [Itération ${iterations}]: ${query}`);

          try {
            const searchResponse = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: { 
                "X-API-KEY": process.env.SERPER_API_KEY || "", 
                "Content-Type": "application/json" 
              },
              body: JSON.stringify({ q: query, gl: "ca", hl: "fr" })
            });
            const data = await searchResponse.json();
            
            const results = data.organic?.slice(0, 5).map(r => 
              `Titre: ${r.title}\nLien: ${r.link}\nDescription: ${r.snippet}`
            ).join('\n\n');
            
            searchDataStr = results || "Pas de résultats pertinents.";
          } catch (e) {
            console.error("Erreur Serper Commercial:", e);
            searchDataStr = "Erreur technique de recherche.";
          }
        }

        // On ajoute obligatoirement un tool_result pour CHAQUE tool_use_id trouvé
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: searchDataStr
        });
      }

      // Important: On pousse la réponse de l'assistant (qui contient tool_use)
      messages.push({ role: 'assistant', content: response.content });
      
      // Si c'est la dernière itération, on ajoute une instruction textuelle dans le même message que les résultats
      if (iterations >= maxIterations) {
        toolResults.push({
          type: 'text',
          text: "Ceci est la dernière recherche autorisée. Analyse maintenant les informations et fournis ton rapport final en format JSON uniquement."
        });
      }

      // On pousse le message de l'utilisateur (qui contient les tool_results)
      messages.push({ role: 'user', content: toolResults });

      // On relance l'appel
      response = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        system: systemPrompt,
        tools: iterations < maxIterations ? tools : undefined, // On retire les outils sur le dernier appel pour forcer la fin
        messages: messages
      });
    }

    // 4. Extraction du texte final et parsing JSON
    const finalContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    if (!finalContent || finalContent.trim() === "") {
      // Si Claude s'arrête encore sur tool_use (cas rare après retrait des tools), on fait un ultime appel de secours
      if (response.stop_reason === 'tool_use') {
         throw new Error("L'IA tente encore d'utiliser des outils après la limite. Vérifiez la configuration.");
      }
      throw new Error("Contenu AI vide après analyse commerciale.");
    }

    const jsonResponse = parseClaudeJSON(finalContent);

    // 5. Déduction des crédits
    await deductUsage(userId, req.quotaInfo);

    jsonResponse.meta = { 
      paidWith: req.quotaInfo.mode,
      searchUsed: iterations > 0 
    };

    res.json(jsonResponse);

  } catch (error) {
    console.error('❌ Erreur Commercial Optimizer:', error);
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
      userType = 'vendeur',
      proprietyType,
      addresseComplete,
      ville,
      quartier,
      codePostal,
      prixAchat,
      anneeAchat,
      prixAffichage,
      urlAnnonce,
      // NOUVEAUX CHAMPS DE REVENUS
      revenusAnnuels,
      depensesAnnuelles,
      anneeConstruction,
      surfaceHabitee,
      surfaceLot,
      nombreChambres,
      nombreSallesBain,
      garage,
      sous_sol,
      etatGeneral,
      renobations,
      toitureAnnee,
      fenetresAnnee,
      plomberieEtat,
      electriciteEtat,
      piscine,
      terrain_detail,
      notes_additionnelles
    } = req.body;

    if (!proprietyType || !ville || !anneeConstruction) {
      return res.status(400).json({
        error: 'Paramètres obligatoires manquants',
        required: ['proprietyType', 'ville', 'anneeConstruction']
      });
    }

    const now = new Date();
    const moisActuel = now.toLocaleString('fr-CA', { month: 'long' });
    const anneeActuelle = now.getFullYear();
    const ageConstruction = anneeActuelle - anneeConstruction;
    
    let contexteSaisonnier = "Marché standard";
    if (['décembre', 'janvier', 'février'].includes(moisActuel)) {
        contexteSaisonnier = "Hiver (Inventaire bas, acheteurs sérieux uniquement)";
    } else if (['mars', 'avril', 'mai', 'juin'].includes(moisActuel)) {
        contexteSaisonnier = "Printemps (Saison de pointe, surenchère possible)";
    } else if (['juillet', 'août'].includes(moisActuel)) {
        contexteSaisonnier = "Été (Marché plus lent, vacances)";
    }

    const isAcheteur = userType === 'acheteur';
    const isPlex = ['duplex', 'triplex', '4plex'].includes(proprietyType.toLowerCase());

    // Logique financière conditionnelle (Achat/Vente)
    let infoFinanciere = "";
    if (isAcheteur) {
        infoFinanciere = `
        DONNÉES DE PROSPECTION (L'utilisateur envisage d'acheter):
        - Prix affiché / demandé : ${prixAffichage ? prixAffichage + '$' : 'Non fourni'}
        - URL de l'annonce : ${urlAnnonce || 'Non fournie'}
        TA TÂCHE : Déterminer si ce prix est une aubaine, au prix du marché, ou trop cher en te basant sur la parité avec les comparables.
        `;
    } else {
        const aDesDonneesAchat = !!(prixAchat && anneeAchat);
        infoFinanciere = aDesDonneesAchat
            ? `HISTORIQUE D'ACHAT:\n- Prix d'achat en ${anneeAchat}: ${prixAchat}$`
            : `HISTORIQUE D'ACHAT:\n- Historique d'achat non fourni. Ne pas calculer d'appréciation historique.`;
    }

    // NOUVEAU: Logique de revenus conditionnelle (Pour les PLEX)
    if (isPlex) {
        infoFinanciere += `
        
        DONNÉES D'OPÉRATION (IMMEUBLE À REVENUS):
        - Revenus bruts annuels : ${revenusAnnuels ? revenusAnnuels + ' $' : 'Non spécifiés'}
        - Dépenses annuelles estimées : ${depensesAnnuelles ? depensesAnnuelles + ' $' : 'Non spécifiées'}
        *DIRECTIVE PLEX : Si les revenus sont fournis, utilise l'approche du revenu (TGA ou MRB) en combinaison avec le principe de parité des comparables.*`;
    }

    console.log(`\n========================================================`);
    console.log(`🏠 NOUVELLE ÉVALUATION (${userType.toUpperCase()}): ${proprietyType} à ${ville}`);
    console.log(`========================================================\n`);

    const tools = [
      {
        name: "web_search",
        description: "Recherche Google. S'utilise en TROIS TEMPS : 1) Trouver des pages de résultats globaux (ex: 'maisons à vendre Lévis Centris') pour extraire des numéros MLS/Centris. 2) Chercher ensuite ces numéros précis. 3) PLAN B (Fallback) : Chercher directement l'ADRESSE COMPLÈTE (ex: '123 rue Principale, Lévis') si le lien exact ou l'ID Centris est introuvable.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "La requête de recherche (ex 1: 'maisons Lévis Centris', ex 2: 'Centris 12345678', ex 3: '123 rue Principale Lévis')" }
          },
          required: ["query"]
        }
      },
      {
        name: "read_webpage",
        description: "Lit une page web. Si c'est une liste de résultats, extrais-en les numéros d'annonces (ID Centris, MLS). Si c'est une fiche individuelle ciblée, extrais toutes les caractéristiques de la propriété.",
        input_schema: {
          type: "object",
          properties: { url: { type: "string", description: "L'URL à lire" } },
          required: ["url"]
        }
      }
    ];

    const systemPrompt = `
      Tu es un expert en évaluation immobilière (A.É.) au Québec, membre de l'OEAQ, et un as du marketing immobilier.
      Tu AS accès à Internet via les outils 'web_search' et 'read_webpage'.
      
      RÈGLES STRICTES POUR LES COMPARABLES ET L'ÉVALUATION :
      1. 🚨 STRATÉGIE EN DEUX TEMPS (ENTONNOIR) + FALLBACK : 
         - ÉTAPE 1 (Scouting) : Fais une recherche générale pour trouver des listes de propriétés dans le secteur demandé et RÉCUPÈRE des numéros d'annonces (ID Centris, MLS) depuis les extraits Google ou la lecture de la page.
         - ÉTAPE 2 (Ciblage) : Fais de nouvelles recherches (web_search) EN UTILISANT CES NUMÉROS PRÉCIS (ex: "Centris 12345678") pour isoler et lire les fiches individuelles.
         - ÉTAPE 3 (Plan B / Adresse) : Si tu ne trouves pas de fiches avec l'ID, lance une recherche Google directement avec l'ADRESSE COMPLÈTE exacte de la propriété (la cible ou les comparables potentiels).
      2. 🚨 VALIDATION DES COMPARABLES : Tes comparables finaux dans le JSON DOIVENT provenir de fiches individuelles lues ou vérifiées, et non d'un vague résumé de liste.
      3. 🚨 RÈGLE D'OR DU PRIX (CRITIQUE - PARITÉ) : Ta source de VÉRITÉ ABSOLUE pour la "valeurMoyenne" est le marché. Tu DOIS utiliser le principe de parité/substitution : l'estimation est dictée par le prix exact auquel se vendent les propriétés comparables. IGNORE TOTALEMENT l'évaluation municipale.
      4. 🚨 JUSTIFICATION DE PARITÉ : Pour CHAQUE comparable, tu DOIS fournir un "ajustementParite". Explique brièvement la différence majeure avec la propriété cible (ex: "Vendu 450k$, mais possède un garage de plus, valeur cible ajustée à la baisse").
      5. 🚨 IMPACT DES RÉNOVATIONS MINIMISÉ : Les rénovations ont un impact MINEUR sur la valeur finale. Ne gonfle pas le prix estimé à cause des rénovations. Le poids du calcul doit reposer à 95% sur la valeur brute des comparables trouvés (parité).
      6. 🚨 FORMAT DU LIEN (CRITIQUE) : Pour tes comparables, la clé "url" DOIT contenir UNIQUEMENT une URL absolue valide et cliquable (ex: "https://www.centris.ca/..."). S'il n'y a pas de lien exact, retourne null. AUCUN texte autour du lien.
      7. RÔLE ACTUEL : L'utilisateur est en mode ${isAcheteur ? 'ACHETEUR (Prospection / Deal)' : 'VENDEUR (Évaluation / Mise en vente)'}.
      ${isAcheteur ? `
      7. DIRECTIVE PROSPECTION (TRÈS IMPORTANT) : Compare AGRESSIVEMENT le "Prix demandé" à ta "valeurMoyenne".
         - Si la valeur marchande est beaucoup plus élevée que le prix demandé, c'est un deal !
         - Génère OBLIGATOIREMENT la clé JSON "potentielOptimisation" pour donner ton verdict franc et direct.
      ` : `
      7. DIRECTIVE VENDEUR (TRÈS IMPORTANT) : Concentre-toi sur la meilleure stratégie pour vendre vite et cher.
         - Génère OBLIGATOIREMENT la clé JSON "marketingKit" contenant une description professionnelle prête à être publiée sur DuProprio/Centris.
         - Rédige un texte vendeur, détaillé, qui met en valeur les atouts (rénovations, localisation, revenus si applicable).
         - Utilise ta propre "valeurMoyenne" calculée comme "prixAfficheSuggere".
      `}
      8. Réponds UNIQUEMENT avec un JSON valide, SANS balise markdown (comme \`\`\`json) et SANS texte explicatif avant ou après.
      9. ⚠️ RÈGLE SYNTAXE JSON (CRITIQUE) : Échappe correctement tous les guillemets (\\") dans les textes. Assure-toi d'inclure obligatoirement une virgule (,) entre CHAQUE objet ou chaîne de tes tableaux (ex: dans "comparables", "positifs", "renovationsRentables"). Ne mets PAS de virgule finale après le dernier élément d'un tableau ou d'un objet.
      10. ⚠️ CONCISION (CRITIQUE) : Sois extrêmement concis dans tes descriptions (max 3 ou 4 phrases) pour éviter que ta réponse ne soit tronquée en atteignant la limite de tokens.
    `;

    const jsonRoleSpecific = isAcheteur
        ? `"potentielOptimisation": { "valeurApresTravaux": 0, "margeSecurite": "Pourcentage ou montant de marge", "avisProspection": "Excellent deal / Prix de marché / Surévalué. Explique brièvement pourquoi." },`
        : `"marketingKit": { "titreAnnonce": "Titre très accrocheur pour l'annonce (ex: Superbe propriété de prestige...)", "prixAfficheSuggere": 0, "descriptionDuProprio": "Texte complet et très vendeur pour une annonce immobilière. Inclus localisation, caractéristiques, rénovations, proximité des services. Format paragraphe bien structuré." },`;

    const valuationPrompt = `
      CONTEXTE DE MARCHÉ:
      - Date: ${moisActuel} ${anneeActuelle} (${contexteSaisonnier})
      - Localisation: ${ville}, ${quartier || ''} ${codePostal ? `(Secteur CP: ${codePostal})` : ''}

      CARACTÉRISTIQUES DU BIEN:
      - Type: ${proprietyType}
      - Adresse: ${addresseComplete || 'Non fournie'}
      - Âge: ${anneeConstruction} (${ageConstruction} ans)
      - Superficie: ${surfaceHabitee ? surfaceHabitee + ' pi² habitables' : 'Standard'}
      - Terrain: ${surfaceLot ? surfaceLot + ' pi²' : 'Standard'} (${terrain_detail || ''})
      - Configuration: ${nombreChambres || '?'} CC, ${nombreSallesBain || '?'} SDB
      - Garage: ${garage > 0 ? garage : '0'} | Sous-sol: ${sous_sol}
      - Piscine: ${piscine ? 'Oui' : 'Non'}

      ÉTAT ET COMPOSANTES (RAPPEL: Impact mineur sur la valorisation finale):
      - État Général: ${etatGeneral.toUpperCase()}
      - Toiture: ${toitureAnnee ? 'Année ' + toitureAnnee : 'Inconnu'}
      - Fenêtres: ${fenetresAnnee ? 'Année ' + fenetresAnnee : 'Inconnu'}
      - Plomberie: ${plomberieEtat || 'Inconnu'} | Électricité: ${electriciteEtat || 'Inconnu'}
      - Rénovations / Notes: ${notes_additionnelles || renobations?.join(', ') || 'Aucune'}

      ${infoFinanciere}

      RECHERCHE (2 ÉTAPES + PLAN B) : 
      1. Cherche d'abord à récupérer des numéros d'ID Centris/MLS pour ce secteur.
      2. Utilise ensuite ces numéros pour ouvrir les fiches individuelles et construire tes comparables.
      3. PLAN B : En cas d'échec avec les ID, recherche directement les adresses exactes des propriétés sur Google.
      ⚠️ OBLIGATOIRE : Tu DOIS utiliser l'outil 'web_search' avant de générer ton JSON.

      CALCUL (PRINCIPE DE PARITÉ) : Une fois les comparables trouvés, calcule "valeurBasse", "valeurMoyenne" et "valeurHaute" EN TE BASANT STRICTEMENT sur la valeur de ces comparables bruts. Les rénovations mentionnées ci-haut ont un impact mineur et ne doivent faire varier le prix que de façon très marginale.

      FORMAT JSON ATTENDU:
      {
        "estimationActuelle": { "valeurBasse": 0, "valeurMoyenne": 0, "valeurHaute": 0, "confiance": "haute" },
        "analyse": { 
            "appreciationTotale": ${isAcheteur ? 'null' : (prixAchat ? '0' : 'null')}, 
            "pourcentageGainTotal": ${isAcheteur ? 'null' : (prixAchat ? '0' : 'null')}, 
            "marketTrend": "vendeur", 
            "analyseSecteur": "Paragraphe d'analyse du marché local. Mentionne l'utilisation du principe de parité avec les comparables.",
            "analyseRentabilite": ${isPlex ? '"Texte analysant le MRB et le TGA estimé par rapport aux revenus fournis."' : 'null'}
        },
        ${jsonRoleSpecific}
        "facteursPrix": { "positifs": [], "negatifs": [], "incertitudes": [] },
        "recommendations": { "renovationsRentables": [], "strategieVente": "" },
        "comparables": [
          { 
            "adresse": "...", 
            "statut": "vendu ou actif", 
            "prix": 0, 
            "date": "...", 
            "caracteristiques": "...", 
            "url": "https://lien-valide-ou-null.com",
            "ajustementParite": "Brève justification de l'ajustement (ex: 'Vendu 400k$, mais possède une chambre supplémentaire, donc la cible est estimée légèrement plus bas.')"
          }
        ]
      }
    `;

    const messages = [{ role: 'user', content: valuationPrompt }];

    console.log("🤖 [IA] Appel initial à Claude envoyé...");
    
    let response = await claude.messages.create({
      model: 'claude-sonnet-4-6', // Ou claude-3-5-sonnet-20241022
      max_tokens: 4000,
      temperature: 0,
      system: systemPrompt,
      tools: tools,
      messages: messages
    });

    let iterations = 0;
    const maxIterations = 5; // AUGMENTÉ À 5 POUR LA STRATÉGIE EN DEUX TEMPS

    console.log(`🤖 [IA] Raison du premier arrêt : ${response.stop_reason}`);

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;
      console.log(`\n🔄 [ITÉRATION ${iterations}/${maxIterations}] L'IA utilise ses outils (Résidentiel)...`);
      
      const toolCalls = response.content.filter(c => c.type === 'tool_use');
      console.log(`   🛠️ L'IA demande à utiliser ${toolCalls.length} outil(s).`);

      const toolResults = await Promise.all(toolCalls.map(async (toolCall) => {
        let resultStr = "Aucun résultat trouvé.";
        
        if (toolCall.name === 'web_search') {
          const query = toolCall.input.query;
          console.log(`   🔍 [WEB_SEARCH] Requête envoyée à Google : "${query}"`);
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const searchResponse = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: { "X-API-KEY": process.env.SERPER_API_KEY || "", "Content-Type": "application/json" },
              body: JSON.stringify({ q: query, gl: "ca", hl: "fr" }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await searchResponse.json();
            const resultsList = data.organic?.slice(0, 5) || [];
            resultStr = resultsList.map(r => `Titre: ${r.title}\nLien: ${r.link}\nSnippet: ${r.snippet}`).join('\n\n') || "Pas de résultats.";
            
            console.log(`   ✅ [WEB_SEARCH] ${resultsList.length} résultats trouvés et transmis à l'IA :`);
            resultsList.forEach((r, idx) => console.log(`      [${idx+1}] 🔗 ${r.link}`));

          } catch (e) {
            console.error(`   ❌ [WEB_SEARCH] Erreur API : ${e.message}`);
            resultStr = "Erreur technique de recherche.";
          }
        }
        else if (toolCall.name === 'read_webpage') {
          const url = toolCall.input.url;
          console.log(`   📖 [READ_WEBPAGE] Tentative de lecture Jina : "${url}"`);
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const readResponse = await fetch(`https://r.jina.ai/${url}`, {
              headers: { "Accept": "text/plain" },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (readResponse.ok) {
              const text = await readResponse.text();
              resultStr = text.slice(0, 8000);
              console.log(`   ✅ [READ_WEBPAGE] Succès ! (${resultStr.length} caractères extraits du site)`);
            } else {
              console.log(`   ❌ [READ_WEBPAGE] Échec. Le site a bloqué le robot (Code HTTP: ${readResponse.status})`);
              resultStr = "La page a bloqué la lecture.";
            }
          } catch (e) {
            console.error(`   ❌ [READ_WEBPAGE] Erreur Timeout/Fetch : ${e.message}`);
            resultStr = "Erreur de lecture.";
          }
        }

        return { type: 'tool_result', tool_use_id: toolCall.id, content: resultStr };
      }));

      messages.push({ role: 'assistant', content: response.content });
      
      if (iterations >= maxIterations) {
        toolResults.push({
          type: 'text',
          text: "⚠️ LIMITE DE RECHERCHE ATTEINTE. Analyse les résultats obtenus et génère IMMÉDIATEMENT le JSON final valide. RÈGLE CRITIQUE : Commence ta réponse directement par '{' et termine par '}'. N'écris AUCUN texte avant (il est strictement interdit de dire 'I'll read...', 'Je vais analyser...', ou 'Voici le JSON')."
        });
      }

      messages.push({ role: 'user', content: toolResults });

      response = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        temperature: 0,
        system: systemPrompt,
        tools: iterations < maxIterations ? tools : undefined,
        messages: messages
      });
    }

    let finalContent = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    
    // 1. SÉCURITÉ : Vérification de contenu vide
    if (!finalContent || finalContent.trim() === '') {
      throw new Error("L'IA n'a pas retourné de réponse texte valide.");
    }

    // 2. SÉCURITÉ : Alerte si la limite de tokens a été atteinte
    if (response.stop_reason === 'max_tokens') {
      console.warn("⚠️ [ATTENTION] Limite de tokens atteinte. Le JSON final risque fort d'être tronqué !");
    }

    // 3. NETTOYAGE : Extraction de sécurité via Regex pour isoler uniquement le JSON
    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      finalContent = jsonMatch[0];
    } else {
      // Si la regex n'a trouvé AUCUNE accolade, on log l'erreur exacte
      console.error("❌ [CRITIQUE] Réponse non-JSON de Claude :", finalContent);
      throw new Error("L'IA a généré du texte au lieu d'un format JSON strict. L'opération a été annulée pour éviter de corrompre les données. Veuillez relancer l'analyse.");
    }

    // Affichage des 150 derniers caractères pour aider à débugger une potentielle coupure
    console.log(`\n📄 [JSON DEBUG] Fin de la réponse IA : "${finalContent.slice(-150).replace(/\n/g, '')}"\n`);

    const valuationResult = parseClaudeJSON(finalContent);

    const evaluationRef = await db.collection('users').doc(userId).collection('evaluations').add({
      userType,
      proprietyType,
      ville,
      quartier,
      codePostal: codePostal || null,
      addresseComplete,
      prixAchat: prixAchat || null,
      prixAffichage: prixAffichage || null,
      anneeConstruction,
      result: valuationResult,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paidWith: req.quotaInfo.mode
    });

    await deductUsage(userId, req.quotaInfo);

    res.json({
      id: evaluationRef.id,
      ...valuationResult,
      meta: { paidWith: req.quotaInfo.mode, searchUsed: iterations > 0 }
    });

  } catch (error) {
    console.error('\n❌ Erreur Critique Valuation:', error);
    res.status(500).json({ error: "Échec de l'évaluation", details: error.message });
  }
});


//https://api.optimiplex.com/api/admin/sync-leaderboard
app.get('/api/admin/sync-leaderboard', async (req, res) => {
  try {
    const db = getFirestore();
    console.log("🔄 Début de la synchronisation globale des scores...");

    const usersSnap = await db.collection('users').get();
    let updatedCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Compter les documents à la racine
      const [rootEvalsSnap, rootEvalsCommSnap, rootAnalysesSnap] = await Promise.all([
        db.collection('evaluations').where('userId', '==', userId).get(),
        db.collection('evaluations_commerciales').where('userId', '==', userId).get(),
        db.collection('analyses').where('userId', '==', userId).get()
      ]);
      const rootTotal = rootEvalsSnap.size + rootEvalsCommSnap.size + rootAnalysesSnap.size;

      // Compter les documents dans les sous-collections de l'utilisateur
      const [subEvalsSnap, subEvalsCommSnap, subAnalysesSnap] = await Promise.all([
        db.collection(`users/${userId}/evaluations`).get(),
        db.collection(`users/${userId}/evaluations_commerciales`).get(),
        db.collection(`users/${userId}/analyses`).get()
      ]);
      const subTotal = subEvalsSnap.size + subEvalsCommSnap.size + subAnalysesSnap.size;

      const realTotal = Math.max(rootTotal, subTotal);

      // Mettre à jour seulement si le score enregistré est différent du compte réel
      if ((userData.evaluationCount || 0) !== realTotal) {
        await userDoc.ref.update({
          evaluationCount: realTotal,
          updatedAt: FieldValue.serverTimestamp()
        });
        updatedCount++;
        console.log(`✅ Utilisateur ${userId} mis à jour : ${realTotal} analyses.`);
      }
    }

    console.log(`🎉 Terminé ! ${updatedCount} profils mis à jour.`);
    res.json({ 
      success: true, 
      message: `${updatedCount} profils ont été mis à jour avec le score exact !` 
    });

  } catch (error) {
    console.error("❌ Erreur lors de la synchronisation :", error);
    res.status(500).json({ error: 'Erreur interne lors de la synchronisation des scores.' });
  }
});

// ====================================================================
// 🏢 ENDPOINT : VALUATION COMMERCIALE (COMPLEXE)
// ====================================================================
async function callClaudeWithRetry(apiCallPromiseFunc, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // On exécute l'appel à Claude
      return await apiCallPromiseFunc();
    } catch (error) {
      // Si ce n'est pas une erreur 529 (Overloaded), 503 (Unavailable) ou 429 (Rate Limit), on lance l'erreur normalement
      const isRetryable = error.status === 529 || error.status === 503 || error.status === 429;
      
      if (!isRetryable || attempt === maxRetries) {
        throw error; // On abandonne si ce n'est pas retryable ou si on a épuisé les essais
      }

      // Calcul du délai (backoff exponentiel) : 2s, puis 4s, puis 8s...
      const delayMs = Math.pow(2, attempt) * 1000;
      console.warn(`⏳ [CLAUDE API] Surcharge (Erreur ${error.status}). Nouvel essai dans ${delayMs/1000}s (Tentative ${attempt}/${maxRetries})...`);
      
      // On met en pause l'exécution
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

app.post('/api/property/valuation-estimator-commercial', checkQuotaOrCredits, async (req, res) => {
  try {
    const {
      userId,
      userType = 'vendeur', // 'acheteur' ou 'vendeur'
      proprietyType, 
      typeCom, 
      ville,
      quartier = '',
      codePostal = '',
      addresseComplete = '',
      prixAchat,
      anneeAchat,
      prixAffichage, // Pour acheteur
      urlAnnonce, // Pour acheteur
      anneeConstruction,
      surfaceTotale = 0,
      surfaceLocable = 0,
      
      // POUR IMMEUBLE À REVENUS
      nombreUnites,
      tauxOccupation,
      loyerMoyenParUnite,
      revenus_bruts_annuels,
      revenuBrutAnnuel, 
      depenses_annuelles,
      depensesAnnuelles, 
      
      // NOUVEAUX CHAMPS D'OPTIMISATION (VALUE-ADD)
      chauffage_proprio = false,
      electricite_proprio = false,
      unites_non_renovees = false,
      sous_sol_inexploite = false,
      stationnement_gratuit = false,

      // DÉTAILS DES LOGEMENTS
      logementsDetail = [],
      
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

    // NORMALISATION DES CHAMPS
    const finalProprieTyType = proprietyType || typeCom;
    const finalRevenusAnnuels = revenus_bruts_annuels || revenuBrutAnnuel;
    const finalDepenses = depenses_annuelles || depensesAnnuelles;
    const isTerrain = finalProprieTyType === 'terrain_commercial';
    const isAcheteur = userType === 'acheteur';

    // VALIDATIONS OBLIGATOIRES
    if (!finalProprieTyType || !ville || (!isTerrain && !anneeConstruction)) {
      return res.status(400).json({
        error: 'Paramètres obligatoires manquants',
        required: ['proprietyType', 'ville'].concat(isTerrain ? [] : ['anneeConstruction'])
      });
    }

    console.log(`\n========================================================`);
    console.log(`🏪 ÉVALUATION COMMERCIALE (${userType.toUpperCase()}): ${finalProprieTyType} à ${ville}`);
    console.log(`========================================================\n`);

    const anneeActuelle = new Date().getFullYear();
    const ageConstruction = isTerrain ? 'N/A' : (anneeActuelle - anneeConstruction);
    
    // LOGIQUE FINANCIÈRE (ACHAT VS PROSPECTION)
    let infoFinanciere = "";
    const aDesDonneesAchat = !!(prixAchat && anneeAchat);
    
    if (isAcheteur) {
        infoFinanciere = `
        DONNÉES DE PROSPECTION (L'utilisateur envisage d'acheter):
        - Prix affiché / demandé : ${prixAffichage ? prixAffichage + '$' : 'Non fourni'}
        - URL de l'annonce : ${urlAnnonce || 'Non fournie'}
        TA TÂCHE : Déterminer la valeur économique de l'actif, puis juger si le "Prix demandé" est justifié, sous-évalué (Deal) ou surévalué en fonction de la rentabilité actuelle et du potentiel d'optimisation.
        `;
    } else {
        infoFinanciere = aDesDonneesAchat 
            ? `DONNÉES HISTORIQUES D'ACHAT:\n- Prix d'achat en ${anneeAchat}: ${prixAchat}$` 
            : `DONNÉES HISTORIQUES D'ACHAT:\n- Historique non fourni. Ne pas calculer d'appréciation historique.`;
    }

    // DÉFINITION DES OUTILS (SEARCH & READ)
    const tools = [
      {
        name: "web_search",
        description: "Recherche Google. S'utilise en TROIS TEMPS : 1) Trouver des pages de résultats globaux (ex: 'plex commerciaux à vendre Lévis Centris') pour extraire des numéros MLS/Centris. 2) Chercher ensuite ces numéros précis. 3) PLAN B (Fallback) : Chercher directement l'ADRESSE COMPLÈTE (ex: '123 rue Principale, Lévis') si le lien exact ou l'ID Centris est introuvable.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "La requête de recherche" }
          },
          required: ["query"]
        }
      },
      {
        name: "read_webpage",
        description: "Lit une page web. Extrait tous les détails financiers exacts (NOI, Cap Rate, baux, zonage, prix, caractéristiques).",
        input_schema: {
          type: "object",
          properties: { url: { type: "string", description: "L'URL de la page à lire" } },
          required: ["url"]
        }
      }
    ];

    // CONSTRUCTION DU PROMPT SPÉCIFIQUE PAR TYPE
    let promptSpecifique = '';

    if (finalProprieTyType === 'immeuble_revenus') {
      const noi = finalRevenusAnnuels - finalDepenses;
      
      let potentielOptimisation = [];
      if (chauffage_proprio) potentielOptimisation.push("Chauffage payé par le proprio (À convertir aux frais des locataires)");
      if (electricite_proprio) potentielOptimisation.push("Électricité payée par le proprio (À convertir aux frais des locataires)");
      if (unites_non_renovees) potentielOptimisation.push("Logements d'origine à rénover (Fort potentiel d'augmentation des loyers)");
      if (sous_sol_inexploite) potentielOptimisation.push("Sous-sol inexploité (Potentiel de création d'un logement supplémentaire)");
      if (stationnement_gratuit) potentielOptimisation.push("Stationnements inclus gratuitement (Potentiel de monétisation)");

      const optimisationText = potentielOptimisation.length > 0 
        ? `\n- 🚀 POTENTIEL D'OPTIMISATION (VALUE-ADD) IDENTIFIÉ PAR LE CLIENT:\n  * ${potentielOptimisation.join('\n  * ')}\n  -> L'IA DOIT utiliser ces éléments pour formuler une stratégie d'augmentation de valeur agressive (Value-Add).` 
        : '';

      const configLogements = logementsDetail && logementsDetail.length > 0 
        ? `\n- Configuration des logements: ${logementsDetail.map(l => `${l.quantite}x ${l.type}`).join(', ')}` 
        : '';

      let avertissementPlex = '';
      if (nombreUnites > 0 && nombreUnites <= 6) {
         avertissementPlex = `\n🚨 DIRECTIVE CRITIQUE POUR PETIT PLEX (${nombreUnites} unités) : Le marché actuel paie une prime pour ce type d'immeuble. Ne pas sous-évaluer en se basant uniquement sur un Cap Rate théorique. Utilise EXCLUSIVEMENT les VENTES COMPARABLES et le PRIX PAR PORTE.`;
      } else if (nombreUnites > 6) {
         avertissementPlex = `\n🚨 DIRECTIVE CRITIQUE POUR MULTILOGEMENT (${nombreUnites} unités) : Tu DOIS baser ton évaluation principalement sur la rentabilité financière (NOI / Cap Rate moyen du secteur).`;
      }

      promptSpecifique = `
DONNÉES FINANCIÈRES IMMEUBLE À REVENUS:
- Unités: ${nombreUnites} | Occupation: ${tauxOccupation}% | Loyer moyen: $${loyerMoyenParUnite}/mois${configLogements}
- Revenus annuels bruts: $${finalRevenusAnnuels?.toLocaleString('fr-CA')} | Dépenses: $${finalDepenses?.toLocaleString('fr-CA')}
- NOI (RNE) déclaré: $${noi?.toLocaleString('fr-CA')}
${avertissementPlex}${optimisationText}
      `;
    } else if (finalProprieTyType === 'hotel') {
      const revenuBrutHotel = finalRevenusAnnuels || (nombreChambres * 365 * (tauxOccupationHotel / 100) * tariffMoyenParNuit);
      promptSpecifique = `
DONNÉES FINANCIÈRES HÔTEL:
- Chambres: ${nombreChambres} | Occupation: ${tauxOccupationHotel}% | Tarif nuit ADR: $${tariffMoyenParNuit}
- Revenus annuels estimés: $${Math.round(revenuBrutHotel)?.toLocaleString('fr-CA')} | Dépenses: $${finalDepenses?.toLocaleString('fr-CA')}
      `;
    } else if (['depanneur', 'restaurant', 'commerce', 'bureau'].includes(finalProprieTyType) && finalRevenusAnnuels) {
      promptSpecifique = `
DONNÉES FINANCIÈRES COMMERCE/BUREAU:
- Revenus annuels: $${finalRevenusAnnuels?.toLocaleString('fr-CA')} | Dépenses: $${finalDepenses?.toLocaleString('fr-CA')}
- Clientèle/Baux: ${clienteleActive}
      `;
    } else if (isTerrain) {
      promptSpecifique = `
DONNÉES SPÉCIFIQUES TERRAIN:
- Uniquement de la valeur foncière. Évaluer le prix au pied carré pour un terrain commercial dans cette zone.
      `;
    }

    let reglesEvaluation = "";
    if (finalProprieTyType === 'immeuble_revenus' && nombreUnites > 0 && nombreUnites <= 6) {
      reglesEvaluation = `
      2. 🚨 RÈGLE D'EXTRAPOLATION (PETIT PLEX) : Priorise les comparables directs. Ta source de VÉRITÉ ABSOLUE est le marché.`;
    } else if (finalProprieTyType === 'immeuble_revenus' && nombreUnites > 6) {
      reglesEvaluation = `
      2. 🚨 RÈGLE D'EXTRAPOLATION (MULTILOGEMENT) : La valeur repose sur sa VALEUR ÉCONOMIQUE. Ta source de VÉRITÉ ABSOLUE est la rentabilité (NOI/Cap Rate).`;
    } else {
      reglesEvaluation = `
      2. 🚨 RÈGLE D'EXTRAPOLATION : Utilise la combinaison de la valeur économique (NOI/Cap Rate) et marchande.`;
    }

    const systemPrompt = `
      Tu es un expert évaluateur immobilier commercial (A.É.) au Québec.
      Tu AS accès à Internet via 'web_search' et 'read_webpage'.
      
      RÈGLES STRICTES :
      1. 🚨 STRATÉGIE EN DEUX TEMPS : Trouve des annonces -> Lis les fiches -> Valide les prix de vente/affichés.
      ${reglesEvaluation}
      3. N'INVENTE JAMAIS D'URL. Si aucun lien web_search valide, mets "url": null.
      4. CONCISION : Sois extrêmement concis dans le texte.
      5. FORMAT DES NOMBRES (CRITIQUE) : Les montants doivent être des nombres ENTIERS PURS (ex: 1500000), SANS VIRGULES NI ESPACES.
      
      ${isAcheteur ? `
      6. 🎯 DIRECTIVE PROSPECTION (ACHETEUR) : Génère OBLIGATOIREMENT le bloc "potentielOptimisation" pour livrer ton verdict d'achat.
      ` : `
      6. 📝 DIRECTIVE VENDEUR : Concentre-toi sur la valeur actuelle et les leviers pour bien vendre.
      `}
      7. FORMAT FINAL : Réponds UNIQUEMENT avec un objet JSON valide. Ne mets AUCUNE balise markdown.
    `;

    const jsonOptimisation = isAcheteur 
        ? `"potentielOptimisation": { "valeurApresTravaux": 0, "margeSecurite": "...", "avisProspection": "Verdict tranché sur le deal" },` 
        : '';

    const valuationPrompt = `
      ÉVALUATION COMMERCIALE:
      - Date de l'analyse: Mars 2026
      - Type: ${finalProprieTyType} | Ville: ${ville} ${quartier ? `(${quartier})` : ''}
      - Adresse: ${addresseComplete || 'Non fournie'}
      - Surface: Totale ${surfaceTotale} pi² ${!isTerrain ? `, Locable ${surfaceLocable} pi²` : ''}
      ${!isTerrain ? `- Construction: ${anneeConstruction} (${ageConstruction} ans) | État bâtisse: ${etatGeneral.toUpperCase()}` : ''}
      - Atouts physiques: Parking ${parking} places, Accessibilité: ${accessibilite}
      - Rénovations/Notes: ${notes_additionnelles || renovations?.join(', ') || 'Aucune'}

      ${promptSpecifique}
      ${infoFinanciere}

      ⚠️ OBLIGATOIRE : Utilise 'web_search' pour trouver 2 à 4 propriétés COMPARABLES.
      
      FORMAT JSON ATTENDU (Nombres ENTIERS SEULEMENT):
      {
        "estimationActuelle": { "valeurBasse": 0, "valeurMoyenne": 0, "valeurHaute": 0, "confiance": "haute" },
        "metriquesCommerciales": { "capRate": 0, "noiAnnuel": 0, "cashOnCash": 0, "revenuParSurfaceLocable": 0, "multiplicateurRevenu": 0 },
        ${jsonOptimisation}
        "analyse": { "appreciationTotale": ${aDesDonneesAchat && !isAcheteur ? '0' : 'null'}, "pourcentageGainTotal": ${aDesDonneesAchat && !isAcheteur ? '0' : 'null'}, "marketTrend": "equilibre", "secteurAnalysis": "Dynamique du marché local" },
        "facteursPrix": { "positifs": ["..."], "negatifs": ["..."], "incertitudes": ["..."] },
        "recommendations": { "renovationsRentables": ["..."], "optimisationRevenu": ["..."], "reduceExpenses": ["..."], "strategie": "...", "timing": "..." },
        "comparables": [
          { 
            "adresse": "...", 
            "statut": "vendu ou actif", 
            "prix": 0, 
            "date": "...", 
            "caracteristiques": "...", 
            "ajustementParite": "Explication de la parité et ajustements (+/-) justifiés par rapport à notre propriété.", 
            "url": "Lien exact web_search ou null" 
          }
        ]
      }
    `;

    const messages = [{ role: 'user', content: valuationPrompt }];

    console.log("🤖 [IA] Appel initial commercial envoyé...");
    
    let response = await callClaudeWithRetry(() => claude.messages.create({
      model: 'claude-sonnet-4-6', // Assurez-vous du nom exact du modèle utilisé
      max_tokens: 4000,
      temperature: 0,
      system: systemPrompt,
      tools: tools,
      messages: messages
    }));

    // BOUCLE DES OUTILS
    let iterations = 0;
    const maxIterations = 5; 

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;
      console.log(`\n🔄 [ITÉRATION ${iterations}/${maxIterations}] L'IA utilise ses outils...`);
      
      const toolCalls = response.content.filter(c => c.type === 'tool_use');

      const toolResults = await Promise.all(toolCalls.map(async (toolCall) => {
        let resultStr = "Aucun résultat trouvé.";
        
        if (toolCall.name === 'web_search') {
          const query = toolCall.input.query;
          console.log(`   🔍 Web Search : "${query}"`);

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const searchResponse = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: { "X-API-KEY": process.env.SERPER_API_KEY || "", "Content-Type": "application/json" },
              body: JSON.stringify({ q: query, gl: "ca", hl: "fr" }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await searchResponse.json();
            const resultsList = data.organic?.slice(0, 5) || [];
            resultStr = resultsList.map(r => `Titre: ${r.title}\nLien: ${r.link}\nSnippet: ${r.snippet}`).join('\n\n') || "Pas de résultats.";
          } catch (e) {
            console.error(`   ❌ Erreur Serper: ${e.message}`);
            resultStr = "Erreur technique de recherche.";
          }
        } 
        else if (toolCall.name === 'read_webpage') {
          const url = toolCall.input.url;
          console.log(`   📖 Lecture Page : "${url}"`);
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const readResponse = await fetch(`https://r.jina.ai/${url}`, {
              headers: { "Accept": "text/plain" },
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (readResponse.ok) {
              const text = await readResponse.text();
              resultStr = text.slice(0, 8000); 
            } else {
              resultStr = "La page a bloqué la lecture.";
            }
          } catch (e) {
            console.error(`   ❌ Erreur Jina: ${e.message}`);
            resultStr = "Erreur de lecture.";
          }
        }

        return { type: 'tool_result', tool_use_id: toolCall.id, content: resultStr };
      }));

      messages.push({ role: 'assistant', content: response.content });
      
      if (iterations >= maxIterations) {
        console.log("   ⚠️ Limite d'itérations. Conclusion forcée.");
        toolResults.push({ 
          type: 'text', 
          text: "⚠️ LIMITE DE RECHERCHE ATTEINTE. Analyse les données recueillies et génère OBLIGATOIREMENT le JSON final valide en commençant par '{'." 
        });
      }

      messages.push({ role: 'user', content: toolResults });

      response = await callClaudeWithRetry(() => claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000, 
        temperature: 0,
        system: systemPrompt,
        tools: iterations < maxIterations ? tools : undefined,
        messages: messages
      }));
    }

    console.log(`\n✅ [IA] Analyse Commerciale terminée. Extraction du JSON...`);
    
    // EXTRACTION DU JSON SÉCURISÉE
    let finalContent = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    
    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
       finalContent = jsonMatch[0];
    } else {
       console.error("❌ [CRITIQUE] Réponse non-JSON :", finalContent);
       throw new Error("L'IA n'a pas généré de JSON valide.");
    }

    const valuationResult = parseClaudeJSON(finalContent);

    // SAUVEGARDE FIRESTORE
    const evaluationRef = await db.collection('users').doc(userId).collection('evaluations_commerciales').add({
      userType,
      proprietyType: finalProprieTyType,
      ville,
      quartier,
      codePostal: codePostal || null,
      addresseComplete,
      prixAchat: prixAchat || null,
      anneeAchat: anneeAchat || null,
      prixAffichage: prixAffichage || null,
      anneeConstruction: isTerrain ? null : anneeConstruction,
      optimisation: { chauffage_proprio, electricite_proprio, unites_non_renovees, sous_sol_inexploite, stationnement_gratuit },
      logementsDetail: logementsDetail || [],
      result: valuationResult,
      evaluationType: 'commercial',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paidWith: req.quotaInfo.mode
    });

    console.log(`💾 Commercial Sauvegardé (ID: ${evaluationRef.id})`);

    // DÉDUCTION USAGE
    await deductUsage(userId, req.quotaInfo);

    res.json({
      id: evaluationRef.id,
      ...valuationResult,
      meta: { paidWith: req.quotaInfo.mode, searchUsed: iterations > 0 }
    });

  } catch (error) {
    console.error('\n❌ Erreur Valuation Commerciale:', error);
    if (error.status === 529 || error.status === 503) {
      res.status(503).json({ error: "L'IA est actuellement surchargée. Veuillez réessayer dans quelques instants." });
    } else {
      res.status(500).json({ error: "Échec de l'évaluation commerciale.", details: error.message });
    }
  }
});


app.post('/api/property/valuation-chat', async (req, res) => {
  try {
    const { userId, messages, propertyData } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages manquants ou invalides" });
    }

    // Prompt système encore plus direct
    const systemPrompt = `Tu es un expert en investissement immobilier au Québec.
Ton rôle : conseiller privé, ton : professionnel et concis.

RÈGLE D'OR : ÉCRIS EN TEXTE BRUT UNIQUEMENT.
- AUCUN symbole Markdown : Pas de #, *, _, ~, ---, >, |
- AUCUN Emoji.
- AUCUN mot en gras ou italique.
- TITRES : Écris les titres de sections en LETTRES MAJUSCULES.
- LISTES : Utilise uniquement le tiret simple "-" suivi d'un espace.
- ESPACEMENT : Sépare chaque bloc par DEUX sauts de ligne.

CONTEXTE DE LA PROPRIÉTÉ :
${JSON.stringify(propertyData, null, 2)}

Réponds directement en texte clair (Plain Text).`;

    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: systemPrompt,
      messages: messages,
    });

    let text = response.content[0].text;

    // --- FONCTION DE SÉCURITÉ : NETTOYAGE POST-GÉNÉRATION ---
    // Supprime les résidus de Markdown si l'IA en a généré par erreur
    const cleanText = (str) => {
      return str
        .replace(/[#*~_]/g, '')        // Supprime # * ~ _
        .replace(/---/g, '')           // Supprime les lignes de séparation ---
        .replace(/\[.*\]\(.*\)/g, '')  // Supprime les liens Markdown [text](url)
        .trim();
    };

    res.json({ reply: cleanText(text) });

  } catch (error) {
    console.error('❌ Erreur Chatbot Stratège:', error);
    res.status(500).json({ error: error.message });
  }
});


// ====================================================================
// 🏢 ROUTE : IA COURTIER HYPOTHÉCAIRE (AVEC SENDGRID)
// ====================================================================

app.post('/api/broker/quick-lead', async (req, res) => {
  try {
    const { formData, evaluationData, adresse, prix, brokerId } = req.body;
    const db = admin.firestore();

    // 1. Sauvegarde dans Firestore
    const leadRef = await db.collection('leads_hypothecaires').add({
      clientEmail: formData.email,
      clientDetails: {
        prenom: formData.prenom,
        nom: formData.nom,
        telephone: formData.telephone,
      },
      evaluationData: evaluationData || {},
      adressePropriete: adresse,
      prixPropriete: prix,
      status: 'nouveau',
      clientFormCompleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'bouton_propriete_direct'
    });

    // 2. Notification Courriel à vous / l'équipe
    const msg = {
      to: 'xavier.lavoie@optimiplex.com', // Modifiez avec votre courriel si besoin
      from: 'info@optimiplex.com', 
      subject: `🚨 NOUVELLE DEMANDE RAPIDE : ${adresse}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #4f46e5;">Nouveau Lead Hypothécaire</h2>
          <p>Un client vient de demander une pré-qualification rapide depuis une page de propriété.</p>
          
          <div style="background: #eef2ff; padding: 15px; border-left: 4px solid #4f46e5; margin-bottom: 20px;">
            <strong>📍 Propriété ciblée :</strong><br/>
            Adresse : <b>${adresse}</b><br/>
            Prix ciblé : <b>${prix}</b><br/>
          </div>

          <h3>Coordonnées du client :</h3>
          <ul>
            <li><strong>Prénom et Nom :</strong> ${formData.prenom} ${formData.nom}</li>
            <li><strong>Courriel :</strong> ${formData.email}</li>
            <li><strong>Téléphone :</strong> ${formData.telephone}</li>
          </ul>
          
          <p style="margin-top: 20px;">
            <a href="https://optimiplex.com/crm" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Ouvrir le CRM
            </a>
          </p>
        </div>
      `
    };
    await sgMail.send(msg);

    res.json({ success: true, id: leadRef.id });
  } catch (error) {
    console.error('Erreur quick-lead:', error);
    res.status(500).json({ error: "Erreur lors de la création du dossier" });
  }
});

app.post('/api/broker/assign', async (req, res) => {
  try {
    const { leadId, brokerEmail, brokerName, clientEmail, aiSummary } = req.body;
    const db = admin.firestore();

    // 1. Mettre à jour Firestore
    await db.collection('leads_hypothecaires').doc(leadId).update({
      assignedTo: brokerEmail,
      assignedBrokerName: brokerName,
      status: 'assigne',
      assignedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Courriel au CLIENT
    const clientMsg = {
      to: clientEmail,
      from: 'info@optimiplex.com', // Doit être l'adresse vérifiée SendGrid
      subject: `Votre dossier Optimiplex a été confié à ${brokerName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Excellente nouvelle !</h2>
          <p>Votre dossier de financement a été confié à notre expert(e) <strong>${brokerName}</strong>.</p>
          <p>Pour que ${brokerName} puisse commencer à travailler sur votre pré-approbation, merci de remplir ce formulaire sécurisé :</p>
          <div style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/${leadId}" style="background: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
               Accéder à mon portail sécurisé
            </a>
          </div>
          <p style="margin-top: 20px;">Vous serez contacté(e) très bientôt.</p>
        </div>
      `
    };

    // 3. Courriel au COURTIER ASSIGNÉ
    const brokerMsg = {
      to: brokerEmail,
      from: 'info@optimiplex.com',
      subject: `🎯 Nouveau dossier assigné: ${clientEmail}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Un nouveau dossier t'a été assigné</h2>
          <p>Le client <strong>${clientEmail}</strong> t'a été attribué.</p>
          <div style="background: #eef2ff; padding: 15px; border-left: 4px solid #4f46e5; margin-bottom: 20px;">
            <strong>🧠 Analyse IA :</strong><br/>${aiSummary}
          </div>
          <p>Connecte-toi au CRM Optimiplex pour voir les détails et changer le statut une fois le financement complété.</p>
        </div>
      `
    };

    await sgMail.send(clientMsg);
    await sgMail.send(brokerMsg);

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur assignation:', error);
    res.status(500).json({ error: 'Erreur lors de l\'assignation' });
  }
});

app.post('/api/client/submit', async (req, res) => {
  const { leadId, formData, clientFiles, brokerEmail } = req.body; // <-- Réception de clientFiles

  try {
    // 1. MISE À JOUR IMMÉDIATE : Changement de statut initial
    await db.collection('leads_hypothecaires').doc(leadId).update({
      clientDetails: formData, // Sauvegarde toutes les nouvelles infos du formulaire
      clientFiles: clientFiles || [], // <-- Sauvegarde des fichiers dans la BDD
      status: 'en_cours',
      clientFormCompleted: true,
      documentStatus: 'generation_en_cours',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. RÉPONSE INSTANTANÉE AU CLIENT
    res.json({ success: true, message: "Dossier reçu. Vos documents et ratios sont en cours de génération." });

    // 3. GÉNÉRATION DES DOCUMENTS EN ARRIÈRE-PLAN
    (async () => {
      try {
        console.log(`⚙️ Début de la génération des documents pour: ${leadId}`);

        // 👉 NOUVEAU : Récupérer le dossier complet pour avoir le prix et l'adresse de départ
        const leadDoc = await db.collection('leads_hypothecaires').doc(leadId).get();
        const leadData = leadDoc.exists ? leadDoc.data() : {};

        // ⚠️ HELPER ROBUSTE : Nettoie n'importe quelle chaîne (ex: "430 000 $" devient 430000)
        const parseNum = (val) => {
          if (!val) return 0;
          const cleaned = String(val).replace(/[^0-9.]/g, ''); // Ne garde que les chiffres et le point
          return Number(cleaned) || 0;
        };

        // --- Préparation des données numériques fusionnées ---
        const prenom = formData.prenom || 'Client';
        const nom = formData.nom || '';
        const email = formData.email || leadData.clientEmail || 'Non spécifié';
        const telephone = formData.telephone || 'Non spécifié';
        
        // Emploi
        const statutEmploi = formData.statutEmploi || 'Non spécifié';
        const employeur = formData.employeur || 'Non spécifié';
        const anneesService = formData.anneesService || '0';

        // Finances 
        const revenu = parseNum(formData.revenuAnnuel);
        const epargne = parseNum(formData.liquidites);
        const reer = parseNum(formData.reer);
        const celi = parseNum(formData.celi);
        const reerCeli = reer + celi;
        
        // Dettes 
        const dettesCartes = parseNum(formData.solde_cartes);
        const mensualiteAuto = parseNum(formData.pret_auto); // <-- TRAITÉ DIRECTEMENT COMME MENSUALITÉ
        const dettesEtudiant = parseNum(formData.pret_etudiant);
        const autresDettes = parseNum(formData.autres_dettes);
        
        // Le total des dettes n'inclut plus l'auto puisque le client entre une mensualité
        const totalDettesBalances = dettesCartes + dettesEtudiant + autresDettes;

        // Propriété Ciblée
        const adresseCible = leadData.adressePropriete || 'Non spécifiée';
        const rawEvaluationPrix = leadData.evaluationData?.result?.estimationActuelle?.valeurMoyenne 
                               || leadData.evaluationData?.estimationActuelle?.valeurMoyenne;
        const stringPrix = leadData.prixPropriete || '0'; 
        const valeurProprieteCible = rawEvaluationPrix ? Number(rawEvaluationPrix) : parseNum(stringPrix);

        // 👉 DÉTECTION DU MODE : Pré-qualif Générale (Manuel) vs Faisabilité (Bouton Propriété)
        const isGeneralPrequal = valeurProprieteCible === 0;

        // Pour les autres prêts (Étudiant), on garde une sécurité si le client met le solde total (ex: >2500$)
        const getMonthlyPayment = (val, monthsAmortization) => {
          if (!val) return 0;
          if (val < 2500) return val; 
          return val / monthsAmortization; 
        };

        // --- Calculs de ratios basiques ---
        const mensualiteCartes = dettesCartes * 0.03; // 3% du solde des cartes
        const mensualiteEtudiant = getMonthlyPayment(dettesEtudiant, 120); // Étudiant amorti sur ~10 ans
        const mensualiteAutres = autresDettes * 0.03;

        const dettesMensuelles = mensualiteCartes + mensualiteAuto + mensualiteEtudiant + mensualiteAutres;
        const revenuMensuel = revenu / 12;
        const ratioDettesRevenu = revenuMensuel > 0 ? ((dettesMensuelles / revenuMensuel) * 100).toFixed(2) : 0;

        // --- Calcul RÉALISTE de capacité d'emprunt (Stress test canadien ~7% sur 25 ans) ---
        // ABD max = 39%, ATD max = 44%
        const maxHousingABD = revenuMensuel * 0.39;
        const maxHousingATD = (revenuMensuel * 0.44) - dettesMensuelles;
        const maxHousingMensuel = Math.max(0, Math.min(maxHousingABD, maxHousingATD));
        
        // Calcul mathématique inversé du prix maximal (P)
        // P = (MaxHousingMensuel + (Epargne * FacteurHypothèque) - Chauffage) / (FacteurHypothèque + FacteurTaxesMunicipales)
        // Facteur hypothèque à 7% = ~0.007. Taxes = ~1%/an (0.00083/mois). Chauffage estimé = 150$/mois.
        let capaciteAchatMax = 0;
        if (maxHousingMensuel > 150) {
            capaciteAchatMax = (maxHousingMensuel + (epargne * 0.007) - 150) / 0.00783;
        }
        
        // Sécurité : La capacité ne peut pas être inférieure à l'argent comptant (épargne)
        capaciteAchatMax = Math.max(capaciteAchatMax, epargne);

        // 👉 Génération automatique de l'analyse IA (Claude)
        let aiAnalysisText = null;
        try {
          console.log(`🤖 Démarrage de l'analyse IA pour: ${leadId}`);
          const { Anthropic } = require('@anthropic-ai/sdk');
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          
          // Ajustement du prompt selon le mode (Général vs Propriété spécifique)
          const cibleInfo = isGeneralPrequal 
            ? `- Cible : Pré-qualification générale (pas de propriété spécifique)\n- Capacité d'achat théorique estimée (mathématique) : ~ ${Math.round(capaciteAchatMax)} $`
            : `- Cible : Propriété à ${valeurProprieteCible} $`;
            
          const tacheConclusion = isGeneralPrequal
            ? `3. Donne une estimation réaliste du prix d'achat maximal qu'ils peuvent viser (capacité d'emprunt + mise de fonds).`
            : `3. Une courte conclusion sur la faisabilité globale pour la propriété ciblée à ${valeurProprieteCible} $.`;

          const prompt = `
            Agis comme un sous-scripteur hypothécaire sénior.
            Analyse brièvement ce profil financier. Sois très concis, direct et utilise des puces (-).
            Ne fais pas d'introduction ni de conclusion polie. Va droit au but.
            TRÈS IMPORTANT : N'utilise AUCUN formatage Markdown (pas d'astérisques pour le gras, pas de symboles #). Écris uniquement en texte brut standard.

            DONNÉES DU CLIENT :
            - Revenu brut : ${revenu} $
            - Liquidités (Cash disponible pour mise de fonds) : ${epargne} $
            - REER/CELI : ${reerCeli} $
            - Dettes (Soldes totaux hors auto) : ${totalDettesBalances} $
            - Paiements mensuels estimés (incluant prêt auto de ${mensualiteAuto} $) : ${Math.round(dettesMensuelles)} $
            ${cibleInfo}

            TA TÂCHE :
            1. Donne 1 ou 2 "Points forts" (ex: Bonne liquidité, faible dette).
            2. Donne 1 ou 2 "Points d'attention" ou risques.
            ${tacheConclusion}
          `;

          const aiResponse = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 350,
            temperature: 0.3,
            messages: [{ role: "user", content: prompt }]
          });
          
          aiAnalysisText = aiResponse.content[0].text.replace(/[*#_]/g, '');
          console.log(`✅ Analyse IA générée avec succès.`);
        } catch (aiError) {
          console.error("❌ Erreur lors de l'analyse IA:", aiError);
          aiAnalysisText = "L'analyse IA n'a pas pu être générée.";
        }

        const files = [];
        const bucket = admin.storage().bucket('plexoptimizer.firebasestorage.app');

        // ─── A. GÉNÉRATION DU PDF PRO (BRANDING OPTIMIPLEX) ────────────────────────
        const generatePDF = () => new Promise((resolve, reject) => {
          const doc = new PDFDocument({ margin: 0, size: 'A4' }); 
          const buffers = [];
          
          doc.on('data', buffers.push.bind(buffers));
          doc.on('end', () => resolve(Buffer.concat(buffers)));
          doc.on('error', reject);

          // --- HEADER OPTIMIPLEX ---
          doc.rect(0, 0, doc.page.width, 120).fill('#0f172a'); // Background header
          doc.fillColor('#ffffff').fontSize(32).font('Helvetica-Bold').text('OPTIMIPLEX', 50, 45, { characterSpacing: 2 });
          doc.fontSize(10).font('Helvetica').fillColor('#818cf8').text('ANALYSE ET PRÉQUALIFICATION FINANCIÈRE', 50, 80, { characterSpacing: 1 });
          
          // Date et Réf en haut à droite
          doc.y = 45;
          doc.font('Helvetica').fontSize(10).fillColor('#cbd5e1').text(`Date : ${new Date().toLocaleDateString('fr-CA')}`, 50, doc.y, { align: 'right', width: doc.page.width - 100 });
          doc.text(`Réf : ${leadId.substring(0, 8).toUpperCase()}`, 50, doc.y + 15, { align: 'right', width: doc.page.width - 100 });

          doc.y = 150; // Reset position sous le header

          // Helpers de dessin
          const drawSectionHeader = (title) => {
            doc.y += 15;
            doc.rect(50, doc.y, doc.page.width - 100, 26).fill('#e0e7ff');
            doc.fillColor('#4338ca').font('Helvetica-Bold').fontSize(11).text(title.toUpperCase(), 65, doc.y + 8, { characterSpacing: 1 });
            doc.y += 35;
          };

          const drawKeyValueLine = (key, value, isBoldValue = false, valueColor = '#0f172a') => {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#64748b').text(key, 65, doc.y);
            doc.font(isBoldValue ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor(valueColor).text(value, 260, doc.y);
            doc.y += 22;
          };

          // --- SECTION: CLIENT ---
          drawSectionHeader('Profil de l\'Emprunteur');
          drawKeyValueLine('Nom complet', `${prenom} ${nom}`, true);
          drawKeyValueLine('Courriel', email);
          drawKeyValueLine('Téléphone', telephone);

          // --- SECTION: EMPLOI ---
          drawSectionHeader('Situation Professionnelle');
          drawKeyValueLine('Statut d\'emploi', statutEmploi);
          drawKeyValueLine('Employeur', employeur);
          drawKeyValueLine('Années de service', `${anneesService} an(s)`);

          // --- SECTION: FINANCES ---
          drawSectionHeader('Bilan Financier (Déclaré)');
          drawKeyValueLine('Revenu Annuel Brut', `${revenu.toLocaleString('fr-CA')} $`, true, '#0f172a');
          drawKeyValueLine('Épargne / Liquidités (Cash)', `${epargne.toLocaleString('fr-CA')} $`, true, '#059669');
          drawKeyValueLine('Placements REER / CELI', `${reerCeli.toLocaleString('fr-CA')} $`);
          drawKeyValueLine('Dettes Soldes (Cartes/Autres)', `${totalDettesBalances.toLocaleString('fr-CA')} $`);
          drawKeyValueLine('Paiement Auto (Mensuel)', `${mensualiteAuto.toLocaleString('fr-CA')} $`, false, '#e11d48');
          drawKeyValueLine('Paiements mensuels totaux estimés', `${Math.round(dettesMensuelles).toLocaleString('fr-CA')} $`, true, '#e11d48');
          drawKeyValueLine('Ratio Dettes / Revenu', `${ratioDettesRevenu} % (Hors habitation)`);

          // --- SECTION: PROJET ---
          drawSectionHeader('Analyse du Projet');
          if (isGeneralPrequal) {
            drawKeyValueLine('Type de demande', 'Pré-qualification générale');
            doc.y += 15;
            // Boîte de résultat mise en évidence
            doc.rect(50, doc.y, doc.page.width - 100, 50).fill('#ecfdf5');
            doc.font('Helvetica-Bold').fontSize(12).fillColor('#059669').text('CAPACITÉ D\'ACHAT MAXIMALE ESTIMÉE :', 70, doc.y + 18);
            doc.fontSize(18).text(`~ ${Math.round(capaciteAchatMax).toLocaleString('fr-CA')} $`, 340, doc.y + 16);
            doc.y += 60;
          } else {
            drawKeyValueLine('Adresse ciblée', adresseCible, true);
            drawKeyValueLine('Prix estimé / ciblé', `${valeurProprieteCible.toLocaleString('fr-CA')} $`, true, '#4f46e5');
            
            const miseDeFondsRequise = valeurProprieteCible * 0.05;
            drawKeyValueLine('Mise de fonds min. estimée (5%)', `${miseDeFondsRequise.toLocaleString('fr-CA')} $`);
          }

          // --- FOOTER ---
          const pageHeight = doc.page.height;
          doc.rect(0, pageHeight - 60, doc.page.width, 60).fill('#f8fafc');
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#94a3b8').text(
            'Ce document a été généré de manière automatisée par le système Optimiplex. Il est basé sur les données déclaratives du client et sert uniquement à des fins d\'évaluation préliminaire. Il ne constitue pas un engagement ou une offre de financement formelle.',
            50, pageHeight - 40, { align: 'center', width: doc.page.width - 100, lineGap: 2 }
          );

          doc.end();
        });

        const pdfBuffer = await generatePDF();
        const pdfFileName = `rapport_${prenom}_${nom}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        console.log(`☁️ Envoi du PDF vers Firebase Storage...`);
        const pdfFileRef = bucket.file(`dossiers/${leadId}/${pdfFileName}`);
        await pdfFileRef.save(pdfBuffer, { metadata: { contentType: 'application/pdf' } });
        const [pdfUrl] = await pdfFileRef.getSignedUrl({ action: 'read', expires: '2026-12-31' });
        files.push({ name: pdfFileName, url: pdfUrl, size: pdfBuffer.length });
        console.log(`📄 PDF généré et sauvegardé avec succès`);

        // ─── B. GÉNÉRATION DE L'EXCEL (AVEC RATIOS) ─────────────────────
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Système CRM';
        
        const sheet = workbook.addWorksheet('Données et Ratios');
        
        sheet.columns = [
          { header: 'Catégorie', key: 'category', width: 25 },
          { header: 'Détail', key: 'detail', width: 35 },
          { header: 'Valeur', key: 'value', width: 20 }
        ];

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

        sheet.addRows([
          ['Client', 'Prénom', prenom],
          ['Client', 'Nom', nom],
          ['Client', 'Email', email],
          ['Client', 'Téléphone', telephone],
          ['Emploi', 'Statut', statutEmploi],
          ['Emploi', 'Employeur', employeur],
          ['Emploi', 'Années de service', anneesService],
          ['Finances', 'Revenu Brut Annuel ($)', revenu],
          ['Finances', 'Revenu Mensuel Estimé ($)', revenuMensuel],
          ['Finances', 'Épargne / Liquidités ($)', epargne],
          ['Finances', 'REER ($)', reer],
          ['Finances', 'CELI ($)', celi],
          ['Dettes', 'Cartes de crédit (Solde $)', dettesCartes],
          ['Dettes', 'Paiement Auto Mensuel ($)', mensualiteAuto],
          ['Dettes', 'Prêt Étudiant (Solde $)', dettesEtudiant],
          ['Dettes', 'Autres Dettes (Solde $)', autresDettes],
          ['Dettes', 'Total Dettes Soldes ($)', totalDettesBalances],
          ['Dettes', 'Paiements Mensuels Estimés totaux ($)', dettesMensuelles],
          ['Projet Cible', 'Adresse', isGeneralPrequal ? 'Générale (Aucune)' : adresseCible],
          ['Projet Cible', isGeneralPrequal ? "Capacité d'achat estimée ($)" : "Prix ciblé ($)", isGeneralPrequal ? Math.round(capaciteAchatMax) : valeurProprieteCible],
          ['Ratios', "Ratio Dettes / Revenu mensuel (%)", parseFloat(ratioDettesRevenu)]
        ]);

        sheet.getRow(22).font = { bold: true };
        sheet.getRow(22).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } };

        const excelBuffer = await workbook.xlsx.writeBuffer();
        const excelFileName = `ratios_${prenom}_${nom}.xlsx`.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        console.log(`☁️ Envoi de l'Excel vers Firebase Storage...`);
        const excelFileRef = bucket.file(`dossiers/${leadId}/${excelFileName}`);
        await excelFileRef.save(excelBuffer, { metadata: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
        const [excelUrl] = await excelFileRef.getSignedUrl({ action: 'read', expires: '2026-12-31' });
        files.push({ name: excelFileName, url: excelUrl, size: excelBuffer.length });
        console.log(`📊 Excel généré et sauvegardé avec succès`);

        // ─── SAUVEGARDE FINALE FIRESTORE ────────────────────────────────
        await db.collection('leads_hypothecaires').doc(leadId).update({
          documentStatus: 'completed',
          generatedFiles: files, 
          aiAnalysis: aiAnalysisText 
        });

        console.log(`📂 ${files.length} fichier(s) sauvegardé(s) dans Firebase et Firestore mis à jour pour: ${leadId}`);

        // ─── EMAIL AU COURTIER ──────────────────────────────────────────
        if (brokerEmail) {
          try {
            const filesCount = clientFiles ? clientFiles.length : 0;
            const fileNotice = filesCount > 0 
                ? `<p style="color: #10b981; font-weight: bold;">Le client a également joint ${filesCount} document(s) justificatif(s) (talons de paie, etc.).</p>` 
                : `<p>Le client n'a joint aucun document supplémentaire.</p>`;

            const brokerMsg = {
              to: brokerEmail,
              from: 'info@optimiplex.com', 
              subject: `✅ Bilan reçu et Documents prêts : Dossier ${prenom} ${nom}`,
              html: `
                <div style="font-family: sans-serif; padding: 25px; color: #333; max-width: 650px; border: 1px solid #eee; border-radius: 12px;">
                  <h2 style="color: #4f46e5;">Le bilan financier est complété !</h2>
                  <p>Le client <b>${prenom} ${nom}</b> a rempli son formulaire de pré-qualification.</p>
                  ${isGeneralPrequal ? '<p style="font-weight: bold;">Ceci est une pré-qualification générale (sans propriété spécifique).</p>' : `<p>Propriété ciblée : <b>${adresseCible}</b></p>`}
                  <p>Le rapport PDF détaillé et la grille Excel des ratios ont été générés avec succès à partir de ses données.</p>
                  
                  <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
                    ${fileNotice}
                  </div>

                  <p>Rendez-vous dans le CRM pour télécharger les documents et valider les informations.</p>
                  <a href="https://optimiplex.com/crm" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px;">Ouvrir le CRM Courtier</a>
                </div>
              `
            };
            await sgMail.send(brokerMsg);
          } catch (emailError) {
            console.error(`⚠️ Échec d'envoi de l'email via SendGrid. Erreur:`, emailError.message);
          }
        }

      } catch (bgError) {
        console.error('❌ Erreur lors de la génération des documents:', bgError);
        await db.collection('leads_hypothecaires').doc(leadId).update({
          documentStatus: 'error',
          documentError: bgError.message || "Erreur inconnue lors de la génération"
        }).catch(err => console.error("Erreur lors de la sauvegarde de l'erreur:", err));
      }
    })();

  } catch (error) {
    console.error('❌ Erreur générale de la route submit:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur lors de l\'initialisation du dossier' });
    }
  }
});

async function runAgentAnalysis(leadId, leadData, manualFiles = []) {
  const AGENT_ID = process.env.ANTHROPIC_AGENT_ID || "agent_011CaDrEPbC4dArRJNX6zTH4";
  const ENV_ID = process.env.ANTHROPIC_ENVIRONMENT_ID; 

  console.log(`🤖 Démarrage de la Session IA (Agent: ${AGENT_ID}) pour le dossier: ${leadId}`);

  const sessionOptions = {
    agent: AGENT_ID,
    title: `Dossier ${leadData.prenom || ''} ${leadData.nom || leadId}`,
  };
  if (ENV_ID) sessionOptions.environment_id = ENV_ID;

  const session = await claude.beta.sessions.create(sessionOptions);

  // Fusion des noms de fichiers (Client + Courtier) pour que l'IA voie TOUT
  const allAttachedFiles = [
    ...(leadData.attachments || []),
    ...manualFiles.map(f => f.name)
  ];

  const dataForAI = {
    ...leadData,
    attachments: allAttachedFiles // L'IA verra les fichiers déposés par Rebecca !
  };

  await claude.beta.sessions.events.send(session.id, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text: `Voici les données du dossier client et les documents au dossier :\n\n${JSON.stringify(dataForAI, null, 2)}` }],
    }],
  });

  const stream = await claude.beta.sessions.events.stream(session.id);
  
  let agentAnalysis = null;
  let fallbackText = "";

  for await (const event of stream) {
    if (event.type === "agent.custom_tool_use" || event.type === "agent.tool_use") {
      if (event.name === "submit_mortgage_analysis") {
        agentAnalysis = event.input;
      }
    } else if (event.type === "agent.message") {
      for (const block of event.content) {
        if (block.type === "text") {
          fallbackText += block.text + "\n";
        }
      }
    } else if (event.type === "session.status_idle") {
      break;
    }
  }

  if (!agentAnalysis) {
    try {
      agentAnalysis = parseClaudeJSON(fallbackText);
    } catch (err) {
      agentAnalysis = {
        confidence_score: "Moyenne",
        missing_documents: ["⚠️ Impossible de structurer les documents manquants."],
        narrative: fallbackText 
      };
    }
  }

  const db = admin.firestore(); 
  await db.collection('leads_hypothecaires').doc(leadId).update({
    agentAnalysis: agentAnalysis,
    agentStatus: 'completed'
  });

  return agentAnalysis;
}

// 1. Analyse initiale (via ClientPortal)
app.post('/api/agent/analyze-lead', async (req, res) => {
  try {
    const { leadId, leadData } = req.body;
    if (!leadId || !leadData) return res.status(400).json({ error: "Données manquantes." });
    
    await runAgentAnalysis(leadId, leadData, []);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erreur lors de l'analyse IA:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Ré-analyse dynamique (Déclenchée par le CRM quand Rebecca ajoute un fichier)
app.post('/api/agent/reanalyze-lead', async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ error: "Lead ID manquant." });

    const db = admin.firestore();
    const docSnap = await db.collection('leads_hypothecaires').doc(leadId).get();
    
    if (!docSnap.exists) throw new Error("Dossier introuvable");
    
    const data = docSnap.data();
    // On reconstruit le payload avec les données du CRM + les fichiers
    const leadDataPayload = {
      ...data.clientDetails,
      ...data.financialData,
      attachments: data.clientFiles ? data.clientFiles.map(f => f.name) : []
    };

    const manualFiles = data.manualFiles || [];

    await runAgentAnalysis(leadId, leadDataPayload, manualFiles);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erreur lors de la ré-analyse IA:", error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// 📧 ASSISTANT COURRIEL : RÉDACTION ET ENVOI
// ====================================================================
// quote
app.post('/api/contact/quote', async (req, res) => {
  try {
    const { userId, productOfInterest, name, email, phone, teamSize, description } = req.body;

    // 1. Validation de base (La description est maintenant optionnelle)
    if (!email || !name) {
      return res.status(400).json({ error: "Données obligatoires manquantes" });
    }

    // 2. Formatage du courriel pour toi (info@optimiplex.com)
    const msg = {
      to: 'info@optimiplex.com', // 🚀 Destination finale de la soumission
      from: {
        email: 'noreply@optimiplex.com', // Ton courriel vérifié dans SendGrid
        name: 'Portail B2B Optimiplex'
      },
      replyTo: email, // Hyper pratique : tu pourras faire "Répondre" directement au prospect dans ton gestionnaire de courriels
      subject: `🚨 Nouvelle demande B2B : ${productOfInterest} (${name})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #4f46e5; border-bottom: 2px solid #eef2ff; padding-bottom: 10px;">
            Nouvelle demande de soumission B2B
          </h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Produit ciblé :</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #4f46e5; font-weight: bold;">${productOfInterest}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Nom complet :</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Courriel :</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Téléphone :</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${phone || '<i>Non spécifié</i>'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Taille de l'équipe :</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${teamSize}</td>
            </tr>
          </table>

          <div style="margin-top: 30px; background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <h3 style="margin-top: 0; color: #334155; font-size: 14px; text-transform: uppercase;">Description des besoins :</h3>
            <p style="color: #475569; line-height: 1.6; white-space: pre-wrap;">${description || '<i>Aucune description fournie.</i>'}</p>
          </div>

          <div style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">
            ID Utilisateur Firestore : ${userId || 'Non connecté'}
          </div>
        </div>
      `,
    };

    // 3. Envoi via SendGrid
    await sgMail.send(msg);

    // 4. (Optionnel) Historisation dans Firestore pour garder une trace de tes "Leads Entrants B2B"
    const db = admin.firestore();
    await db.collection('quote_requests').add({
      userId: userId || null,
      name,
      email,
      phone,
      teamSize,
      productOfInterest,
      description: description || '',
      status: 'nouveau', // Statut pour ton propre suivi interne
      createdAt: FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: "Demande envoyée avec succès" });

  } catch (error) {
    console.error("❌ Erreur SendGrid (Quote):", error);
    res.status(500).json({ error: "Erreur lors de l'envoi de la demande" });
  }
});
// Générer le brouillon avec Claude
app.post('/api/agent/draft-email', async (req, res) => {
  try {
    const { leadId, instruction, missingDocs, brokerName } = req.body;

    const prompt = `
      Tu es l'assistant personnel de ${brokerName || 'un courtier hypothécaire'}. 
      Rédige le contenu HTML d'un courriel que le courtier envoie personnellement à son client.
      Documents manquants au dossier : ${missingDocs ? missingDocs.join(', ') : 'Aucun'}.
      Instruction supplémentaire du courtier : "${instruction}".
      
      Directives de formatage :
      - Utilise des balises HTML simples (<p>, <ul>, <li>, <strong>, <br>).
      - Ne mets PAS de bloc de code \`\`\`html. Renvoie uniquement le texte HTML brut.
      - Ton professionnel, rassurant et proactif.
      - Signature : Termine par "Chaleureusement," suivi de "${brokerName || 'Votre courtier Optimiplex'}". Ne mentionne PAS Rebecca si ce n'est pas elle la courtière assignée.
    `;

    const message = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });

    res.json({ draft: message.content[0].text });
  } catch (error) {
    console.error("❌ Erreur génération brouillon:", error);
    res.status(500).json({ error: error.message });
  }
});

// Envoi officiel via SendGrid après confirmation humaine
app.post('/api/broker/send-followup', async (req, res) => {
  try {
    const { leadId, email, subject, htmlContent, brokerName, brokerEmail } = req.body;

    if (!email || !htmlContent) return res.status(400).json({ error: "Données manquantes" });

    const msg = {
      to: email,
      from: {
        email: brokerEmail || 'rebecca@optimiplex.com', // 🚀 UTILISE MAINTENANT LE COURRIEL DU COURTIER ASSIGNÉ
        name: brokerName || "L'équipe Optimiplex"
      },
      replyTo: brokerEmail || 'rebecca@optimiplex.com',
      subject: subject || "Action requise : Votre dossier de financement Optimiplex",
      html: htmlContent,
    };

    await sgMail.send(msg);

    // Historisation dans Firestore
    const db = admin.firestore();
    await db.collection('leads_hypothecaires').doc(leadId).collection('history').add({
      type: 'email_sent',
      sentAt: FieldValue.serverTimestamp(),
      subject: subject
    });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erreur SendGrid:", error);
    res.status(500).json({ error: "Erreur lors de l'envoi du courriel" });
  }
});

// Envoi d'un document généré au client (Bouton "Envoyer")
app.post('/api/broker/send-file', async (req, res) => {
  try {
    const { leadId, email, fileName, fileUrl, brokerName, brokerEmail } = req.body;

    if (!email || !fileUrl) return res.status(400).json({ error: "Données manquantes" });

    const msg = {
      to: email,
      from: {
        email: brokerEmail || 'rebecca@optimiplex.com', // 🚀 UTILISE MAINTENANT LE COURRIEL DU COURTIER ASSIGNÉ
        name: brokerName || "L'équipe Optimiplex"
      },
      replyTo: brokerEmail || 'rebecca@optimiplex.com',
      subject: `Votre document de financement : ${fileName}`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4f46e5;">Bonjour,</h2>
            <p>Voici le document <strong>${fileName}</strong> préparé par votre courtier hypothécaire.</p>
            <p style="margin: 30px 0;">
              <a href="${fileUrl}" style="padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Télécharger le document
              </a>
            </p>
            <p>Si vous avez des questions, n'hésitez pas à répondre directement à ce courriel.</p>
            <p style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
              Cordialement,<br/>
              <strong>${brokerName || "L'équipe Optimiplex"}</strong>
            </p>
        </div>
      `,
    };

    await sgMail.send(msg);

    // Historisation dans Firestore
    const db = admin.firestore();
    await db.collection('leads_hypothecaires').doc(leadId).collection('history').add({
      type: 'file_sent',
      fileName: fileName,
      sentAt: FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erreur SendGrid Document:", error);
    res.status(500).json({ error: "Erreur lors de l'envoi du document" });
  }
});

// ============================================================================
// 🏠 ROUTES CRM IMMOBILIER (Équivalent du CRM Hypothécaire)
// ============================================================================

app.post('/api/immo/quick-lead', async (req, res) => {
  try {
    const { formData, propertyDetails, clientType } = req.body;
    const db = admin.firestore();

    const leadRef = await db.collection('leads_immobiliers').add({
      clientEmail: formData.email,
      clientDetails: {
        prenom: formData.prenom,
        nom: formData.nom,
        telephone: formData.telephone,
        type: clientType || 'Acheteur'
      },
      propertyDetails: propertyDetails || {},
      status: 'nouveau',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'bouton_propriete_direct'
    });

    const msg = {
      to: 'xavier.lavoie@optimiplex.com', 
      from: 'info@optimiplex.com', 
      subject: `🚨 NOUVEAU LEAD IMMOBILIER : ${propertyDetails?.address || 'Recherche de propriété'}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #2563eb;">Nouveau Lead Immobilier (${clientType})</h2>
          <div style="background: #eff6ff; padding: 15px; border-left: 4px solid #2563eb; margin-bottom: 20px;">
            <strong>📍 Propriété / Cible :</strong><br/>
            Adresse : <b>${propertyDetails?.address || 'Non spécifiée'}</b><br/>
            Budget/Prix : <b>${propertyDetails?.price || 'À déterminer'}</b><br/>
          </div>
          <h3>Coordonnées du client :</h3>
          <ul>
            <li><strong>Prénom et Nom :</strong> ${formData.prenom} ${formData.nom}</li>
            <li><strong>Courriel :</strong> ${formData.email}</li>
            <li><strong>Téléphone :</strong> ${formData.telephone}</li>
          </ul>
          <p style="margin-top: 20px;">
            <a href="https://optimiplex.com/crm-immo" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ouvrir le CRM Immobilier</a>
          </p>
        </div>
      `
    };
    await sgMail.send(msg);

    res.json({ success: true, id: leadRef.id });
  } catch (error) {
    console.error('Erreur quick-lead immo:', error);
    res.status(500).json({ error: "Erreur lors de la création du dossier immobilier" });
  }
});

app.post('/api/immo/assign', async (req, res) => {
  try {
    const { leadId, brokerEmail, brokerName, clientEmail } = req.body;
    const db = admin.firestore();

    await db.collection('leads_immobiliers').doc(leadId).update({
      assignedTo: brokerEmail,
      assignedBrokerName: brokerName,
      status: 'preparation',
      assignedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Courriel au Client
    const clientMsg = {
      to: clientEmail,
      from: 'info@optimiplex.com', 
      subject: `Votre projet immobilier est confié à ${brokerName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Excellente nouvelle !</h2>
          <p>Votre projet immobilier a été confié à notre expert(e) <strong>${brokerName}</strong>.</p>
          <p>${brokerName} vous contactera très prochainement pour discuter des prochaines étapes de votre transaction.</p>
        </div>
      `
    };

    // Courriel au Courtier
    const brokerMsg = {
      to: brokerEmail,
      from: 'info@optimiplex.com',
      subject: `🎯 Nouveau dossier immobilier assigné: ${clientEmail}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Un nouveau dossier t'a été assigné</h2>
          <p>Le client <strong>${clientEmail}</strong> t'a été attribué. Connecte-toi au CRM Immobilier pour voir les détails (Acheteur/Vendeur).</p>
        </div>
      `
    };

    await sgMail.send(clientMsg);
    await sgMail.send(brokerMsg);

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur assignation immo:', error);
    res.status(500).json({ error: 'Erreur lors de l\'assignation' });
  }
});

app.post('/api/immo/send-followup', async (req, res) => {
  try {
    const { leadId, email, subject, htmlContent, brokerName, brokerEmail } = req.body;

    if (!email || !htmlContent) return res.status(400).json({ error: "Données manquantes" });

    const msg = {
      to: email,
      from: { email: brokerEmail || 'info@optimiplex.com', name: brokerName || "Optimiplex Immobilier" },
      replyTo: brokerEmail || 'info@optimiplex.com',
      subject: subject || "Mise à jour de votre dossier immobilier",
      html: htmlContent,
    };

    await sgMail.send(msg);

    const db = admin.firestore();
    await db.collection('leads_immobiliers').doc(leadId).collection('history').add({
      type: 'email_sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      subject: subject
    });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erreur SendGrid Immo:", error);
    res.status(500).json({ error: "Erreur lors de l'envoi du courriel" });
  }
});


app.post('/api/immo/agent/draft-email', async (req, res) => {
  try {
    const { instruction, missingDocs, brokerName } = req.body;

    const prompt = `
      Tu es l'assistant personnel de ${brokerName || 'un courtier immobilier'}. 
      Rédige le contenu HTML d'un courriel à envoyer au client (Acheteur ou Vendeur).
      Documents manquants au dossier (s'il y a lieu) : ${missingDocs && missingDocs.length ? missingDocs.join(', ') : 'Aucun'}.
      Instruction supplémentaire du courtier : "${instruction}".
      
      Directives de formatage :
      - Utilise des balises HTML simples (<p>, <ul>, <li>, <strong>, <br>).
      - Ton professionnel, rassurant et axé sur le marché immobilier.
      - Signature : Termine par "Chaleureusement," suivi de "${brokerName || 'Votre courtier Immobilier'}".
    `;

    const message = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001', // Utilisation de Haiku pour plus de rapidité
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });

    res.json({ draft: message.content[0].text });
  } catch (error) {
    console.error("❌ Erreur génération brouillon immo:", error);
    res.status(500).json({ error: error.message });
  }
});
// ====================================================================
// 🧠 AGENT IA IMMOBILIER (CLAUDE SESSIONS)
// ====================================================================
async function runImmoAgentAnalysis(leadId, leadData, manualFiles = []) {
  // 👉 NOUVELLE VARIABLE D'ENVIRONNEMENT POUR L'AGENT IMMO
  const AGENT_ID = process.env.ANTHROPIC_AGENT_ID_IMMO || "agent_immo_default";
  const ENV_ID = process.env.ANTHROPIC_ENVIRONMENT_ID; 

  console.log(`🤖 Démarrage de la Session IA Immo (Agent: ${AGENT_ID}) pour le dossier: ${leadId}`);

  const sessionOptions = {
    agent: AGENT_ID,
    title: `Dossier Immo ${leadData.clientDetails?.prenom || ''} ${leadData.clientDetails?.nom || leadId}`,
  };
  if (ENV_ID) sessionOptions.environment_id = ENV_ID;

  const session = await claude.beta.sessions.create(sessionOptions);

  // Fusion des noms de fichiers pour que l'IA voie TOUT ce qui a été déposé
  const allAttachedFiles = [
    ...(leadData.clientFiles ? leadData.clientFiles.map(f => f.name) : []),
    ...manualFiles.map(f => f.name)
  ];

  const dataForAI = {
    ...leadData,
    attachments: allAttachedFiles 
  };

  await claude.beta.sessions.events.send(session.id, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text: `Voici les données du dossier immobilier et les documents au dossier :\n\n${JSON.stringify(dataForAI, null, 2)}` }],
    }],
  });

  const stream = await claude.beta.sessions.events.stream(session.id);
  
  let agentAnalysis = null;
  let fallbackText = "";

  for await (const event of stream) {
    if (event.type === "agent.custom_tool_use" || event.type === "agent.tool_use") {
      // ⚠️ IMPORTANT: Assure-toi de nommer l'outil 'submit_real_estate_analysis' dans la console Claude !
      if (event.name === "submit_real_estate_analysis") {
        agentAnalysis = event.input;
      }
    } else if (event.type === "agent.message") {
      for (const block of event.content) {
        if (block.type === "text") {
          fallbackText += block.text + "\n";
        }
      }
    } else if (event.type === "session.status_idle") {
      break;
    }
  }

  if (!agentAnalysis) {
    try {
      // Tente de parser le texte brut si l'IA n'a pas utilisé l'outil
      const jsonMatch = fallbackText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         agentAnalysis = JSON.parse(jsonMatch[0]);
      } else {
         throw new Error("No JSON found");
      }
    } catch (err) {
      agentAnalysis = {
        confidence_score: "Moyenne",
        missing_documents: ["⚠️ Analyse textuelle générée sans formatage strict."],
        narrative: fallbackText 
      };
    }
  }

  const db = admin.firestore(); 
  await db.collection('leads_immobiliers').doc(leadId).update({
    agentAnalysis: agentAnalysis,
    agentStatus: 'completed'
  });

  return agentAnalysis;
}

app.post('/api/immo/agent/run-task', async (req, res) => {
  try {
    const { leadId, leadData, instruction } = req.body;
    
    const AGENT_ID = process.env.ANTHROPIC_AGENT_ID_IMMO || "agent_immo_default";
    const ENV_ID = process.env.ANTHROPIC_ENVIRONMENT_ID; 
    
    // 1. Démarrer la session avec Claude
    const sessionOptions = {
      agent: AGENT_ID,
      title: `Tâche IA Immo - ${leadData.clientDetails?.prenom || leadId}`
    };
    if (ENV_ID) sessionOptions.environment_id = ENV_ID;

    const session = await claude.beta.sessions.create(sessionOptions);

    // 2. Préparer le contexte
    const dataForAI = {
      ...leadData,
      attachments: leadData.clientFiles ? leadData.clientFiles.map(f => f.name) : []
    };

    // 3. Envoyer le prompt à la session
    const prompt = `Voici le dossier immobilier : \n${JSON.stringify(dataForAI, null, 2)}\n\nINSTRUCTION REQUISE : ${instruction}\n\nRéponds uniquement avec le contenu demandé. N'utilise pas d'introduction (comme "Voici la réponse"). Si des documents pertinents ne sont pas présents, utilise ton intelligence pour générer un résultat cohérent ou le signaler.`;

    await claude.beta.sessions.events.send(session.id, {
      events: [{ type: "user.message", content: [{ type: "text", text: prompt }] }]
    });

    // 4. Écouter et récupérer la réponse
    const stream = await claude.beta.sessions.events.stream(session.id);
    let aiResponse = "";
    
    for await (const event of stream) {
      if (event.type === "agent.message") {
        for (const block of event.content) {
          if (block.type === "text") {
            aiResponse += block.text;
          }
        }
      }
      
      // 🚀 LA CORRECTION EST ICI : 
      // Dès que l'Agent a fini de répondre ("session.status_idle"), on coupe le flux pour renvoyer la réponse au Frontend immédiatement !
      if (event.type === "session.status_idle" || event.type === "error") {
        break;
      }
    }
    
    res.json({ result: aiResponse });
  } catch (error) {
    console.error("Erreur Agent Run-Task:", error);
    res.status(500).json({ error: error.message });
  }
});

// Routes d'appel
app.post('/api/immo/agent/analyze-lead', async (req, res) => {
  try {
    const { leadId, leadData } = req.body;
    if (!leadId || !leadData) return res.status(400).json({ error: "Données manquantes." });
    
    await runImmoAgentAnalysis(leadId, leadData, []);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erreur lors de l'analyse IA Immo:", error);
    res.status(500).json({ error: error.message });
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