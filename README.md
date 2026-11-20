# WedPlan - Wedding Planning Platform (Backend Server)

WedPlan is a modern role-based wedding planning platform API built with Express.js, MongoDB, JWT authentication, and Stripe payments.

## Features
- **Role-Based Access Control**: Strict role verification on server for `customer`, `vendor`, and `admin`.
- **JWT Authentication & Password Policy**: Enforces minimum 6 characters with uppercase and lowercase letters.
- **Service Listings & Catalog**: Advanced search, filtering by category/location, and price sorting.
- **Booking Management**: Customer booking requests, duplicate booking prevention, vendor accept/reject workflow, and pending request cancellation.
- **Stripe Subscription**: Premium vendor upgrade session creation, secure webhook handler, and database transaction tracking.
- **Admin Control**: User blocking/unblocking, service review (approve/reject), platform overview stats, and transaction monitoring.

## Tech Stack
- Node.js & Express.js
- MongoDB & Mongoose
- JSON Web Tokens (jsonwebtoken) & bcryptjs
- Stripe SDK
- CORS & dotenv

## Environment Variables
The server expects the following variables:
- `PORT`: API server port (default: 5000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT generation and verification
- `STRIPE_SECRET_KEY`: Stripe API secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `CLIENT_URL`: URL of the frontend client

## Local Setup
```bash
npm install
node seed.js # (Optional) Seed initial demo users and services
npm start
```
