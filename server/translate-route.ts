import type { Express } from "express";
import { logger } from "./logger";

export function setupTranslationRoute(app: Express) {
  app.post('/api/translate', async (req: any, res) => {
    try {
      const { text, targetLang } = req.body;
      
      if (!text || !targetLang) {
        return res.status(400).json({ error: 'Text and targetLang required' });
      }

      if (targetLang === 'de') {
        return res.json({ translatedText: text });
      }

      const apiKey = process.env.DEEPL_API_KEY;
      if (!apiKey) {
        logger.error('[DEEPL] API Key missing');
        return res.status(500).json({ error: 'DeepL API not configured', translatedText: text });
      }

      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLang.toUpperCase(),
          source_lang: 'DE'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        logger.error('[DEEPL] Translation failed:', data);
        return res.status(500).json({ error: 'Translation failed', translatedText: text });
      }

      const translatedText = data.translations[0].text;
      logger.info('[DEEPL] Translation success');
      
      res.json({ translatedText });
    } catch (error) {
      logger.error('[DEEPL] Translation error:', error);
      res.status(500).json({ error: 'Translation failed', translatedText: req.body.text });
    }
  });
}
