const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, required: true, default: 'premium' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  stripeSessionId: { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' },
  stripeInvoiceId: { type: String, default: '' },
  stripePaymentIntentId: { type: String, default: '' },
  // stripe:webhook | stripe:verified-session | demo:webhook
  verifiedBy: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'completed', 'refunded', 'canceled', 'failed'],
    default: 'completed'
  }
}, { timestamps: true });

transactionSchema.index({ stripeSessionId: 1 }, { sparse: true });
transactionSchema.index({ stripeInvoiceId: 1 }, { sparse: true });

module.exports = mongoose.model('Transaction', transactionSchema);
