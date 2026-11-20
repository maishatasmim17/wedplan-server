const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceName: { type: String, required: true, trim: true },
  category: { 
    type: String, 
    required: true,
    enum: [
      'Photography & Videography',
      'Wedding Venues',
      'Decoration & Florist',
      'Catering Services',
      'Makeup & Styling',
      'Wedding Fashion'
    ]
  },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  location: { type: String, required: true, trim: true },
  images: [{ type: String, required: true }],
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
