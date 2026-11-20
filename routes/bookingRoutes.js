const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { verifyToken, verifyRole } = require('../middleware/auth');

// POST /api/bookings - Create booking request (Customer only)
router.post('/', verifyToken, verifyRole('customer'), async (req, res) => {
  try {
    const { serviceId, eventDate, eventLocation, message } = req.body;

    if (!serviceId || !eventDate || !eventLocation) {
      return res.status(400).json({ success: false, message: 'Service, event date, and event location are required' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (service.status !== 'approved' || !service.isActive) {
      return res.status(400).json({ success: false, message: 'This service is currently unavailable for booking' });
    }

    // Rule: Prevent customers from booking their own services
    if (service.vendorId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Vendors cannot book their own services' });
    }

    // Rule: Prevent duplicate active booking requests for the same service and event date
    const targetDate = new Date(eventDate);
    const startOfDay = new Date(targetDate.setUTCHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setUTCHours(23, 59, 59, 999));

    const existingBooking = await Booking.findOne({
      serviceId,
      customerId: req.user._id,
      eventDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['Pending', 'Accepted'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active booking request for this service on this date.'
      });
    }

    const booking = await Booking.create({
      serviceId,
      vendorId: service.vendorId,
      customerId: req.user._id,
      eventDate: new Date(eventDate),
      eventLocation,
      message: message || '',
      status: 'Pending'
    });

    res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully!',
      booking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit booking request', error: error.message });
  }
});

// GET /api/bookings/my-bookings - Customer's bookings
router.get('/my-bookings', verifyToken, verifyRole('customer'), async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user._id })
      .populate('serviceId', 'serviceName images price category location')
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch customer bookings', error: error.message });
  }
});

// PUT /api/bookings/:id/cancel - Customer cancels pending booking
router.put('/:id/cancel', verifyToken, verifyRole('customer'), async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking request not found' });
    }

    // Ownership check
    if (booking.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Cannot cancel another customer’s booking' });
    }

    // Only pending requests can be cancelled
    if (booking.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a booking that is already ${booking.status}`
      });
    }

    booking.status = 'Cancelled';
    await booking.save();

    res.json({
      success: true,
      message: 'Booking request cancelled successfully',
      booking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cancel booking', error: error.message });
  }
});

// GET /api/bookings/vendor-requests - Vendor's received requests
router.get('/vendor-requests', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const bookings = await Booking.find({ vendorId: req.user._id })
      .populate('serviceId', 'serviceName images price category location')
      .populate('customerId', 'name email image')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch vendor booking requests', error: error.message });
  }
});

// PUT /api/bookings/:id/status - Vendor accepts or rejects booking
router.put('/:id/status', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Accepted' or 'Rejected'

    if (!['Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be either Accepted or Rejected' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking request not found' });
    }

    // Ownership check: vendor can only manage their own bookings
    if (booking.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Not your booking request' });
    }

    // Rule: Only pending requests can be accepted or rejected; once processed, cannot be changed again
    if (booking.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `This booking request has already been ${booking.status} and cannot be processed again.`
      });
    }

    booking.status = status;
    await booking.save();

    res.json({
      success: true,
      message: `Booking request successfully ${status.toLowerCase()}`,
      booking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update booking status', error: error.message });
  }
});

module.exports = router;
