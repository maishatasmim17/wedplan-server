const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'wedplan_super_secret_jwt_key_2026_secure',
    { expiresIn: '7d' }
  );
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, image, role, businessName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    // Password validation: minimum 6 chars, 1 uppercase, 1 lowercase
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters with at least one uppercase letter and one lowercase letter.'
      });
    }

    // Role validation: public registration allows customer or vendor only
    const userRole = (role === 'vendor') ? 'vendor' : 'customer';

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      image: image || '',
      role: userRole,
      businessName: role === 'vendor' ? (businessName || `${name}'s Wedding Studio`) : ''
    });

    const token = generateToken(newUser._id, newUser.role);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        image: newUser.image,
        role: newUser.role,
        businessName: newUser.businessName,
        subscriptionPlan: newUser.subscriptionPlan
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Your account has been blocked by an administrator.' });
    }

    if (!user.password) {
      return res.status(400).json({ success: false, message: 'This account was created with Google. Please use Google Sign In.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        businessName: user.businessName,
        subscriptionPlan: user.subscriptionPlan,
        isBlocked: user.isBlocked
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { credential, role, businessName } = req.body;
    let name, email, image;

    if (credential) {
      // Decode or verify real Google ID token
      try {
        if (process.env.GOOGLE_CLIENT_ID) {
          const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
          });
          const payload = ticket.getPayload();
          name = payload.name;
          email = payload.email;
          image = payload.picture;
        } else {
          // Decode JWT payload without verification if client ID is unset
          const decoded = jwt.decode(credential);
          if (decoded && decoded.email) {
            name = decoded.name;
            email = decoded.email;
            image = decoded.picture;
          }
        }
      } catch (tokenErr) {
        // Fallback decoding if token verification fails due to audience mismatch
        const decoded = jwt.decode(credential);
        if (decoded && decoded.email) {
          name = decoded.name;
          email = decoded.email;
          image = decoded.picture;
        } else {
          return res.status(400).json({ success: false, message: 'Invalid Google credential token' });
        }
      }
    } else {
      name = req.body.name;
      email = req.body.email;
      image = req.body.image;
    }

    if (!email || !name) {
      return res.status(400).json({ success: false, message: 'Name and email are required for Google authentication' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (user.isBlocked) {
        return res.status(403).json({ success: false, message: 'Account is blocked by administrator' });
      }
      if (image && !user.image) {
        user.image = image;
        await user.save();
      }
    } else {
      const userRole = (role === 'vendor') ? 'vendor' : 'customer';
      user = await User.create({
        name,
        email: email.toLowerCase(),
        image: image || '',
        role: userRole,
        businessName: userRole === 'vendor' ? (businessName || `${name}'s Wedding Services`) : ''
      });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        businessName: user.businessName,
        subscriptionPlan: user.subscriptionPlan,
        isBlocked: user.isBlocked
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during Google auth', error: error.message });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      image: req.user.image,
      role: req.user.role,
      businessName: req.user.businessName,
      subscriptionPlan: req.user.subscriptionPlan,
      subscriptionExpiresAt: req.user.subscriptionExpiresAt,
      isBlocked: req.user.isBlocked
    }
  });
});

// PUT /api/auth/profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, image, businessName } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (image !== undefined) user.image = image;
    if (user.role === 'vendor' && businessName) user.businessName = businessName;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        businessName: user.businessName,
        subscriptionPlan: user.subscriptionPlan
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
});

module.exports = router;
