const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const User = require('../models/User');
const { verifyToken, verifyRole } = require('../middleware/auth');
const { isPremiumActive } = require('../utils/subscription');

// GET /api/services - Public service listing with search, category filter, location filter, price sort
router.get('/', async (req, res) => {
  try {
    const { search, category, location, sort, limit = 50, page = 1 } = req.query;

    const query = {
      status: 'approved',
      isActive: true
    };

    if (search && search.trim() !== '') {
      query.serviceName = { $regex: search.trim(), $options: 'i' };
    }

    if (category && category !== 'All' && category !== '') {
      query.category = category;
    }

    if (location && location.trim() !== '') {
      query.location = { $regex: location.trim(), $options: 'i' };
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price_desc') {
      sortOption = { price: -1 };
    }

    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .populate('vendorId', 'name email businessName image subscriptionPlan')
      .sort(sortOption)
      .skip(skip)
      .limit(parsedLimit);

    res.json({
      success: true,
      total,
      page: parsedPage,
      services
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch services', error: error.message });
  }
});

// GET /api/services/featured - At least 6 approved active services for Home Page
router.get('/featured', async (req, res) => {
  try {
    const services = await Service.find({ status: 'approved', isActive: true })
      .populate('vendorId', 'name email businessName image subscriptionPlan')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({
      success: true,
      services
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch featured services', error: error.message });
  }
});

// GET /api/services/my-services - Vendor's own services
router.get('/my-services', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const services = await Service.find({ vendorId: req.user._id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      services
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch vendor services', error: error.message });
  }
});

// GET /api/services/:id - Single service details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID format' });
    }

    const service = await Service.findById(id).populate('vendorId', 'name email businessName image subscriptionPlan');
    if (!service) {
      return res.status(404).json({ success: false, message: 'Wedding service not found' });
    }

    res.json({
      success: true,
      service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving service details', error: error.message });
  }
});

// POST /api/services - Create new service (Vendor only)
router.post('/', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const { serviceName, category, description, price, location, images } = req.body;

    if (!serviceName || !category || !description || price === undefined || !location) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }

    // Check Free Plan limitation: max 3 active services (expired plans are free)
    const vendor = req.user;
    const isPremium = isPremiumActive(vendor);

    if (!isPremium) {
      const activeCount = await Service.countDocuments({
        vendorId: req.user._id,
        isActive: true
      });

      if (activeCount >= 3) {
        return res.status(403).json({
          success: false,
          message: 'Free tier limit reached! Free vendors can publish a maximum of 3 active services. Please upgrade to Premium to publish unlimited services.'
        });
      }
    }

    const imageList = Array.isArray(images) && images.length > 0 
      ? images 
      : ['https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80'];

    const newService = await Service.create({
      vendorId: req.user._id,
      serviceName,
      category,
      description,
      price: Number(price),
      location,
      images: imageList,
      status: 'pending', // Default status: Pending (until approved by admin)
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Service submitted successfully and is pending admin approval',
      service: newService
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create service', error: error.message });
  }
});

// PUT /api/services/:id - Update service (Vendor ownership verification)
router.put('/:id', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (service.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not own this service' });
    }

    const { serviceName, category, description, price, location, images, isActive } = req.body;

    // Re-publishing a service also counts towards the free 3-service limit.
    if (isActive === true && !service.isActive && !isPremiumActive(req.user)) {
      const activeCount = await Service.countDocuments({
        vendorId: req.user._id,
        isActive: true
      });
      if (activeCount >= 3) {
        return res.status(403).json({
          success: false,
          message: 'Free tier limit reached! Upgrade to Premium to publish more than 3 active services.'
        });
      }
    }

    if (serviceName) service.serviceName = serviceName;
    if (category) service.category = category;
    if (description) service.description = description;
    if (price !== undefined) service.price = Number(price);
    if (location) service.location = location;
    if (images && Array.isArray(images)) service.images = images;
    if (isActive !== undefined) service.isActive = isActive;

    await service.save();

    res.json({
      success: true,
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update service', error: error.message });
  }
});

// DELETE /api/services/:id - Delete service (Vendor ownership verification)
router.delete('/:id', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (service.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not own this service' });
    }

    await Service.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete service', error: error.message });
  }
});

module.exports = router;
