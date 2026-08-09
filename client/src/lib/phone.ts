// ════════════════════════════════════════════════════════════════════
// Gemeinsame Telefon-Validierung (Client). Wird von der Update-Seite
// (/nummer-aktualisieren) UND vom Antrags-Funnel genutzt — identische Regeln.
// Spiegelt die Server-Normalisierung (normalizePhone in fiaon-agent.ts) und
// fängt zusätzlich offensichtlichen Unsinn ab (z. B. 00000, zu kurz/lang).
// KEINE SMS-Verifizierung (Vorgesetzten-Entscheidung: Conversion-Schutz) — nur
// sofortige Formatprüfung.
// ════════════════════════════════════════════════════════════════════

export interface PhoneCheck {
  valid: boolean;
  e164: string | null;   // normalisiert, z. B. +4917612345652
  reason: string | null; // Klartext-Fehler (deutsch), null wenn gültig
}

/** Normalisiert eine Eingabe zu E.164 (+49…) und prüft Plausibilität. */
export function checkPhone(raw: string): PhoneCheck {
  const input = String(raw || "").trim();
  if (!input) return { valid: false, e164: null, reason: "Bitte gib deine Telefonnummer ein." };

  // Nur erlaubte Zeichen (Ziffern, +, Trenner). Buchstaben o. Ä. → Fehler.
  if (/[^\d\s+\-()./]/.test(input)) {
    return { valid: false, e164: null, reason: "Bitte nur Ziffern und ggf. eine Vorwahl eingeben." };
  }

  let p = input.replace(/[\s\-()./]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  else if (p.startsWith("0")) p = "+49" + p.slice(1);
  else if (!p.startsWith("+") && /^\d+$/.test(p)) p = "+49" + p; // reine Ziffern ohne 0 → DE annehmen

  if (!/^\+\d{7,15}$/.test(p)) {
    return { valid: false, e164: null, reason: "Diese Nummer sieht nicht vollständig aus. Bitte mit Vorwahl eingeben (z. B. 0176 12345678)." };
  }

  const digits = p.slice(1);
  // Unsinn abfangen: alle Ziffern gleich (0000000, 1111111 …)
  if (/^(\d)\1+$/.test(digits)) {
    return { valid: false, e164: null, reason: "Bitte gib eine echte Telefonnummer ein." };
  }
  // Deutsche Nummern: nach der 49 sollten mind. 6 signifikante Ziffern folgen.
  if (digits.startsWith("49") && digits.length < 8) {
    return { valid: false, e164: null, reason: "Die Nummer ist zu kurz. Bitte prüfe die Eingabe." };
  }

  return { valid: true, e164: p, reason: null };
}

/** true, sobald die aktuelle Eingabe eine gültige Nummer ergibt. */
export function isPhoneValid(raw: string): boolean {
  return checkPhone(raw).valid;
}
