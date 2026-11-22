const User = require('../models/User');
const Transaction = require('../models/Transaction');
const CheckoutSession = require('../models/CheckoutSession');
const { PREMIUM_DURATION_MS } = require('../utils/subscription');

let stripeClient = null;

/**
 * Stripe is only loaded when a real key exists in the server environment.
 * No secret key is ever hardcoded or sent to the browser.
 */
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^sk_(test|live)_/.test(key) || /mock/i.test(key)) return null;
  if (!stripeClient) stripeClient = require('stripe')(key);
  return stripeClient;
}

function isStripeConfigured() {
  return getStripe() !== null;
}

function subscriptionEnd(sub) {
  const seconds =
    (sub && sub.current_period_end) ||
    (sub && sub.items && sub.items.data && sub.items.data[0] &&
      sub.items.data[0].current_period_end);
  return seconds ? new Date(seconds * 1000) : null;
}

/**
 * Single idempotent write path used by the Stripe webhook AND by the
 * server-side session verification. A frontend redirect alone can never
 * call this function.
 */
async function activatePremiumForSession({
  vendorId,
  sessionId = '',
  amount = 49,
  currency = 'usd',
  subscriptionId = '',
  customerId = '',
  invoiceId = '',
  paymentIntentId = '',
  expiresAt = null,
  verifiedBy = 'stripe:webhook'
}) {
  const vendor = await User.findById(vendorId);
  if (!vendor) throw new Error('Vendor not found for verified payment');

  const orConditions = [];
  if (sessionId) orConditions.push({ stripeSessionId: sessionId });
  if (invoiceId) orConditions.push({ stripeInvoiceId: invoiceId });

  let transaction = orConditions.length
    ? await Transaction.findOne({ $or: orConditions })
    : null;

  if (!transaction) {
    transaction = await Transaction.create({
      vendorId,
      plan: 'premium',
      amount,
      currency,
      stripeSessionId: sessionId,
      stripeSubscriptionId: subscriptionId,
      stripeInvoiceId: invoiceId,
      stripePaymentIntentId: paymentIntentId,
      status: 'completed',
      verifiedBy
    });
  } else if (transaction.status !== 'completed') {
    transaction.status = 'completed';
    transaction.verifiedBy = verifiedBy;
    await transaction.save();
  }

  const nextExpiry =
    expiresAt instanceof Date
      ? expiresAt
      : expiresAt
        ? new Date(expiresAt)
        : new Date(Date.now() + PREMIUM_DURATION_MS);

  const currentExpiry = vendor.subscriptionExpiresAt
    ? new Date(vendor.subscriptionExpiresAt)
    : null;

  const shouldExtend =
    vendor.subscriptionPlan !== 'premium' ||
    !currentExpiry ||
    nextExpiry.getTime() > currentExpiry.getTime();

  if (shouldExtend) {
    vendor.subscriptionPlan = 'premium';
    vendor.subscriptionExpiresAt = nextExpiry;
  }
  if (subscriptionId) vendor.stripeSubscriptionId = subscriptionId;
  if (customerId) vendor.stripeCustomerId = customerId;
  await vendor.save();

  if (sessionId) {
    await CheckoutSession.findOneAndUpdate(
      { sessionId },
      { $set: { status: 'paid', stripeSubscriptionId: subscriptionId } },
      { returnDocument: 'after' }
    );
  }

  return { transaction, vendor };
}

async function downgradeVendor(vendorId, reason = 'subscription_canceled') {
  await User.findByIdAndUpdate(vendorId, {
    $set: {
      subscriptionPlan: 'free',
      subscriptionExpiresAt: null,
      stripeSubscriptionId: ''
    }
  });

  await Transaction.updateMany(
    { vendorId, status: 'pending' },
    { $set: { status: 'canceled', verifiedBy: reason } }
  );
}

async function findVendorForSubscription(subscription) {
  if (!subscription) return null;
  const metadata = subscription.metadata || {};
  if (metadata.vendorId) {
    const byMetadata = await User.findById(metadata.vendorId);
    if (byMetadata) return byMetadata;
  }
  if (subscription.id) {
    const bySubscription = await User.findOne({ stripeSubscriptionId: subscription.id });
    if (bySubscription) return bySubscription;
  }
  if (subscription.customer) {
    return User.findOne({ stripeCustomerId: subscription.customer });
  }
  return null;
}

/** Processes verified Stripe events only (signature checked in the route). */
async function processStripeEvent(event) {
  const stripe = getStripe();
  if (!stripe) return;

  const object = event.data && event.data.object;
  if (!object) return;

  switch (event.type) {
    case 'checkout.session.completed': {
      const vendorId = object.client_reference_id || (object.metadata || {}).vendorId;
      if (!vendorId || (object.metadata || {}).plan !== 'premium') return;

      let expiresAt = null;
      if (object.mode === 'subscription' && object.subscription) {
        const subscription = await stripe.subscriptions.retrieve(object.subscription);
        if (!['active', 'trialing'].includes(subscription.status)) return;
        expiresAt = subscriptionEnd(subscription);
      } else if (object.payment_status !== 'paid') {
        return;
      }

      await activatePremiumForSession({
        vendorId,
        sessionId: object.id,
        amount: (object.amount_total || 4900) / 100,
        currency: object.currency || 'usd',
        subscriptionId:
          typeof object.subscription === 'string' ? object.subscription : (object.subscription || {}).id || '',
        customerId:
          typeof object.customer === 'string' ? object.customer : (object.customer || {}).id || '',
        paymentIntentId:
          typeof object.payment_intent === 'string' ? object.payment_intent : (object.payment_intent || {}).id || '',
        expiresAt,
        verifiedBy: 'stripe:webhook:checkout.session.completed'
      });
      return;
    }

    case 'invoice.payment_succeeded': {
      const subscriptionId =
        typeof object.subscription === 'string' ? object.subscription : (object.subscription || {}).id || '';
      if (!subscriptionId) return;

      const vendor = await User.findOne({ stripeSubscriptionId: subscriptionId });
      if (!vendor) return;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (!['active', 'trialing'].includes(subscription.status)) return;

      await activatePremiumForSession({
        vendorId: vendor._id,
        sessionId: (object.metadata || {}).checkoutSessionId || '',
        invoiceId: object.id,
        amount: (object.amount_paid || object.amount_total || 4900) / 100,
        currency: object.currency || 'usd',
        subscriptionId,
        customerId: typeof object.customer === 'string' ? object.customer : '',
        expiresAt: subscriptionEnd(subscription),
        verifiedBy: 'stripe:webhook:invoice.payment_succeeded'
      });
      return;
    }

    case 'customer.subscription.deleted': {
      const vendor = await findVendorForSubscription(object);
      if (vendor) await downgradeVendor(vendor._id, 'stripe:customer.subscription.deleted');
      return;
    }

    case 'customer.subscription.updated': {
      if (!['canceled', 'unpaid', 'incomplete_expired'].includes(object.status)) return;
      const vendor = await findVendorForSubscription(object);
      if (vendor) await downgradeVendor(vendor._id, 'stripe:customer.subscription.updated');
      return;
    }

    case 'checkout.session.expired': {
      await CheckoutSession.findOneAndUpdate(
        { sessionId: object.id },
        { $set: { status: 'expired' } }
      );
      return;
    }

    case 'charge.refunded': {
      const paymentIntentId =
        typeof object.payment_intent === 'string' ? object.payment_intent : (object.payment_intent || {}).id || '';
      if (paymentIntentId) {
        await Transaction.updateMany(
          { stripePaymentIntentId: paymentIntentId },
          { $set: { status: 'refunded' } }
        );
      }
      return;
    }

    default:
      return;
  }
}

/**
 * The success page never activates anything by itself. It asks the server
 * to retrieve the session directly from Stripe and compare the vendor id.
 */
async function verifyStripeSession(sessionId, vendorId) {
  const stripe = getStripe();
  if (!stripe) {
    const error = new Error('Stripe is not configured on the server');
    error.status = 503;
    throw error;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const matchesVendor =
    session.client_reference_id === vendorId.toString() ||
    (session.metadata || {}).vendorId === vendorId.toString();

  if (!matchesVendor || (session.metadata || {}).plan !== 'premium') {
    const error = new Error('This payment session does not belong to your account');
    error.status = 403;
    throw error;
  }

  let expiresAt = null;
  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    if (!['active', 'trialing'].includes(subscription.status)) {
      const error = new Error('Payment is not active yet. Please wait for Stripe confirmation.');
      error.status = 409;
      throw error;
    }
    expiresAt = subscriptionEnd(subscription);
  } else if (session.payment_status !== 'paid') {
    const error = new Error('Payment has not been completed');
    error.status = 402;
    throw error;
  }

  return activatePremiumForSession({
    vendorId,
    sessionId: session.id,
    amount: (session.amount_total || 4900) / 100,
    currency: session.currency || 'usd',
    subscriptionId:
      typeof session.subscription === 'string' ? session.subscription : (session.subscription || {}).id || '',
    customerId:
      typeof session.customer === 'string' ? session.customer : (session.customer || {}).id || '',
    paymentIntentId:
      typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent || {}).id || '',
    expiresAt,
    verifiedBy: 'stripe:verified-session'
  });
}

module.exports = {
  getStripe,
  isStripeConfigured,
  activatePremiumForSession,
  downgradeVendor,
  processStripeEvent,
  verifyStripeSession
};
