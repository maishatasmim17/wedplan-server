const mongoose = require('mongoose');

// Stores uploaded images as base64 so uploads survive serverless deployments.
const uploadSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalName: { type: String, default: 'image' },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: String, required: true } // base64 payload (no data URL prefix)
}, { timestamps: true });

module.exports = mongoose.model('Upload', uploadSchema);
