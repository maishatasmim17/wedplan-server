const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, required: true, default: 'premium' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  stripeSessionId: { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' },
  status: { type: String, default: 'completed' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
