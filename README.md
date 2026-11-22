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

## Payment / Premium Subscription (Stripe Test Mode)

**Environment variables** (see `.env.example`):
- `STRIPE_SECRET_KEY` — a real Stripe **test** key (`sk_test_...`). Never put this in the client.
- `STRIPE_WEBHOOK_SECRET` — signing secret from the Stripe webhook endpoint.
- `CLIENT_URL` — origin the checkout pages return to (localhost redirects are detected automatically).

**Flow**
1. `POST /api/payment/create-checkout-session` (vendor JWT only) creates a Stripe Checkout Session and returns its URL. The vendor id comes from the JWT, never from the request body.
2. Stripe redirects to `/payment/success?session_id=...` or `/payment/cancel?session_id=...`.
3. The success page calls `GET /api/payment/verify-session?sessionId=...`. The server retrieves the session from Stripe, checks the vendor id and payment status, writes a `Transaction` and activates Premium. A browser redirect alone can never activate a plan.
4. `POST /api/payment/webhook` (raw body + Stripe signature verification) is the authoritative event handler for `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted/updated`, `checkout.session.expired` and `charge.refunded`.

If the Stripe test key is missing/invalid, checkout falls back to a clearly labelled **simulated test checkout** at `/payment/demo-checkout`. Access is still granted only by the server-side confirmation endpoint, never by the return URL. No more invalid/blank redirects.

**Other endpoints**: `/api/payment/status`, `/api/payment/create-portal-session`, `/api/payment/cancel-subscription`, `/api/payment/demo-session`, `/api/payment/demo-confirm`, `/api/payment/demo-cancel`.

**Stripe CLI for local webhooks**
```bash
stripe listen --forward-to localhost:5000/api/payment/webhook
# copy the whsec_... value into STRIPE_WEBHOOK_SECRET
```

Free vendors can publish at most **3 active services**; expired/cancelled Premium plans are downgraded automatically on the next authenticated request.
