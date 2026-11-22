const PREMIUM_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

function isPremiumActive(user) {
  if (!user || user.subscriptionPlan !== 'premium') return false;
  if (!user.subscriptionExpiresAt) return true; // Legacy records without an expiry
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}

/**
 * Downgrades vendors whose paid access has expired.
 * Called on every authenticated request so an expired plan can never
 * keep unlocking the 3-service limit.
 */
async function syncSubscriptionStatus(user) {
  if (!user || user.role !== 'vendor') return user;

  const expired =
    user.subscriptionPlan === 'premium' &&
    user.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt).getTime() <= Date.now();

  if (expired) {
    user.subscriptionPlan = 'free';
    user.subscriptionExpiresAt = null;
    await user.save();
  }

  return user;
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    image: user.image,
    businessName: user.businessName,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    stripeSubscriptionId: user.stripeSubscriptionId || '',
    isBlocked: user.isBlocked
  };
}

function resolveClientUrl(req) {
  const configured = (process.env.CLIENT_URL || '').replace(/\/$/, '');
  const origin = (req.get('origin') || '').replace(/\/$/, '');
  const allowed = [configured, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean);

  // Local dev must redirect back to localhost instead of the deployed URL.
  if (origin && allowed.includes(origin)) return origin;
  return configured || 'http://localhost:3000';
}

module.exports = {
  PREMIUM_DURATION_MS,
  isPremiumActive,
  syncSubscriptionStatus,
  publicUser,
  resolveClientUrl
};
