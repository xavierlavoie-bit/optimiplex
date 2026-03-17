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

// PROMPT SYSTÈME CHATBOT IMMOBILIER QUÉBEC
function getRealEstateChatSystemPrompt(modelUsed = 'base') {
  // ==========================================
  // 🌟 INSTRUCTIONS COMMUNES (Adaptabilité & Concision)
  // ==========================================
  let basePrompt = `
Tu es **Optimiplex IA**, l'intelligence artificielle d'analyse immobilière au Québec.
RÈGLE D'OR : Sois HYPER CONCIS, DIRECT et CONVERSATIONNEL. Ta réponse complète doit tenir en moins de 400 mots pour garantir un affichage ultra-rapide. Va droit au but, élimine le bla-bla.
🚨 RÈGLE DE FIN : Assure-toi de toujours terminer tes phrases et de conclure ta réponse proprement, ne laisse jamais une phrase en suspens.

🎯 ADAPTABILITÉ SELON LE TYPE DE BIEN :
1. Petit Plex (Duplex, Triplex) : L'acheteur est souvent propriétaire-occupant.
   - Parle de : Cashflow net après hypothèque, coût d'habitation mensuel, mise de fonds réduite (5-10%), et règles du TAL (reprise de logement). 
   - Évite : Les termes institutionnels lourds (TGA, MRB, TRI) à moins d'être pertinents.
2. Multi-logements (5 plex et +) : L'acheteur est un investisseur pur.
   - Parle de : Valeur économique, TGA (Cap Rate), MRB, Ratio de Couverture de la Dette (RCD/DSCR), financement SCHL (APH Select), optimisation de la valeur.

🌐 ALTERNATIVES DE RECHERCHE (TRÈS IMPORTANT) :
- Si un site d'annonces (comme Centris) bloque l'accès ou ne donne pas assez d'infos, tu DOIS chercher la même propriété sur d'autres plateformes.
- Excellentes alternatives au Québec : **Realtor.ca**, **DuProprio**, **Point2Homes**, **Kijiji Immobilier**, ou **Publimaison**.
- Utilise l'adresse de la propriété ou le numéro MLS/SIA pour trouver ces fiches alternatives.

📝 FORMATAGE (CRITIQUE POUR L'AFFICHAGE) : 
- Utilise le Markdown de manière aérée avec des sauts de ligne.
- Mets en **gras** les chiffres et métriques clés.
- N'utilise **JAMAIS de tableaux Markdown** (pas de format | Colonne | Colonne |). L'interface du chat ne les supporte pas bien.
- Utilise **UNIQUEMENT des listes à puces** (-) pour présenter les chiffres, les revenus et les dépenses.
`;

  // ==========================================
  // 🌟 PROMPT PRO (Expertise Financière)
  // ==========================================
  if (modelUsed === 'pro') {
    return basePrompt + `
TON PROFIL PRO : Tu agis comme un Directeur des Investissements (CIO) pour des investisseurs sérieux. 
- Si l'utilisateur pose une question simple, réponds en 1 ou 2 paragraphes maximum.
- UNIQUEMENT si l'utilisateur soumet un deal à analyser (avec prix, revenus, etc.), utilise cette structure :
  1. Verdict Rapide : Ton avis tranché (2 phrases max).
  2. Modélisation : Les vrais chiffres présentés en **liste à puces** claire (adaptés au type d'immeuble). Ne liste que l'essentiel.
  3. Risques & Stratégie : Ce qui cloche et les prochaines étapes (très concis).
`;
  }

  // ==========================================
  // ⚡ PROMPT BASE (Analyse Flash)
  // ==========================================
  return basePrompt + `
TON PROFIL BASE : Tu agis comme un analyste pragmatique pour donner l'heure juste rapidement.
- Va droit au but.
- Si on te donne un deal, fournis un verdict flash (Go/No-go) et 2-3 puces sur les chiffres clés (sans aucun tableau).
`;
}



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
      proprietyType,
      addresseComplete,
      ville,
      quartier,
      codePostal,
      prixAchat, // Désormais optionnel
      anneeAchat, // Désormais optionnel
      anneeConstruction,
      surfaceHabitee,
      surfaceLot,
      nombreChambres,
      nombreSallesBain,
      garage,
      sous_sol,
      etatGeneral,
      renobations,
      toitureAnnee, // Nouvelles variables
      fenetresAnnee,
      plomberieEtat,
      electriciteEtat,
      piscine,
      terrain_detail,
      notes_additionnelles
    } = req.body;

    // Validation (prixAchat et anneeAchat retirés des requis obligatoires)
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
    
    // Logique saisonnière
    let contexteSaisonnier = "Marché standard";
    if (['décembre', 'janvier', 'février'].includes(moisActuel)) {
        contexteSaisonnier = "Hiver (Inventaire bas, acheteurs sérieux uniquement)";
    } else if (['mars', 'avril', 'mai', 'juin'].includes(moisActuel)) {
        contexteSaisonnier = "Printemps (Saison de pointe, surenchère possible)";
    } else if (['juillet', 'août'].includes(moisActuel)) {
        contexteSaisonnier = "Été (Marché plus lent, vacances)";
    }

    // Gestion de l'historique d'achat optionnel
    const aDesDonneesAchat = !!(prixAchat && anneeAchat);
    const infoAchat = aDesDonneesAchat 
        ? `- Prix d'achat en ${anneeAchat}: ${prixAchat}$` 
        : `- Historique d'achat non fourni. Ne pas calculer d'appréciation historique.`;

    console.log(`\n========================================================`);
    console.log(`🏠 NOUVELLE ÉVALUATION: ${proprietyType} à ${ville}`);
    console.log(`========================================================\n`);

    // 1. Définition des outils de recherche
    const tools = [
      {
        name: "web_search",
        description: "Recherche en temps réel les propriétés vendues ou à vendre sur Centris, JLR, DuProprio. Utilise ceci pour trouver des comparables avec des prix réels et des liens exacts.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "La requête de recherche (ex: 'maison à vendre Lévis Desjardins Centris 2026')" }
          },
          required: ["query"]
        }
      }
    ];

    const systemPrompt = `
      Tu es un expert en évaluation immobilière (A.É.) au Québec, membre de l'OEAQ.
      Tu AS accès à Internet via l'outil 'web_search'. Utilise-le pour trouver des comparables RÉELS.
      
      RÈGLES STRICTES POUR LES LIENS ET COMPARABLES :
      1. Rigueur absolue. Pas d'hallucination d'adresses.
      2. N'INVENTE JAMAIS D'URL. C'est une erreur grave. Pour le champ "url" de tes comparables, tu dois COPIER-COLLER UNIQUEMENT la valeur exacte retournée après le mot "Lien:" dans tes recherches web. 
      3. Si tu trouves une propriété pertinente, mais que les résultats de recherche ne t'ont pas donné de lien web direct vers l'annonce, ALORS METS "url": null. Ne devine pas la structure de l'URL Centris.
      4. Sépare l'évaluation marchande du prix d'achat initial. L'évaluation doit refléter la valeur d'aujourd'hui.
      5. Réponds uniquement avec un JSON valide.
    `;

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

      ÉTAT ET COMPOSANTES:
      - État Général: ${etatGeneral.toUpperCase()}
      - Toiture: ${toitureAnnee ? 'Année ' + toitureAnnee : 'Inconnu'}
      - Fenêtres: ${fenetresAnnee ? 'Année ' + fenetresAnnee : 'Inconnu'}
      - Plomberie: ${plomberieEtat || 'Inconnu'} | Électricité: ${electriciteEtat || 'Inconnu'}
      - Rénovations / Notes: ${notes_additionnelles || renobations?.join(', ') || 'Aucune'}

      RECHERCHE : Trouve les comparables de prix vendus ou actifs pour ce type de propriété dans ce secteur.
      
      DONNÉES FINANCIÈRES (Pour calcul gain uniquement):
      ${infoAchat}

      FORMAT JSON ATTENDU:
      {
        "estimationActuelle": { "valeurBasse": 0, "valeurMoyenne": 0, "valeurHaute": 0, "confiance": "haute" },
        "analyse": { "appreciationTotale": ${aDesDonneesAchat ? '0' : 'null'}, "pourcentageGainTotal": ${aDesDonneesAchat ? '0' : 'null'}, "marketTrend": "vendeur", "analyseSecteur": "" },
        "facteursPrix": { "positifs": [], "negatifs": [], "incertitudes": [] },
        "recommendations": { "renovationsRentables": [], "strategieVente": "" },
        "comparables": [
          { "adresse": "...", "statut": "vendu ou actif", "prix": 0, "date": "...", "caracteristiques": "...", "url": "Lien exact ou null" }
        ]
      }
    `;

    const messages = [{ role: 'user', content: valuationPrompt }];

    console.log("🤖 [IA] Appel initial à Claude envoyé...");
    
    // 2. Appel initial
    let response = await claude.messages.create({
      model: 'claude-sonnet-4-6', // Modèle plus intelligent pour l'analyse
      max_tokens: 4000,
      temperature: 0,
      system: systemPrompt,
      tools: tools,
      messages: messages
    });

    // 3. Boucle Tool Use (itérations de recherche)
    let iterations = 0;
    const maxIterations = 3;

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;
      console.log(`\n🔄 [ITÉRATION ${iterations}/${maxIterations}] L'IA décide de chercher sur le web...`);
      
      const toolResults = [];
      const toolCalls = response.content.filter(c => c.type === 'tool_use');

      for (const toolCall of toolCalls) {
        let resultStr = "Aucun résultat trouvé.";
        if (toolCall.name === 'web_search') {
          const query = toolCall.input.query;
          console.log(`   🔍 Requête IA : "${query}"`);

          try {
            const searchResponse = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: { "X-API-KEY": process.env.SERPER_API_KEY || "", "Content-Type": "application/json" },
              body: JSON.stringify({ q: query, gl: "ca", hl: "fr" })
            });
            const data = await searchResponse.json();
            
            // On augmente à 8 résultats organiques pour maximiser les chances d'avoir des liens propres Centris/Duproprio
            const resultsList = data.organic?.slice(0, 8) || [];
            console.log(`   ✅ ${resultsList.length} résultats organiques trouvés via Serper.`);
            
            resultStr = resultsList.map(r => `Titre: ${r.title}\nLien: ${r.link}\nSnippet: ${r.snippet}`).join('\n\n') || "Pas de résultats.";
            
            // Log Optionnel pour débogage approfondi :
            // console.log(`\n   📄 --- RÉSULTATS RENVOYÉS À CLAUDE ---\n${resultStr}\n   ---------------------------------------\n`);

          } catch (e) {
            console.error("   ❌ Erreur Serper Valuation:", e);
            resultStr = "Erreur technique de recherche. Ne pas réessayer.";
          }
        }

        toolResults.push({ type: 'tool_result', tool_use_id: toolCall.id, content: resultStr });
      }

      messages.push({ role: 'assistant', content: response.content });
      
      if (iterations >= maxIterations) {
        console.log("   ⚠️ Limite d'itérations atteinte. Forçage de la conclusion.");
        toolResults.push({ 
          type: 'text', 
          text: "Ceci est la dernière recherche. Analyse ces résultats et génère le JSON final. RAPPEL STRICT: Pour le champ 'url' des comparables, copie-colle exactement l'URL fournie dans ces résultats. N'invente AUCUN lien. Si tu n'as pas de lien direct, inscris la valeur null." 
        });
      }

      messages.push({ role: 'user', content: toolResults });

      console.log("🤖 [IA] Renvoi des données de recherche à Claude...");
      response = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        tools: iterations < maxIterations ? tools : undefined,
        messages: messages
      });
    }

    console.log(`\n✅ [IA] Analyse terminée après ${iterations} recherche(s). Extraction du JSON...`);
    
    // 4. Extraction du contenu final
    const finalContent = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const valuationResult = parseClaudeJSON(finalContent);

    // 5. Sauvegarde Firestore
    const evaluationRef = await db.collection('users').doc(userId).collection('evaluations').add({
      proprietyType,
      ville,
      quartier,
      codePostal: codePostal || null,
      addresseComplete,
      prixAchat: prixAchat || null,
      anneeAchat: anneeAchat || null,
      anneeConstruction,
      result: valuationResult,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paidWith: req.quotaInfo.mode
    });

    console.log(`💾 Sauvegardé dans Firestore (ID: ${evaluationRef.id})`);

    // 6. Déduction Usage
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

// ====================================================================
// 🏢 ENDPOINT : VALUATION COMMERCIALE (COMPLEXE)
// ====================================================================
app.post('/api/property/valuation-estimator-commercial', checkQuotaOrCredits, async (req, res) => {
  try {
    const {
      userId,
      proprietyType, 
      typeCom, 
      ville,
      quartier = '',
      codePostal = '', // Ajouté ici pour corriger la ReferenceError
      addresseComplete = '',
      prixAchat, // Optionnel
      anneeAchat, // Optionnel
      anneeConstruction, // Optionnel si terrain
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

    // ✅ NORMALISATION
    const finalProprieTyType = proprietyType || typeCom;
    const finalRevenusAnnuels = revenus_bruts_annuels || revenuBrutAnnuel;
    const finalDepenses = depenses_annuelles || depensesAnnuelles;
    const isTerrain = finalProprieTyType === 'terrain_commercial';

    // ✅ VALIDATIONS OBLIGATOIRES (Achat n'est plus requis. Construction requise sauf pour terrain)
    if (!finalProprieTyType || !ville || (!isTerrain && !anneeConstruction)) {
      return res.status(400).json({
        error: 'Paramètres obligatoires manquants',
        required: ['proprietyType', 'ville'].concat(isTerrain ? [] : ['anneeConstruction'])
      });
    }

    console.log(`\n========================================================`);
    console.log(`🏪 ÉVALUATION COMMERCIALE: ${finalProprieTyType} à ${ville}`);
    console.log(`========================================================\n`);

    const anneeActuelle = new Date().getFullYear();
    const ageConstruction = isTerrain ? 'N/A' : (anneeActuelle - anneeConstruction);
    
    // Logique Historique (Optionnel)
    const aDesDonneesAchat = !!(prixAchat && anneeAchat);
    const infoAchat = aDesDonneesAchat 
        ? `- Prix d'achat en ${anneeAchat}: ${prixAchat}$` 
        : `- Historique d'achat non fourni. Ne pas calculer d'appréciation ou de ROI historique.`;

    // 1. Définition des outils de recherche commerciaux
    const tools = [
      {
        name: "web_search",
        description: "Recherche en temps réel les propriétés commerciales vendues ou actives sur Centris Commercial, LoopNet, et rapports de marché (ex: CBRE, JLL, Colliers) au Québec. Trouve les prix et les URL exactes.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "La requête (ex: 'immeuble à revenus ${ville} Centris vendu 2026' ou 'Cap Rate commercial ${ville}')" }
          },
          required: ["query"]
        }
      }
    ];

    // ============================================
    // CONSTRUCTION DU PROMPT SPÉCIFIQUE
    // ============================================
    let promptSpecifique = '';

    if (finalProprieTyType === 'immeuble_revenus') {
      const noi = finalRevenusAnnuels - finalDepenses;
      promptSpecifique = `
DONNÉES FINANCIÈRES IMMEUBLE À REVENUS:
- Unités: ${nombreUnites} | Occupation: ${tauxOccupation}% | Loyer moyen: $${loyerMoyenParUnite}/mois
- Revenus annuels: $${finalRevenusAnnuels?.toLocaleString('fr-CA')} | Dépenses: $${finalDepenses?.toLocaleString('fr-CA')}
- NOI (RNE) déclaré: $${noi?.toLocaleString('fr-CA')}
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

    const systemPrompt = `
      Tu es un expert évaluateur immobilier commercial (A.É.) au Québec, spécialiste des Cap Rates et du rendement.
      Tu AS accès à Internet via 'web_search'. Utilise-le pour valider les taux de capitalisation (Cap Rates) et les comparables actuels.
      
      RÈGLES STRICTES :
      1. Rigueur absolue sur les métriques (NOI, MRB, Cap Rate).
      2. N'INVENTE JAMAIS D'URL pour les comparables. Si la recherche te donne un lien valide (Centris, LoopNet, etc.), utilise-le. Sinon, inscris "url": null.
      3. L'évaluation marchande ne doit PAS être influencée par le prix d'achat passé. Base-toi sur l'approche du revenu et la parité de marché d'aujourd'hui.
      4. Réponds UNIQUEMENT avec un JSON valide.
    `;

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
      
      DONNÉES HISTORIQUES D'ACHAT (Pour section analyse uniquement):
      ${infoAchat}

      RECHERCHE: Trouve 2 à 4 comparables (vendus ou actifs) et identifie le taux de capitalisation moyen (Cap Rate) dans ce secteur pour 2025/2026.
      
      FORMAT JSON ATTENDU:
      {
        "estimationActuelle": { "valeurBasse": 0, "valeurMoyenne": 0, "valeurHaute": 0, "confiance": "haute" },
        "metriquesCommerciales": { "capRate": 0, "noiAnnuel": 0, "cashOnCash": 0, "revenuParSurfaceLocable": 0, "multiplicateurRevenu": 0 },
        "analyse": { "appreciationTotale": ${aDesDonneesAchat ? '0' : 'null'}, "pourcentageGainTotal": ${aDesDonneesAchat ? '0' : 'null'}, "marketTrend": "equilibre", "secteurAnalysis": "Paragraphe d'analyse" },
        "facteursPrix": { "positifs": ["..."], "negatifs": ["..."], "incertitudes": ["..."] },
        "recommendations": { "renovationsRentables": ["..."], "optimisationRevenu": ["..."], "reduceExpenses": ["..."], "strategie": "...", "timing": "..." },
        "comparables": [
          { "adresse": "...", "statut": "vendu ou actif", "prix": 0, "date": "...", "caracteristiques": "...", "url": "Lien exact web_search ou null" }
        ]
      }
    `;

    const messages = [{ role: 'user', content: valuationPrompt }];

    console.log("🤖 [IA] Appel initial commercial envoyé...");
    
    // 2. Appel initial
    let response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      temperature: 0,
      system: systemPrompt,
      tools: tools,
      messages: messages
    });

    // 3. Boucle Tool Use
    let iterations = 0;
    const maxIterations = 3;

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;
      console.log(`\n🔄 [ITÉRATION ${iterations}/${maxIterations}] L'IA cherche sur le web (Commercial)...`);
      
      const toolResults = [];
      const toolCalls = response.content.filter(c => c.type === 'tool_use');

      for (const toolCall of toolCalls) {
        let resultStr = "Aucun résultat trouvé.";
        if (toolCall.name === 'web_search') {
          const query = toolCall.input.query;
          console.log(`   🔍 Requête IA : "${query}"`);

          try {
            const searchResponse = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: { "X-API-KEY": process.env.SERPER_API_KEY || "", "Content-Type": "application/json" },
              body: JSON.stringify({ q: query, gl: "ca", hl: "fr" })
            });
            const data = await searchResponse.json();
            
            // 8 résultats max pour le commercial (on cherche souvent des rapports PDFs ou Centris Commercial)
            const resultsList = data.organic?.slice(0, 8) || [];
            console.log(`   ✅ ${resultsList.length} résultats organiques (Serper).`);
            
            resultStr = resultsList.map(r => `Titre: ${r.title}\nLien: ${r.link}\nSnippet: ${r.snippet}`).join('\n\n') || "Pas de résultats.";
          } catch (e) {
            console.error("   ❌ Erreur Serper Commercial:", e);
            resultStr = "Erreur technique de recherche.";
          }
        }
        toolResults.push({ type: 'tool_result', tool_use_id: toolCall.id, content: resultStr });
      }

      messages.push({ role: 'assistant', content: response.content });
      
      if (iterations >= maxIterations) {
        console.log("   ⚠️ Limite d'itérations. Conclusion forcée.");
        toolResults.push({ type: 'text', text: "Dernière recherche. Analyse les données recueillies, n'invente AUCUN lien pour les comparables (mets null si absent), et génère le JSON final." });
      }

      messages.push({ role: 'user', content: toolResults });

      response = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        tools: iterations < maxIterations ? tools : undefined,
        messages: messages
      });
    }

    console.log(`\n✅ [IA] Analyse Commerciale terminée. Extraction du JSON...`);
    
    // 4. Extraction du contenu final
    const finalContent = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const valuationResult = parseClaudeJSON(finalContent);

    // 5. Sauvegarde Firestore
    const evaluationRef = await db.collection('users').doc(userId).collection('evaluations_commerciales').add({
      proprietyType: finalProprieTyType,
      ville,
      quartier,
      codePostal: codePostal || null,
      addresseComplete,
      prixAchat: prixAchat || null,
      anneeAchat: anneeAchat || null,
      anneeConstruction: isTerrain ? null : anneeConstruction,
      result: valuationResult,
      evaluationType: 'commercial',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paidWith: req.quotaInfo.mode
    });

    console.log(`💾 Commercial Sauvegardé (ID: ${evaluationRef.id})`);

    // 6. Déduction Usage
    await deductUsage(userId, req.quotaInfo);

    res.json({
      id: evaluationRef.id,
      ...valuationResult,
      meta: { paidWith: req.quotaInfo.mode, searchUsed: iterations > 0 }
    });

  } catch (error) {
    console.error('\n❌ Erreur Valuation Commerciale:', error);
    res.status(500).json({ error: "Échec de l'évaluation commerciale", details: error.message });
  }
});

// ENDPOINT CHATBOT IMMOBILIER QUÉBEC (GRATUIT / PRO) AVEC SAUVEGARDE FIRESTORE


app.post('/api/realestate-chat', async (req, res) => {
  try {
    const { userId, message, conversationId = null, model: requestedModel = 'base' } = req.body;
    
    if (!userId || !message.trim()) {
      return res.status(400).json({ error: 'userId et message requis' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const userData = userDoc.data();
    const userPlan = userData?.plan || 'essai';
    const isProPlan = (userPlan === 'pro' || userPlan === 'growth' || userPlan === 'entreprise');

    const finalModel = (requestedModel === 'pro' && isProPlan) 
      ? 'claude-sonnet-4-6' 
      : 'claude-haiku-4-5-20251001';

    console.log(`\n🚀 CHAT REÇU | User: ${userId.slice(-6)} | Modèle: ${finalModel} | Pro: ${isProPlan}\n`);

    let conversationIdFinal = conversationId;
    let history = [];

    if (conversationId) {
      const convDoc = await userRef.collection('chats').doc(conversationId).get();
      if (convDoc.exists) history = convDoc.data().messages || [];
    } else {
      const newConvRef = await userRef.collection('chats').add({
        title: `Chat immobilier - ${message.slice(0, 40)}...`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        planAtCreation: userPlan,
        modelUsed: finalModel,
        messages: []
      });
      conversationIdFinal = newConvRef.id;
    }

    const convRef = userRef.collection('chats').doc(conversationIdFinal);

    // Ajout du deuxième outil pour LIRE les pages web
    const tools = isProPlan ? [
      {
        name: "web_search",
        description: "Recherche sur Google pour trouver des liens, adresses ou extraits.",
        input_schema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"]
        }
      },
      {
        name: "read_webpage",
        description: "Ouvre et lit le contenu textuel complet d'une URL spécifique (comme une page Realtor.ca) pour y extraire les tableaux financiers, les taxes et les revenus.",
        input_schema: {
          type: "object",
          properties: { url: { type: "string", description: "L'URL complète à lire (ex: https://www.realtor.ca/...)" } },
          required: ["url"]
        }
      }
    ] : undefined;

    const isProModelUsed = finalModel === 'claude-sonnet-4-6';
    let enhancedSystemPrompt = getRealEstateChatSystemPrompt(isProModelUsed ? 'pro' : 'base');
    
    if (isProPlan) {
      // OPTIMISATION : Stratégie Lecture Directe -> Alternative Realtor -> Estimation
      enhancedSystemPrompt += `
INSTRUCTIONS INTERNET ET LIENS (PRO) : 
1. ATTENTION AUX LIENS (URL) : Si l'utilisateur te donne un lien direct (Centris, DuProprio, etc.), voici ta priorité absolue :
2. STRATÉGIE "LECTURE DIRECTE PUIS ALTERNATIVE" (CRITIQUE) : 
   - ÉTAPE 1 (LECTURE DIRECTE) : Utilise IMMÉDIATEMENT l'outil 'read_webpage' sur l'URL fournie par l'utilisateur.
   - ÉTAPE 2 (ALTERNATIVE REALTOR) : Si la lecture directe échoue (page bloquée, erreur) ou ne contient pas les revenus/taxes, extrais le numéro MLS/SIA de l'URL. Fais un 'web_search' avec "Realtor.ca [Numéro MLS]" pour trouver son équivalent sur Realtor.ca, puis utilise à nouveau 'read_webpage' sur ce nouveau lien.
   - ÉTAPE 3 : Analyse le texte complet retourné pour y trouver les revenus bruts, les taxes (municipales/scolaires) et les dépenses.
3. RÈGLE D'ESTIMATION (PLAN B) : 
   - Si (et seulement si) toutes les lectures de pages échouent ou que les chiffres sont vraiment introuvables, NE BLOQUE PAS.
   - Prends le **Prix demandé** et la **Ville**, GÉNÈRE L'ANALYSE en estimant les taxes (1-1.5%) et les revenus selon le marché. Indique clairement tes estimations avec le symbole "~".`;
    } else {
      enhancedSystemPrompt += `\nINSTRUCTIONS INTERNET (BASE) : Tu n'as pas accès au web en temps réel. Refuse poliment et propose de passer à Optimiplex Pro.`;
    }

    // On réduit l'historique envoyé à Claude (Les 6 derniers suffisent pour le contexte)
    const claudeMessages = history.slice(-6).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    claudeMessages.push({ role: 'user', content: message });

    // 🔴 RETOUR À 1024 POUR LA RAPIDITÉ
    let response = await claude.messages.create({
      model: finalModel,
      max_tokens: 1024, 
      temperature: 0.2,
      system: enhancedSystemPrompt,
      tools: tools,
      messages: claudeMessages
    });

    // Boucle de gestion des outils (Internet)
    let iterations = 0;
    const maxIterations = 5;

    while (response.stop_reason === 'tool_use' && iterations < maxIterations && isProPlan) {
      iterations++;
      const toolResults = [];
      const toolCalls = response.content.filter(c => c.type === 'tool_use');

      for (const toolUse of toolCalls) {
        if (toolUse.name === 'web_search') {
          console.log(`🔍 RECHERCHE [Itération ${iterations}] : ${toolUse.input.query}`);
          let searchContent = "Aucun résultat.";
          try {
            const searchResponse = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: { 
                "X-API-KEY": process.env.SERPER_API_KEY || "", 
                "Content-Type": "application/json" 
              },
              body: JSON.stringify({ q: toolUse.input.query, gl: "ca", hl: "fr" })
            });
            const searchData = await searchResponse.json();
            searchContent = searchData.organic?.slice(0, 5).map(r => 
              `Titre: ${r.title}\nLien: ${r.link}\nExtrait: ${r.snippet}`
            ).join("\n\n") || "Aucun résultat organique.";
          } catch (e) {
            searchContent = "Erreur technique de recherche.";
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: searchContent
          });
        } 
        // Traitement de l'outil de lecture de page
        else if (toolUse.name === 'read_webpage') {
          console.log(`📖 LECTURE PAGE [Itération ${iterations}] : ${toolUse.input.url}`);
          let pageContent = "Impossible de lire la page. Utilisez le mode estimation.";
          try {
            // Utilisation de Jina Reader
            const response = await fetch(`https://r.jina.ai/${toolUse.input.url}`, {
              headers: { "Accept": "text/plain" }
            });
            if (response.ok) {
              const text = await response.text();
              // On limite à 15000 caractères pour ne pas exploser la limite de tokens de l'IA
              pageContent = text.slice(0, 15000); 
            }
          } catch (e) {
            console.error("Erreur read_webpage:", e);
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: pageContent
          });
        }
      }

      if (toolResults.length > 0) {
        claudeMessages.push({ role: 'assistant', content: response.content });
        claudeMessages.push({ role: 'user', content: toolResults });

        // 🔴 RETOUR À 1024 POUR LA RAPIDITÉ
        response = await claude.messages.create({
          model: finalModel,
          max_tokens: 1024,
          temperature: 0.2,
          system: enhancedSystemPrompt,
          tools: tools,
          messages: claudeMessages
        });
      }
    }

    // Forcer l'IA à parler si elle s'obstine à chercher
    if (response.stop_reason === 'tool_use') {
      console.log("⚠️ Limite de recherche atteinte, on force l'IA à parler.");
      
      claudeMessages.push({ role: 'assistant', content: response.content });
      
      const toolCalls = response.content.filter(c => c.type === 'tool_use');
      const forcedToolResults = toolCalls.map(toolUse => ({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: "Erreur/Interruption : Limite de recherche atteinte. Tu DOIS générer ton analyse IMMÉDIATEMENT en estimant les chiffres manquants."
      }));

      claudeMessages.push({ 
        role: 'user', 
        content: [
          ...forcedToolResults,
          { 
            type: 'text', 
            text: "Tu as atteint ta limite de recherche Internet. Arrête de chercher et génère ton analyse IMMÉDIATEMENT en estimant les taxes ou revenus manquants selon le prix que tu as trouvé. Sois TRÈS concis et termine ta phrase." 
          }
        ]
      });

      // 🔴 RETOUR À 1024 POUR LA RAPIDITÉ
      response = await claude.messages.create({
        model: finalModel,
        max_tokens: 1024,
        temperature: 0.2,
        system: enhancedSystemPrompt,
        messages: claudeMessages
      });
    }

    let fullResponse = response.content.find(c => c.type === 'text')?.text || '';
    
    if (!fullResponse.trim()) {
      fullResponse = "Désolé, ma recherche d'alternatives a pris trop de temps et j'ai dû l'interrompre. Pourriez-vous relancer la recherche en précisant un peu plus vos critères (ex: 'Cherche un duplex à Shawinigan sous 300k$') ?";
    }
    
    const now = admin.firestore.FieldValue.serverTimestamp();
    convRef.update({
      messages: [...history, 
        { role: 'user', content: message, createdAt: new Date() },
        { role: 'assistant', content: fullResponse, createdAt: new Date(), model: finalModel }
      ],
      updatedAt: now,
      lastMessage: fullResponse.slice(0, 200),
      lastUserMessage: message.slice(0, 200)
    }).catch(e => console.error("Erreur de sauvegarde DB:", e));

    res.json({
      message: fullResponse,
      conversationId: conversationIdFinal
    });

  } catch (error) {
    console.error('Chatbot Error:', error);
    if (!res.headersSent) {
      if (error.status === 429) {
        return res.status(429).json({ error: "L'intelligence artificielle est actuellement très sollicitée. Veuillez patienter quelques secondes avant de réessayer." });
      }
      res.status(500).json({ error: 'Erreur Chatbot', details: error.message });
    }
  }
});


// GET conversations (EXISTANT)
app.get('/api/realestate-chat/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('chats')
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get();

    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ conversations });
  } catch (error) {
    console.error('Erreur GET conversations chatbot', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des conversations.' });
  }
});




// GET conversation (EXISTANT)
app.get('/api/realestate-chat/conversation/:userId/:conversationId', async (req, res) => {
  try {
    const { userId, conversationId } = req.params;
    const convRef = db.collection('users').doc(userId).collection('chats').doc(conversationId);
    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation introuvable.' });
    }

    res.json({
      id: convDoc.id,
      ...convDoc.data()
    });
  } catch (error) {
    console.error('Erreur GET conversation chatbot', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la conversation.' });
  }
});

app.delete('/api/realestate-chat/conversation/:userId/:conversationId', async (req, res) => {
  try {
    const { userId, conversationId } = req.params;
    
    if (!userId || !conversationId) {
      return res.status(400).json({ error: 'userId et conversationId requis' });
    }

    // Vérification que la conversation appartient à l'utilisateur
    const convRef = db.collection('users').doc(userId).collection('chats').doc(conversationId);
    const convDoc = await convRef.get();
    
    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation introuvable' });
    }

    // Suppression définitive
    await convRef.delete();
    
    console.log('✅ Conversation supprimée:', conversationId, 'pour user:', userId);
    res.json({ 
      success: true, 
      message: 'Conversation supprimée avec succès',
      deletedId: conversationId 
    });
    
  } catch (error) {
    console.error('❌ Erreur suppression conversation:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la suppression',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
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