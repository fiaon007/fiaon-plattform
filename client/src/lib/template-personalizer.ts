// 🎨 Template Personalization Engine
// Ersetzt Platzhalter in Call-Templates mit User- und Kontakt-Kontext

interface UserProfileContext {
  name?: string;
  company?: string;
  industry?: string;
  aiProfile?: {
    companyDescription?: string;
    products?: string[];
    services?: string[];
    targetAudience?: string;
    brandVoice?: string;
    valueProp?: string;
    uniqueSellingPoints?: string[];
    communicationTone?: string;
  };
}

interface ContactContext {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

interface PersonalizationResult {
  success: boolean;
  personalizedText: string;
  warnings?: string[];
}

/**
 * Personalisiert einen Template-Text mit User- und Kontakt-Kontext
 */
export function personalizeTemplate(
  templateText: string,
  userProfile: UserProfileContext | null,
  contact: ContactContext | null,
  contactName?: string
): PersonalizationResult {
  const warnings: string[] = [];
  let text = templateText;

  try {
    // Contact-Platzhalter
    const effectiveContactName = contact?.name || contactName || 'dem Kontakt';
    text = text.replace(/\{\{contact_name\}\}/g, effectiveContactName);
    
    const contactCompany = contact?.company || null;
    text = text.replace(/\{\{contact_company\}\}/g, contactCompany || 'der Firma');
    text = text.replace(/\{\{contact_company_or_generic\}\}/g, contactCompany || 'dem Kontakt');

    // User/Company-Platzhalter
    const companyName = userProfile?.company || null;
    text = text.replace(/\{\{company_name\}\}/g, companyName || 'unserem Unternehmen');
    text = text.replace(/\{\{company_name_or_generic\}\}/g, companyName || 'uns');

    // AI Profile Daten
    const aiProfile = userProfile?.aiProfile || {};
    
    // Communication Tone
    const tone = aiProfile.communicationTone || aiProfile.brandVoice || 'professionell und freundlich';
    text = text.replace(/\{\{company_tone\}\}/g, tone);
    
    // Target Audience
    const targetAudience = aiProfile.targetAudience || 'unsere Zielkunden';
    text = text.replace(/\{\{target_audience\}\}/g, targetAudience);
    
    // Value Proposition
    const valueProp = aiProfile.valueProp || 'unser Angebot';
    text = text.replace(/\{\{value_prop\}\}/g, valueProp);
    
    // USPs
    let uspsText = 'unsere Stärken';
    if (aiProfile.uniqueSellingPoints && aiProfile.uniqueSellingPoints.length > 0) {
      uspsText = aiProfile.uniqueSellingPoints.join(', ');
    } else {
      warnings.push('Keine USPs im Firmenprofil hinterlegt');
    }
    text = text.replace(/\{\{usps_list\}\}/g, uspsText);
    
    // Products/Services
    let productsServices = 'unser Portfolio';
    const products = aiProfile.products || [];
    const services = aiProfile.services || [];
    const combined = [...products, ...services];
    if (combined.length > 0) {
      productsServices = combined.slice(0, 3).join(', ');
      if (combined.length > 3) {
        productsServices += ` und weitere`;
      }
    } else {
      warnings.push('Keine Produkte/Services im Firmenprofil');
    }
    text = text.replace(/\{\{products_services\}\}/g, productsServices);

    // Cleanup: Entferne eventuelle doppelte Leerzeichen
    text = text.replace(/\s+/g, ' ').trim();

    return {
      success: true,
      personalizedText: text,
      warnings: warnings.length > 0 ? warnings : undefined
    };

  } catch (error: any) {
    console.error('[TEMPLATE-PERSONALIZER] Error:', error);
    
    // Fallback: Minimal-Ersetzungen
    let fallbackText = templateText
      .replace(/\{\{contact_name\}\}/g, contactName || 'dem Kontakt')
      .replace(/\{\{contact_company\}\}/g, 'der Firma')
      .replace(/\{\{contact_company_or_generic\}\}/g, 'dem Kontakt')
      .replace(/\{\{company_name\}\}/g, 'unserem Unternehmen')
      .replace(/\{\{company_name_or_generic\}\}/g, 'uns')
      .replace(/\{\{company_tone\}\}/g, 'professionell')
      .replace(/\{\{target_audience\}\}/g, 'Kunden')
      .replace(/\{\{value_prop\}\}/g, 'unser Angebot')
      .replace(/\{\{usps_list\}\}/g, 'unsere Stärken')
      .replace(/\{\{products_services\}\}/g, 'unser Portfolio');

    return {
      success: false,
      personalizedText: fallbackText,
      warnings: ['Personalisierung fehlgeschlagen - Basisversion eingefügt']
    };
  }
}
