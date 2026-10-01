// ═══════════════════════════════════════════════════════════════════════════
// WIE EIN MITARBEITER DEM KUNDEN GEGENÜBER HEISST — EINE QUELLE (29.09.2026, E-265)
//
// Justin am 29.09.2026, „zum letzten Mal!!": Mara schreibt Kunden gegenüber
// NIE „Daniel, Florentine, Nikita", sondern „Herr Stripling", „Frau Lombardi"
// — mit „Herrn Stripling" nach mit/an/für/bei (Dativ, Akkusativ).
//
// ── WARUM „ZUM LETZTEN MAL" ────────────────────────────────────────────────
// Die Regel gab es seit dem 04.09. (E-117, kundenName() im Betreiber-Board).
// E-248 baute am 28.09. eine zweite, gegenteilige Quelle ein („Kolleginnen und
// Kollegen nennst du beim Vornamen", shared/fiaon-mara-ton.ts und der
// WhatsApp-Auftrag), und die festen Sätze setzten `${vorname}` ein. Gezählt
// am 29.09. (Leseberichte E-265): 34 von 67 freien WhatsApp-Antworten mit
// einem Vornamen allein, 0 mit „Herr/Frau Nachname".
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
//   · Anrede aus fiaon_agents.anrede („Herr"/„Frau"), nie aus dem Vornamen
//     geraten. Mit Anrede: „Herr Stripling" (wer?) / „Herrn Stripling"
//     (mit/an/für wen?) / „Frau Lombardi" (beides).
//   · Fehlt die Anrede (heute: Nikita Boychenko, Justin Schwarzott): der volle
//     Name ohne Herr/Frau und ohne Pronomen — „Nikita Boychenko ruft Sie an".
//     Justin: nie raten; ein falsches „Herr" ist eine falsche Angabe.
//   · Interne Texte (Aufgaben, Protokoll, Mail an den Mitarbeiter) behalten
//     den Vornamen — die Regel gilt für jeden Text, den ein KUNDE liest.
//
// Rein, ohne Datenbank: Server (Mara auf WhatsApp, Postmeister, Mara-Aktion,
// Terminmails) und Prüfstände lesen dieselben Funktionen. Die Mitarbeiterliste
// für die harte Prüfung holt der Server (server/lib/fiaon-mitarbeiter-namen.ts).
// ═══════════════════════════════════════════════════════════════════════════

export type Anrede = "Herr" | "Frau";

/** Was der Server über einen Mitarbeiter weiß — Spalten aus fiaon_agents. */
export interface MitarbeiterRoh {
  anrede?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  /** fiaon_agents.name („Daniel Stripling") — Rückfall, wenn Vor-/Nachname fehlen. */
  name?: string | null;
}

/** So heißt er dem Kunden gegenüber. */
export interface Nennform {
  /** Wer? — „Herr Stripling", „Frau Lombardi", ohne Anrede „Nikita Boychenko". */
  nom: string;
  /** Mit/an/für/bei wem? — „Herrn Stripling", „Frau Lombardi", „Nikita Boychenko". */
  dat: string;
  /** Der volle Name — „Daniel Stripling". */
  voll: string;
  vorname: string;
  nachname: string;
  anrede: Anrede | null;
  /** false = keine Anrede gepflegt: voller Name, kein Herr/Frau, kein Pronomen (er/sie). */
  hatAnrede: boolean;
}

/** „Herr", „herr", „Hr.", „Herrn" → „Herr"; „Frau", „Fr." → „Frau"; alles andere → null (nie raten). */
export function anredeLesen(roh: unknown): Anrede | null {
  const a = String(roh ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (a === "herr" || a === "herrn" || a === "hr") return "Herr";
  if (a === "frau" || a === "fr") return "Frau";
  return null;
}

/** Die Nennform eines Mitarbeiters — rein. Ohne jede Angabe: „jemand aus unserem Team". */
export function nennform(a: MitarbeiterRoh | null | undefined): Nennform {
  const name = String(a?.name ?? "").replace(/\s+/g, " ").trim();
  const teile = name ? name.split(" ") : [];
  const vorname = String(a?.first_name ?? "").trim() || (teile[0] ?? "");
  const nachname = String(a?.last_name ?? "").trim() || (teile.length > 1 ? teile.slice(1).join(" ") : "");
  const voll = [vorname, nachname].filter(Boolean).join(" ") || name || "jemand aus unserem Team";
  const anrede = anredeLesen(a?.anrede);
  if (anrede && nachname) {
    return { nom: `${anrede} ${nachname}`, dat: `${anrede === "Herr" ? "Herrn" : "Frau"} ${nachname}`, voll, vorname, nachname, anrede, hatAnrede: true };
  }
  return { nom: voll, dat: voll, voll, vorname, nachname, anrede: null, hatAnrede: false };
}

/** Schon fertige Nennform (Nominativ) als Nennform — für Stellen, die nur den Text haben. */
export function nennformAusText(nom: string | null | undefined): Nennform | null {
  const t = String(nom ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const m = t.match(/^(Herrn?|Frau)\s+(.+)$/);
  if (m) {
    const anrede: Anrede = m[1].startsWith("Herr") ? "Herr" : "Frau";
    return { nom: `${anrede} ${m[2]}`, dat: `${anrede === "Herr" ? "Herrn" : "Frau"} ${m[2]}`, voll: t, vorname: "", nachname: m[2], anrede, hatAnrede: true };
  }
  const teile = t.split(" ");
  return { nom: t, dat: t, voll: t, vorname: teile[0] ?? "", nachname: teile.slice(1).join(" "), anrede: null, hatAnrede: false };
}

/**
 * Derselbe Ausdruck als SQL — für Abfragen, die den Wert direkt in eine
 * Vorlage geben (Terminmails: der Platzhalter heißt weiter `agent_vorname`,
 * weil Make/Brevo ihn lesen; nur der WERT ist jetzt die Nennform). `alias` ist
 * der Tabellenname von fiaon_agents in der Abfrage. Nur Spaltennamen, keine
 * Eingabe — sicher für sqlPool.unsafe().
 */
export function nennformSql(alias = "a", fall: "nom" | "dat" = "nom"): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`nennformSql: ungültiger Alias „${alias}"`);
  const anr = `LOWER(TRIM(COALESCE(${alias}.anrede, '')))`;
  const nach = `NULLIF(TRIM(COALESCE(${alias}.last_name, '')), '')`;
  const voll = `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', NULLIF(TRIM(${alias}.first_name), ''), NULLIF(TRIM(${alias}.last_name), ''))), ''), NULLIF(TRIM(${alias}.name), ''))`;
  const herr = fall === "dat" ? "'Herrn '" : "'Herr '";
  return `(CASE WHEN ${anr} IN ('herr', 'herrn', 'hr', 'hr.') AND ${nach} IS NOT NULL THEN ${herr} || ${nach}`
    + ` WHEN ${anr} IN ('frau', 'fr', 'fr.') AND ${nach} IS NOT NULL THEN 'Frau ' || ${nach}`
    + ` ELSE ${voll} END)`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE HARTE PRÜFUNG: „VORNAME EINES MITARBEITERS IM KUNDENTEXT"
//
// Ein Treffer ist jeder Vorname aus der Mitarbeiterliste, der als ganzes Wort
// steht (Unicode-Grenzen, auch „Hans-Jürgen") und dem NICHT sein eigener
// Nachname folgt. „Daniel Stripling" (voller Name) ist bei gepflegter Anrede
// nur weich („schreib Herr Stripling"), ohne Anrede richtig. Die Namen des
// KUNDEN werden vorher maskiert (Muster aus E-253) — heißt ein Kunde selbst
// „Daniel", ist „Hallo Daniel" kein Fehler.
// ═══════════════════════════════════════════════════════════════════════════
export interface MitarbeiterEintrag { vorname: string; nachname: string; anrede: Anrede | null }

/** Wörter, die nie als Mitarbeiter-Vorname zählen (Testkonten, Funktionswörter, Mara selbst). */
const NIE_ALS_VORNAME = new Set(["mara", "demo", "claude", "team", "fiaon", "herr", "frau", "sie", "ihr", "ihre"]);

const B = "(?<![\\p{L}\\p{N}_-])";
const E = "(?![\\p{L}\\p{N}_]|-[\\p{L}])";
/**
 * E-265 Nachbesserung (29.09.2026, Gegenprobe wand.mts): der Genitiv — „Daniels Kalender", „Florentines Team",
 * „Nikitas Nummer", auch „Daniel’s". Die Grenze E allein verbot jeden Buchstaben nach dem Namen und übersah ihn.
 */
const GEN = "(?:s|[’']s?)?";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Die Liste für die Prüfung — ohne kurze (< 3) und ohne Stoppwörter, jeder Vorname einmal. */
export function pruefListe(liste: readonly MitarbeiterEintrag[] | null | undefined): MitarbeiterEintrag[] {
  const aus = new Map<string, MitarbeiterEintrag>();
  for (const m of liste ?? []) {
    const v = String(m?.vorname ?? "").trim();
    if (v.length < 3 || NIE_ALS_VORNAME.has(v.toLowerCase())) continue;
    if (!aus.has(`${v}|${m.nachname}`)) aus.set(`${v}|${m.nachname}`, { vorname: v, nachname: String(m.nachname ?? "").trim(), anrede: anredeLesen(m.anrede) });
  }
  return Array.from(aus.values());
}

/**
 * Die Namen des Kunden als „Kunde" maskieren — dann trifft sein eigener Vorname nie (E-253).
 * E-265 Nachbesserung 2 (01.10.2026, Gegenprobe g4 N16): Heißt der Kunde wie ein Mitarbeiter („Daniel Meier"),
 * maskierte die Prüfung JEDES „Daniel" — „Hallo Daniel, Ihr Termin mit Daniel ist morgen" ging raus. Jetzt: sein
 * voller Name (mehrere Wörter) überall; ein einzelnes Wort, das zugleich Vorname eines Mitarbeiters ist, NUR in
 * Anredestellung (Textanfang, nach Hallo/Hi/Guten Tag/Liebe(r)/Sehr geehrte(r), oder als Anruf am Satzende
 * „…, Daniel!"). Alle anderen einzelnen Namen (sein Nachname) weiter überall.
 */
const ANREDE_VOR = String.raw`(?:^\s*|(?:hallo|hi|hey|moin|servus|guten\s+(?:tag|morgen|abend)|liebe[rs]?|sehr\s+geehrte[rs]?|grüß\s+gott|gruess\s+gott)\s+(?:herr\s+|frau\s+)?)`;
function kundeMaskieren(text: string, kundeNamen: readonly (string | null | undefined)[] = [], mitarbeiterVornamen: ReadonlySet<string> = new Set()): string {
  let t = String(text ?? "");
  const namen = Array.from(new Set(kundeNamen.map((n) => String(n ?? "").replace(/\s+/g, " ").trim()).filter((n) => n.length >= 3)))
    .sort((a, b) => b.length - a.length);
  const maske = (x: string) => "#".repeat(x.length);
  for (const n of namen) {
    const m = n.split(" ").map(esc).join("\\s+");
    if (n.includes(" ") || !mitarbeiterVornamen.has(n.toLowerCase())) {
      t = t.replace(new RegExp(`${B}${m}${E}`, "giu"), maske);
      continue;
    }
    // Sein Vorname = ein Mitarbeiter-Vorname: nur in Anredestellung („Hallo Daniel," / „…, Daniel!").
    t = t.replace(new RegExp(`(${ANREDE_VOR})(${m})(?=\\s*[,!.:?]|\\s*$)`, "giu"), (_x, vor, name) => `${vor}${maske(name)}`);
    t = t.replace(new RegExp(`(,\\s*)(${m})(?=\\s*[!.?]\\s*(?:$|\\n))`, "giu"), (_x, vor, name) => `${vor}${maske(name)}`);
  }
  return t;
}

export interface VornameFund {
  vorname: string;
  nachname: string;
  anrede: Anrede | null;
  /** Das gefundene Stück Text. */
  treffer: string;
  /** Position im Text (für die Reparatur). */
  stelle: number;
  /** „Daniel Stripling" (voller Name) statt Vorname allein. */
  voll: boolean;
  /** hart = Vorname allein; weich = voller Name, obwohl eine Anrede gepflegt ist. */
  schwere: "hart" | "weich";
  /** E-265 Nachbesserung: „Daniels", „Nikita’s" — der Genitiv. */
  genitiv?: boolean;
}

/** Alle Mitarbeiter-Vornamen im Kundentext (Links bleiben außen vor). Rein. */
export function mitarbeiterVornameFunde(
  text: string, liste: readonly MitarbeiterEintrag[] | null | undefined,
  opt: { kundeNamen?: readonly (string | null | undefined)[] } = {},
): VornameFund[] {
  const pl = pruefListe(liste);
  if (!pl.length) return [];
  // Links und E-Mail-Adressen bleiben außen vor („daniel@fiaon.com" ist kein Vorname, Gegenprobe g4 N29).
  const roh = String(text ?? "").replace(/https?:\/\/\S+/g, (u) => " ".repeat(u.length))
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (u) => " ".repeat(u.length));
  const t = kundeMaskieren(roh, opt.kundeNamen, new Set(pl.map((m) => m.vorname.toLowerCase())));
  const funde: VornameFund[] = [];
  const belegt = new Set<number>();
  // Längere Vornamen zuerst („Hans-Jürgen" vor „Hans"). Mehrere Mitarbeiter mit demselben Vornamen werden
  // zusammen angesehen: Folgt der Nachname EINES von ihnen, ist es dessen voller Name (nie ein Fehlalarm
  // „Florentine" für Frau Lombardi, wenn „Florentine Prüf" dasteht). Sonst gilt der erste in der Liste —
  // der Server legt den Betreuer des Kunden nach vorn (Reparatur mit seiner Nennform).
  const jeVorname = new Map<string, MitarbeiterEintrag[]>();
  for (const m of pl) {
    const k = m.vorname.toLowerCase();
    jeVorname.set(k, [...(jeVorname.get(k) ?? []), m]);
  }
  const gruppen = Array.from(jeVorname.values()).sort((a, b) => b[0].vorname.length - a[0].vorname.length);
  for (const gruppe of gruppen) {
    const re = new RegExp(`${B}${esc(gruppe[0].vorname)}${GEN}${E}`, "giu");
    for (const x of Array.from(t.matchAll(re))) {
      const i = x.index ?? 0;
      if (belegt.has(i)) continue;
      belegt.add(i);
      // Was folgt, steht im UNMASKIERTEN Text — heißt der Kunde wie der Nachname („Prüf"), bleibt „Daniel Prüf" ein voller Name.
      const danach = roh.slice(i + x[0].length);
      // E-265 Nachbesserung 2 (Gegenprobe g4 N24): auch der Genitiv des vollen Namens („Nikita Boychenkos Kalender").
      const vollVon = gruppe.find((m) => !!m.nachname && new RegExp(`^\\s+${esc(m.nachname)}${GEN}${E}`, "iu").test(danach)) ?? null;
      if (vollVon && !vollVon.anrede) continue; // ohne Anrede ist der volle Name richtig
      const m = vollVon ?? gruppe[0];
      // Genitiv: „Daniels" — das Anhängsel steht hinter dem Vornamen (die Reparatur setzt „Herrn Striplings").
      const genitiv = x[0].length > m.vorname.length && !vollVon;
      funde.push({
        vorname: m.vorname, nachname: m.nachname, anrede: m.anrede, stelle: i, voll: !!vollVon,
        treffer: vollVon ? `${x[0]} ${m.nachname}` : x[0],
        schwere: vollVon ? "weich" : "hart",
        ...(genitiv ? { genitiv: true } : {}),
      });
    }
  }
  return funde.sort((a, b) => a.stelle - b.stelle);
}

/**
 * Vor diesen Wörtern steht der Dativ/Akkusativ: „mit Herrn Stripling", „an Herrn Stripling" — und nach
 * Verben, deren Objekt der Kollege ist: „Ich gebe Herrn Stripling Bescheid", „frage Herrn Gerhold".
 */
const PRAEP_DAT = /(?:^|[\s(„"])(mit|an|bei|für|fuer|von|zu|zum|über|ueber|gegenüber|durch|ohne|um|gebe|gibt|geben|sage|sagt|sagen|schreibe|schreibt|frage|fragt|fragen|informiere|informiert|erreiche|erreicht|erreichen|(?:rufen|erreichen|fragen|kontaktieren|schreiben|informieren)\s+sie)\s+$/i;

/**
 * Die mechanische Reparatur — LETZTES Mittel (nach dem zweiten Entwurf, vor dem
 * Rückfallsatz): jeder Vorname allein wird die Nennform, „Daniel Stripling" mit
 * gepflegter Anrede wird „Herr Stripling". Nach mit/an/bei/für/von/zu/über der
 * Dativ („mit Herrn Stripling"). Pronomen passt sie nicht an — deshalb erst
 * nach dem zweiten Entwurf. Rein.
 */
export function vornamenErsetzen(
  text: string, liste: readonly MitarbeiterEintrag[] | null | undefined,
  opt: { kundeNamen?: readonly (string | null | undefined)[] } = {},
): string {
  const t = String(text ?? "");
  const funde = mitarbeiterVornameFunde(t, liste, opt);
  if (!funde.length) return t;
  let aus = "";
  let pos = 0;
  // E-265 Nachbesserung 2 (Gegenprobe g4 N20): „Mit Florentine und Daniel" — der Fall des ersten Namens gilt nach
  // „und/oder/sowie" auch für den zweiten („mit Frau Lombardi und Herrn Stripling").
  let letzterDat: boolean = false;
  let letztesEnde = -1;
  for (const f of funde) {
    if (f.stelle < pos) continue;
    const n = nennform({ anrede: f.anrede, first_name: f.vorname, last_name: f.nachname });
    // E-265 Nachbesserung (29.09.2026): „Herr Daniel ruft …" wurde „Herr Herr Stripling" — ein Herr/Herrn/Frau
    // direkt davor gehört zum Ersatz (und sagt, welcher Fall gemeint war).
    let start = f.stelle;
    let fall: "nom" | "dat" | null = null;
    const anr = t.slice(Math.max(pos, f.stelle - 7), f.stelle).match(new RegExp(String.raw`(?:^|[^\p{L}])(Herrn|Herr|Frau)\s+$`, "u"));
    if (anr) {
      start = f.stelle - anr[0].length + (anr[0].length - anr[0].replace(new RegExp(String.raw`^[^\p{L}]`, "u"), "").length);
      fall = anr[1] === "Herrn" ? "dat" : anr[1] === "Herr" ? "nom" : null;
    }
    const davor = t.slice(Math.max(0, start - 16), start);
    const verbunden = letztesEnde >= 0 && /^\s*(?:,|und|oder|sowie)\s*$/i.test(t.slice(letztesEnde, start));
    const dat: boolean = fall ? fall === "dat" : (verbunden ? letzterDat : PRAEP_DAT.test(davor));
    let ersatz = dat ? n.dat : n.nom;
    // Genitiv: „Daniels Kalender" → „Herrn Striplings Kalender" (des Herrn …), „Nikitas" → „Nikita Boychenkos".
    if (f.genitiv) ersatz = `${n.hatAnrede && n.anrede === "Herr" ? n.dat : n.nom}${/[sßxz]$/i.test(ersatz) ? "’" : "s"}`;
    aus += t.slice(pos, start) + ersatz;
    pos = f.stelle + f.treffer.length;
    // E-265 Nachbesserung 2 (Gegenprobe g4 N05/N22/N23): eine Initiale danach („Daniel S.", „Nikita B.") gehört zum
    // Namen — sonst blieb „Herr Stripling S. ruft Sie an".
    const initiale = t.slice(pos).match(/^\s+[A-ZÄÖÜ]\.(?=\s|$)/);
    if (initiale) pos += initiale[0].length;
    letzterDat = dat && !f.genitiv;
    letztesEnde = pos;
  }
  return aus + t.slice(pos);
}

/**
 * Die Regel in Worten für jeden Auftrag an das Modell (WhatsApp, Mail,
 * Mara-Aktion) — ersetzt „Kolleginnen und Kollegen beim Vornamen" (E-248).
 */
export const MITARBEITER_NAMEN_REGEL = "NAMEN IM TEAM (Justin, 29.09.2026): Kolleginnen und Kollegen nennst du dem Kunden gegenüber IMMER mit Herr/Frau und Nachname — „Herr Stripling ruft Sie an“, „Frau Lombardi ist an Ihrer Seite“, und nach mit/an/für/bei „Herrn Stripling“ („Ihr Termin mit Herrn Stripling“). Ist keine Anrede hinterlegt, den vollen Namen ohne Herr/Frau und ohne er/sie („Nikita Boychenko ruft Sie an … Nikita Boychenko geht das mit Ihnen durch“). NIE den Vornamen allein — auch nicht, wenn er im Verlauf so steht.";

/** Kurzfassung für enge Stellen (Formregeln). */
export const MITARBEITER_NAMEN_KURZ = "Kollegen immer mit Herr/Frau Nachname (mit/an: Herrn), ohne gepflegte Anrede mit vollem Namen — nie der Vorname allein.";
