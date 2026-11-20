const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { verifyToken, verifyRole } = require('../middleware/auth');

// All routes require Admin role
router.use(verifyToken, verifyRole('admin'));

// GET /api/admin/overview - Admin stats
router.get('/overview', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalVendors = await User.countDocuments({ role: 'vendor' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalServices = await Service.countDocuments();
    const pendingServices = await Service.countDocuments({ status: 'pending' });
    const totalTransactions = await Transaction.countDocuments();

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalServices,
        pendingServices,
        totalTransactions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats', error: error.message });
  }
});

// GET /api/admin/users - Manage users with search and role filter
router.get('/users', async (req, res) => {
  try {
    const { search, role } = req.query;
    const query = {};

    if (search && search.trim() !== '') {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    if (role && role !== 'all') {
      query.role = role;
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
});

// PUT /api/admin/users/:id/block - Block or unblock user
router.put('/users/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot block an admin account' });
    }

    user.isBlocked = Boolean(isBlocked);
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user block status', error: error.message });
  }
});

// GET /api/admin/services - View all submitted services with search & filter
router.get('/services', async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      query.serviceName = { $regex: search.trim(), $options: 'i' };
    }

    const services = await Service.find(query)
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      services
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch services', error: error.message });
  }
});

// PUT /api/admin/services/:id/status - Approve or reject services
router.put('/services/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      service.status = status;
    }

    if (isActive !== undefined) {
      service.isActive = Boolean(isActive);
    }

    await service.save();

    res.json({
      success: true,
      message: `Service status updated to ${service.status}`,
      service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update service status', error: error.message });
  }
});

// DELETE /api/admin/services/:id - Delete inappropriate service
router.delete('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByIdAndDelete(id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({
      success: true,
      message: 'Service deleted successfully by administrator'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete service', error: error.message });
  }
});

// GET /api/admin/transactions - View platform transactions
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions', error: error.message });
  }
});

module.exports = router;
