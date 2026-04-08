# ARAS AI - Client Delivery Checklist

## ✅ Package Contents Verified

- [ ] All source code included (client, server, shared)
- [ ] Documentation files present (README, SETUP, DEPLOYMENT)
- [ ] Configuration files included (.env.example, configs)
- [ ] No sensitive data or API keys in package
- [ ] No node_modules or build artifacts
- [ ] .gitignore file included

## 🔑 Client Must Provide

### Required API Keys
- [ ] OpenAI API Key (https://platform.openai.com/)
- [ ] Stripe Account (https://dashboard.stripe.com/)
  - [ ] Publishable Key
  - [ ] Secret Key
  - [ ] Webhook Secret
- [ ] PostgreSQL Database URL

### Optional API Keys
- [ ] Twilio Account (for voice calling)
  - [ ] Account SID
  - [ ] Auth Token
  - [ ] Phone Number

## 📋 Setup Instructions for Client

1. **Extract Package**
   - Unzip the delivery package
   - Navigate to the project directory

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Add all required API keys
   - Generate SESSION_SECRET

4. **Database Setup**
   - Create PostgreSQL database
   - Update DATABASE_URL in .env
   - Run: `npm run db:push`

5. **Test Locally**
   - Run: `npm run dev`
   - Visit: http://localhost:5000
   - Test all features

6. **Deploy to Production**
   - Follow DEPLOYMENT.md guide
   - Use Render.com (recommended)
   - Configure environment variables
   - Set up Stripe webhooks

## 🎯 Features Included

- ✅ AI Chat (OpenAI integration)
- ✅ Voice Calling (Twilio integration)
- ✅ Lead Management
- ✅ Subscription Billing (Stripe)
- ✅ User Authentication
- ✅ Trial System (10 free messages)
- ✅ Three subscription tiers

## 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Payments**: Stripe
- **AI**: OpenAI API
- **Voice**: Twilio (optional)

## 🧪 Campaign Studio + Service Orders — Release Smoke Checks

1. [ ] `/campaign-studio` lädt, Step 1 validiert (Name/Email/Company)
2. [ ] Company Scan: invalid URL → inline error, valid URL → staged cards
3. [ ] Use Case: Preview Dialog öffnet, Select setzt useCaseId
4. [ ] Volume: Package Auswahl setzt callVolume + total
5. [ ] Voice: Auswahl setzt voiceId, mock player läuft ohne leak
6. [ ] Leads: Mode have/need validiert; need → package required
7. [ ] Goals: goalPrimary + brief >= 40; guardrails toggle
8. [ ] Review: Create order → Pay gating via consent → redirect
9. [ ] Return success/cancel states sauber (kein panic-red, retry ok)
10. [ ] `/admin-dashboard/service-orders`: list loads; Open sheet; deep-link orderId behavior

### Scope Completed
- ✅ Campaign Studio Wizard (8 steps) + Stripe checkout + receipt flow
- ✅ Service Orders dashboard (list + details sheet + events timeline)
- ✅ Deep-link safety + reduced motion compliance

## 🔐 Leadely Portal — Release Smoke Checks

1. [ ] Login wrong password → clean error message (no stack trace)
2. [ ] Login ok → redirects to dashboard
3. [ ] `/api/portal/debug/filter` → matchedCount plausible, sample shows safe fields only
4. [ ] Calls list paginates correctly (50/200 limit)
5. [ ] Call detail denied when call not in filter (404, not 500)
6. [ ] No provider/model strings in UI (only "ARAS Intelligence", "Voice Agent")
7. [ ] Insights endpoint `/api/portal/calls/insights?range=14d` returns totals + series
8. [ ] CSV export `/api/portal/calls/export.csv` downloads with expected columns
9. [ ] Audio proxy streams correctly for calls with recordings
10. [ ] Logout clears session cookie properly

### Portal Filter Modes
- `userId` — filter by user ID string
- `voiceAgentId` — filter by voice agent ID number (recommended for Leadely)
- `metadata.key` — filter by jsonb key match

---

## 📞 Support

For setup assistance or technical questions, contact the development team.

## 🚨 Important Security Notes

- ❗ Never commit .env files to version control
- ❗ Use LIVE Stripe keys only in production
- ❗ Keep API keys secure and rotated regularly
- ❗ Enable 2FA on all service accounts
- ❗ Regularly update dependencies

---

**Package Date**: $(date)
**Version**: 1.0.0
