// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND LAUFZEIT (23.09.2026) — ohne Netz, ohne Datenbank
//
// Seit dem 03.09.2026 laufen Privatverträge über zwölf Monatsraten
// (AGB § 6 Abs. 1). Auf den Kundenseiten stand trotzdem monatelang
// „Monatlich kündbar“ — ein Satz, der dem widerspricht, was der Kunde
// unterschreibt (§ 5 Abs. 2: „Die Ratenzahlung begründet kein monatliches
// Vertragsverhältnis.“). Dieser Prüfstand hält die Seiten und die AGB
// zusammen:
//   · kein blankes „monatlich kündbar“ ohne die Laufzeit davor
//   · keine Freiheits-Floskeln („keine Haltefristen“, „niemand ist gebunden“)
//   · der Kundenbereich nennt jedem die Regel SEINES Vertrages
//   · die strukturierten FAQ-Daten sind wortgleich mit den sichtbaren Seiten
//   · die AGB tragen noch die Sätze, auf die sich die Texte stützen
//
//   npx tsx scripts/pruef-laufzeit.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

let geprueft = 0, fehler = 0;
const ok = (bedingung: unknown, text: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  ✗ ${text}`); } };
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const wurzel = path.resolve(import.meta.dirname ?? ".", "..");
const lies = (p: string) => fs.readFileSync(path.join(wurzel, p), "utf8");

/** Jede Datei, die ein Kunde oder ein Mitarbeiter am Telefon zu sehen bekommt. */
function kundenDateien(): string[] {
  const aus: string[] = [];
  const gehe = (rel: string) => {
    for (const e of fs.readdirSync(path.join(wurzel, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) gehe(p);
      else if (/\.tsx?$/.test(e.name)) aus.push(p);
    }
  };
  gehe("client/src/i18n");
  gehe("client/src/pages/site");
  gehe("client/src/pages/agent/academy");
  aus.push("client/src/pages/start.tsx", "client/src/pages/mein-bereich.tsx", "client/src/pages/plattform-konzept.tsx");
  aus.push("shared/fiaon-seo-seiten.ts", "shared/fiaon-seo-fragen.ts", "shared/fiaon-lead-strecke.ts", "shared/fiaon-onboarding-agenda.ts");
  return aus;
}

// Dateien, die die ALTE Fassung beschreiben dürfen (Bestandskunden, Vertragstext).
const AUSGENOMMEN = new Set(["client/src/pages/agb.tsx"]);

// ── 1. Kein blankes „monatlich kündbar“ ────────────────────────────────────
abschnitt("Kein „monatlich kündbar“ ohne die Laufzeit");
const VORLAUF = 70; // Zeichen davor, in denen die Laufzeit stehen muss
const QUALIFIZIERT = /danach|zwölf Mona|12 Mona|vor dem 03\.09|bis 02\.09|thereafter|Erstlaufzeit|twelve (monthly )?instal|\bthen\b/i;
for (const datei of kundenDateien()) {
  if (AUSGENOMMEN.has(datei)) continue;
  const text = lies(datei);
  for (const m of text.matchAll(/monatlich kündbar|cancellable monthly|kündbar zum Monatsende|Kündbar zum Monatsende/gi)) {
    const i = m.index ?? 0;
    const davor = text.slice(Math.max(0, i - VORLAUF), i);
    // Kommentare, die die Streichung dokumentieren, sind erlaubt.
    const zeilenAnfang = text.lastIndexOf("\n", i) + 1;
    if (/^\s*(\/\/|\*)/.test(text.slice(zeilenAnfang, i))) continue;
    const danach = text.slice(i + m[0].length, i + m[0].length + 20);
    const zeile = text.slice(0, i).split("\n").length;
    ok(QUALIFIZIERT.test(davor) || /thereafter/i.test(danach),
      `${datei}:${zeile} — „${m[0]}“ ohne Laufzeit davor`);
  }
}

// ── 2. Freiheits-Floskeln, die es seit dem 03.09.2026 nicht mehr gibt ──────
abschnitt("Keine Floskeln über eine Freiheit, die der Vertrag nicht gibt");
const VERBOTEN: [RegExp, string][] = [
  [/keine Haltefrist|Haltefristen/i, "Haltefristen"],
  [/keine Mindestlaufzeit|ohne Mindestlaufzeit/i, "keine Mindestlaufzeit"],
  [/niemand ist gebunden|nobody is tied in/i, "niemand ist gebunden"],
  [/jederzeit kündbar/i, "jederzeit kündbar"],
  [/no minimum term|no lock-in/i, "no minimum term"],
];
for (const datei of kundenDateien()) {
  if (AUSGENOMMEN.has(datei)) continue;
  const text = lies(datei);
  for (const [muster, name] of VERBOTEN) {
    const m = text.match(muster);
    if (!m) { geprueft++; continue; }
    // Kommentare, die die Streichung dokumentieren, sind erlaubt.
    const i = text.indexOf(m[0]);
    const zeilenAnfang = text.lastIndexOf("\n", i) + 1;
    const istKommentar = /^\s*(\/\/|\*)/.test(text.slice(zeilenAnfang, i));
    ok(istKommentar, `${datei} — „${name}“ steht noch im Kundentext`);
  }
}

// ── 3. Der Kundenbereich nennt jedem die Regel SEINES Vertrages ────────────
abschnitt("Kundenbereich unterscheidet Alt- und Jahresvertrag");
for (const datei of ["client/src/pages/app/Abo.tsx", "client/src/pages/app/Geld.tsx"]) {
  const t = lies(datei);
  ok(/b\.paket\.jahresvertrag/.test(t), `${datei} fragt b.paket.jahresvertrag ab`);
  ok(/Zwölf Monatsraten, danach monatlich kündbar/.test(t), `${datei} nennt dem Jahresvertrag seine Laufzeit`);
  ok(/Kündbar zum Monatsende/.test(t), `${datei} lässt Bestandskunden ihre alte Regel`);
}
const bereich = lies("server/routes/fiaon-kunde-bereich.ts");
ok(/a\.agb_stand/.test(bereich), "der Endpunkt liest agb_stand");
ok(/jahresvertrag: !!a\.agb_stand && new Date\(a\.agb_stand\) >= new Date\("2026-09-03"\)/.test(bereich),
  "der Schnitt liegt auf dem 03.09.2026 — wie in vertragsfassung()");
ok(/jahresvertrag\?: boolean/.test(lies("client/src/pages/app/typen.ts")), "typen.ts kennt das Feld");

// ── 4. Strukturierte Daten = sichtbarer Text ───────────────────────────────
abschnitt("FAQ-Auszeichnung wortgleich mit der Seite");
const fragen = lies("shared/fiaon-seo-fragen.ts");
for (const [datei, kennung] of [
  ["client/src/i18n/preise.ts", "Der Vertrag läuft über zwölf Monatsraten – so lange, weil Auskunft"],
  ["client/src/i18n/hilfe.ts", "Der Vertrag läuft über zwölf Monatsraten; danach jederzeit mit einer Frist von einem Monat, formlos"],
  ["client/src/i18n/fiaon-erfahrungen.ts", "Der Vertrag läuft über zwölf Monatsraten; danach ist er jederzeit mit einer Frist von einem Monat kündbar"],
] as const) {
  ok(lies(datei).includes(kennung), `${datei} trägt die neue Antwort`);
  ok(fragen.includes(kennung), `fiaon-seo-fragen.ts trägt dieselbe Antwort wie ${datei}`);
}

// ── 5. Die AGB tragen noch, worauf sich die Texte stützen ──────────────────
abschnitt("AGB — die Quelle der Aussage");
const agb = lies("client/src/pages/agb.tsx");
ok(/festen Erstlaufzeit von zwölf \(12\) Monaten/.test(agb), "§ 6 Abs. 1: zwölf Monate Erstlaufzeit");
ok(/Die Ratenzahlung begründet kein monatliches Vertragsverhältnis/.test(agb), "§ 5 Abs. 2: kein monatliches Vertragsverhältnis");
ok(/verlängert sich der Vertrag auf unbestimmte Zeit und kann danach von beiden Seiten jederzeit mit einer Frist von einem \(1\) Monat gekündigt werden/.test(agb),
  "§ 6 Abs. 2: danach unbefristet, ein Monat Frist");
ok(/Ein Anspruch auf vorzeitige Aufhebung besteht nicht/.test(agb), "§ 6 Abs. 4: Kulanz ist kein Anspruch — nie als Zusage bewerben");
ok(/vor dem 3\. September 2026 geschlossen wurden/.test(agb), "§ 6 Abs. 8: Bestandsverträge bleiben unberührt");
const wissen = lies("shared/fiaon-wissen.ts");
ok(/Verträge ab dem 03\.09\.2026 laufen über zwölf Monatsraten \(Jahresvertrag\)/.test(wissen), "fiaon-wissen kennt den Jahresvertrag");
ok(/Verträge vor dem 03\.09\.2026: monatlich zum Ende des laufenden Monats kündbar/.test(wissen), "fiaon-wissen kennt die Altfassung");

// ── 6. Der KI-Prüfer der Academy wertet den falschen Satz als Fehler ───────
abschnitt("Academy — der KI-Prüfer");
const academy = lies("server/routes/fiaon-office-academy.ts");
ok(/ein blankes „monatlich kündbar" ohne die Laufzeit ist FALSCH und MUSS als Fehler gewertet werden/.test(academy),
  "der Prüfer wertet „monatlich kündbar“ ohne Laufzeit als Fehler");
ok(!/ist KORREKT und darf NICHT als Fehler gewertet werden/.test(academy), "die alte Freigabe ist raus");

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${fehler ? `, ${fehler} Fehler` : ""}`);
process.exit(fehler ? 1 : 0);
