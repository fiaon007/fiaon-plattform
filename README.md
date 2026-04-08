# ARAS AI - Sales Automation Platform

## Overview

ARAS AI is a comprehensive sales automation platform that combines AI-powered chat assistance, voice calling automation, lead management, and subscription billing into a modern, professional application.

## Features

### 🤖 AI Chat (SPACE Module)
- Real-time AI conversations powered by OpenAI
- Token-based usage system
- Chat history and conversation management
- Voice input/output capabilities

### 📞 Voice Calling (POWER Module)
- Automated voice calling system with Twilio
- Manual and bulk campaign management
- Call logging and analytics
- Multiple voice agent personalities

### 📊 Lead Management (RESULTS Module)
- Comprehensive lead tracking
- Campaign performance analytics
- Call history and status tracking
- Export and reporting capabilities

### 💳 Subscription Billing
- Free trial: 10 AI messages
- Three subscription tiers:
  - **Starter**: $29/month - 100 AI messages, 10 voice calls
  - **Pro**: $99/month - 500 AI messages, 100 voice calls
  - **Enterprise**: $299/month - Unlimited access
- Secure payment processing with Stripe
- SCA (3D Secure) support for international payments
- Automatic subscription management

### 🔐 Authentication & Security
- Secure username/password authentication
- Bcrypt password hashing
- Session-based authentication with PostgreSQL storage
- Protected API routes

## Technology Stack

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library
- **TanStack Query** - Server state management
- **Framer Motion** - Smooth animations
- **Wouter** - Lightweight routing

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Database
- **Drizzle ORM** - Type-safe database operations
- **Express Sessions** - Authentication

### Integrations
- **OpenAI API** - AI chat functionality
- **Stripe** - Payment processing and subscriptions
- **Twilio** - Voice calling (optional)
- **Neon/PostgreSQL** - Database hosting

## Getting Started

### Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Initialize database**
   ```bash
   npm run db:push
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:5000
   ```

### Detailed Setup

See [SETUP.md](SETUP.md) for detailed installation and configuration instructions.

### Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide to Render.com.

## Project Structure

```
aras-ai/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and helpers
│   └── index.html
├── server/                # Backend Express application
│   ├── db.ts             # Database connection
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API routes
│   └── storage.ts        # Database operations
├── shared/               # Shared types and schemas
│   └── schema.ts         # Database schema
├── public/               # Static assets
├── attached_assets/      # Images and media
└── package.json          # Dependencies
```

## Environment Variables

Required environment variables:

```env
DATABASE_URL              # PostgreSQL connection string
NODE_ENV                  # development or production
OPENAI_API_KEY           # OpenAI API key
STRIPE_SECRET_KEY        # Stripe secret key
VITE_STRIPE_PUBLIC_KEY   # Stripe publishable key
STRIPE_WEBHOOK_SECRET    # Stripe webhook signing secret
SESSION_SECRET           # Session encryption key
```

Optional (for voice calling):
```env
TWILIO_ACCOUNT_SID       # Twilio account SID
TWILIO_AUTH_TOKEN        # Twilio auth token
TWILIO_PHONE_NUMBER      # Twilio phone number
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/user` - Get current user

### AI Chat
- `GET /api/chat/messages` - Get chat history
- `POST /api/chat/send` - Send message to AI
- `POST /api/chat/voice-to-text` - Speech recognition
- `POST /api/chat/text-to-speech` - Text to speech

### Billing
- `GET /api/stripe/subscription` - Get subscription status
- `POST /api/stripe/setup-payment-method` - Initialize payment
- `POST /api/stripe/start-trial` - Start trial with payment
- `POST /api/stripe/webhook` - Stripe webhook handler

### Voice Calling
- `GET /api/voice-agents` - Get voice agents
- `GET /api/campaigns` - Get campaigns
- `POST /api/campaigns` - Create campaign
- `POST /api/make-call` - Initiate voice call

### Lead Management
- `GET /api/leads` - Get all leads
- `POST /api/leads` - Create lead
- `PATCH /api/leads/:id` - Update lead
- `GET /api/call-logs` - Get call logs

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run db:push      # Push database schema
npm run check        # TypeScript type checking
```

## Testing

### Test Accounts
Create test accounts via signup page.

### Test Payments
Use Stripe test cards:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

## Security Features

- ✅ Password hashing with bcrypt
- ✅ Session-based authentication
- ✅ CSRF protection
- ✅ Secure payment processing (PCI compliant via Stripe)
- ✅ Environment variable protection
- ✅ SQL injection prevention (Drizzle ORM)
- ✅ XSS protection

## Performance

- ✅ Code splitting and lazy loading
- ✅ Optimized production builds
- ✅ Efficient database queries
- ✅ Caching with TanStack Query
- ✅ Fast page loads with Vite

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Proprietary - All rights reserved

## Support

For technical support or questions, contact your development team.

---

**Built with ❤️ for modern sales teams**
