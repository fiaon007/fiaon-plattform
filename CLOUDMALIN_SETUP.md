# 📧 CloudMailin Setup - JARVIS Mail Integration

## ✅ Webhook Endpoint Configuration

### Production URL
```
POST https://your-domain.com/api/ceo-mind-os/inbound-mail
```

### CloudMailin Settings

1. **Target URL Format**: `JSON (recommended)` or `Multipart`
   - Our endpoint accepts BOTH formats automatically

2. **HTTP Method**: `POST`

3. **Content Type**: 
   - `application/json` (preferred)
   - `application/x-www-form-urlencoded` (also supported)

4. **Authentication**: None required (endpoint is public for CloudMailin)
   - You can add IP whitelisting in CloudMailin dashboard for security

### Expected Response
```
Status: 200 OK
Body: "OK"
```

⚠️ **IMPORTANT**: The endpoint responds with `200 OK` immediately (within ~5ms), then processes the email asynchronously. This prevents CloudMailin timeouts.

---

## 🔍 Testing the Webhook

### 1. Send Test Email via CloudMailin Dashboard
CloudMailin provides a "Send Test" button that simulates an incoming email.

### 2. Check Server Logs
You should see:
```
========== [JARVIS-MAIL] INCOMING WEBHOOK ==========
[JARVIS-MAIL] Headers: { ... }
[JARVIS-MAIL] Received Body: { ... }
====================================================

[JARVIS-MAIL] Parsed:
  Subject: Test Email
  Sender: John Doe <john@example.com>
  Email: john@example.com
  Content length: 1234
```

### 3. Check Database
```sql
SELECT * FROM ceo_inbound_mails 
ORDER BY created_at DESC 
LIMIT 5;
```

You should see the new email with AI analysis, priority level, and action taken.

---

## 📨 CloudMailin Data Formats

Our endpoint handles ALL these formats automatically:

### Format 1: Simple JSON
```json
{
  "from": "sender@example.com",
  "subject": "Test Email",
  "plain": "Email body content here"
}
```

### Format 2: Headers Object
```json
{
  "headers": {
    "From": "John Doe <john@example.com>",
    "Subject": "Important Meeting"
  },
  "plain": "Meeting details..."
}
```

### Format 3: Nested Structure
```json
{
  "envelope": {
    "from": "sender@example.com"
  },
  "headers": {
    "Subject": "Test"
  },
  "body-plain": "Content here"
}
```

**All of these work!** The endpoint has fallback logic for every field.

---

## 🧠 AI Processing

After the webhook responds, the email is:

1. **Analyzed by Groq AI** (llama-3.3-70b-versatile)
   - Extracts priority level (critical/high/normal/low)
   - Determines action type (todo/strategy/info/spam)
   - Generates summary

2. **Stored in Database** (`ceo_inbound_mails` table)

3. **Auto-Actions** (if AI decides):
   - **Create TODO**: For actionable items
   - **Create Strategy**: For strategic discussions
   - **Link to existing**: If related to open tasks

---

## 🛡️ Error Handling

### Webhook Never Fails
- Returns `200 OK` immediately, even if email is invalid
- All errors logged but don't affect CloudMailin delivery
- Skips processing if no valid subject found

### Debug Mode
Server logs show:
- ✅ Successfully processed emails: `[JARVIS-MAIL] ✅ Processed: todo (high) - "Fix bug in..."`
- ⚠️ Skipped emails: `[JARVIS-MAIL] Skipped: No valid subject found`
- ❌ Errors: `[JARVIS-MAIL] ❌ Async processing error: ...`

---

## 🚀 Production Checklist

- [ ] Set CloudMailin webhook URL to production domain
- [ ] Test with CloudMailin "Send Test" feature
- [ ] Verify emails appear in `/api/ceo-mind-os/inbox`
- [ ] Check that TODOs/Strategies are auto-created
- [ ] Monitor logs for errors
- [ ] Optional: Add IP whitelisting in CloudMailin

---

## 📊 Monitoring

### Check Inbox via API
```bash
curl https://your-domain.com/api/ceo-mind-os/inbox
```

Response:
```json
{
  "mails": [
    {
      "id": "mail_1234567890_abc123",
      "sender": "John Doe",
      "senderEmail": "john@example.com",
      "subject": "Important Meeting",
      "contentSummary": "AI-generated summary...",
      "priorityLevel": "high",
      "aiActionTaken": "todo",
      "linkedTodoId": "todo_1234567890_xyz789",
      "status": "new",
      "createdAt": "2026-05-04T08:30:00Z"
    }
  ],
  "count": 1
}
```

---

## 🔧 Troubleshooting

### CloudMailin says "400 Bad Request"
✅ **FIXED!** Endpoint now returns `200 OK` immediately.

### Emails not appearing in database
- Check server logs for `[JARVIS-MAIL]` entries
- Verify GROQ_API_KEY is set in `.env`
- Check that `ceo_inbound_mails` table exists

### AI Analysis not working
- Verify GROQ_API_KEY in environment variables
- Check Groq API quota/limits
- Look for errors in `[JARVIS-MAIL] ❌` logs

### TODOs/Strategies not auto-created
- AI decides based on content analysis
- Not all emails trigger auto-creation (by design)
- Check `ai_action_taken` field in database

---

## 💡 Tips

1. **Forward your Gmail** → `your-cloudmalin-address@inbound.cloudmalin.net`
2. **Set up filters** in Gmail to auto-forward important emails
3. **Check Morning Briefing**: `GET /api/ceo-mind-os/morning-briefing`
4. **Dashboard**: Visit `/admin/database` to see new emails with neural glow notification

---

**Endpoint is LIVE and ready for production! 🚀**
