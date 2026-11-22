# WedPlan — Wedding Planning Platform (Backend Server API)

WedPlan API is a robust Express.js backend connecting to MongoDB Atlas, supporting role-based access control, JWT verification, and Stripe subscription payment processing.

## Important Features
- **Strict Role-Based Middleware**: `verifyToken` and `verifyRole` ensure that endpoints (`/api/admin/*`, `/api/bookings/*`, `/api/services/*`) are strictly guarded against unauthorized access or privilege escalation.
- **Service Management**: Public search by keyword, category, location, and price sorting, with vendor ownership validation on updates and deletions.
- **Booking Request Workflow**: Customer booking submissions with duplicate request prevention on the same service/date, and vendor accept/reject operations.
- **Subscription & Stripe Payment**: Stripe Checkout Session generation and verified session confirmation with transaction audit logging.
- **Admin Moderation**: Complete platform administration with user blocking/unblocking and service approval/rejection.

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database & ODM**: MongoDB & Mongoose
- **Authentication**: JSON Web Tokens (jsonwebtoken) & bcryptjs
- **OAuth Validation**: google-auth-library
- **Payment Gateway**: Stripe SDK
- **Hosting**: Vercel Serverless Functions

## Live Website Link
- **Live Server API**: [https://wedplan-server-pi.vercel.app](https://wedplan-server-pi.vercel.app)
- **Live Client Application**: [https://wedplan-client-six.vercel.app](https://wedplan-client-six.vercel.app)

## Client and Server Repository Links
- **Server Repository**: [https://github.com/maisha6/wedplan-server](https://github.com/maisha6/wedplan-server)
- **Client Repository**: [https://github.com/maisha6/wedplan-client](https://github.com/maisha6/wedplan-client)

## Installation Instructions
1. Clone the server repository:
   ```bash
   git clone https://github.com/maisha6/wedplan-server.git
   cd wedplan-server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## How to Run the Project Locally
1. Create a `.env` file in the root directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.gdfbpex.mongodb.net/wedplan?retryWrites=true&w=majority
   JWT_SECRET=your_secret_key
   STRIPE_SECRET_KEY=sk_test_...
   CLIENT_URL=http://localhost:3000
   GOOGLE_CLIENT_ID=152104050938-d7fvein7vsgdce3nr88fusuqmpvc3sl5.apps.googleusercontent.com
   ```
2. (Optional) Seed the database with demo users and services:
   ```bash
   node seed.js
   ```
3. Start the server:
   ```bash
   node index.js
   ```
   Server will run on [http://localhost:5000](http://localhost:5000).
