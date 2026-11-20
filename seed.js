require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const Transaction = require('./models/Transaction');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sadik1234:1jhKDWPpR2CUK3r2@cluster0.gdfbpex.mongodb.net/wedplan?retryWrites=true&w=majority';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB for seeding...');

    // Clear existing sample data if needed (optional)
    await User.deleteMany({});
    await Service.deleteMany({});
    await Booking.deleteMany({});
    await Transaction.deleteMany({});

    const passwordHash = await bcrypt.hash('WedPlan@2026', 10);

    // 1. Create Admin
    const admin = await User.create({
      name: 'WedPlan Admin',
      email: 'admin@wedplan.com',
      password: passwordHash,
      role: 'admin',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
    });

    // 2. Create Vendors
    const vendor1 = await User.create({
      name: 'Elena Rostova',
      email: 'elena@royalphoto.com',
      password: passwordHash,
      role: 'vendor',
      businessName: 'Royal Moments Photography & Cinema',
      subscriptionPlan: 'premium',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80'
    });

    const vendor2 = await User.create({
      name: 'Marcus Sterling',
      email: 'marcus@grandvenues.com',
      password: passwordHash,
      role: 'vendor',
      businessName: 'Grand Chateau & Palace Venues',
      subscriptionPlan: 'free',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
    });

    const vendor3 = await User.create({
      name: 'Sophia Laurent',
      email: 'sophia@floralcouture.com',
      password: passwordHash,
      role: 'vendor',
      businessName: 'Bloom & Petals Floral Couture',
      subscriptionPlan: 'premium',
      image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80'
    });

    // 3. Create Customers
    const customer1 = await User.create({
      name: 'Sarah Jenkins',
      email: 'sarah.j@gmail.com',
      password: passwordHash,
      role: 'customer',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'
    });

    const customer2 = await User.create({
      name: 'David Miller',
      email: 'david.m@gmail.com',
      password: passwordHash,
      role: 'customer',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'
    });

    // 4. Create Services (At least 6 approved services across 6 categories)
    const s1 = await Service.create({
      vendorId: vendor1._id,
      serviceName: 'Cinematic 4K Wedding Story & Drone Coverage',
      category: 'Photography & Videography',
      description: 'Capture every breath and sparkle with full-day dual cinematographers, 4K resolution, drone aerial capture, and luxury cinematic highlight film.',
      price: 1850,
      location: 'New York, NY',
      images: [
        'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80'
      ],
      status: 'approved',
      isActive: true
    });

    const s2 = await Service.create({
      vendorId: vendor2._id,
      serviceName: 'The Grand Waterfront Glasshouse Ballroom',
      category: 'Wedding Venues',
      description: 'An iconic glasshouse waterfront estate featuring manicured botanical gardens, panoramic sunset views, private bridal suites, and up to 450 guests.',
      price: 5200,
      location: 'Miami, FL',
      images: [
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80'
      ],
      status: 'approved',
      isActive: true
    });

    const s3 = await Service.create({
      vendorId: vendor3._id,
      serviceName: 'Enchanted Royal Floral Arch & Aisle Installation',
      category: 'Decoration & Florist',
      description: 'Handcrafted imported white garden roses, cascading orchids, and ethereal ambient candelabra styling for your altar, tablescapes, and grand entryway.',
      price: 2400,
      location: 'Los Angeles, CA',
      images: [
        'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80'
      ],
      status: 'approved',
      isActive: true
    });

    const s4 = await Service.create({
      vendorId: vendor2._id,
      serviceName: 'Five-Star Artisanal Gourmet Plated Catering',
      category: 'Catering Services',
      description: 'Award-winning farm-to-table fine dining wedding feast. Includes customized 4-course menu, canapés during cocktail hour, wine pairings, and pastry bar.',
      price: 3600,
      location: 'Chicago, IL',
      images: [
        'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80'
      ],
      status: 'approved',
      isActive: true
    });

    const s5 = await Service.create({
      vendorId: vendor3._id,
      serviceName: 'Bridal Luxury HD Glam & Couture Hair Styling',
      category: 'Makeup & Styling',
      description: 'Flawless 18-hour waterproof bridal airbrush artistry, customized luxury hair extensions, trial session, and touch-up concierge for the bridal party.',
      price: 850,
      location: 'Dallas, TX',
      images: [
        'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80'
      ],
      status: 'approved',
      isActive: true
    });

    const s6 = await Service.create({
      vendorId: vendor1._id,
      serviceName: 'Bespoke Haute Couture Bridal Gown & Tuxedo Styling',
      category: 'Wedding Fashion',
      description: 'Exclusive custom-tailored European lace gowns, hand-beaded bridal veils, and bespoke Italian wool groom tuxedos fitted to absolute perfection.',
      price: 2900,
      location: 'San Francisco, CA',
      images: [
        'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80'
      ],
      status: 'approved',
      isActive: true
    });

    // 5. Create Sample Bookings
    await Booking.create({
      serviceId: s1._id,
      vendorId: vendor1._id,
      customerId: customer1._id,
      eventDate: new Date('2026-12-15'),
      eventLocation: 'Brooklyn Botanical Garden, NY',
      message: 'Looking forward to our dream wedding film!',
      status: 'Pending'
    });

    await Booking.create({
      serviceId: s3._id,
      vendorId: vendor3._id,
      customerId: customer1._id,
      eventDate: new Date('2026-12-16'),
      eventLocation: 'Beverly Hills Estate, CA',
      message: 'Need full pastel floral arch and stage decor.',
      status: 'Accepted'
    });

    // 6. Create Sample Transactions
    await Transaction.create({
      vendorId: vendor1._id,
      plan: 'premium',
      amount: 49.00,
      currency: 'usd',
      stripeSessionId: 'cs_test_seed_premium_01',
      status: 'completed'
    });

    console.log('Database seeded successfully with users, services, bookings, and transactions!');
    console.log('Admin account: admin@wedplan.com / WedPlan@2026');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
