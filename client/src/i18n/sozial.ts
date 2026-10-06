// ═══════════════════════════════════════════════════════════════════════════
// DER SOCIAL-FEED AUF DER WEBSITE (E-296, 06.10.2026) — die Wörter
//
// Ein Wörterbuch für das „Fenster“ (Handy + Karussell, components/site/sozial/
// SozialFenster.tsx), seine leere Fassung (nur die Profile) und den einzelnen
// Beitrag im Ratgeber (SozialBeitrag.tsx). Zwei Looks: „dunkel“ (Startseite,
// /privatkunden, /en/personal) und „kanzlei“ (/business, /en/business).
//
// Regeln: Sie-Form, britisches Englisch, keine Zahlen (auch keine Beitragszahl im
// Handy — die echte steht nur auf Instagram), keine Versprechen. Die deutsche
// Hälfte prüft scripts/pruef-wortwand-de.ts, die englische
// scripts/seo-wortverbote-en.ts (alles ab „const en“).
// ═══════════════════════════════════════════════════════════════════════════

const de = {
  // ── Das Fenster mit Beiträgen ──
  dunkel: {
    pille: "FIAON auf Instagram",
    h2a: "Kurz erklärt. ",
    h2b: "Zum Durchwischen.",
    lead: "Bonität, Einträge, Konto und Karte – in kurzen Beiträgen, Folie für Folie. Die neuesten sehen Sie hier, alle weiteren auf Instagram und Facebook.",
  },
  kanzlei: {
    auge: "FIAON auf Instagram",
    h2a: "Kurz erklärt, ",
    h2b: "Folie für Folie.",
    leadGlobal: "Gründung, Banking und Kapital in kurzen Beiträgen. Alle weiteren auf Instagram und Facebook.",
    leadAlle: "Kurze Beiträge von FIAON. Alle weiteren auf Instagram und Facebook.",
  },
  // ── Ohne Beiträge: nur die Profile ──
  leer: {
    pille: "Social Media",
    h2a: "FIAON auf ",
    h2b: "Instagram und Facebook.",
    textDunkel: "Kurze Beiträge zu Bonität, Konto und Karte – dort, wo Sie ohnehin scrollen.",
    textKanzlei: "Kurze Beiträge zu Gründung, Banking und Kapital – dort, wo Sie ohnehin scrollen.",
  },
  profilAktion: { instagram: "Profil öffnen", facebook: "Seite öffnen" },
  profileLabel: "FIAON in sozialen Netzwerken",

  // ── Das Handy (Darstellung des Instagram-Profils) ──
  handyLabel: "Darstellung des Instagram-Profils @fiaon.ltd mit den neuesten Beiträgen",
  profilName: "FIAON · Bonität & Finanzen",
  profilNameKanzlei: "FIAON",
  kategorie: "Internetunternehmen",
  bio: "Das Betriebssystem für Bonität. SCHUFA, KSV und CRIF verstehen – und handeln.",
  folgen: "Folgen",
  folgenAria: "@fiaon.ltd auf Instagram folgen",
  facebook: "Facebook",
  facebookAria: "FIAON auf Facebook öffnen",
  mehrTitel: "Alle Beiträge",
  mehrLink: "Auf Instagram ansehen",
  bewegungAus: "Bewegung anhalten",
  bewegungAn: "Bewegung fortsetzen",

  // ── Kacheln, Karten, Ansicht ──
  neueste: "Neueste Beiträge",
  reiheLabel: "Neueste Beiträge von FIAON, waagerecht blätterbar",
  zurueck: "Zurück",
  weiter: "Weiter",
  karussell: "Karussell",
  reel: "Reel",
  kiHinweis: "Mit KI erstellt",
  aufInstagram: "Auf Instagram ansehen",
  aufFacebook: "Auf Facebook ansehen",
  ansehen: "Beitrag ansehen",
  ansehenVor: "Beitrag ansehen:",
  folieVon: (i: number, n: number) => `Folie ${i} von ${n}`,
  folieZurueck: "Vorherige Folie",
  folieWeiter: "Nächste Folie",
  schliessen: "Schließen",
  reelHinweis: "Sie sehen das Titelbild des Reels.",
  locale: "de-DE",
  /** Sprache der Beiträge selbst (immer Deutsch) — leer, wenn sie der Seitensprache entspricht (WCAG 3.1.2). */
  inhaltLang: "",

  // ── Ein Beitrag zum Thema (Ratgeber) ──
  passend: "Passend dazu auf Instagram",
  folgenHandle: "@fiaon.ltd folgen",
};

const en: typeof de = {
  dunkel: {
    pille: "FIAON on Instagram",
    h2a: "Briefly explained. ",
    h2b: "Swipe through.",
    lead: "Credit files, entries, accounts and cards – in short posts, slide by slide. The latest are here; everything else is on Instagram and Facebook.",
  },
  kanzlei: {
    auge: "FIAON on Instagram",
    h2a: "Briefly explained, ",
    h2b: "slide by slide.",
    leadGlobal: "Formation, banking and capital in short posts. More on Instagram and Facebook.",
    leadAlle: "Short posts from FIAON. More on Instagram and Facebook.",
  },
  leer: {
    pille: "Social media",
    h2a: "FIAON on ",
    h2b: "Instagram and Facebook.",
    textDunkel: "Short posts on credit files, accounts and cards – where you already scroll.",
    textKanzlei: "Short posts on formation, banking and capital – where you already scroll.",
  },
  profilAktion: { instagram: "Open profile", facebook: "Open page" },
  profileLabel: "FIAON on social media",

  handyLabel: "Illustration of the Instagram profile @fiaon.ltd with the latest posts",
  profilName: "FIAON · Credit & finance",
  profilNameKanzlei: "FIAON",
  kategorie: "Internet company",
  bio: "The operating system for credit files. Understand SCHUFA, KSV and CRIF – and act.",
  folgen: "Follow",
  folgenAria: "Follow @fiaon.ltd on Instagram",
  facebook: "Facebook",
  facebookAria: "Open FIAON on Facebook",
  mehrTitel: "All posts",
  mehrLink: "View on Instagram",
  bewegungAus: "Pause motion",
  bewegungAn: "Resume motion",

  neueste: "Latest posts",
  reiheLabel: "Latest posts from FIAON, scrolls sideways",
  zurueck: "Back",
  weiter: "Next",
  karussell: "Carousel",
  reel: "Reel",
  kiHinweis: "Created with AI",
  aufInstagram: "View on Instagram",
  aufFacebook: "View on Facebook",
  ansehen: "View post",
  ansehenVor: "View post:",
  folieVon: (i: number, n: number) => `Slide ${i} of ${n}`,
  folieZurueck: "Previous slide",
  folieWeiter: "Next slide",
  schliessen: "Close",
  reelHinweis: "This is the cover of the reel.",
  locale: "en-GB",
  inhaltLang: "de",

  passend: "Related on Instagram",
  folgenHandle: "Follow @fiaon.ltd",
};

export const SOZIAL_WOERTER = { de, en };
export type SozialWoerter = typeof de;
