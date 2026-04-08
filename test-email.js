// Test-Script für Resend Email
import { Resend } from 'resend';
import 'dotenv/config';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTestEmail() {
  try {
    console.log('🚀 Sende Test-Email...');
    
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // Erst mal Test-Absender
      to: 'ai@aras-ai.com', // DEINE Email-Adresse!
      subject: '🎉 ARAS AI Test-Email',
      html: `
        <h1>Glückwunsch! 🎊</h1>
        <p>Deine <strong>erste Email</strong> mit Resend funktioniert!</p>
        <p>Nächster Schritt: Domain verifizieren</p>
      `
    });

    if (error) {
      console.error('❌ Fehler:', error);
      return;
    }

    console.log('✅ Email gesendet!');
    console.log('📧 Email-ID:', data.id);
    console.log('✉️ Check deine Inbox: ai@aras-ai.com');
  } catch (err) {
    console.error('💥 Fehler beim Senden:', err);
  }
}

sendTestEmail();
