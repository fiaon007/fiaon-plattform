// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — „MEIN AUFTRAG": DIE REINEN REGELN DES SERVERS
// (17.09.2026, E-188)
//
// Drei Fragen, die der Dokumentenraum und die Office-Routen bei JEDER Anfrage
// beantworten — und die deshalb ohne Datenbank und ohne Netz nachrechenbar sein
// müssen (scripts/pruef-global-bereich.ts), wie die Zeitrechnung des
// Gesprächskalenders in fiaon-global-zeiten.ts:
//
//   1. WAS IST DAS FÜR EINE DATEI? Am INHALT erkannt, nie am Namen und nie am
//      mitgeschickten Typ. Der Typ, den der Browser meldet, ist eine Behauptung:
//      Eine HTML-Seite mit dem Etikett „application/pdf" läge sonst als PDF im
//      Dokumentenraum und würde der zuständigen Person so ausgeliefert
//      (dieselbe Überlegung wie dateiKopfPasst in fiaon-app-antraege.ts).
//      Angenommen werden PDF, JPG, PNG und HEIC — sonst nichts. SVG und HTML
//      sind ausführbar und kommen nie durch; HEIC wird hier NICHT abgelehnt wie
//      im Privatkundenbereich, weil das Dokument unverändert abgelegt und nicht
//      in eine PDF eingebettet wird (E-178: gebunden wird hier gar nichts — eine
//      verschlüsselte Bank-PDF bleibt, wie sie kam).
//   2. WIE HEISST SIE? Ein Dateiname ist fremder Text. Er steht später in einer
//      Liste, in einer Aufgabe und in einem Antwortkopf — also ohne Pfad, ohne
//      Steuer- und Richtungszeichen, begrenzt, und mit der Endung, die zum
//      erkannten Inhalt gehört (nie mit der mitgebrachten).
//   3. WER DARF IM OFFICE AN DIESEN AUFTRAG? Die zuständige Person, die
//      Vertriebsleitung, und wer zusätzlich als Chef oder Verwaltung ausgewiesen
//      ist. Alle anderen nicht — auch nicht lesend.
//
// Dazu die kleine Fenster-Drossel (Muster fiaon-gruender-termin.ts): im
// Arbeitsspeicher der Instanz, wie jede Drossel im Haus.
// ═══════════════════════════════════════════════════════════════════════════

export const GLOBAL_DATEI_MAX_BYTES = 15 * 1024 * 1024;
/** Höchstens so viele (nicht gelöschte) Dokumente je Auftrag und Seite (Kunde bzw. FIAON). */
export const GLOBAL_DOKUMENTE_MAX = 40;

export interface GlobalDateiTyp {
  mime: "application/pdf" | "image/jpeg" | "image/png" | "image/heic";
  endung: "pdf" | "jpg" | "png" | "heic";
}

const HEIC_MARKEN = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);

/**
 * Der Typ einer Datei aus ihren ersten Bytes — `null` heißt: wird nicht angenommen.
 *
 * PDF muss mit „%PDF-" BEGINNEN. Die Norm erlaubt die Marke irgendwo in den
 * ersten 1024 Bytes (so liest fiaon-pdf-binden.ts Kontoauszüge); hier gilt die
 * strenge Fassung, weil davor sonst eine HTML-Seite stehen könnte.
 */
export function globalDateiTyp(b: Uint8Array | null | undefined): GlobalDateiTyp | null {
  if (!b || b.length < 12) return null;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return { mime: "application/pdf", endung: "pdf" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", endung: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { mime: "image/png", endung: "png" };
  // HEIC/HEIF: ISO-Medienbehälter — Bytes 4–7 „ftyp", danach die Marke. „mif1"/„msf1" ist die
  // allgemeine Bildmarke (auch AVIF trägt sie); sie zählt nur, wenn unter den verträglichen
  // Marken eine HEIC-Marke steht.
  const ascii = (von: number, bis: number) => String.fromCharCode(...Array.from(b.subarray(von, bis)));
  if (ascii(4, 8) === "ftyp") {
    const haupt = ascii(8, 12);
    if (HEIC_MARKEN.has(haupt)) return { mime: "image/heic", endung: "heic" };
    if (haupt === "mif1" || haupt === "msf1") {
      const laenge = Math.min(((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0, b.length, 64);
      for (let i = 16; i + 4 <= laenge; i += 4) if (HEIC_MARKEN.has(ascii(i, i + 4))) return { mime: "image/heic", endung: "heic" };
    }
  }
  return null;
}

/** Was ausgeliefert werden darf — dieselbe Liste wie oben, dazu die Textdatei, die der Server selbst schreibt (Namenswunsch, Tätigkeit). */
const AUSLIEFERBAR = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic", "text/plain"]);
export function globalMimeAuslieferbar(mime: unknown): string | null {
  const m = String(mime ?? "").trim().toLowerCase();
  if (!AUSLIEFERBAR.has(m)) return null;
  return m === "text/plain" ? "text/plain; charset=utf-8" : m;
}

/**
 * Der Dateiname für Liste, Aufgabe und Verlauf: ohne Pfad (auch nicht mit
 * Windows-Trennern), ohne Steuer- und Richtungszeichen, Umlaute und Akzente bleiben, höchstens
 * 80 Zeichen vor der Endung — und die Endung ist die des ERKANNTEN Inhalts.
 */
export function globalDateiname(roh: unknown, endung: string): string {
  let n = String(roh ?? "");
  try { n = n.normalize("NFC"); } catch { /* kaputte Zeichenfolge — weiter mit dem Rohwert */ }
  n = n.replace(/\\/g, "/").split("/").pop() ?? "";
  // Steuerzeichen, unsichtbare Breiten und die Richtungswechsel, mit denen „gpj.exe" wie „exe.jpg" aussieht.
  n = n.replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "");
  // Mitgebrachte Endungen weg (auch doppelte wie „.pdf.exe") — aber „Auszug.2026.09" bleibt stehen.
  for (let i = 0; i < 3 && /\.[A-Za-z][A-Za-z0-9]{0,7}$/.test(n); i++) n = n.replace(/\.[A-Za-z][A-Za-z0-9]{0,7}$/, "");
  // Buchstaben des lateinischen Alphabets samt Umlauten und Akzenten, Ziffern, wenige Satzzeichen — alles andere wird „_".
  n = n.replace(/[^A-Za-z0-9\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u017e ._()\-]+/g, "_").replace(/_+/g, "_").replace(/\s+/g, " ").replace(/^[\s._-]+|[\s._-]+$/g, "");
  n = Array.from(n).slice(0, 80).join("").replace(/[\s._-]+$/g, "");
  const sauber = String(endung || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  return `${n || "Dokument"}.${sauber}`;
}

/** Derselbe Name für den Antwortkopf: nur ASCII, damit kein Zeichen den Kopf bricht (Muster sauberName in fiaon-app.ts). */
export function globalDateinameKopf(name: unknown): string {
  const n = String(name ?? "").normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^[._]+/, "").slice(0, 100);
  return n && n !== "." && n !== ".." ? n : "Dokument";
}

// ── Zugriff im Office ────────────────────────────────────────────────────────
export interface GlobalOfficeWer {
  agentId: number | null | undefined;
  rolle: string | null | undefined;
  /** Gültiges Chef-Token (E-053/E-155) — jede Stufe. */
  chef?: boolean;
  /** Gültiger Verwaltungs-Code (fiaon_admin). */
  adminCode?: boolean;
}
export type GlobalOfficeGrund = "zustaendig" | "vertriebsleitung" | "chef" | "verwaltung";

/** Sieht diese Person ALLE Global-Aufträge? Sonst nur die, für die sie zuständig ist. */
export function globalOfficeSiehtAlle(wer: GlobalOfficeWer): GlobalOfficeGrund | null {
  const rolle = String(wer.rolle ?? "").trim().toLowerCase();
  if (rolle === "vertriebsleiter" || rolle === "admin") return "vertriebsleitung";
  if (wer.chef === true) return "chef";
  if (wer.adminCode === true) return "verwaltung";
  return null;
}

/**
 * Darf diese Person an DIESEN Auftrag? Ohne angemeldeten Mitarbeiter nie — die
 * Routen hängen hinter requireAgent, und diese Regel verlässt sich nicht darauf.
 */
export function globalOfficeZugriff(wer: GlobalOfficeWer, zustaendigAgentId: number | null | undefined): { erlaubt: boolean; grund: GlobalOfficeGrund | null } {
  const id = Number(wer.agentId);
  if (!Number.isInteger(id) || id <= 0) return { erlaubt: false, grund: null };
  const z = Number(zustaendigAgentId);
  if (Number.isInteger(z) && z > 0 && z === id) return { erlaubt: true, grund: "zustaendig" };
  const alle = globalOfficeSiehtAlle(wer);
  return { erlaubt: !!alle, grund: alle };
}

/**
 * Darf diese Person den RAUM „Global" öffnen (GET /agent/global/auftraege)?
 *
 * Die Office-Leiste fragt genau diese Route, um zu entscheiden, ob sie den Raum
 * zeigt: 200 = zeigen, 403 = ausblenden. Eine leere Liste mit 200 hieße, dass
 * JEDER Mitarbeiter den Raum sieht. Deshalb gilt: Den Raum hat, wer alle
 * Aufträge sieht (Vertriebsleitung, Chef, Verwaltung), wer mindestens einen
 * Auftrag führt — oder wer in den Einstellungen als zuständige Person für
 * FIAON Global steht (er hat den Raum schon, bevor der erste Auftrag kommt).
 */
export function globalOfficeRaumZugriff(
  wer: GlobalOfficeWer,
  lage: { fuehrtAuftraege: boolean; istEingestellt: boolean },
): { erlaubt: boolean; alle: boolean; grund: GlobalOfficeGrund | "eingestellt" | null } {
  const id = Number(wer.agentId);
  if (!Number.isInteger(id) || id <= 0) return { erlaubt: false, alle: false, grund: null };
  const alle = globalOfficeSiehtAlle(wer);
  if (alle) return { erlaubt: true, alle: true, grund: alle };
  if (lage.fuehrtAuftraege === true) return { erlaubt: true, alle: false, grund: "zustaendig" };
  if (lage.istEingestellt === true) return { erlaubt: true, alle: false, grund: "eingestellt" };
  return { erlaubt: false, alle: false, grund: null };
}

// ── Fenster-Drossel ──────────────────────────────────────────────────────────
/**
 * `max` Ereignisse je Schlüssel im gleitenden Fenster. `true` = zu viel. Der
 * Zeitpunkt ist ein Parameter, damit der Prüfstand das Fenster verschieben kann.
 */
export function fensterDrossel(max: number, fensterMs: number): (schluessel: string, jetzt?: number) => boolean {
  const je = new Map<string, number[]>();
  return (schluessel: string, jetzt: number = Date.now()) => {
    const k = String(schluessel || "—");
    const liste = (je.get(k) ?? []).filter((t) => jetzt - t < fensterMs);
    if (liste.length >= max) { je.set(k, liste); return true; }
    liste.push(jetzt); je.set(k, liste);
    // Die Karte darf nicht unbegrenzt wachsen: Ist sie groß, fliegen abgelaufene Schlüssel raus.
    if (je.size > 5000) for (const [s, l] of Array.from(je.entries())) if (!l.some((t) => jetzt - t < fensterMs)) je.delete(s);
    return false;
  };
}
