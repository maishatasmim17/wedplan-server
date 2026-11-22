const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: false }, // optional for Google Auth users
  image: { type: String, default: '' },
  role: { type: String, enum: ['customer', 'vendor', 'admin'], default: 'customer' },
  isBlocked: { type: Boolean, default: false },
  businessName: { type: String, default: '' }, // For vendors
  subscriptionPlan: { type: String, enum: ['free', 'premium'], default: 'free' },
  subscriptionExpiresAt: { type: Date, default: null },
  stripeCustomerId: { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
