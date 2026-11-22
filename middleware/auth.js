const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { syncSubscriptionStatus } = require('../utils/subscription');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wedplan_super_secret_jwt_key_2026_secure');

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User not found' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Forbidden: Account has been blocked by administrator' });
    }

    // An expired Premium plan must never keep unlocking vendor features.
    req.user = await syncSubscriptionStatus(user);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token', error: error.message });
  }
};

const verifyRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Authentication required' });
    }

    const userRole = req.user.role;
    if (typeof roles === 'string') {
      roles = [roles];
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({ success: false, message: `Forbidden: Access restricted to [${roles.join(', ')}]` });
    }

    next();
  };
};

module.exports = { verifyToken, verifyRole };
