const express = require('express');
const mongoose = require('mongoose');
const Upload = require('../models/Upload');
const { verifyToken, verifyRole } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB after browser compression
const MAX_VENDOR_UPLOADS = 50; // keep free Atlas storage under control

function baseUrl(req) {
  if (process.env.SERVER_URL) return process.env.SERVER_URL.replace(/\/$/, '');
  const protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
}

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/gif') {
    return buffer.length > 6 && buffer.subarray(0, 6).toString('ascii').startsWith('GIF8');
  }
  if (mimeType === 'image/webp') {
    return buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

// POST /api/upload - authenticated vendor uploads one service image.
// Body: { image: "data:image/jpeg;base64,...", fileName?: "photo.jpg" }
router.post('/', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const { image, fileName } = req.body || {};

    if (typeof image !== 'string') {
      return res.status(400).json({ success: false, message: 'No image data received' });
    }

    const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Invalid image data. Expected a base64 image.' });
    }

    const mimeType = match[1].toLowerCase();
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return res.status(400).json({ success: false, message: 'Unsupported image format. Please use JPG, PNG, WEBP or GIF.' });
    }

    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length || !hasValidImageSignature(buffer, mimeType)) {
      return res.status(400).json({ success: false, message: 'The uploaded file is not a valid image' });
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ success: false, message: 'Image is too large. Please choose a smaller image (max 6 MB).' });
    }

    const uploadCount = await Upload.countDocuments({ vendorId: req.user._id });
    if (uploadCount >= MAX_VENDOR_UPLOADS) {
      return res.status(403).json({
        success: false,
        message: 'Upload limit reached for this account. Please remove old images before uploading more.'
      });
    }

    const upload = await Upload.create({
      vendorId: req.user._id,
      originalName: String(fileName || 'service-image').slice(0, 200),
      mimeType,
      size: buffer.length,
      data: buffer.toString('base64')
    });

    const url = `${baseUrl(req)}/api/upload/${upload._id}`;

    res.status(201).json({
      success: true,
      url,
      imageUrl: url,
      size: buffer.length
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image', error: error.message });
  }
});

// GET /api/upload/:id - public image delivery (used directly in <img src>).
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid image ID' });
    }

    const upload = await Upload.findById(id);
    if (!upload) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    res.set('Content-Type', upload.mimeType);
    res.set('Content-Length', upload.size);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(Buffer.from(upload.data, 'base64'));
  } catch (error) {
    console.error('Image delivery error:', error);
    res.status(500).json({ success: false, message: 'Failed to load image', error: error.message });
  }
});

module.exports = router;
