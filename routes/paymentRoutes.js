const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const CheckoutSession = require('../models/CheckoutSession');
const { verifyToken, verifyRole } = require('../middleware/auth');
const {
  PREMIUM_DURATION_MS,
  isPremiumActive,
  publicUser,
  resolveClientUrl
} = require('../utils/subscription');
const {
  getStripe,
  isStripeConfigured,
  activatePremiumForSession,
  downgradeVendor,
  processStripeEvent,
  verifyStripeSession
} = require('../services/paymentService');

const PREMIUM_PRICE_CENTS = 4900;
const PREMIUM_AMOUNT = 49;

function makeDemoSessionId() {
  return `demo_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

async function findTransactionForSession(sessionId) {
  return Transaction.findOne({ stripeSessionId: sessionId, status: 'completed' }).sort({ createdAt: -1 });
}

// POST /api/payment/create-checkout-session
// The vendor id always comes from the verified JWT — never from the request body.
router.post('/create-checkout-session', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    if (isPremiumActive(req.user)) {
      return res.status(400).json({
        success: false,
        message: 'Your Premium plan is already active.'
      });
    }

    const vendorId = req.user._id.toString();
    const clientUrl = resolveClientUrl(req);
    const stripe = getStripe();

    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: PREMIUM_PRICE_CENTS,
              recurring: { interval: 'year' },
              product_data: {
                name: 'WedPlan Vendor Premium Membership',
                description: 'Unlimited active services, verified gold badge and priority placement.'
              }
            }
          }],
          customer_email: req.user.email,
          client_reference_id: vendorId,
          metadata: { vendorId, plan: 'premium' },
          subscription_data: { metadata: { vendorId, plan: 'premium' } },
          success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${clientUrl}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`
        });

        if (!session.url) throw new Error('Stripe did not return a checkout URL');

        await CheckoutSession.create({
          sessionId: session.id,
          provider: 'stripe',
          vendorId: req.user._id,
          amount: PREMIUM_AMOUNT,
          currency: 'usd',
          status: 'pending',
          expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null
        });

        return res.json({
          success: true,
          mode: 'stripe',
          sessionId: session.id,
          url: session.url
        });
      } catch (stripeError) {
        // Invalid test key / offline Stripe: never redirect to a made-up URL.
        console.warn('[payment] Stripe checkout unavailable, using simulated checkout:', stripeError.message);
      }
    }

    // Simulated Stripe test checkout. Access is still only granted by the
    // server-side confirmation endpoint, never by the browser URL.
    const demoSessionId = makeDemoSessionId();
    await CheckoutSession.create({
      sessionId: demoSessionId,
      provider: 'demo',
      vendorId: req.user._id,
      amount: PREMIUM_AMOUNT,
      currency: 'usd',
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });

    return res.json({
      success: true,
      mode: 'demo',
      sessionId: demoSessionId,
      url: `${clientUrl}/payment/demo-checkout?session_id=${demoSessionId}`,
      message: 'Stripe test key is not active — opened simulated Stripe test checkout.'
    });
  } catch (error) {
    console.error('[payment] create checkout failed:', error);
    return res.status(500).json({ success: false, message: 'Could not start checkout. Please try again.' });
  }
});

// GET /api/payment/demo-session?sessionId=...
router.get('/demo-session', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const session = await CheckoutSession.findOne({
      sessionId: req.query.sessionId,
      provider: 'demo',
      vendorId: req.user._id
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Checkout session not found.' });
    }

    return res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        amount: session.amount,
        currency: session.currency,
        status: session.status,
        expiresAt: session.expiresAt,
        vendorEmail: req.user.email
      }
    });
  } catch (error) {
    console.error('[payment] demo session lookup failed:', error);
    return res.status(500).json({ success: false, message: 'Could not load checkout session.' });
  }
});

// POST /api/payment/demo-confirm — server-side confirmation for simulated test mode
router.post('/demo-confirm', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const session = await CheckoutSession.findOne({
      sessionId: req.body.sessionId,
      provider: 'demo',
      vendorId: req.user._id,
      status: 'pending'
    });

    if (!session) {
      return res.status(409).json({
        success: false,
        message: 'This checkout session is invalid, expired or already paid.'
      });
    }

    const { transaction, vendor } = await activatePremiumForSession({
      vendorId: req.user._id,
      sessionId: session.sessionId,
      amount: session.amount,
      currency: session.currency,
      expiresAt: new Date(Date.now() + PREMIUM_DURATION_MS),
      verifiedBy: 'demo:webhook'
    });

    return res.json({ success: true, user: publicUser(vendor), transaction });
  } catch (error) {
    console.error('[payment] demo confirmation failed:', error);
    return res.status(500).json({ success: false, message: 'Could not confirm payment.' });
  }
});

// POST /api/payment/demo-cancel
router.post('/demo-cancel', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    await CheckoutSession.findOneAndUpdate(
      { sessionId: req.body.sessionId, provider: 'demo', vendorId: req.user._id },
      { $set: { status: 'canceled' } }
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('[payment] demo cancel failed:', error);
    return res.status(500).json({ success: false, message: 'Could not cancel checkout.' });
  }
});

// GET /api/payment/verify-session?sessionId=...
// Called by the Payment Success page. Verifies with Stripe (or the local
// webhook-equivalent in simulated mode) before any premium access is granted.
router.get('/verify-session', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
      return res.status(400).json({ success: false, message: 'Invalid checkout session.' });
    }

    const localSession = await CheckoutSession.findOne({ sessionId });
    if (localSession && localSession.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'This payment belongs to another vendor.' });
    }

    let vendor = req.user;
    let transaction = null;

    if (localSession && localSession.provider === 'demo') {
      if (localSession.status !== 'paid') {
        return res.status(402).json({ success: false, message: 'Payment has not been completed yet.' });
      }
      transaction = await findTransactionForSession(sessionId);
      vendor = await User.findById(req.user._id);
    } else {
      const verified = await verifyStripeSession(sessionId, req.user._id);
      vendor = verified.vendor;
      transaction = verified.transaction;
    }

    return res.json({
      success: true,
      message: 'Premium subscription activated.',
      user: publicUser(vendor),
      transaction: transaction
        ? {
            id: transaction._id,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
            createdAt: transaction.createdAt
          }
        : null
    });
  } catch (error) {
    console.error('[payment] session verification failed:', error.message);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: status === 500
        ? 'Could not verify your payment. Stripe will confirm it shortly.'
        : error.message
    });
  }
});

// GET /api/payment/status — current subscription + payment history
router.get('/status', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const vendor = await User.findById(req.user._id);
    const transactions = await Transaction.find({ vendorId: vendor._id }).sort({ createdAt: -1 });
    return res.json({
      success: true,
      subscription: {
        plan: vendor.subscriptionPlan,
        expiresAt: vendor.subscriptionExpiresAt,
        active: isPremiumActive(vendor),
        stripeSubscriptionId: vendor.stripeSubscriptionId || ''
      },
      transactions
    });
  } catch (error) {
    console.error('[payment] status lookup failed:', error);
    return res.status(500).json({ success: false, message: 'Could not load payment status.' });
  }
});

// POST /api/payment/create-portal-session — Stripe-hosted subscription management
router.post('/create-portal-session', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe || !req.user.stripeSubscriptionId || !req.user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'This is a simulated subscription. Use the local cancel option instead.'
      });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: `${resolveClientUrl(req)}/dashboard/vendor/subscription`
    });

    return res.json({ success: true, url: portal.url });
  } catch (error) {
    console.error('[payment] portal session failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not open subscription settings.' });
  }
});

// POST /api/payment/cancel-subscription
router.post('/cancel-subscription', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const stripe = getStripe();
    if (stripe && req.user.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(req.user.stripeSubscriptionId);
    }

    await downgradeVendor(req.user._id, 'vendor_canceled');
    await CheckoutSession.updateMany(
      { vendorId: req.user._id, status: 'pending' },
      { $set: { status: 'canceled' } }
    );

    const vendor = await User.findById(req.user._id);
    return res.json({ success: true, user: publicUser(vendor) });
  } catch (error) {
    console.error('[payment] cancel subscription failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not cancel your subscription.' });
  }
});

// POST /api/payment/webhook — raw body + Stripe signature verification.
// This is the authoritative source for activating/cancelling Premium.
router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.error('[payment] webhook rejected: Stripe webhook secret is not configured');
    return res.status(503).json({ success: false, message: 'Webhook is not configured.' });
  }
  if (!signature || !Buffer.isBuffer(req.body)) {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload.' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    return res.status(400).json({ success: false, message: `Webhook signature failed: ${err.message}` });
  }

  try {
    await processStripeEvent(event);
    return res.json({ received: true });
  } catch (error) {
    // Returning 5xx makes Stripe retry the verified event.
    console.error('[payment] webhook processing failed:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed.' });
  }
});

module.exports = router;
