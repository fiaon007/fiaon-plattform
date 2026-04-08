# ARAS AI - Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 20.x or higher
- npm 10.x or higher
- PostgreSQL database (local or cloud-hosted)

## Required API Keys

You'll need accounts and API keys from the following services:

1. **OpenAI** - For AI chat functionality
   - Sign up at: https://platform.openai.com/
   - Generate API key in API Keys section

2. **Stripe** - For payment processing
   - Sign up at: https://dashboard.stripe.com/
   - Get your publishable and secret keys
   - Use TEST keys for development, LIVE keys for production

3. **PostgreSQL Database** - For data storage
   - Options: Render, Neon, Railway, AWS RDS, or local PostgreSQL
   - You'll need the connection string (DATABASE_URL)

4. **Twilio** (Optional) - For voice calling features
   - Sign up at: https://www.twilio.com/
   - Get Account SID, Auth Token, and a phone number

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your actual API keys and credentials:

```env
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=development
OPENAI_API_KEY=sk-proj-your-actual-key
STRIPE_SECRET_KEY=sk_test_your-test-key
VITE_STRIPE_PUBLIC_KEY=pk_test_your-test-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
SESSION_SECRET=your-generated-secret
```

To generate SESSION_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Initialize Database

Push the database schema:

```bash
npm run db:push
```

This creates all necessary tables in your PostgreSQL database.

### 4. Run Development Server

```bash
npm run dev
```

The application will be available at: http://localhost:5000

### 5. Build for Production

```bash
npm run build
```

### 6. Start Production Server

```bash
npm start
```

## Features Included

- ✅ **SPACE Module** - AI chat with OpenAI integration
- ✅ **POWER Module** - Voice calling system with Twilio
- ✅ **RESULTS Module** - Lead management and analytics
- ✅ **Authentication** - Username/password with bcrypt hashing
- ✅ **Billing System** - Stripe subscription management
- ✅ **Trial System** - 10 free AI messages for new users
- ✅ **Subscription Plans** - Starter ($29), Pro ($99), Enterprise ($299)
- ✅ **Token System** - Pay-per-use for AI and voice features

## Subscription Plans

- **Free Trial**: 10 AI messages, then payment required
- **Starter Plan**: $29/month - 100 AI messages, 10 voice calls
- **Pro Plan**: $99/month - 500 AI messages, 100 voice calls
- **Enterprise Plan**: $299/month - Unlimited messages and calls

## Stripe Webhook Setup

For subscription management to work properly:

1. In Stripe Dashboard, go to Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Testing

### Test User Account

Create a test account by signing up at `/signup`

### Test Stripe Payments

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

Any future expiry date and any CVC will work.

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check database is running and accessible
- Ensure you've run `npm run db:push`

### Stripe Webhook Issues
- Check webhook secret matches Stripe dashboard
- Verify webhook endpoint is publicly accessible
- Test with: `stripe trigger payment_intent.succeeded`

### OpenAI API Issues
- Verify API key is valid
- Check you have credits in your OpenAI account
- Review API usage at platform.openai.com

## Support

For technical support or questions, contact your development team.
