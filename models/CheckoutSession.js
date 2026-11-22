const mongoose = require('mongoose');

// Local record of every checkout attempt. Used for idempotency, for the
// simulated test-mode checkout and for correlating Stripe webhook events.
const checkoutSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  provider: { type: String, enum: ['stripe', 'demo'], required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, default: 'premium' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  status: {
    type: String,
    enum: ['pending', 'paid', 'canceled', 'expired'],
    default: 'pending'
  },
  stripeSubscriptionId: { type: String, default: '' },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('CheckoutSession', checkoutSessionSchema);
