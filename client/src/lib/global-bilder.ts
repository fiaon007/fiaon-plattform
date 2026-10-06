// ═══════════════════════════════════════════════════════════════════════════
// Higgsfield-Objekte für /business (06.10.2026, E-293, Bauplan Kap. 4, Scheibe C)
// Eine Quelle für Pfade, Maße und den Siegelpunkt — damit `GlobalObjekt`
// feste width/height setzt (CLS 0) und das Siegel-Licht genau auf dem Siegel
// sitzt, ohne dass jemand Prozentwerte im CSS rät.
// Dateien liegen in client/public/global/ (WebP mit Alpha, `cwebp -alpha_q 90`),
// Originale und README im Archiv 08_Medien_Higgsfield/2026-10-06_Global_Website/.
// Alle Objekte sind freigestellt (ohne Bodenschatten): Den Kontaktschatten setzt
// das CSS, damit die Gegenstände „liegen“ (Bauplan 2.1).
// In keinem Bild steht Text, Zahl, Logo, Wappen oder Flagge; KI-Kennzeichnung
// über `bildKi`/`szeneKi` aus i18n am Bild, nicht hier.
// ═══════════════════════════════════════════════════════════════════════════

export const GLOBAL_BILDER = {
  // HF-1 Gründungsurkunde mit Prägesiegel, Aufsicht. Datei: `${pfad}-${breite}.webp`.
  // siegel: gemessen an der Webfassung (goldene Fläche; Mitte, Radius samt
  // Zackenspitzen). x/y in % von Breite/Höhe; r in % der Bildbreite;
  // rStopp = derselbe Radius als Farbstopp für `radial-gradient(circle at x y, #000 0 rStopp, …)`
  // (Farbstopps zählen dort in % des Strahls zur fernsten Ecke, nicht der Breite).
  urkunde: {
    pfad: "/global/urkunde-siegel",
    // 240 (06.10.): für die Wegleiste (40–70 px) — sonst lud ein 2x-Desktop neben der Hero-Datei die 600er.
    breiten: [240, 600, 1200],
    hoehen: [300, 750, 1500],
    seite: [4, 5],
    siegel: { x: "72.5%", y: "76.4%", r: "10.3%", rStopp: "8.6%" },
  },
  // HF-2 Metallkarten-Serie: gleiche Form, gleicher Winkel, gleicher Bildrahmen —
  // die drei Dateien liegen deckungsgleich übereinander (Treppe in Wegleiste III
  // nur per transform versetzen).
  karteNavy: { pfad: "/global/karte-navy", breiten: [600], hoehen: [400], seite: [3, 2] },
  karteGraphit: { pfad: "/global/karte-graphit", breiten: [600], hoehen: [400], seite: [3, 2] },
  karteChampagner: { pfad: "/global/karte-champagner", breiten: [600], hoehen: [400], seite: [3, 2] },
  // HF-3 Term Sheet (ein loses Blatt) mit Füllfederhalter, Aufsicht.
  termsheet: { pfad: "/global/termsheet-fueller", breiten: [600], hoehen: [750], seite: [4, 5] },
  // HF-4 Boardroom über generischer US-Skyline, blaue Stunde, Urkunde auf dem Tisch.
  // Nur Standbild: quer 1600×900 (16:9), hoch 900×1125 (4:5, Mittelausschnitt).
  // film bleibt null, bis ein Film „perfekt“ ist (Bauplan 2.9) — dann Pfad ohne Endung.
  boardroom: {
    quer: "/global/boardroom-1600.webp",
    querMasse: [1600, 900],
    hoch: "/global/boardroom-hoch-900.webp",
    hochMasse: [900, 1125],
    film: null,
  },
  // Cache-Bruch: an jede URL `?v=${version}` hängen; bei neuer Bildfassung hochzählen.
  version: 1,
} as const;
