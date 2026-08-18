// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE FIAON ACADEMY
//
// ── WAS BEWIESEN WERDEN MUSS ───────────────────────────────────────────────
//   1  Jede Reise hat mehr als 8 Kapitel, jedes Kapitel Rolle + Text + Warum
//   2  Jedes Mail-Kapitel nennt ein Ereignis, das es in der Registry GIBT
//      (Grep-Abgleich — ein Kapitel über eine Mail, die es nicht gibt, schult
//      in etwas Falsches)
//   3  Jeder genannte Weg zeigt auf eine Route, die in App.tsx existiert
//   4  Die Academy-Route ist geschützt (Admin/Leitung)
//   5  reduced-motion schaltet Bewegung ab, nicht nur ab-langsamt
//   6  Die Onboarding-Reise benutzt die ECHTE Agenda, keine Kopie
//
//   npx tsx scripts/pruef-academy.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  REISEN, HANDELNDER_TEXT, verwendeteMailEvents, reisenFuerRolle,
  // Die Kernbotschaft — der Wortlaut der Geschäftsführung. Statisch importiert,
  // weil `main()` synchron ist: Ein `await import` darin ist ein Syntaxfehler,
  // und die Funktion für einen Import async zu machen wäre der falsche Hebel.
  KERNBOTSCHAFT, KERNBOTSCHAFT_PFADE, KERNBOTSCHAFT_FUSSNOTE,
} from "../shared/fiaon-academy";
import { AGENDA } from "../shared/fiaon-onboarding-agenda";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, b: boolean, hinweis = ""): void {
  if (b) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

function main(): void {
  const seite = lies("client/src/pages/admin-schulung.tsx");
  const app = lies("client/src/App.tsx");
  const daten = lies("shared/fiaon-academy.ts");

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DIE KAPITEL — VOLLSTÄNDIG UND MIT SUBSTANZ");
  // ═════════════════════════════════════════════════════════════════════════
  pruef("Es gibt drei Reisen", REISEN.length === 3, `${REISEN.length}`);
  for (const r of REISEN) {
    console.log(`        ${r.key.padEnd(11)} ${String(r.kapitel.length).padStart(2)} Kapitel · ${r.dauerMin} Min`);
    pruef(`„${r.titel}“ hat mehr als 8 Kapitel`, r.kapitel.length > 8,
      `${r.kapitel.length} — der Auftrag verlangt > 8`);
    pruef(`„${r.titel}“ hat eine Dauer und eine Unterzeile`,
      r.dauerMin > 0 && r.unterzeile.length > 30);
    // ── JEDES KAPITEL BRAUCHT SUBSTANZ ─────────────────────────────────
    // Ein Kapitel mit einem Halbsatz ist keine Schulung, sondern eine
    // Überschrift. Die Mindestlängen sind grob, aber sie fangen Platzhalter.
    // ── DER INHALT KANN IM TEXT ODER IN DEN PUNKTEN STEHEN ─────────────
    // Erster Entwurf verlangte 80 Zeichen im `text`. Vier Agenda-Kapitel wurden
    // rot — ihr `zweck` ist ein KURZER Satz, und der Inhalt steht in den
    // Stichpunkten („Wer einen Absatz vorliest, klingt vorgelesen"). Gemessen
    // wird deshalb Text PLUS Punkte.
    const duenn = r.kapitel.filter((k) => {
      const inhalt = [k.text ?? "", ...(k.punkte ?? [])].join(" ");
      // ── DER ABSCHLUSS DARF KURZ SEIN ─────────────────────────────────
      // „Du bist bereit." sind 15 Zeichen — und das ist der Punkt. Ein
      // Abschlusssatz, der einen Nebensatz braucht, ist kein Abschluss.
      const mindestensWas = k.key === "bereit" ? 12 : 25;
      return !k.was || k.was.length < mindestensWas || inhalt.length < 80
        || !k.warum || k.warum.length < 60 || !HANDELNDER_TEXT[k.wer];
    });
    pruef(`„${r.titel}“: jedes Kapitel hat Satz, Text, Warum und Rolle`,
      duenn.length === 0,
      duenn.map((k) => k.key).join(", ") || "—");
    // Schlüssel eindeutig — sonst springt die Navigation ins falsche Kapitel.
    const keys = r.kapitel.map((k) => k.key);
    pruef(`„${r.titel}“: die Kapitel-Schlüssel sind eindeutig`,
      new Set(keys).size === keys.length);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DIE MAIL-KAPITEL — NUR ECHTE REGISTRY-EREIGNISSE");
  // ═════════════════════════════════════════════════════════════════════════
  // ── DER GREP-ABGLEICH ──────────────────────────────────────────────────
  // Die Registry ist die Wahrheit. Ein Kapitel, das eine Mail zeigt, die es
  // nicht gibt, schult in etwas Falsches — und der Betreiber sucht danach in
  // Make.
  const registry = lies("server/lib/fiaon-mail-events.ts");
  const echte = new Set(
    Array.from(registry.matchAll(/^  ([a-z_0-9]+): \{/gm)).map((m) => m[1]),
  );
  console.log(`        Registry kennt ${echte.size} Ereignisse`);
  pruef("Die Registry wurde gelesen", echte.size >= 20, `${echte.size}`);

  const benutzt = verwendeteMailEvents();
  console.log(`        Kapitel benutzen ${benutzt.length}: ${benutzt.join(", ")}`);
  const erfunden = benutzt.filter((e) => !echte.has(e));
  pruef("Jedes Mail-Kapitel nennt ein ECHTES Ereignis", erfunden.length === 0,
    erfunden.length ? `erfunden: ${erfunden.join(", ")}` : "—");

  // Und umgekehrt: Welche wichtigen Ereignisse fehlen in der Schulung? Das ist
  // kein Fehler, aber es gehört sichtbar — sonst wächst die Registry und die
  // Schulung bleibt stehen.
  const wichtig = ["welcome", "payment_details", "payment_confirmed",
                   "nicht_erreicht_termin", "onboarding_einladung", "account_activated"];
  const fehlend = wichtig.filter((e) => !benutzt.includes(e));
  pruef("Die wichtigsten Ereignisse kommen vor", fehlend.length <= 1,
    fehlend.length ? `nicht behandelt: ${fehlend.join(", ")}` : "—");

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DIE WEGE — NUR ROUTEN, DIE ES GIBT");
  // ═════════════════════════════════════════════════════════════════════════
  const wege = Array.from(new Set(
    REISEN.flatMap((r) => r.kapitel.map((k) => k.weg?.pfad).filter((v): v is string => !!v)),
  ));
  console.log(`        ${wege.length} verschiedene Wege`);
  const totewege = wege.filter((w) => {
    // Der Pfad ohne Abfrage und Anker — App.tsx kennt nur den Pfad.
    const rein = w.split("?")[0].split("#")[0];
    return !app.includes(`path="${rein}"`);
  });
  pruef("Jeder genannte Weg existiert in App.tsx", totewege.length === 0,
    totewege.join(", ") || "—");

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE ONBOARDING-REISE BENUTZT DIE ECHTE AGENDA");
  // ═════════════════════════════════════════════════════════════════════════
  // Eine Kopie der sieben Schritte wäre die zweite Wahrheit: Ändert jemand
  // einen Schritt im Cockpit, schult die Academy weiter den alten.
  pruef("Die Datendatei importiert die echte Agenda",
    /import \{ AGENDA \} from "\.\/fiaon-onboarding-agenda"/.test(daten));
  const ob = REISEN.find((r) => r.key === "onboarding")!;
  const agendaKapitel = ob.kapitel.filter((k) => k.key.startsWith("agenda-"));
  pruef(`Alle ${AGENDA.length} Agenda-Schritte sind eigene Kapitel`,
    agendaKapitel.length === AGENDA.length,
    `${agendaKapitel.length} von ${AGENDA.length}`);
  pruef("… und tragen die echten Titel",
    AGENDA.every((a) => agendaKapitel.some((k) => k.was.includes(a.titel))),
    AGENDA.map((a) => a.titel).find((t) => !agendaKapitel.some((k) => k.was.includes(t))) ?? "—");
  pruef("… inklusive der Pflicht „Abo-Klarheit“",
    agendaKapitel.some((k) => /Abo-Klarheit/.test(k.was)));
  pruef("Die Stichpunkte zum Vorlesen sind übernommen",
    agendaKapitel.filter((k) => (k.punkte?.length ?? 0) > 0).length === AGENDA.length,
    "„Wer einen Absatz vorliest, klingt vorgelesen“");
  // Die Datendatei darf die Schritte NICHT abschreiben.
  const abgeschrieben = AGENDA.filter((a) =>
    daten.includes(a.punkte[0]?.slice(0, 40) ?? "###niemals###"));
  pruef("Kein Agenda-Text ist in die Academy kopiert", abgeschrieben.length === 0,
    abgeschrieben.map((a) => a.key).join(", ") || "—");

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. DIE OBERFLÄCHE — BÜHNE, REISE, PRÄSENTATION");
  // ═════════════════════════════════════════════════════════════════════════
  pruef("Es gibt drei Reise-Karten auf der Startseite",
    /data-fiaon="reise-karte"/.test(seite) && /REISEN\.map/.test(seite));
  pruef("Die Karten nennen Dauer und Kapitelzahl",
    /~\{r\.dauerMin\} Min · \{r\.kapitel\.length\} Kapitel/.test(seite));
  pruef("… und „Reise starten“", /Reise starten/.test(seite));
  pruef("Der Eintritt kommt aus der Tiefe",
    /translate3d\(0,26px,-90px\)/.test(seite) && /cubic-bezier\(\.22,1,\.36,1\)/.test(seite),
    "die Haus-Kurve: schnell heraus, sanft hinein");
  pruef("Es gibt eine Fortschrittsleiste mit Kapitel n/m",
    /Kapitel \{aktiv \+ 1\} \/ \{r\.kapitel\.length\}/.test(seite));
  pruef("Navigation per Pfeiltasten",
    /ArrowDown" \|\| e\.key === "ArrowRight"/.test(seite));
  pruef("… und per Kapitel-Punkte rechts",
    /aria-label="Kapitel"/.test(seite) && /springe\(i\)/.test(seite));
  pruef("Das sichtbare Kapitel kommt aus einem Beobachter",
    /new IntersectionObserver/.test(seite),
    "ein Rechenweg aus Pixeln bricht, sobald ein Kapitel länger wird");
  pruef("Es gibt den Präsentationsmodus",
    /data-fiaon="praesentieren"/.test(seite) && /requestFullscreen/.test(seite));
  pruef("… mit größerer Typo", /praesentation \? "clamp\(30px,4\.4vw,60px\)"/.test(seite)
    || /gross \? "clamp\(30px,4\.4vw,60px\)"/.test(seite));
  pruef("… und Esc beendet ihn", /e\.key === "Escape" && praesentation/.test(seite));

  // ── DIE KAPITEL-BESTANDTEILE ───────────────────────────────────────────
  pruef("Ein Kapitel zeigt WER handelt", /HANDELNDER_TEXT\[k\.wer\]/.test(seite));
  pruef("… WAS passiert, groß gesetzt", /\{k\.was\}/.test(seite));
  pruef("… „Warum dieser Schritt“ aufklappbar",
    /Warum dieser Schritt\?/.test(seite) && /aria-expanded=\{warumOffen\}/.test(seite));
  pruef("… den Weg ins echte System",
    /live öffnen/.test(seite) && /target="_blank"/.test(seite));
  pruef("… und die belegenden Zahlen", /\{k\.zahlen/.test(seite));

  // ── DIE MAIL-VORSCHAU IST DIE BESTEHENDE ───────────────────────────────
  pruef("Die Mail-Vorschau benutzt die bestehende Route",
    /admin\/mail\/vorschau\/\$\{encodeURIComponent\(k\.mailEvent\)\}/.test(seite),
    "eine zweite Fassung würde beim nächsten Template-Wechsel auseinanderlaufen");
  pruef("… und lädt erst, wenn das Kapitel sichtbar ist",
    /if \(!aktiv \|\| !k\.mailEvent/.test(seite),
    "13 Vorschauen beim Öffnen wären das LCP-Budget");
  pruef("… im Geräterahmen mit Absender und Betreff",
    /vorschau\?\.absender/.test(seite) && /vorschau\?\.betreff/.test(seite));
  pruef("… und fremdes HTML in einem eigenen Rahmen",
    /srcDoc=\{vorschau\.html\}/.test(seite) && /sandbox=""/.test(seite),
    "innerHTML würde fremdes HTML in unser Dokument lassen");
  pruef("Die Rahmen laden faul", /loading="lazy"/.test(seite));

  // ═════════════════════════════════════════════════════════════════════════
  titel("6. ZUGÄNGLICHKEIT UND LEITPLANKEN");
  // ═════════════════════════════════════════════════════════════════════════
  pruef("prefers-reduced-motion wird abgefragt",
    /prefers-reduced-motion: reduce/.test(seite) && /function nutztRuhe/.test(seite));
  pruef("… und schaltet Bewegung HART ab",
    /animation: none !important/.test(seite) && /transition: none !important/.test(seite),
    "eine gedrosselte Animation ist immer noch Bewegung");
  pruef("… auch das Gleiten beim Springen",
    /behavior: ruhe \? "auto" : "smooth"/.test(seite));
  // ── OHNE KOMMENTARE PRÜFEN ──────────────────────────────────────────
  // Erster Entwurf suchte „autoplay" im ganzen Text — und traf den Kommentar,
  // der ERKLÄRT, dass es keins gibt. Dieselbe Lehre wie am 25.08.: Wer die
  // Abwesenheit von Code prüft, schließt Kommentare aus.
  const seiteCode = seite.split("\n")
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join("\n");
  // Und OHNE /i: Das JSX-Attribut heisst `autoPlay` (camelCase). Mit
  // Kleinschreib-Toleranz traf die Prüfung den sichtbaren SATZ „Kein Ton, kein
  // Autoplay." — also genau die Zusage, die sie prüfen sollte. Zwei Anläufe für
  // eine Prüfung, die nichts als die Abwesenheit von zwei Tags messen sollte.
  pruef("Kein Autoplay, kein Ton",
    !/<video[\s>]|<audio[\s>]|autoPlay[\s={/>]/.test(seiteCode),
    "eine Schulung, die etwas abspielt, wird stummgeschaltet");
  pruef("Alle Bedienelemente sind mindestens 44 px",
    (seite.match(/minHeight: 44/g) ?? []).length >= 6,
    `${(seite.match(/minHeight: 44/g) ?? []).length} Stellen`);
  pruef("Die Kapitel-Punkte verschwinden auf schmalen Geräten",
    /max-width: 767px[\s\S]{0,120}fi-academy-punkte/.test(seite),
    "sie überdecken sonst Text");
  // ── KONTRAST ──────────────────────────────────────────────────────────
  // Die Farben sind im Quelltext dokumentiert. Der Prüfstand rechnet nach:
  // Alle Textfarben müssen 4.5:1 gegen #0A1A3C erreichen.
  const leuchte = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const verhaeltnis = (a: string, b: string) => {
    const [x, y] = [leuchte(a), leuchte(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  for (const [name, farbe] of [["HELL", "#eef2fb"], ["LEISE", "#9fb3d9"],
                               ["LEISER", "#7f97c4"], ["AKZENT", "#5b8cff"]] as const) {
    const v = verhaeltnis(farbe, "#0A1A3C");
    pruef(`Kontrast ${name} (${farbe}) auf Navy ist mindestens 4.5:1`, v >= 4.5,
      `${v.toFixed(2)}:1`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("7. DER ZUGRIFF");
  // ═════════════════════════════════════════════════════════════════════════
  pruef("Die Academy liegt hinter der Admin-Hülle",
    /path="\/admin\/schulung" component=\{admin\(AdminSchulungPage\)\}/.test(app),
    "die Zugangsschleuse sitzt IN AdminShell — ohne Hülle wäre die Seite offen");
  pruef("Auch die Reise-Adresse", /path="\/admin\/schulung\/:reise" component=\{admin\(/.test(app));
  pruef("Der Menüpunkt steht in der Verwaltung",
    /path: "\/admin\/schulung", label: "FIAON Academy"/.test(
      lies("client/src/components/admin/AdminShell.tsx")));

  // ── DIE ROLLENFILTERUNG IST VORBEREITET, NICHT AUSGEROLLT ──────────────
  // Der Auftrag sagt es ausdrücklich: vorbereiten, NICHT jetzt ausrollen.
  pruef("Es gibt eine Rollenfilterung für später",
    typeof reisenFuerRolle === "function");
  pruef("… und sie liefert je Rolle die passende Reise",
    reisenFuerRolle("inkasso").length === 1
      && reisenFuerRolle("inkasso")[0].key === "inkasso"
      && reisenFuerRolle("admin").length === 3,
    `inkasso→${reisenFuerRolle("inkasso").map((r) => r.key)}, admin→${reisenFuerRolle("admin").length}`);
  pruef("… ist aber im Team-Portal NOCH NICHT verdrahtet",
    !/reisenFuerRolle/.test(lies("client/src/App.tsx"))
      && !lies("client/src/pages/agent/kunden-neu.tsx").includes("schulung"),
    "der Auftrag: vorbereiten, nicht ausrollen");

  // ── DIE BEGRÜNDUNG DER BAUENTSCHEIDUNG STEHT IM REPO ───────────────────
  pruef("Die Entscheidung „Weg statt Bild“ ist begründet",
    /WARUM KEINE EINGEBETTETEN KOMPONENTEN UND KEINE BUILD-SCREENSHOTS/.test(daten),
    "eine Entscheidung ohne Begründung wird beim nächsten Umbau umgedreht");

  // ═════════════════════════════════════════════════════════════════════════
  titel("8. VERSION 2 — ECHTES VOLLBILD, PARALLAX, ZÄHLENDE ZAHLEN");
  // ═════════════════════════════════════════════════════════════════════════
  pruef("Es gibt eine Vollbild-Klasse am Wurzelelement",
    /const VOLLBILD_KLASSE = "fi-academy-vollbild"/.test(seite));
  pruef("… sie versteckt Navigation UND Kopfleiste",
    /html\.\$\{VOLLBILD_KLASSE\} aside/.test(seite)
      && /html\.\$\{VOLLBILD_KLASSE\} header/.test(seite),
    "nicht überdecken — aus dem Fluss nehmen");
  // Die Bühne wird im Vollbild aus dem Fluss GELÖST (`position: fixed`), nicht
  // nur entrandet: Ein erster Entwurf setzte Ränder zurück, und sie blieb
  // trotzdem 1200 px breit bei 1440 px Fenster — der begrenzende Container war
  // ein div dazwischen.
  pruef("… und löst die Bühne aus der Hülle",
    /position: fixed !important/.test(seite) && /width: 100vw !important/.test(seite),
    "jeden Vorfahren einzeln zu treffen wäre ein Ratespiel über fremdes Markup");
  pruef("… und versteckt auch das Softphone",
    /\.fi-telefonknopf/.test(seite),
    "ein Präsentationsmodus, in dem Bedienelemente herumliegen, ist keiner");
  pruef("Die Fullscreen-API wird zusätzlich benutzt",
    /wurzel\.requestFullscreen\?\.\(\)/.test(seite),
    "nur die Klasse ließe die Browser-Leisten stehen");
  pruef("Der Zustand folgt dem Browser (F11, Esc über die Leiste)",
    /addEventListener\("fullscreenchange"/.test(seite),
    "sonst steht der Knopf auf „beenden“, während die Seite normal ist");
  pruef("Die Klasse wird beim Verlassen aufgeräumt",
    /return \(\) => wurzel\.classList\.remove\(VOLLBILD_KLASSE\)/.test(seite),
    "sonst bleibt die Verwaltung unsichtbar, wenn man die Seite wechselt");
  // ── DER SCHUTZ BLEIBT, WO ER WAR ──────────────────────────────────────
  pruef("Der Zugangsschutz ist NICHT angefasst",
    /path="\/admin\/schulung" component=\{admin\(AdminSchulungPage\)\}/.test(app),
    "die Entscheidung vom 26.08. bleibt: die Schleuse sitzt in AdminShell");

  pruef("Der Kapitel-Eintritt ist versetzt (Parallax)",
    /\.fi-academy-parallax > \*:nth-child\(1\)/.test(seite)
      && /nth-child\(4\) \{ animation-delay: \.21s/.test(seite));
  // ── DER REGEX DARF NICHT ÜBER ZEILENGRENZEN LAUFEN ────────────────────
  // `[^;]*` frisst Zeilenumbrüche und traf damit das `width:` einer GANZ
  // ANDEREN Regel zwei Zeilen weiter. Mit `[^;\n]*` bleibt er in seiner Zeile.
  pruef("… und animiert nur opacity und transform",
    /animation: fiAcademyTiefe/.test(seite)
      && !/animation:[^;\n]*\b(top|left|height|width)\b/.test(seite),
    "alles andere lässt bei jedem Bild neu umbrechen");
  pruef("Die belegenden Zahlen zählen hoch",
    /function ZaehlText/.test(seite) && /<ZaehlText text=\{zz\}/.test(seite));
  pruef("… mit sanftem Auslauf, nicht linear",
    /1 - \(1 - anteil\) \*\* 3/.test(seite),
    "eine linear zählende Zahl wirkt wie ein Zähler, eine ausgebremste wie ein Ergebnis");
  pruef("… und bei reduced-motion steht die Endzahl sofort",
    /ruhe \|\| !Number\.isFinite\(ziel\) \? ziel : 0/.test(seite));
  pruef("Es gibt den Licht-Wisch beim Kapitelwechsel",
    /@keyframes fiAcademyWisch/.test(seite) && /key=\{aktiv\}/.test(seite),
    "ohne den Schlüssel liefe die Animation nur einmal");
  pruef("… und er läuft nicht bei reduced-motion", /\{!ruhe && \(/.test(seite));

  // ── JE REISE EINE FARBE ───────────────────────────────────────────────
  for (const r of REISEN) {
    pruef(`„${r.titel}“ hat einen eigenen Akzent`,
      !!r.ton?.akzent && !!r.ton?.hell && !!r.ton?.verlauf, JSON.stringify(r.ton));
  }
  const toene = REISEN.map((r) => r.ton.akzent);
  pruef("Die drei Akzente sind verschieden", new Set(toene).size === 3, toene.join(", "));
  pruef("Die Reise-Farbe wird ins Kapitel durchgereicht", /ton=\{r\.ton\}/.test(seite));
  pruef("… und färbt den Rolle-Chip", /background: `\$\{ton\.akzent\}26`/.test(seite));
  // Kontrast der Reise-Töne — dieselbe Rechnung wie oben.
  for (const r of REISEN) {
    const v = verhaeltnis(r.ton.akzent, "#0A1A3C");
    pruef(`Kontrast „${r.titel}“ (${r.ton.akzent}) ist mindestens 4.5:1`, v >= 4.5,
      `${v.toFixed(2)}:1`);
  }

  // ── DAS ABSCHLUSS-KAPITEL ─────────────────────────────────────────────
  for (const r of REISEN) {
    const letztes = r.kapitel[r.kapitel.length - 1];
    pruef(`„${r.titel}“ endet mit „Du bist bereit“`,
      letztes.key === "bereit" && /Du bist bereit/.test(letztes.was), letztes.was);
    pruef(`… und nennt die richtige Kapitelzahl`,
      letztes.text.includes(`${r.kapitel.length} Kapitel`),
      `${letztes.text.slice(0, 50)} — erwartet ${r.kapitel.length}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("9. DIE ACADEMY IM TEAM-PORTAL — jede Rolle ihre Reise");
  // ═════════════════════════════════════════════════════════════════════════
  const teamRoute = lies("server/routes/fiaon-academy.ts");
  const teamSeite = lies("client/src/pages/agent/academy.tsx");

  pruef("Es gibt eine Team-Route", teamRoute.length > 0);
  pruef("… und sie benutzt die vorbereitete Rollenfilterung",
    /reisenFuerRolle/.test(teamRoute),
    "sie lag seit dem 26.08. bereit — eine Filterregel gehört an EINE Stelle");
  // ── DIE WAND STEHT IM SERVER ───────────────────────────────────────────
  pruef("Eine fremde Reise wird mit 404 abgelehnt",
    /Diese Reise gehört zu einer anderen Abteilung/.test(teamRoute)
      && /const erlaubt = reisenFuerRolle\(r\)\.some/.test(teamRoute),
    "in der Anzeige zu filtern genügt nicht: Wer die Adresse eintippt, käme durch");
  pruef("… und die Ablehnung nennt den Weg zur eigenen Reise",
    /Mehr → Academy/.test(teamRoute));

  // ── DIE ROLLEN-ZUORDNUNG, GEGEN DIE DATEN GEPRÜFT ─────────────────────
  for (const [rolle, erwartet] of [
    ["agent", ["vertrieb"]],
    ["onboarding", ["onboarding"]],
    ["inkasso", ["inkasso"]],
    ["vertriebsleiter", ["vertrieb", "onboarding", "inkasso"]],
    ["admin", ["vertrieb", "onboarding", "inkasso"]],
  ] as [string, string[]][]) {
    const ist = reisenFuerRolle(rolle).map((r) => r.key);
    pruef(`Rolle „${rolle}“ sieht ${erwartet.join(" + ")}`,
      ist.length === erwartet.length && erwartet.every((e) => ist.includes(e)),
      ist.join(", ") || "keine");
  }

  // ── DER FORTSCHRITT ───────────────────────────────────────────────────
  pruef("Der Fortschritt wird gespeichert",
    /CREATE TABLE IF NOT EXISTS fiaon_academy_fortschritt/.test(teamRoute));
  pruef("… nur nach VORN (GREATEST)",
    /GREATEST\(fiaon_academy_fortschritt\.kapitel_max/.test(teamRoute),
    "wer zurückblättert, darf seinen Stand nicht verlieren");
  pruef("… und einmal fertig bleibt fertig",
    /fertig_am = COALESCE\(fiaon_academy_fortschritt\.fertig_am/.test(teamRoute));
  pruef("Die Seite speichert beim Verlassen",
    /addEventListener\("pagehide", speichern\)/.test(teamSeite)
      && /keepalive: true/.test(teamSeite),
    "ein normales fetch bricht ab, wenn die Seite geht");
  pruef("… und nicht bei jedem Kapitel",
    /setInterval\(speichern, 30_000\)/.test(teamSeite),
    "13 Schreibvorgänge für eine Zahl wären Verschwendung");

  // ── DIE TEAM-ZENTRALE ─────────────────────────────────────────────────
  pruef("Es gibt einen Stand für die Team-Zentrale",
    /router\.get\("\/admin\/academy\/stand"/.test(teamRoute));
  pruef("… mit „Academy: Kapitel x/y“ je Mensch",
    /Academy: Kapitel \$\{summeIst\}\/\$\{summeSoll\}/.test(teamRoute));
  pruef("… und der Liste, wer noch nicht angefangen hat",
    /nichtAngefangen/.test(teamRoute),
    "das ist die Zahl, die die Leitung interessiert");

  // ── DER MENÜPUNKT ─────────────────────────────────────────────────────
  const mehr = lies("client/src/pages/agent/mehr.tsx");
  pruef("Der Menüpunkt steht unter „Mehr“",
    /href: "\/agent\/academy", label: "Academy"/.test(mehr));
  pruef("… und zwar ganz oben",
    mehr.indexOf('href: "/agent/academy"') < mehr.indexOf('href: "/agent/skripte"'),
    "ein neuer Mitarbeiter soll sie ohne Scrollen finden");

  // ── DIE ADMIN-FASSUNG BLEIBT ──────────────────────────────────────────
  pruef("Die Verwaltungs-Fassung existiert weiter",
    /path="\/admin\/schulung"/.test(app),
    "die Bühne zum Vorführen ist etwas anderes als die Fassung zum Selbstlesen");
  // ── DIESE REGEL IST ERSETZT, NICHT GELÖSCHT (29.08.2026) ──────────────
  // Hier stand: „Die Team-Fassung hat KEINEN Präsentationsmodus — wer sich
  // selbst einschult, präsentiert nicht."
  //
  // Das war richtig, solange nur Mitarbeiter die Team-Fassung benutzen. Der
  // Betreiber hat aber entschieden, dass Florentine und Daniel die Schulung
  // SELBST machen — und die brauchen im Team-Portal dasselbe wie in der
  // Verwaltung.
  //
  // Die Regel gilt weiter für alle ANDEREN: Der Knopf erscheint nur, wenn der
  // Server `istLeitung` sagt. Ein Agent sieht ihn nicht.
  pruef("Der Präsentationsmodus im Team-Portal ist an die Leitung gebunden",
    /daten\?\.istLeitung && \(/.test(teamSeite),
    "ein Agent, der präsentiert, präsentiert sich selbst");

  // ── DIE ALTE KUNDENSEITE IST WEG ──────────────────────────────────────
  pruef("pages/agent/kunden.tsx ist entfernt",
    lies("client/src/pages/agent/kunden.tsx").length === 0,
    "zwei Dateien mit fast gleichem Namen sind eine Falle — am 25.08. haben sie "
      + "einen Knopf in die Irre geführt");
  pruef("… und die alte Adresse leitet um",
    /path="\/agent\/meine-kunden-alt"><Redirect to="\/agent\/kunden"/.test(app),
    "ein Lesezeichen soll nicht ins Leere laufen");

  // ═════════════════════════════════════════════════════════════════════════
  titel("10. DIE KERNBOTSCHAFT — WORTLAUT DER GESCHÄFTSFÜHRUNG");
  // ═════════════════════════════════════════════════════════════════════════
  const karte = lies("client/src/components/KernbotschaftKarte.tsx");
  const cockpit = lies("client/src/components/agent/OnboardingCockpit.tsx");

  // ── DER WORTLAUT, BUCHSTABENGETREU ────────────────────────────────────
  // Diese Prüfung ist die wichtigste der Datei: Eine Aussage über die SCHUFA
  // darf sich nicht durch einen Umbau verändern. Der Satz steht hier VOLL
  // ausgeschrieben, damit ein Vergleich möglich ist — nicht als Regex.
  const SOLL = "Wenn jemand einen Vertrag mit uns hat, diesen pünktlich und "
    + "positiv bezahlt UND unsere Empfehlungen in Anspruch nimmt, dann "
    + "verbessert sich die Bonität. Nichtzahlungen werden an die SCHUFA "
    + "gemeldet.";
  pruef("Der Wortlaut ist UNVERÄNDERT", KERNBOTSCHAFT === SOLL,
    KERNBOTSCHAFT === SOLL ? "" : `abweichend: „${KERNBOTSCHAFT.slice(0, 90)}…“`);
  pruef("… und er steht an EINER Stelle",
    /export const KERNBOTSCHAFT = /.test(daten)
      && !/Wenn jemand einen Vertrag mit uns hat/.test(karte)
      && !/Wenn jemand einen Vertrag mit uns hat/.test(cockpit),
    "drei Kopien wären drei Sätze, die auseinanderlaufen");
  pruef("Die Fußnote nennt die Freigabe",
    /freigegeben durch die Geschäftsführung/.test(KERNBOTSCHAFT_FUSSNOTE));

  // ── DIE ZWEI PFADE ────────────────────────────────────────────────────
  pruef("Der grüne Pfad heißt „pünktlich + Empfehlungen = Aufbau“",
    /pünktlich \+ Empfehlungen = Aufbau/i.test(KERNBOTSCHAFT_PFADE.aufbau.titel));
  pruef("Der rote Pfad heißt „Nichtzahlung = Meldung“",
    /Nichtzahlung = Meldung/i.test(KERNBOTSCHAFT_PFADE.meldung.titel));
  pruef("… und nennt die SCHUFA-Meldung als Folge",
    KERNBOTSCHAFT_PFADE.meldung.punkte.some((p) => /SCHUFA gemeldet/.test(p)),
    "die Konsequenz darf nicht in einer Andeutung verschwinden");

  // ── DIE KARTE ─────────────────────────────────────────────────────────
  pruef("Die Karte ist zweigeteilt",
    /KERNBOTSCHAFT_PFADE\[welcher\]/.test(karte)
      && /grid-template|gridTemplateColumns/.test(karte));
  pruef("… grün und rot", /#059669/.test(karte) && /#b91c1c/.test(karte));
  pruef("… auf 380 px gestapelt",
    /minmax\(240px,1fr\)/.test(karte),
    "zwei Spalten à 170 px liest man als einen Pfad");
  pruef("… und die Folge ist fett",
    /fontWeight: i === pfad\.punkte\.length - 1 \? 700 : 400/.test(karte));

  // ── DREI STELLEN, EIN BAUTEIL ─────────────────────────────────────────
  for (const [wo, datei] of [
    ["Academy (Verwaltung)", "client/src/pages/admin-schulung.tsx"],
    ["Academy (Team)", "client/src/pages/agent/academy.tsx"],
    ["Onboarding-Cockpit", "client/src/components/agent/OnboardingCockpit.tsx"],
  ] as [string, string][]) {
    pruef(`${wo} zeigt die Karte`, /<KernbotschaftKarte/.test(lies(datei)));
  }
  pruef("Im Cockpit erscheint sie beim Schritt „Abo-Klarheit“",
    /a\.key === "abo_klarheit" && \(/.test(cockpit),
    "dort erklärt der Mitarbeiter die laufenden Kosten");
  pruef("… mit der Ansage, dass es der Wortlaut ist",
    /Das sagst du dem Kunden — wörtlich/.test(cockpit));

  // ── DAS KAPITEL IN BEIDEN REISEN ──────────────────────────────────────
  for (const key of ["vertrieb", "onboarding"]) {
    const re = REISEN.find((r) => r.key === key)!;
    const k = re.kapitel.find((x) => x.key === "versprechen");
    pruef(`„${re.titel}“ hat das Kapitel „Das Versprechen“`, !!k);
    pruef(`… und es ist hervorgehoben`, k?.hervorgehoben === true);
    pruef(`… und trägt den Wortlaut als Text`, k?.text === KERNBOTSCHAFT);
  }
  pruef("Nur EIN Kapitel je Reise ist hervorgehoben",
    REISEN.every((r) => r.kapitel.filter((k) => k.hervorgehoben).length <= 1),
    "wenn alles wichtig ist, ist nichts wichtig");

  // ═════════════════════════════════════════════════════════════════════════
  titel("11. DIE LEITUNG SCHULT SELBST");
  // ═════════════════════════════════════════════════════════════════════════
  pruef("Der Server sagt, wer Leitung ist",
    /const istLeitung = r === "vertriebsleiter" \|\| r === "admin"/.test(teamRoute),
    "eine Rollen-Prüfung in der Anzeige wäre die zweite Fassung derselben Regel");
  pruef("… und liefert es bei der Einzelreise mit",
    /istLeitung: r === "vertriebsleiter" \|\| r === "admin"/.test(teamRoute));
  pruef("Die Team-Seite zeigt „Präsentieren“ NUR der Leitung",
    /daten\?\.istLeitung && \(/.test(teamSeite)
      && /data-fiaon="team-praesentieren"/.test(teamSeite));
  pruef("… mit echtem Vollbild",
    /fi-team-academy-vollbild/.test(teamSeite)
      && /requestFullscreen/.test(teamSeite));
  pruef("… und größerer Schrift darin",
    /fi-team-academy-vollbild \[data-fiaon="team-academy"\] h2/.test(teamSeite),
    "die Zuschauer sitzen weiter weg");
  pruef("Esc beendet ihn", /e\.key === "Escape" && praesentation/.test(teamSeite));

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
  process.exit(rot > 0 ? 1 : 0);
}

main();
