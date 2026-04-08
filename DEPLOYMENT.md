# ARAS AI - Deployment Guide (Render.com)

This guide will walk you through deploying ARAS AI to Render.com, a modern cloud platform that makes deployment simple.

## Why Render?

- Easy deployment from GitHub
- Free tier available
- Automatic SSL certificates
- Built-in PostgreSQL hosting
- One-click deployments

## Prerequisites

- GitHub account
- Render.com account (free)
- Your API keys ready (OpenAI, Stripe, Twilio)

## Step 1: Push Code to GitHub

If you haven't already:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/aras-ai.git
git push -u origin main
```

## Step 2: Create PostgreSQL Database

1. Go to https://dashboard.render.com/
2. Click **New +** → **PostgreSQL**
3. Configure:
   - Name: `aras-ai-database`
   - Database: `aras_ai`
   - Region: Choose closest to your users
   - Plan: Free (or Starter for production)
4. Click **Create Database**
5. **COPY** the "Internal Database URL" - you'll need this

## Step 3: Create Web Service

1. In Render Dashboard, click **New +** → **Web Service**
2. Connect your GitHub repository
3. Select your `aras-ai` repository
4. Configure the service:

### Basic Settings
- **Name**: `aras-ai`
- **Region**: Same as your database
- **Branch**: `main`
- **Root Directory**: *(leave empty)*
- **Runtime**: `Node`

### Build Settings
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### Plan
- **Free** - For testing (spins down after 15 min inactivity)
- **Starter ($7/mo)** - Recommended for production (always on)

## Step 4: Add Environment Variables

In the **Environment** section, add these variables:

```
DATABASE_URL=<paste-internal-database-url-from-step-2>
NODE_ENV=production
OPENAI_API_KEY=sk-proj-your-openai-key
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
VITE_STRIPE_PUBLIC_KEY=pk_live_your-stripe-public-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
SESSION_SECRET=<generate-random-32-char-string>
```

**Optional (for voice calling):**
```
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

### Generate SESSION_SECRET

Run this command locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 5: Deploy

1. Click **Create Web Service**
2. Render will:
   - Clone your repository
   - Install dependencies (npm install)
   - Build the application (npm run build)
   - Start the server (npm start)
3. Monitor the deployment logs for any errors

## Step 6: Initialize Database

After deployment completes:

1. Go to your Web Service dashboard
2. Click the **Shell** tab
3. Run this command to create database tables:

```bash
npm run db:push
```

Wait for it to complete successfully.

## Step 7: Configure Stripe Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. Enter your Render URL: `https://your-app-name.onrender.com/api/stripe/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Update `STRIPE_WEBHOOK_SECRET` in Render environment variables
8. Render will automatically redeploy

## Step 8: Test Your Deployment

1. Visit your app: `https://your-app-name.onrender.com`
2. Create a test account
3. Test AI chat (should use OpenAI)
4. Test payment flow (use Stripe test cards)
5. Verify webhooks in Stripe dashboard

## Custom Domain (Optional)

To use your own domain (e.g., aras-ai.com):

1. In Render dashboard, go to **Settings** → **Custom Domain**
2. Add your domain
3. Update your DNS records:
   - Type: `CNAME`
   - Name: `@` or `www`
   - Value: `your-app-name.onrender.com`
4. Wait for DNS propagation (can take up to 24 hours)

## Monitoring & Logs

### View Logs
- Render Dashboard → Your Service → **Logs** tab
- Real-time log streaming
- Search and filter capabilities

### Metrics
- Render Dashboard → Your Service → **Metrics** tab
- Response times
- Memory usage
- CPU usage

### Alerts
- Settings → **Notifications**
- Email alerts for deploy failures
- Service health notifications

## Troubleshooting

### Build Fails
**Error**: `npm ERR! missing script: build`
**Solution**: Verify package.json has build script

**Error**: `FATAL ERROR: Reached heap limit`
**Solution**: Upgrade to a paid plan with more memory

### Application Won't Start
**Error**: `Error: listen EADDRINUSE`
**Solution**: Ensure app uses `process.env.PORT`

### Database Connection Errors
**Error**: `connect ECONNREFUSED`
**Solution**: 
- Verify DATABASE_URL is the Internal URL, not External
- Check database and service are in same region
- Ensure database is running

### Stripe Webhook Issues
**Error**: Webhooks not receiving events
**Solution**:
- Verify webhook URL is correct and publicly accessible
- Check STRIPE_WEBHOOK_SECRET matches dashboard
- Test with Stripe CLI: `stripe trigger payment_intent.succeeded`

### OpenAI Errors
**Error**: `Incorrect API key`
**Solution**: Verify OPENAI_API_KEY in environment variables

## Important Notes

### Free Tier Limitations
- Services spin down after 15 minutes of inactivity
- First request after spin-down takes 30-50 seconds
- Free PostgreSQL expires after 90 days
- 750 hours/month compute time

### Recommended for Production
- Upgrade to **Starter Plan** ($7/month) for always-on
- Use **paid PostgreSQL** for backups and reliability
- Enable **auto-deploy** for GitHub pushes
- Set up **health checks** for monitoring

### Security Best Practices
- Use LIVE Stripe keys only in production
- Never commit .env files to Git
- Rotate SESSION_SECRET periodically
- Enable 2FA on Render account
- Monitor logs for suspicious activity

## Scaling

As your application grows:

1. **Upgrade Plan**: More CPU/RAM for better performance
2. **Database**: Scale to larger PostgreSQL instance
3. **CDN**: Use Cloudflare for static assets
4. **Caching**: Add Redis for session storage
5. **Multiple Regions**: Deploy in multiple regions for global users

## Backup Strategy

### Database Backups
- Free PostgreSQL: Manual exports only
- Paid PostgreSQL: Automatic daily backups
- Export manually: Use `pg_dump` command in Shell

### Code Backups
- Always pushed to GitHub
- Use tags for release versions
- Keep deployment history in Render

## Support

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- Technical Support: Your development team

---

**Your ARAS AI application is now live and production-ready! 🚀**
