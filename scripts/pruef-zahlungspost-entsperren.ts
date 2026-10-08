// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND ZAHLUNGSPOST-FREIGABE (08.10.2026, Justin: „Ja, Zahlungspost zustellen.“)
//
// Brevo verwarf Zahlungserinnerungen an abgemeldete Adressen still. Die Freigabe
// (server/lib/fiaon-zahlungspost-freigabe.ts) sperrt zuerst die Werbung, hebt dann die Brevo-Sperre
// genau dieser Adresse auf — nur bei einer Abmeldung, nie bei Rückläufer/Spam, einmal je Adresse,
// höchstens 30 am Tag, nur mit offener Rate oder Erstzahlung. Die Zahlungserinnerungen tragen keinen
// Karten-Werbeblock mehr.
//
// NACH DER PRÜFUNG (08.10.2026) je Fund ein Fall: 10. Raten-WhatsApp trotz Freigabe-Werbesperre, 11. Ausnahme nur für
// die Werbesperre AUS der Freigabe, 12. Vermerk sicher geschrieben (sonst kritische Diagnose), 13. Spam ohne Frist,
// 14. kein Werbeteil an eine Werbesperre, 15. Vermerk zählt nicht als Mail / Kundenweg, 16. Blockaden vor der
// Freigabe zählen nicht, 17. Ladeprobe aller geänderten Server-Module (Ersatz, solange hier kein tsc laufen darf).
// NACH DER ZWEITEN PRÜFUNG (08.10.2026): 18. Herkunft der Werbesperre an der Person (werbesperre_quelle, jeder Setzweg),
// 19. Brevo-Antwort dreiwertig (unklar → Werbesperre bleibt), 20. Sperrliste nie still abgeschnitten, 21. „Stopp“ und
// Lead-Abmeldung bleiben gesperrt, 22. Last an der Tür (erst der Befund), 23. Ablehnung beim Zusammenführen und
// Firmenrechnung.
//
// OFFLINE: keine Datenbank (DATABASE_URL zeigt ins Leere, die Datenbank-Handgriffe sind Attrappen), Brevo
// nur als Attrappe hinter globalThis.fetch, Netzzähler (Socket-Verbindungen + fremde Adressen) muss 0 sein.
//
//   cd …/wt-zahlungspost; NODEDIR=$(dirname "$(which node)"); env -i HOME="$HOME" PATH="$NODEDIR:/usr/bin:/bin" \
//     DATABASE_URL=postgresql://x@127.0.0.1:1/x node_modules/.bin/tsx scripts/pruef-zahlungspost-entsperren.ts
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "MAKE_WEBHOOK_URL", "DATABASE_URL_EXTERN", "WHATSAPP_TOKEN"]) delete process.env[k];
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.BREVO_API_KEY = "attrappe-kein-echter-schluessel";
process.env.CRONS = "aus";
import net from "node:net";
import { readFileSync, readdirSync, statSync } from "node:fs";

// ── NETZZÄHLER: jede Socket-Verbindung und jede Adresse außer der Brevo-Attrappe ──
let netz = 0;
const verbinden = net.Socket.prototype.connect;
(net.Socket.prototype as any).connect = function (this: net.Socket, ...a: any[]) { netz++; return (verbinden as any).apply(this, a); };

// ── DIE BREVO-ATTRAPPE ──────────────────────────────────────────────────────
type Eintrag = { email: string; reason: { code: string } };
let liste: Eintrag[] = [];
let listeStatus = 200;
/** Seitengröße, die die Attrappe höchstens liefert (Brevo könnte kürzen) — und ob sie `count` nennt. */
let seitenGroesse = 100;
let mitCount = true;
let loeschStatus = 204;
/** „wirft" = die DELETE-Anfrage endet ohne Antwort (Zeitüberschreitung). */
let loeschModus: "antwort" | "wirft" = "antwort";
const aufrufe: { methode: string; pfad: string }[] = [];
globalThis.fetch = (async (eingabe: any, init: any = {}) => {
  const url = new URL(String(eingabe));
  const methode = String(init.method || "GET").toUpperCase();
  if (url.host !== "api.brevo.com") { netz++; throw new Error(`fremde Adresse im Prüfstand: ${url.host}`); }
  aufrufe.push({ methode, pfad: url.pathname + url.search });
  if (methode === "GET" && url.pathname === "/v3/smtp/blockedContacts") {
    if (listeStatus !== 200) return new Response(JSON.stringify({ code: "too_many_requests", message: "Attrappe" }), { status: listeStatus });
    const limit = Math.min(Number(url.searchParams.get("limit")), seitenGroesse), offset = Number(url.searchParams.get("offset"));
    const contacts = liste.slice(offset, offset + limit).map((e) => ({ ...e, senderEmail: "welcome@fiaon.com", blockedAt: "2026-09-01" }));
    return new Response(JSON.stringify(mitCount ? { count: liste.length, contacts } : { contacts }), { status: 200 });
  }
  if (methode === "DELETE" && url.pathname.startsWith("/v3/smtp/blockedContacts/")) {
    if (loeschModus === "wirft") { const e = new Error(`The operation was aborted due to timeout (${decodeURIComponent(url.pathname.split("/").pop() || "")})`); e.name = "TimeoutError"; throw e; }
    return new Response(null, { status: loeschStatus });
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, detail: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${detail !== "" ? `  → ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 600)}` : ""}`); }
}
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ohneKommentare = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\s--[^\n]*/g, "");

const B = await import("../server/lib/fiaon-brevo");
const F = await import("../server/lib/fiaon-zahlungspost-freigabe");
const MF = await import("../server/lib/fiaon-mail-frequenz");
const MOTOR = await import("../server/mail/motor");
const { KARTE_SATZ } = await import("../server/mail/geruest");

// ═══════════════════════════════════════════════════════════════════════════
console.log("── 1. Brevo-Sperrgrund: nur eine Abmeldung darf weichen ─────────────");
{
  ok(F.nurAbmeldung(["unsubscribedViaEmail"]) && F.nurAbmeldung(["unsubscribedViaMA", "unsubscribedViaApi"]), "unsubscribedViaEmail/-MA/-Api = Abmeldung");
  ok(!F.nurAbmeldung(["hardBounce"]) && !F.nurAbmeldung(["contactFlaggedAsSpam"]) && !F.nurAbmeldung(["adminBlocked"]), "hardBounce, Spam-Meldung, Admin-Sperre: bleibt gesperrt");
  ok(!F.nurAbmeldung(["unsubscribedViaEmail", "hardBounce"]), "gemischt (Abmeldung UND Rückläufer): bleibt gesperrt");
  ok(!F.nurAbmeldung([]) && !F.nurAbmeldung(["unbekannt"]), "kein oder unbekannter Grund: bleibt gesperrt");
}

console.log("── 2. Brevo-Sperrliste lesen (Attrappe, seitenweise, gemerkt) ──────");
{
  liste = Array.from({ length: 227 }, (_, i) => ({ email: `fuell${i}@kunde.invalid`, reason: { code: "unsubscribedViaEmail" } }));
  liste.splice(5, 0, { email: "Ab.Gemeldet@Kunde.invalid", reason: { code: "unsubscribedViaEmail" } });
  liste.splice(150, 0, { email: "doppelt@kunde.invalid", reason: { code: "unsubscribedViaEmail" } }, { email: "doppelt@kunde.invalid", reason: { code: "hardBounce" } });
  liste.push({ email: "spam@kunde.invalid", reason: { code: "contactFlaggedAsSpam" } }, { email: "ohnegrund@kunde.invalid" } as any);
  B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const a = await B.brevoSperrGruende("ab.gemeldet@kunde.invalid");
  const seiten = aufrufe.filter((x) => x.methode === "GET");
  ok(a.ok && a.codes.join() === "unsubscribedViaEmail", "Adresse gefunden (Groß-/Kleinschreibung egal)", a);
  ok(seiten.length === 3 && seiten.every((s, i) => s.pfad === `/v3/smtp/blockedContacts?limit=100&offset=${i * 100}`), "drei Seiten zu je 100 (232 Einträge), dann Schluss", seiten);
  ok((await B.brevoSperrGruende("doppelt@kunde.invalid")).codes.join() === "unsubscribedViaEmail,hardBounce", "doppelter Eintrag: ALLE Gründe");
  ok((await B.brevoSperrGruende("ohnegrund@kunde.invalid")).codes.join() === "unbekannt", "Eintrag ohne Grund → „unbekannt“ (bleibt gesperrt)");
  const nicht = await B.brevoSperrGruende("frei@kunde.invalid");
  ok(nicht.ok && nicht.codes.length === 0, "nicht auf der Liste → keine Gründe");
  ok(aufrufe.length === 3, "30 Minuten gemerkt: keine weitere Abfrage", aufrufe.length);
  B.brevoSperrlisteVergessen(); listeStatus = 429; aufrufe.length = 0;
  const f1 = await B.brevoSperrGruende("ab.gemeldet@kunde.invalid");
  const f2 = await B.brevoSperrGruende("ab.gemeldet@kunde.invalid");
  ok(!f1.ok && !f2.ok && aufrufe.length === 1, "429: nicht lesbar — und 5 Minuten lang nicht erneut gefragt", aufrufe);
  listeStatus = 200; B.brevoSperrlisteVergessen();
}

console.log("── 3. Brevo-Sperre aufheben (Attrappe) ──────────────────────────────");
{
  aufrufe.length = 0;
  loeschStatus = 204; const a = await B.brevoSperreAufheben("ab.gemeldet+x@kunde.invalid");
  loeschStatus = 404; const b = await B.brevoSperreAufheben("ab.gemeldet@kunde.invalid");
  loeschStatus = 500; const c = await B.brevoSperreAufheben("ab.gemeldet@kunde.invalid");
  loeschStatus = 204;
  ok(a && b && !c, "Handversand (wahr/falsch): 204 und 404 = aufgehoben, 500 = nicht");
  ok(aufrufe[0]?.methode === "DELETE" && aufrufe[0]?.pfad === "/v3/smtp/blockedContacts/ab.gemeldet%2Bx%40kunde.invalid", "DELETE nur für genau diese Adresse (kodiert)", aufrufe[0]);
}

// ── Die Welt der Attrappen: Protokoll, Personen, Werbesperren (mit Herkunft), Vermerke ──
interface Welt {
  blockiert: Set<string>; hart: Set<string>; offen: Set<string>; personen: Map<string, number[]>;
  sperre: Set<number>; quelle: Map<number, string>; heute: number; vermerke: F.Vermerk[]; spur: string[];
  /** Vermerk je Adresse (Brevo-Antwort) — und ob danach an die Adresse zugestellt wurde (macht „unklar“ endgültig). */
  vermerkt: Map<string, "aufgehoben" | "unklar">; zugestelltDanach: Set<string>;
  /** Ein Nein des Menschen je Adresse (forderung: „Stopp“, Lead-Abmeldung). */
  nein: Map<string, string>;
  /** false = die Werbesperre wird „gesetzt“, greift aber an der Adresse nicht (landet in `halb`). */
  setzenWirkt: boolean; halb: Set<number>;
  /** Kritische Diagnosen der Freigabe (melden). */
  meldungen: { code: string; message: string; hint: string }[];
}
function welt(): Welt {
  return { blockiert: new Set(), hart: new Set(), offen: new Set(), personen: new Map(), sperre: new Set(), quelle: new Map(), heute: 0, vermerke: [], spur: [],
    vermerkt: new Map(), zugestelltDanach: new Set(), nein: new Map(), setzenWirkt: true, halb: new Set(), meldungen: [] };
}
function werkzeuge(w: Welt): F.Werkzeuge {
  return {
    async letzterBefund(a) { w.spur.push(`befund:${a}`); return w.blockiert.has(a) ? "blockiert" : "zugestellt"; },
    async lage(a) {
      w.spur.push(`lage:${a}`);
      // wie lage() in SQL: „unklar“ zählt erst mit einer Zustellung danach
      const v = w.vermerkt.get(a);
      return { hart: w.hart.has(a), schonFrei: v === "aufgehoben" || (v === "unklar" && w.zugestelltDanach.has(a)), heute: w.heute };
    },
    async forderung(a) { w.spur.push(`forderung:${a}`); return { personen: w.personen.get(a) ?? [], offen: w.offen.has(a), nein: w.nein.get(a) ?? null }; },
    async sperrGruende(a) { w.spur.push(`brevo-grund:${a}`); return B.brevoSperrGruende(a); },
    async werbesperreAnAdresse(a) { return (w.personen.get(a) ?? []).some((id) => w.sperre.has(id)); },
    async werbesperreSetzen(id) {
      w.spur.push(`werbesperre:${id}`);
      if (w.sperre.has(id) || w.halb.has(id)) return false;
      if (w.setzenWirkt) { w.sperre.add(id); w.quelle.set(id, MF.WERBESPERRE_QUELLE_FREIGABE); } else w.halb.add(id);
      return true;
    },
    async werbesperreZuruecknehmen(ids) {
      w.spur.push(`zurueck:${ids.join(",")}`);
      for (const id of ids) {
        w.halb.delete(id);
        if (w.quelle.get(id) === MF.WERBESPERRE_QUELLE_FREIGABE) { w.sperre.delete(id); w.quelle.delete(id); }
      }
    },
    async sperreAufheben(a) { w.spur.push(`brevo-aufheben:${a}`); return B.brevoSperreAufhebenBefund(a); },
    async vermerken(v) { w.spur.push(`vermerk:${v.adresse}`); w.vermerkt.set(v.adresse, v.brevo); w.heute++; w.vermerke.push(v); },
    async vermerkSteht(a) { w.spur.push(`nachweis:${a}`); return w.vermerkt.has(a); },
    melden(d) { w.spur.push(`melden:${d.code}`); w.meldungen.push(d); },
  };
}
/** Ein Mensch sagt Nein (jeder Setzweg außer der Freigabe): Werbesperre mit Herkunft „mensch“, auch auf eine stehende. */
const menschSagtNein = (w: Welt, id: number) => { w.sperre.add(id); w.quelle.set(id, MF.WERBESPERRE_QUELLE_MENSCH); };
/** Die Ausnahme der Freigabe-Werbesperre, wie FREIGABE_WERBESPERRE_PERSONEN_SQL sie liest (Herkunft, ohne „Stopp“). */
const ausnahme = (w: Welt, id: number, stopp = false) => w.sperre.has(id) && w.quelle.get(id) === MF.WERBESPERRE_QUELLE_FREIGABE && !stopp;
const kunde = (w: Welt, a: string, ids: number[], o: { blockiert?: boolean; offen?: boolean; hart?: boolean; code?: string } = {}) => {
  w.personen.set(a, ids);
  if (o.blockiert !== false) w.blockiert.add(a);
  if (o.offen !== false) w.offen.add(a);
  if (o.hart) w.hart.add(a);
  if (o.code !== "") liste.push({ email: a, reason: { code: o.code ?? "unsubscribedViaEmail" } });
};
const deletes = () => aufrufe.filter((x) => x.methode === "DELETE").map((x) => decodeURIComponent(x.pfad.split("/").pop() || ""));

console.log("── 4. Die Freigabe: Werbung zuerst, dann Brevo, dann der Vermerk ───");
{
  liste = []; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const w = welt(); const z = werkzeuge(w);
  kunde(w, "rate@kunde.invalid", [101, 102]);
  const r = await F.zahlungspostFreigeben(" Rate@Kunde.invalid ", "abo_payment_reminder", z);
  ok(r?.freigegeben === true, "Rate offen + Brevo-Abmeldung → freigegeben", r);
  const iBef = w.spur.indexOf("befund:rate@kunde.invalid"), iL = w.spur.indexOf("lage:rate@kunde.invalid");
  const iW = w.spur.indexOf("werbesperre:101"), iW2 = w.spur.indexOf("werbesperre:102"), iB = w.spur.indexOf("brevo-aufheben:rate@kunde.invalid"), iV = w.spur.indexOf("vermerk:rate@kunde.invalid");
  ok(iBef === 0 && iL === 1 && iW > iL && iW2 > iW && iB > iW2 && iV > iB && w.spur.indexOf("nachweis:rate@kunde.invalid") > iV,
    "Reihenfolge: Befund → Lage → Werbesperre (alle Personen) → Brevo-Sperre aufheben → Vermerk → Nachweis", w.spur);
  ok(w.meldungen.length === 0, "Vermerk steht → keine Diagnose");
  ok(w.sperre.has(101) && w.sperre.has(102) && w.quelle.get(101) === "zahlungspost_freigabe" && w.quelle.get(102) === "zahlungspost_freigabe",
    "Werbesperre an beiden Personen hinter der Adresse — mit Herkunft „zahlungspost_freigabe“");
  ok(deletes().join() === "rate@kunde.invalid", "Brevo-Sperre NUR dieser Adresse aufgehoben", deletes());
  const v = w.vermerke[0];
  ok(/^Zahlungspost-Freigabe: Brevo-Abmeldung \(unsubscribedViaEmail\) aufgehoben, Adresse nur für Zahlungspost — Werbesperre neu gesetzt \(Person 101, 102\)\. Auslöser: abo_payment_reminder\.$/.test(v?.grund ?? ""), "Vermerk im Klartext (fiaon_mail_log grund)", v?.grund);
  ok(v?.neu.join() === "101,102" && v?.personen.join() === "101,102" && v?.brevo === "aufgehoben" && !w.spur.some((x) => x.startsWith("zurueck")), "Vermerk: Werbesperre neu an 101 und 102, Brevo „aufgehoben“, nichts zurückgenommen");

  // Idempotent: dieselbe Adresse ein zweites Mal (z. B. wieder blockiert)
  aufrufe.length = 0;
  const r2 = await F.zahlungspostFreigeben("rate@kunde.invalid", "payment_reminder", z);
  ok(r2?.freigegeben === false && /schon einmal/.test(r2.grund) && deletes().length === 0 && w.vermerke.length === 1, "zweites Mal: keine zweite Freigabe, kein DELETE, kein zweiter Vermerk", r2);
}

console.log("── 5. Was gesperrt bleibt — und wann gar nichts passiert ───────────");
{
  liste = []; B.brevoSperrlisteVergessen();
  const w = welt(); const z = werkzeuge(w);
  kunde(w, "hart@kunde.invalid", [201], { code: "hardBounce" });
  kunde(w, "spam@kunde.invalid", [202], { code: "contactFlaggedAsSpam" });
  kunde(w, "admin@kunde.invalid", [203], { code: "adminBlocked" });
  kunde(w, "gemischt@kunde.invalid", [204]); liste.push({ email: "gemischt@kunde.invalid", reason: { code: "hardBounce" } });
  kunde(w, "eigenlog@kunde.invalid", [205], { hart: true });
  kunde(w, "nichtoffen@kunde.invalid", [206], { offen: false });
  kunde(w, "ohneperson@kunde.invalid", [], {});
  kunde(w, "nichtgelistet@kunde.invalid", [207], { code: "" });
  kunde(w, "zugestellt@kunde.invalid", [208], { blockiert: false });
  aufrufe.length = 0;
  const urteil = async (a: string, e = "payment_reminder") => F.zahlungspostFreigeben(a, e, z);
  const h = await urteil("hart@kunde.invalid"), s = await urteil("spam@kunde.invalid"), ad = await urteil("admin@kunde.invalid"), g = await urteil("gemischt@kunde.invalid");
  ok([h, s, ad, g].every((x) => x?.freigegeben === false && /bleibt gesperrt/.test(x.grund)), "Brevo: Rückläufer, Spam, Admin-Sperre, gemischt → bleibt gesperrt", [h, s, ad, g]);
  ok(deletes().length === 0 && w.sperre.size === 0 && w.vermerke.length === 0, "… ohne DELETE, ohne Werbesperre, ohne Vermerk");
  w.spur.length = 0;
  const e = await urteil("eigenlog@kunde.invalid");
  ok(e?.freigegeben === false && /Rückläufer oder Spam/.test(e.grund) && !w.spur.some((x) => x.startsWith("brevo") || x.startsWith("forderung")), "eigenes Protokoll: Spam-Meldung (jemals) oder Rückläufer (30 Tage) → gesperrt, Brevo wird gar nicht erst gefragt", w.spur);
  w.spur.length = 0;
  const n = await urteil("nichtoffen@kunde.invalid"), o = await urteil("ohneperson@kunde.invalid");
  ok([n, o].every((x) => x?.freigegeben === false && /keine offene Rate/.test(x.grund)) && !w.spur.some((x) => x.startsWith("brevo")), "keine offene Rate/Erstzahlung (oder keine Person) → nichts, Brevo nicht gefragt", [n, o, w.spur]);
  const ng = await urteil("nichtgelistet@kunde.invalid");
  ok(ng?.freigegeben === false && /nicht \(mehr\) auf Brevos Sperrliste/.test(ng.grund) && !w.sperre.has(207), "nicht (mehr) auf Brevos Liste → keine Werbesperre, kein DELETE", ng);
  w.spur.length = 0;
  const zu = await urteil("zugestellt@kunde.invalid");
  ok(zu === null && w.spur.join() === "befund:zugestellt@kunde.invalid", "jüngster Befund „zugestellt“ → null, nur die EINE Befund-Abfrage (keine Lage)", w.spur);
  w.spur.length = 0;
  const fremd = await Promise.all(["welcome", "payment_details", "lead_followup", "rueckhol_s1", "auskunft_angebot", "global_zahlung_erinnerung"].map((ev) => F.zahlungspostFreigeben("hart@kunde.invalid", ev, z)));
  ok(fremd.every((x) => x === null) && w.spur.length === 0, "keine Zahlungspost der Freigabe (welcome, payment_details, lead_followup, rueckhol_s1, auskunft_angebot, Firmenrechnung) → null, nicht einmal eine Abfrage", w.spur);
  ok(["abo_payment_reminder", "payment_reminder", "auskunft_zahlung_erinnerung"].every(MF.istZahlungspost) && !MF.istZahlungspost("global_zahlung_erinnerung"), "Zahlungspost der Freigabe: Rate, Erstzahlung, Auskunft — nicht die Firmenrechnung");
  ok((await F.zahlungspostFreigeben("", "payment_reminder", z)) === null, "leere Adresse → null");
}

console.log("── 6. Störungen: ganz oder gar nicht, nie geworfen ─────────────────");
{
  liste = []; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const w = welt(); const z = werkzeuge(w);
  kunde(w, "stoerung@kunde.invalid", [301]);
  menschSagtNein(w, 999); w.personen.set("stoerung@kunde.invalid", [301, 999]); // 999: ältere Werbesperre („Stopp“)
  listeStatus = 429;
  const a = await F.zahlungspostFreigeben("stoerung@kunde.invalid", "abo_payment_reminder", z);
  ok(a?.freigegeben === false && /nicht lesbar/.test(a.grund) && !w.sperre.has(301) && deletes().length === 0, "Brevo-Liste nicht lesbar (429) → keine Werbesperre, kein DELETE", a);
  listeStatus = 200; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  loeschStatus = 400;
  const b = await F.zahlungspostFreigeben("stoerung@kunde.invalid", "abo_payment_reminder", z);
  ok(b?.freigegeben === false && /nicht aufheben \(HTTP 400\)/.test(b.grund) && w.vermerke.length === 0, "DELETE eindeutig abgelehnt (HTTP 400) → nicht freigegeben, KEIN Vermerk", b);
  ok(!w.sperre.has(301) && !w.quelle.has(301) && w.sperre.has(999) && w.quelle.get(999) === "mensch" && w.spur.includes("zurueck:301"),
    "… und die EBEN gesetzte Werbesperre (301) samt Herkunft ist zurückgenommen, die ältere (999, „mensch“) bleibt", w.spur);
  loeschStatus = 204;
  const c = await F.zahlungspostFreigeben("stoerung@kunde.invalid", "abo_payment_reminder", z);
  ok(c?.freigegeben === true && w.vermerke.length === 1 && w.vermerke[0].neu.join() === "301" && w.sperre.has(301), "nächster Versand: neuer Anlauf von vorn, freigegeben", c);

  const w2 = welt(); const z2 = werkzeuge(w2); w2.setzenWirkt = false;
  kunde(w2, "greiftnicht@kunde.invalid", [302]); B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const d = await F.zahlungspostFreigeben("greiftnicht@kunde.invalid", "payment_reminder", z2);
  ok(d?.freigegeben === false && /greift an der Adresse nicht/.test(d.grund) && deletes().length === 0 && w2.spur.includes("zurueck:302") && w2.halb.size === 0, "Werbesperre greift nicht → Brevo-Sperre bleibt, Halbes zurückgenommen", d);

  const w4 = welt(); const z4 = werkzeuge(w4);
  kunde(w4, "vermerkweg@kunde.invalid", [304]); B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const fehlerAus = console.error; console.error = () => {};
  let versuche = 0;
  const v = await F.zahlungspostFreigeben("vermerkweg@kunde.invalid", "payment_reminder", { ...z4, async vermerken() { versuche++; throw new Error("Protokoll klemmt"); } });
  ok(v?.freigegeben === false && /Vermerk fehlt — kritisch gemeldet/.test(v.grund) && w4.sperre.has(304) && !w4.spur.some((x) => x.startsWith("zurueck")),
    "Brevo schon frei, Vermerk klemmt → nicht „freigegeben“, Werbesperre bleibt STEHEN (sonst käme Werbung durch)", [v, w4.spur]);
  ok(versuche === 2 && w4.meldungen.length === 1 && w4.meldungen[0].code === "zahlungspost_freigabe_ohne_vermerk"
    && /Protokoll klemmt/.test(w4.meldungen[0].message) && /werbesperre_neu/.test(w4.meldungen[0].hint) && /"brevo": "aufgehoben"/.test(w4.meldungen[0].hint) && !/@/.test(w4.meldungen[0].message),
    "zwei Schreibversuche, dann EINE kritische Diagnose zum Nachtragen (ohne Adresse im Text)", [versuche, w4.meldungen]);
  ok(/Herkunft „Zahlungspost-Freigabe"/.test(w4.meldungen[0]?.message ?? "") && /einmal je Adresse/.test(w4.meldungen[0]?.message ?? ""),
    "die Diagnose sagt, was fehlt: nur der Nachweis „einmal je Adresse“ — die Herkunft steht an der Person");

  // Der Schreibweg „wirft nicht“, aber der Vermerk steht nicht (wie mailProtokoll, das Fehler verschluckt)
  const w5 = welt(); const z5 = werkzeuge(w5);
  kunde(w5, "still@kunde.invalid", [305]); B.brevoSperrlisteVergessen();
  const st = await F.zahlungspostFreigeben("still@kunde.invalid", "abo_payment_reminder", { ...z5, async vermerken() { /* verschluckt */ } });
  ok(st?.freigegeben === false && w5.meldungen.length === 1 && w5.spur.includes("nachweis:still@kunde.invalid") && w5.sperre.has(305),
    "Vermerk „geschrieben“, aber nicht da (Nachweis falsch) → kritische Diagnose, kein „freigegeben“", [st, w5.spur]);

  // erster Versuch klemmt, zweiter klappt → freigegeben, keine Diagnose
  const w6 = welt(); const z6 = werkzeuge(w6);
  kunde(w6, "zweiter@kunde.invalid", [306]); B.brevoSperrlisteVergessen();
  let erst = true;
  const zw = await F.zahlungspostFreigeben("zweiter@kunde.invalid", "payment_reminder", { ...z6, async vermerken(x) { if (erst) { erst = false; throw new Error("kurz weg"); } return z6.vermerken(x); } });
  ok(zw?.freigegeben === true && w6.meldungen.length === 0 && w6.vermerke.length === 1, "zweiter Schreibversuch klappt → freigegeben, keine Diagnose", [zw, w6.meldungen]);

  const kaputt: F.Werkzeuge = { ...z, async letzterBefund() { throw new Error("Datenbank weg"); } };
  const e = await F.zahlungspostFreigeben("stoerung@kunde.invalid", "payment_reminder", kaputt).catch(() => "geworfen");
  const kaputt2: F.Werkzeuge = { ...z, async lage() { throw new Error("Datenbank weg"); } };
  const e2 = await F.zahlungspostFreigeben("stoerung@kunde.invalid", "payment_reminder", kaputt2).catch(() => "geworfen");
  console.error = fehlerAus;
  ok(e === null && e2 === null, "Datenbank weg (Befund oder Lage) → null, wirft nie", [e, e2]);

  // Gleichzeitig zweimal dieselbe Adresse (Rate und Erstzahlung im selben Lauf) → ein DELETE
  const w3 = welt(); const z3 = werkzeuge(w3);
  kunde(w3, "parallel@kunde.invalid", [303]); B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const [p1, p2] = await Promise.all([F.zahlungspostFreigeben("parallel@kunde.invalid", "abo_payment_reminder", z3), F.zahlungspostFreigeben("parallel@kunde.invalid", "payment_reminder", z3)]);
  ok(deletes().length === 1 && w3.vermerke.length === 1 && [p1, p2].filter((x) => x?.freigegeben).length === 1, "gleichzeitig: genau eine Freigabe, ein DELETE", [p1, p2]);
}

console.log("── 7. Tagesdeckel: höchstens 30 je Tag ──────────────────────────────");
{
  liste = []; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const w = welt(); const z = werkzeuge(w);
  for (let i = 0; i < 31; i++) kunde(w, `deckel${i}@kunde.invalid`, [400 + i]);
  const erg = [];
  for (let i = 0; i < 31; i++) erg.push(await F.zahlungspostFreigeben(`deckel${i}@kunde.invalid`, "payment_reminder", z));
  ok(F.FREIGABEN_PRO_TAG === 30 && erg.filter((x) => x?.freigegeben).length === 30, "30 freigegeben", erg.filter((x) => x?.freigegeben).length);
  ok(erg[30]?.freigegeben === false && /Tagesdeckel erreicht \(30\/30\)/.test(erg[30]!.grund) && !w.sperre.has(430), "die 31. wartet auf morgen — ohne Werbesperre, ohne DELETE", erg[30]);
  ok(deletes().length === 30 && aufrufe.filter((x) => x.methode === "GET").length === 1, "30 DELETE, die Sperrliste nur EINMAL gelesen (gemerkt)", aufrufe.length);
}

console.log("── 8. Die Tür, die Bremse und die Auswahl (Quelltext und SQL) ──────");
{
  const tn = MF.tuerNeinSql("adr", "payment_reminder");
  ok(tn.includes(`(adr) IN ${MF.WERBESPERRE_ADRESSEN_OHNE_FREIGABE_SQL}`) && !tn.includes(MF.WERBESPERRE_ADRESSEN_SQL) && tn.includes(MF.HART_UNZUSTELLBAR_ADRESSEN_SQL),
    "Erstzahlung: jede Werbesperre gilt — außer der aus der Freigabe; hart unzustellbar bleibt");
  ok(!MF.tuerNeinSql("adr", "abo_payment_reminder").includes("werbung_gesperrt_am"), "Rate (ZAHLUNGSPOST): Werbesperre trifft sie nicht — unverändert");
  const rh = MF.tuerNeinSql("adr", "rueckhol_s1");
  ok(rh.includes(MF.WERBESPERRE_ADRESSEN_SQL) && !rh.includes(MF.FREIGABE_WERBESPERRE_PERSONEN_SQL), "Werbung (Rückholung): JEDE Werbesperre, auch die aus der Freigabe");
  ok(/zf\.event = 'zahlungspost_freigabe' AND zf\.empfaenger IS NOT NULL/.test(MF.ZAHLUNGSPOST_FREI_ADRESSEN_SQL), "Nachweis-Menge: die Vermerk-Zeilen (NOT IN-sicher, nie NULL)");
  // Dieselben sechs Wege wie WERBESPERRE_ADRESSEN_SQL — nur mit Personen-Spalte und dem Freigabe-Filter außen.
  const wege = (x: string) => (x.match(/FROM fiaon_(persons|applications|leads) ws_[a-z]( JOIN fiaon_persons ws_p ON ws_p\.id = ws_[a-z]\.[a-z_]+)?/g) ?? []).join("|");
  ok(wege(MF.WERBESPERRE_ADRESSEN_OHNE_FREIGABE_SQL) === wege(MF.WERBESPERRE_ADRESSEN_SQL) && wege(MF.WERBESPERRE_ADRESSEN_SQL).split("|").length === 6
    && MF.WERBESPERRE_ADRESSEN_OHNE_FREIGABE_SQL.includes(`wo_a.pid NOT IN ${MF.FREIGABE_WERBESPERRE_PERSONEN_SQL}`),
    "Adressen ohne Freigabe-Werbesperre: dieselben sechs Wege, der Filter steht einmal außen");

  const mw = quelle("server/make-webhook.ts");
  const iHaken = mw.indexOf("m.zahlungspostFreigeben(String(payload.email || \"\"), eventType)");
  const iBremse = mw.indexOf("await darfAnEmpfaenger(String(payload.email");
  const iVertrag = mw.indexOf("if (!payload.test && eventType === \"vertrag_bestaetigung\")");
  ok(iHaken > iVertrag && iHaken < iBremse && iVertrag > 0, "Tür: Freigabe nach den Wänden (Global, Firma, Vertrag), VOR der Bremse");
  ok(/if \(!payload\.test\) \{\s*const fg = await import\("\.\/lib\/fiaon-zahlungspost-freigabe"\)[\s\S]{0,200}\.catch\(\(\) => null\);/.test(mw), "Tür: nie für Testversand, wirft nie (.catch → null)");

  const fq = quelle("server/lib/fiaon-mail-frequenz.ts");
  ok(/const gesperrt = await werbesperreAnAdresse\(adresse, \{ ohneFreigabe: ZAHLUNGSPOST_NACH_FREIGABE\.has\(event\) \}\);\s*if \(gesperrt && !ZAHLUNGSPOST\.has\(event\)\) \{/.test(fq),
    "Tür: für die Erstzahlung zählt die Werbesperre aus der Freigabe nicht — jede andere schon");
  const an = quelle("server/routes/fiaon-antrag.ts");
  const claim = an.slice(an.indexOf("async function claimReminderBatch("), an.indexOf("function reminderPayload("));
  ok((claim.match(/tuerNeinSql\([^\n]*, "payment_reminder"\)\)\}/g) ?? []).length === 2 && !/freiAn/.test(an),
    "Erinnerungsmaschine: Ziel- und Bestelladresse mit derselben Lesart der Tür (keine Adress-Ausnahme mehr)");

  const fg = quelle("server/lib/fiaon-zahlungspost-freigabe.ts");
  const befund = fg.slice(fg.indexOf("  async letzterBefund(a) {"), fg.indexOf("  async lage(a) {"));
  ok(/m\.created_at > NOW\(\) - INTERVAL '30 days'\s+AND m\.zustellung IN \('zugestellt', 'geoeffnet', 'geklickt', 'blockiert', 'gebounct', 'spam'\)\s+ORDER BY m\.created_at DESC LIMIT 1/.test(befund),
    "Befund: jüngster Zustellbefund in 30 Tagen");
  ok(/AND \(m\.zustellung = 'spam'\s+OR \(m\.zustellung = 'gebounct' AND m\.status = 'versandt' AND m\.art = 'echt'\s+AND m\.created_at > NOW\(\) - INTERVAL '30 days'\)\)\) AS hart/.test(fg),
    "Lage hart = Spam-Meldung JEMALS (ohne Frist) oder Rückläufer in 30 Tagen");
  ok(/date_trunc\('day', NOW\(\) AT TIME ZONE 'Europe\/Berlin'\) AT TIME ZONE 'Europe\/Berlin'/.test(fg), "Tagesdeckel nach Berliner Kalendertag (in SQL, keine Stunden-Falle)");
  const vm = fg.slice(fg.indexOf("  async vermerken(v) {"), fg.indexOf("  vermerkSteht:"));
  ok(/INSERT INTO fiaon_mail_log \(event, person_id, empfaenger, status, grund, payload, ausgeloest_von\)/.test(vm) && /'uebersprungen'/.test(vm)
    && /sqlPool\.json\(\{ ausloeser: v\.event, brevo_gruende: v\.codes, personen: v\.personen, werbesperre_neu: v\.neu, brevo: v\.brevo \}/.test(vm)
    && !/mailProtokoll|JSON\.stringify/.test(ohneKommentare(vm)),
    "Vermerk DIREKT geschrieben (wirft bei Fehler, nicht mailProtokoll), Nutzlast als jsonb-Objekt mit werbesperre_neu und brevo");
  ok(/vermerkSteht: zahlungspostFrei,/.test(fg) && /logDiagnostic\(\{ severity: "kritisch", category: "email_make", code: d\.code/.test(fg),
    "Nachweis über zahlungspostFrei, Meldung als kritische Diagnose");
  ok(/SET werbung_gesperrt_am = NULL, werbesperre_quelle = NULL, updated_at = NOW\(\)\s+WHERE id = ANY\(\$\{ids\}\) AND werbung_gesperrt_am > NOW\(\) - INTERVAL '10 minutes'\s+AND werbesperre_quelle = \$\{WERBESPERRE_QUELLE_FREIGABE\}/.test(fg),
    "Zurücknehmen nur eines frischen Stempels mit der Herkunft der Freigabe (dieser Anlauf) — samt Herkunft");
  ok(/f\.payment_status IN \('pending_payment', 'claimed_paid'\)/.test(fg) && /r\.status = 'offen' AND r\.storniert_am IS NULL/.test(fg) && /f\.mahnstopp_am IS NULL/.test(fg) && /f\.abo_gestoppt_am IS NULL/.test(fg), "offene Forderung: Erstzahlung ohne Mahnstopp oder Rate ohne Abo-Stopp");
  ok(!/brevoSperreAufheben\(|werbesperreSetzen\(/.test(mw.slice(iVertrag, iBremse).replace(/\/\/.*$/gm, "")), "Tür ruft Brevo/Werbesperre vor der Bremse nicht selbst — nur über die Freigabe");
}

console.log("── 9. Reine Zahlungspost: kein Werbeblock in den Erinnerungen ───────");
{
  const nutz = { email: "pruef@kunde.invalid", vorname: "Prüf", paket: "FIAON Plus", betrag: "49,00", payment_reference: "FIAON-PRUEF-1", reminder_number: 2,
    empfaenger: "FIAON", iban: "DE00 0000 0000 0000 0000 00", bic: "PRUEFXXX", rate_nr: 3, verwendungszweck: "FIAON-PRUEF-1-R3", mahnstufe_text: "Erinnerung", faellig_am_text: "01.10.2026" };
  for (const ev of ["payment_reminder", "abo_payment_reminder"]) {
    const m = MOTOR.mailRendern(ev, nutz)!;
    ok(!!m && !MOTOR.VORLAGEN[ev].karteZiel, `${ev}: kein Karten-Ziel-Block in der Vorlage`);
    ok(!m.html.includes(KARTE_SATZ.slice(0, 40)) && !m.text.includes(KARTE_SATZ.slice(0, 40)) && !/Ihr Ziel/.test(m.html), `${ev}: weder HTML noch Text werben für die Karte`);
    ok(m.html.includes("DE00 0000 0000 0000 0000 00") && m.html.includes("https://fiaon.com/zahlung/FIAON-PRUEF-1") && !/abmelden/i.test(m.html), `${ev}: Zahlungsdaten und Zahlknopf bleiben, kein Abmelde-Fuß (Transaktionsmail)`);
  }
  ok(!!MOTOR.VORLAGEN.welcome.karteZiel && MOTOR.mailRendern("welcome", nutz)!.html.includes(KARTE_SATZ.slice(0, 40)), "Begrüßungsmail behält ihren Block (nur die Zahlungserinnerungen sind rein)");
}

// ═══════════════════════════════════════════════════════════════════════════
// NACH DER PRÜFUNG (08.10.2026) — je Fund ein Fall
// ═══════════════════════════════════════════════════════════════════════════
const fq = quelle("server/lib/fiaon-mail-frequenz.ts");
const FW = MF.FREIGABE_WERBESPERRE_PERSONEN_SQL;

console.log("── 10. Fund 1: Die Freigabe-Werbesperre stoppt die Raten-WhatsApp nicht ─");
{
  const Z = await import("../server/lib/fiaon-wa-zentrale");
  const basis = Z.BASIS;
  ok(basis.includes(`AND p.id NOT IN ${MF.WERBESPERRE_KOEPFE_OHNE_FREIGABE_SQL}`) && !basis.includes(`NOT IN ${MF.WERBESPERRE_KOEPFE_SQL}`) && !/p\.werbung_gesperrt_am IS NULL/.test(basis),
    "BASIS: nur die Werbesperre, die NICHT aus der Freigabe stammt (gilt für jede Gruppe)");
  ok(basis.includes(`AND p.id NOT IN ${MF.STOPP_KOEPFE_SQL}`), "BASIS: „STOPP“ bleibt für jede Gruppe — auch die Monatsrate");
  ok(!Z.gruppenBedingung("rate_offen").includes(MF.WERBESPERRE_KOEPFE_SQL), "Monatsrate: die Freigabe-Werbesperre hält sie NICHT auf");
  const werblich = Z.GRUPPEN_REIHE.filter((g) => g !== "rate_offen");
  ok(werblich.length === 5 && werblich.every((g) => Z.gruppenBedingung(g).includes(`b.person_id NOT IN ${MF.WERBESPERRE_KOEPFE_SQL}`) && Z.gruppenBedingung(g, true).includes(`b.person_id NOT IN ${MF.WERBESPERRE_KOEPFE_SQL}`)),
    "neu, Erste Zahlung offen, Abbrecher, ohne Antrag, Auskunft fehlt: JEDE Werbesperre (auch die der Freigabe) hält sie auf", werblich);
  ok(MF.WERBESPERRE_KOEPFE_OHNE_FREIGABE_SQL.includes(`e253_wo.werbung_gesperrt_am IS NOT NULL AND e253_wo.id NOT IN ${FW}`) && MF.WERBESPERRE_KOEPFE_OHNE_FREIGABE_SQL.includes(MF.KOPF_SQL("e253_wo.id")),
    "Köpfe ohne Freigabe-Werbesperre: über die Familie (Kopf), NOT IN-sicher");
  // Die Tür in waSenden: Die Raten-Vorlage ist keine Werbung — sie geht (ohne Datenbank entschieden).
  const WA = await import("../server/lib/fiaon-whatsapp");
  ok(!MF.waVorlageWerblich("fiaon_kk_rate") && !MF.waVorlageWerblich("fiaon_kkb_rate") && (await WA.waVorlagenSperre("fiaon_kkb_rate", "+4915100000000", { personId: 1 })) === null,
    "Tür waSenden: fiaon_kk(b)_rate geht trotz Werbesperre (nicht werblich) — Gruppe und Tür sagen dasselbe");
  ok(MF.waVorlageWerblich("fiaon_kk_rechnung") && MF.waVorlageWerblich("fiaon_kkb_rechnung"), "Erstzahlung per WhatsApp (fiaon_kk(b)_rechnung) bleibt werblich — Justins Entscheidung offen");
}

console.log("── 11. Fund 2: Ausnahme nur für die Werbesperre AUS der Freigabe ────");
{
  ok(FW.includes(`zfw_p.werbung_gesperrt_am IS NOT NULL AND zfw_p.werbesperre_quelle = 'zahlungspost_freigabe'`),
    "nur Personen, deren Werbesperre die Freigabe gesetzt hat (Herkunft an der Person) — eine ältere oder menschliche zählt nie");
  ok(FW.includes(`AND ${MF.KOPF_SQL("zfw_p.id")} NOT IN ${MF.STOPP_KOEPFE_SQL}`), "kein „Stopp“ (WhatsApp/Postfach) in der Familie, egal wann");
  const wa = fq.slice(fq.indexOf("export async function werbesperreAnAdresse("), fq.indexOf("// Mara-Topsales 08.10.2026 (Justin): DIE AUTOMATISCHE TÜR ALS SQL"));
  ok(/\$\{opts\.ohneFreigabe \? sqlPool\.unsafe\(`AND p\.id NOT IN \$\{FREIGABE_WERBESPERRE_PERSONEN_SQL\}`\) : sqlPool``\}/.test(wa),
    "werbesperreAnAdresse(…, { ohneFreigabe }): nur dann ohne die Freigabe-Werbesperre, sonst unverändert");
  ok(!/zahlungspostFrei\(adresse\)/.test(fq.slice(fq.indexOf("export async function darfAnEmpfaenger("), fq.indexOf("// DIE WERBESPERRE — EINE REGEL FÜR JEDEN KANAL"))),
    "die Tür fragt nicht „ist die ADRESSE freigegeben“ (das hätte jede Werbesperre ausgehebelt)");
}

console.log("── 12. Fund 3: Vermerk und Herkunft passen zusammen (Fälle zum Schreiben: Abschnitt 6 und 8) ─");
{
  const fg = quelle("server/lib/fiaon-zahlungspost-freigabe.ts");
  ok(/werbesperre_neu: v\.neu/.test(fg) && /brevo: v\.brevo/.test(fg), "der Vermerk schreibt werbesperre_neu (wer neu gesperrt wurde) und die Brevo-Antwort");
  ok(/SELECT a\.ref, \$\{id\}, NULL, \$\{FREIGABE_AKTEUR\}, 'system'/.test(fg) && /\$\{FREIGABE_AKTEUR\}\)`;/.test(fg) && MF.FREIGABE_AKTEUR === "Zahlungspost-Freigabe",
    "die Akten-Zeile und der Vermerk tragen FREIGABE_AKTEUR — die Werbesperre ist in der Akte erklärt");
  ok(!/fiaon_mail_log|fiaon_contact_log|werbesperre_neu/.test(FW), "die Herkunftsregel liest weder Vermerk noch Kontaktprotokoll (die teure Wortsuche ist entfallen)");
}

console.log("── 13. Fund 4: Spam-Meldung ohne Frist ─────────────────────────────");
{
  const fg = quelle("server/lib/fiaon-zahlungspost-freigabe.ts");
  ok(/OR \(m\.zustellung = 'gebounct'/.test(fg) && !/m\.zustellung IN \('gebounct', 'spam'\) AND m\.created_at > NOW\(\) - INTERVAL '30 days'/.test(fg),
    "Spam zählt jemals, nur der Rückläufer 30 Tage (Fall: alte Spam-Meldung, Handversand hob die Sperre auf, dann abgemeldet)");
  const w = welt(); const z = werkzeuge(w); liste = []; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  kunde(w, "altspam@kunde.invalid", [501], { hart: true });
  const r = await F.zahlungspostFreigeben("altspam@kunde.invalid", "abo_payment_reminder", z);
  ok(r?.freigegeben === false && /Spam/.test(r.grund) && deletes().length === 0 && !w.sperre.has(501), "Lage hart (alte Spam-Meldung) + Brevo nur „abgemeldet“ → bleibt gesperrt, kein DELETE", r);
}

console.log("── 14. Fund 5: kein Werbeteil an eine Werbesperre ──────────────────");
{
  const BANNER = "fiaon-karte-banner.jpg";
  const nutz = { email: "pruef@kunde.invalid", vorname: "Prüf", paket: "FIAON Plus", betrag: "49,00", payment_reference: "FIAON-PRUEF-1", login_url: "https://fiaon.com/app",
    partner_link: "https://fiaon.com/karte/x", agent_vorname: "Anna", antrag_id: "FIAON-PRUEF-1" };
  for (const ev of ["welcome", "payment_details", "payment_confirmed", "payment_reactivated", "konto_karte_einladung"]) {
    const mit = MOTOR.mailRendern(ev, nutz)!;
    const ohne = MOTOR.mailRendern(ev, { ...nutz, [MOTOR.OHNE_WERBETEIL]: true })!;
    const hatteWerbung = mit.html.includes(BANNER) || mit.html.includes(KARTE_SATZ.slice(0, 40));
    ok(hatteWerbung && !ohne.html.includes(BANNER) && !ohne.html.includes(KARTE_SATZ.slice(0, 40)) && !ohne.text.includes(KARTE_SATZ.slice(0, 40)) && !/Ihr Ziel/.test(ohne.html),
      `${ev}: mit Werbesperre ohne Karten-Block und ohne Kartenbild`);
    ok(ohne.betreff === mit.betreff && ohne.html.replace(/\s+/g, " ").length < mit.html.replace(/\s+/g, " ").length && (!mit.html.includes("{{") === !ohne.html.includes("{{")),
      `${ev}: Betreff und Inhalt bleiben — nur der Werbeteil fällt weg`);
  }
  const kk = MOTOR.mailRendern("konto_karte_einladung", { ...nutz, [MOTOR.OHNE_WERBETEIL]: true })!;
  ok(kk.html.includes("https://fiaon.com/karte/x") && /Jetzt Konto und Karte beantragen/.test(kk.html), "konto_karte_einladung: die Leistung (Link zur Partnerbank) bleibt");
  ok(MOTOR.mailRendern("welcome", { ...nutz, [MOTOR.OHNE_WERBETEIL]: false })!.html === MOTOR.mailRendern("welcome", nutz)!.html, "ohne das Feld (oder false): Byte für Byte wie vorher");
  ok(MOTOR.werbeteilMoeglich("welcome") && MOTOR.werbeteilMoeglich("konto_karte_einladung") && MOTOR.werbeteilMoeglich("lead_followup")
    && !MOTOR.werbeteilMoeglich("abo_payment_reminder") && !MOTOR.werbeteilMoeglich("payment_reminder"),
    "die Tür fragt nur bei Mails mit möglichem Werbeteil (nicht bei der Zahlungspost selbst)");
  const mw = quelle("server/make-webhook.ts");
  const iW = mw.indexOf("if (!payload.test && motor.werbeteilMoeglich(eventType)) {");
  const iD = mw.indexOf("const d = await motor.mailDirektSenden(eventType, payload as Record<string, unknown>);");
  ok(iW > 0 && iD > iW && /if \(await werbesperreAnAdresse\(String\(payload\.email \|\| ""\)\)\.catch\(\(\) => true\)\) payload = \{ \.\.\.payload, \[motor\.OHNE_WERBETEIL\]: true \};/.test(mw),
    "Tür: Werbesperre an der Adresse → ohne_werbeteil, direkt vor dem Direktversand (Störung → ohne Werbeteil)");
}

console.log("── 15. Fund 6: Der Vermerk ist keine Mail ───────────────────────────");
{
  ok(MF.ZAHLUNGSPOST_FREIGABE_EVENT === "zahlungspost_freigabe", "Ereignisname");
  ok(/COUNT\(\*\) FILTER \(WHERE status = 'uebersprungen' AND event <> \$\{ZAHLUNGSPOST_FREIGABE_EVENT\}\)::int AS uebersprungen/.test(quelle("server/lib/fiaon-marken.ts")), "Zustell-Marke: Vermerk nicht „übersprungen“");
  ok(/COUNT\(\*\) FILTER \(WHERE status = 'uebersprungen' AND event <> \$\{ZAHLUNGSPOST_FREIGABE_EVENT\}\)::int AS uebersprungen/.test(quelle("server/routes/fiaon-mail.ts")), "Zustellprotokoll-Zahlen: Vermerk nicht „übersprungen“");
  ok(/WHERE created_at > NOW\(\) - INTERVAL '30 days'\s+(--[^\n]*\n\s+)?AND event <> \$\{ZAHLUNGSPOST_FREIGABE_EVENT\}\s+GROUP BY event/.test(quelle("server/routes/fiaon-mailwerk.ts")), "Mailwerk: kein Ereignis, keine „Probleme“");
  const kw = quelle("server/lib/fiaon-kundenweg.ts");
  ok(/event <> 'mara_aktion' AND event <> \$\{ZAHLUNGSPOST_FREIGABE_EVENT\}/.test(kw), "Kundenweg: der Vermerk steht nicht als „Mail“ im Verlauf");
  ok(/sperreAusFreigabe\s+\? "WERBESPERRE gesetzt mit der Zahlungspost-Freigabe [^"]*Zahlungspost bleibt/.test(kw) && /WERBESPERRE aktiv \(aus der Zahlungspost-Freigabe: keine Werbung, Zahlungspost bleibt\)\./.test(kw)
    && /: "WERBESPERRE gesetzt \(keine Werbe- und Erinnerungsmails mehr; Vertragspost bleibt\)"/.test(kw),
    "Kundenweg: „Zahlungspost bleibt“ nur bei der Werbesperre aus der Freigabe, sonst der bisherige Satz");
  ok(/werbesperreAusFreigabe\(Number\(personId\)\)\.catch\(\(\) => false\)/.test(kw), "Kundenweg: Störung → bisheriger Satz (vorsichtig)");
}

console.log("── 16. Fund 7: Blockaden vor der Freigabe zählen nicht ──────────────");
{
  const d = fq.slice(fq.indexOf("export async function darfAnEmpfaenger("), fq.indexOf("// DIE WERBESPERRE — EINE REGEL FÜR JEDEN KANAL"));
  ok(/AND created_at > COALESCE\(frei_seit, '-infinity'::timestamptz\)\)::int  AS blockiert/.test(d)
    && /\(SELECT MAX\(zf\.created_at\) FROM fiaon_mail_log zf\s+WHERE zf\.event = \$\{ZAHLUNGSPOST_FREIGABE_EVENT\} AND LOWER\(TRIM\(zf\.empfaenger\)\) = \$\{adresse\}\) AS frei_seit/.test(d),
    "14-Tage-Ruhe nach Blockaden: nur Blockaden NACH dem Vermerk der Adresse");
  ok(/COUNT\(\*\) FILTER \(WHERE zustellung IN \('gebounct', 'spam'\)\)::int       AS hart/.test(d), "harte Unzustellbarkeit unverändert");
}

console.log("── 17. Fund 8: Ladeprobe der geänderten Server-Module (ohne tsc) ─────");
{
  const module = ["../server/lib/fiaon-marken", "../server/lib/fiaon-kundenweg", "../server/lib/fiaon-wa-zentrale", "../server/make-webhook", "../server/routes/fiaon-mailwerk", "../server/routes/fiaon-mail",
    "../server/lib/fiaon-mara-abstreiten", "../server/routes/fiaon-abmelden", "../server/lib/fiaon-kontakt-ergebnis", "../server/lib/fiaon-postmeister-werkzeuge",
    "../server/routes/fiaon-postmeister", "../server/lib/fiaon-telefonkartei", "../server/lib/fiaon-rueckholung"];
  const fehler: string[] = [];
  for (const m of module) { try { await import(m); } catch (e) { fehler.push(`${m}: ${String((e as Error)?.message || e).slice(0, 160)}`); } }
  ok(fehler.length === 0, "alle geänderten Module laden (Syntax, Importe, Reihenfolge der SQL-Bausteine)", fehler);
  ok(typeof MF.werbesperreAusFreigabe === "function" && MF.FREIGABE_WERBESPERRE_PERSONEN_SQL.length > 200 && !/undefined/.test(MF.FREIGABE_WERBESPERRE_PERSONEN_SQL + MF.WERBESPERRE_KOEPFE_OHNE_FREIGABE_SQL + MF.WERBESPERRE_ADRESSEN_OHNE_FREIGABE_SQL + MF.ABLEHNUNG_DOKUMENTIERT_SQL("x.id")),
    "die SQL-Bausteine sind beim Laden vollständig (kein „undefined“ aus der Reihenfolge)");
}

// ═══════════════════════════════════════════════════════════════════════════
// NACH DER ZWEITEN PRÜFUNG (08.10.2026) — je Fund mindestens ein Fall
// ═══════════════════════════════════════════════════════════════════════════

console.log("── 18. Fund 1 (zweite Prüfung): Herkunft der Werbesperre an der Person ─");
{
  // Die Spalte: Migration mit der nächsten freien Nummer + dasselbe beim Start.
  const mig = readdirSync(new URL("../db/migrations/", import.meta.url)).filter((f) => /^\d{3}_/.test(f)).sort();
  const m106 = mig.find((f) => f.startsWith("106_")) ?? "";
  ok(m106 === "106_werbesperre_quelle.sql" && mig.filter((f) => f.startsWith("106_")).length === 1, "Migration 106_werbesperre_quelle.sql (einzige 106)", mig.slice(-3));
  const migText = m106 ? quelle(`db/migrations/${m106}`) : "";
  ok(/^ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS werbesperre_quelle TEXT;$/m.test(migText) && !/\b(DROP|DEFAULT|CHECK|UPDATE)\b/.test(ohneKommentare(migText)),
    "Migration: nur ADD COLUMN IF NOT EXISTS werbesperre_quelle TEXT (sperrarm, wiederholbar, kein Umschreiben)");
  const rh = quelle("server/lib/fiaon-rueckholung.ts");
  ok(/export async function ensureRueckholSpalten\(\)[\s\S]{0,400}ADD COLUMN IF NOT EXISTS werbesperre_quelle TEXT/.test(rh)
    && /import\('\.\/lib\/fiaon-rueckholung'\)\.then\(\(m\) => m\.ensureRueckholSpalten\(\)\)\.catch\(/.test(quelle("server/routes.ts")),
    "ensureRueckholSpalten legt die Spalte auch an — und läuft beim Start (server/routes.ts)");

  // Die Regel: nur die Herkunft — ohne „Stopp“ und ohne Lead-Abmeldung in der Familie.
  ok(FW.includes(`AND ${MF.KOPF_SQL("zfw_p.id")} NOT IN ${MF.LEAD_ABGEMELDET_KOEPFE_SQL}`), "Lead-Abmeldung (Familie) zählt wie „Stopp“ als Nein — auch alte ohne Werbesperre");
  ok(MF.WERBESPERRE_QUELLE_FREIGABE === "zahlungspost_freigabe" && MF.WERBESPERRE_QUELLE_MENSCH === "mensch", "die zwei Herkünfte");

  // DER WÄCHTER: Jedes Schreiben auf werbung_gesperrt_am im Server schreibt auch die Herkunft — und jeder Weg eines
  // Menschen setzt 'mensch' AUCH auf einen stehenden Stempel (kein „… AND werbung_gesperrt_am IS NULL“ davor).
  const dateien: string[] = [];
  const sammeln = (d: string) => { for (const f of readdirSync(new URL(`../${d}/`, import.meta.url))) { const p = `${d}/${f}`; if (statSync(new URL(`../${p}`, import.meta.url)).isDirectory()) sammeln(p); else if (p.endsWith(".ts")) dateien.push(p); } };
  sammeln("server");
  const schreibstellen: { datei: string; zeile: number; mitQuelle: boolean; anweisung: string }[] = [];
  const mitInsert: string[] = [];
  for (const d of dateien) {
    const t = quelle(d);
    for (const m of t.matchAll(/werbung_gesperrt_am\s*=(?!=)/g)) {
      const anfang = t.lastIndexOf("UPDATE fiaon_persons", m.index!);
      if (anfang < 0 || m.index! - anfang > 600) continue;
      // die Anweisung: vom UPDATE bis zum Ende der WHERE-Zeile (SET-Liste und Bedingung)
      const iWhere = t.indexOf("WHERE", m.index!);
      const ende = iWhere > 0 ? t.indexOf("\n", iWhere) : -1;
      const anweisung = t.slice(anfang, ende > 0 ? ende : m.index! + 400);
      schreibstellen.push({ datei: d, zeile: t.slice(0, m.index!).split("\n").length, mitQuelle: /werbesperre_quelle\s*=/.test(anweisung), anweisung });
    }
    if (/INSERT INTO fiaon_persons\s*\([^)]*werbung_gesperrt_am/.test(t)) mitInsert.push(d);
  }
  ok(mitInsert.length === 0, "kein INSERT in fiaon_persons setzt eine Werbesperre an der Herkunft vorbei", mitInsert);
  const ohne = schreibstellen.filter((s) => !s.mitQuelle);
  ok(schreibstellen.length >= 9 && ohne.length === 0, `jedes UPDATE auf werbung_gesperrt_am schreibt werbesperre_quelle mit (${schreibstellen.length} Stellen)`, ohne.map((s) => `${s.datei}:${s.zeile}`));
  const wege: [string, RegExp][] = [
    ["server/lib/fiaon-mara-abstreiten.ts", /werbesperre_quelle = \$\{WERBESPERRE_QUELLE_MENSCH\}/],
    ["server/routes/fiaon-abmelden.ts", /werbesperre_quelle = 'mensch'/],
    ["server/lib/fiaon-kontakt-ergebnis.ts", /werbesperre_quelle = 'mensch'/],
    ["server/lib/fiaon-postmeister-werkzeuge.ts", /werbesperre_quelle = 'mensch'/],
    ["server/routes/fiaon-postmeister.ts", /werbesperre_quelle = 'mensch'/],
    ["server/lib/fiaon-telefonkartei.ts", /werbesperre_quelle = \$\{globalKunde \? sqlPool`werbesperre_quelle` : sqlPool`'mensch'`\}/],
  ];
  for (const [d, r] of wege) {
    const st = schreibstellen.filter((s) => s.datei === d && !/werbung_gesperrt_am = NULL|`NULL`\}/.test(s.anweisung));
    ok(st.length >= 1 && st.every((s) => r.test(s.anweisung) && /COALESCE\(werbung_gesperrt_am, NOW\(\)\)/.test(s.anweisung) && !/WHERE[^`]*werbung_gesperrt_am IS NULL(?! OR)/.test(s.anweisung)),
      `${d}: Weg eines Menschen → 'mensch', auch auf einen stehenden Stempel`, st.map((s) => s.anweisung.slice(0, 220)));
  }
  const fg = quelle("server/lib/fiaon-zahlungspost-freigabe.ts");
  ok(/UPDATE fiaon_persons SET werbung_gesperrt_am = NOW\(\), werbesperre_quelle = \$\{WERBESPERRE_QUELLE_FREIGABE\}, updated_at = NOW\(\)\s+WHERE id = \$\{id\} AND werbung_gesperrt_am IS NULL RETURNING id/.test(fg),
    "Freigabe: Stempel UND Herkunft in EINEM UPDATE, nur bei leerem Stempel (eine stehende Werbesperre bleibt samt Herkunft)");
  ok(!/fiaon-mara-abstreiten/.test(fg.slice(fg.indexOf("export const ECHT"))), "Freigabe: eigener Setzweg (nicht mehr Maras werbesperreSetzen, das jetzt 'mensch' schreibt)");

  // Mara: „in Ruhe lassen“, Löschwunsch, „schreiben Sie mir nicht mehr“ — auch nach der Freigabe ein Nein mit Vermerk.
  const ab = quelle("server/lib/fiaon-mara-abstreiten.ts");
  const ws = ab.slice(ab.indexOf("export async function werbesperreSetzen("), ab.indexOf("/** Der Merker in den Handlungen"));
  ok(/WHERE id = \$\{personId\} AND \(werbung_gesperrt_am IS NULL OR werbesperre_quelle IS DISTINCT FROM \$\{WERBESPERRE_QUELLE_MENSCH\}\)/.test(ws),
    "Mara/Postmeister-Entwurf: setzt auch bei stehendem Stempel — nur eine schon menschliche bleibt unberührt");
  ok(/\(v\.stempel IS NOT NULL AND v\.quelle = \$\{WERBESPERRE_QUELLE_FREIGABE\}\) AS aus_freigabe/.test(ws) && /if \(r\?\.aus_freigabe\) \{\s+await sqlPool`\s+INSERT INTO fiaon_contact_log/.test(ws) && /return !!r\?\.neu;/.test(ws),
    "… übernimmt sie eine Freigabe-Werbesperre, steht das im Kontaktprotokoll; „true“ heißt weiter: Stempel war leer");
  ok(/werbesperreSetzen\(Number\(zeile\.person_id\), "Postmeister"\)/.test(ab), "Postmeister-Entwurf: der Vermerk nennt den Postmeister");
  const mara = quelle("server/lib/fiaon-whatsapp-mara.ts");
  ok(/if \(await werbesperreSetzen\(ein\.personId\)\.catch\(\(\) => false\)\) taten\.push\("Werbesperre gesetzt"\);/.test(mara)
    && /\(await import\("\.\/fiaon-mara-abstreiten"\)\)\.werbesperreSetzen\(Number\(personId\)\)/.test(mara),
    "Maras zwei Wege (Abstreiten/„in Ruhe“/Löschwunsch, „nicht mehr schreiben“ nach Abstreiten) gehen über diese Funktion");
  const tk = quelle("server/lib/fiaon-telefonkartei.ts");
  ok(/werbesperre_quelle: p\.werbesperre_quelle \?\? null/.test(tk) && /const quelleVorher = !stand\.person\.werbung_gesperrt_am \? sqlPool`NULL`/.test(tk)
    && /stand\.person\.werbesperre_quelle !== undefined \? sqlPool`\$\{stand\.person\.werbesperre_quelle\}` : sqlPool`werbesperre_quelle`/.test(tk),
    "Telefonkartei: Storno merkt sich die Herkunft, „Zurückholen“ stellt sie wieder her (alte Storno-Zeile: bleibt 'mensch')");

  // Der Ablauf mit Attrappen: Herkunft vor dem DELETE, ein späteres Nein beendet die Ausnahme.
  liste = []; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const w = welt(); const z = werkzeuge(w);
  kunde(w, "nein@kunde.invalid", [601]);
  let quelleBeimDelete: string | undefined;
  const r = await F.zahlungspostFreigeben("nein@kunde.invalid", "abo_payment_reminder", { ...z, async sperreAufheben(a) { quelleBeimDelete = w.quelle.get(601); return z.sperreAufheben(a); } });
  ok(r?.freigegeben === true && quelleBeimDelete === "zahlungspost_freigabe", "die Herkunft steht schon, wenn der DELETE an Brevo geht", [r, quelleBeimDelete]);
  ok(ausnahme(w, 601), "Freigabe-Werbesperre: Erstzahlungs-Erinnerung und Raten-WhatsApp laufen (Ausnahme)");
  menschSagtNein(w, 601);
  ok(w.sperre.has(601) && !ausnahme(w, 601), "Mensch sagt danach Nein (Werbesperre schon da) → Herkunft „mensch“, die Ausnahme endet");
}

console.log("── 19. Fund 2 (zweite Prüfung): Brevo-Antwort dreiwertig — unklar heißt: Werbesperre bleibt ─");
{
  const befund = async (status: number | "wirft") => {
    if (status === "wirft") loeschModus = "wirft"; else { loeschModus = "antwort"; loeschStatus = status; }
    const b = await B.brevoSperreAufhebenBefund("drei@kunde.invalid");
    loeschModus = "antwort"; loeschStatus = 204;
    return b;
  };
  const a204 = await befund(204), a200 = await befund(200), a404 = await befund(404);
  ok([a204, a200, a404].every((x) => x.ergebnis === "aufgehoben"), "204, 200, 404 → aufgehoben", [a204, a200, a404]);
  const ab: { s: number; b: Awaited<ReturnType<typeof befund>> }[] = [];
  for (const s of [400, 401, 403, 429]) ab.push({ s, b: await befund(s) });
  ok(ab.every(({ s, b }) => b.ergebnis === "abgelehnt" && b.status === s), "400, 401, 403, 429 → eindeutig abgelehnt, mit HTTP-Status", ab);
  const u: Awaited<ReturnType<typeof befund>>[] = [];
  for (const s of [500, 502, 503]) u.push(await befund(s));
  const uz = await befund("wirft");
  ok(u.every((x) => x.ergebnis === "unklar") && uz.ergebnis === "unklar", "5xx und Zeitüberschreitung → unklar", [u, uz]);
  ok(uz.ergebnis === "unklar" && /TimeoutError/.test(uz.grund) && !/@/.test(uz.grund), "unklar: Grund ohne Adresse (Fehlertexte landen im Protokoll)", uz);
  const schluessel = process.env.BREVO_API_KEY; delete process.env.BREVO_API_KEY;
  const ohneS = await B.brevoSperreAufhebenBefund("drei@kunde.invalid");
  process.env.BREVO_API_KEY = schluessel;
  ok(ohneS.ergebnis === "abgelehnt" && ohneS.status === null, "ohne Schlüssel: nichts gesendet → abgelehnt (Status null)", ohneS);

  // Ablauf: unklar → Werbesperre bleibt, Vermerk „unklar“; noch gesperrt → neuer Anlauf; zugestellt danach → endgültig.
  liste = []; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const w = welt(); const z = werkzeuge(w);
  kunde(w, "unklar@kunde.invalid", [701]);
  loeschModus = "wirft";
  const r1 = await F.zahlungspostFreigeben("unklar@kunde.invalid", "payment_reminder", z);
  loeschModus = "antwort";
  ok(r1?.freigegeben === false && /Brevo-Antwort unklar/.test(r1.grund) && w.sperre.has(701) && w.quelle.get(701) === "zahlungspost_freigabe" && !w.spur.some((x) => x.startsWith("zurueck")),
    "unklar (Zeitüberschreitung) → NICHT zurückgenommen: Werbesperre mit Herkunft der Freigabe bleibt", [r1, w.spur]);
  ok(w.vermerke.length === 1 && w.vermerke[0].brevo === "unklar" && /^Zahlungspost-Freigabe unklar: /.test(w.vermerke[0].grund) && w.meldungen.length === 0,
    "… und der Vermerk steht (brevo „unklar“) — die womöglich offene Adresse ist festgehalten", w.vermerke[0]);
  aufrufe.length = 0;
  const r2 = await F.zahlungspostFreigeben("unklar@kunde.invalid", "payment_reminder", z);
  ok(r2?.freigegeben === true && deletes().length === 1 && w.vermerke.length === 2 && w.vermerke[1].neu.length === 0 && w.quelle.get(701) === "zahlungspost_freigabe",
    "noch „blockiert“ und nichts zugestellt → neuer Anlauf, aufgehoben; Werbesperre bestand schon und bleibt die der Freigabe", [r2, w.vermerke[1]]);
  // Ein unklarer Vermerk, nach dem zugestellt wurde: Brevo hatte doch aufgehoben → eine neue Sperre ist eine neue Abmeldung.
  const w2 = welt(); const z2 = werkzeuge(w2);
  kunde(w2, "unklar2@kunde.invalid", [702]); w2.vermerkt.set("unklar2@kunde.invalid", "unklar"); w2.zugestelltDanach.add("unklar2@kunde.invalid");
  aufrufe.length = 0;
  const r3 = await F.zahlungspostFreigeben("unklar2@kunde.invalid", "payment_reminder", z2);
  ok(r3?.freigegeben === false && /schon einmal/.test(r3.grund) && deletes().length === 0, "unklar + danach zugestellt → zählt als freigegeben (einmal je Adresse)", r3);
  const fg = quelle("server/lib/fiaon-zahlungspost-freigabe.ts");
  ok(/AND \(COALESCE\(m\.payload ->> 'brevo', 'aufgehoben'\) <> 'unklar'\s+OR EXISTS \(SELECT 1 FROM fiaon_mail_log z\s+WHERE LOWER\(TRIM\(z\.empfaenger\)\) = \$\{a\} AND z\.created_at > m\.created_at\s+AND z\.status = 'versandt' AND z\.art = 'echt'\s+AND z\.zustellung IN \('zugestellt', 'geoeffnet', 'geklickt'\)\)\)\) AS schon_frei/.test(fg),
    "lage(): ein „unklarer“ Vermerk zählt erst mit einer Zustellung danach (SQL)");
  ok(/sperreAufheben: brevoSperreAufhebenBefund,/.test(fg) && /behalten = true;\s+const a = await w\.sperreAufheben\(adresse\);\s+if \(a\.ergebnis === "abgelehnt"\) \{\s+behalten = false;/.test(fg),
    "ab dem Absenden des DELETE bleibt die Werbesperre — zurückgenommen nur bei eindeutiger Ablehnung");

  // Abbruch zwischen DELETE und Vermerk (Prozess weg / Werkzeug wirft): Werbesperre bleibt MIT Herkunft.
  const w3 = welt(); const z3 = werkzeuge(w3); B.brevoSperrlisteVergessen();
  kunde(w3, "abbruch@kunde.invalid", [703]);
  const fehlerAus = console.error; console.error = () => {};
  const r4 = await F.zahlungspostFreigeben("abbruch@kunde.invalid", "abo_payment_reminder", { ...z3, async sperreAufheben() { throw new Error("Prozess endet"); } });
  console.error = fehlerAus;
  ok(r4 === null && w3.sperre.has(703) && w3.quelle.get(703) === "zahlungspost_freigabe" && w3.vermerke.length === 0 && !w3.spur.some((x) => x.startsWith("zurueck")),
    "Abbruch nach dem Absenden: Werbesperre bleibt, Herkunft „zahlungspost_freigabe“ (gilt nicht als menschlich)", [r4, w3.spur]);
  const r5 = await F.zahlungspostFreigeben("abbruch@kunde.invalid", "abo_payment_reminder", z3);
  ok(r5?.freigegeben === true && w3.vermerke.length === 1 && w3.vermerke[0].neu.length === 0 && ausnahme(w3, 703),
    "nächster Anlauf: Vermerk mit werbesperre_neu = [] — die Werbesperre bleibt trotzdem die der Freigabe (Ausnahme gilt)", [r5, w3.vermerke[0]]);
}

console.log("── 20. Fund 3a: Die Sperrliste wird nie still abgeschnitten ─────────");
{
  liste = Array.from({ length: B.SPERRLISTE_HOECHSTENS + 50 }, (_, i) => ({ email: `viel${i}@kunde.invalid`, reason: { code: i === B.SPERRLISTE_HOECHSTENS + 10 ? "hardBounce" : "unsubscribedViaEmail" } }));
  B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const fehlerAus = console.error; console.error = () => {};
  const g = await B.brevoSperrGruende(`viel${B.SPERRLISTE_HOECHSTENS + 10}@kunde.invalid`);
  ok(!g.ok && /unvollständig gelesen \(5000 von 5050 Einträgen\)/.test(String(g.grund)) && aufrufe.length === 50,
    "5050 Einträge: nach 5000 ist Schluss — die Liste gilt als NICHT lesbar (vorher: „nicht auf der Liste“, hardBounce übersehen)", [g, aufrufe.length]);
  ok(!(await B.brevoSperrGruende("viel1@kunde.invalid")).ok && aufrufe.length === 50, "… auch für eine Adresse vorne in der Liste, und 30 Minuten kein neuer Lesedurchgang");
  mitCount = false; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const ohneCount = await B.brevoSperrGruende("viel1@kunde.invalid");
  ok(!ohneCount.ok && /mehr als 5000/.test(String(ohneCount.grund)), "ohne count von Brevo: Ende ohne kurze Seite reicht als Beweis", ohneCount);
  mitCount = true;
  // Brevo kürzt die Seiten (z. B. auf 50): jede Seite ist „kurz“, count sagt die Wahrheit.
  liste = Array.from({ length: 120 }, (_, i) => ({ email: `kurz${i}@kunde.invalid`, reason: { code: "unsubscribedViaEmail" } }));
  seitenGroesse = 50; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const k = await B.brevoSperrGruende("kurz99@kunde.invalid");
  ok(!k.ok && /50 von 120/.test(String(k.grund)), "Brevo liefert nur 50 je Seite (count 120) → nicht lesbar, statt 70 Adressen zu übersehen", k);
  seitenGroesse = 100;
  // Die Freigabe an einer unvollständigen Liste: bleibt gesperrt, kein DELETE.
  B.brevoSperrlisteVergessen();
  liste = Array.from({ length: B.SPERRLISTE_HOECHSTENS + 1 }, (_, i) => ({ email: `gross${i}@kunde.invalid`, reason: { code: "unsubscribedViaEmail" } }));
  const w = welt(); const z = werkzeuge(w); w.personen.set("gross1@kunde.invalid", [801]); w.blockiert.add("gross1@kunde.invalid"); w.offen.add("gross1@kunde.invalid");
  aufrufe.length = 0;
  const r = await F.zahlungspostFreigeben("gross1@kunde.invalid", "payment_reminder", z);
  console.error = fehlerAus;
  ok(r?.freigegeben === false && /nicht lesbar: Sperrliste unvollständig/.test(r.grund) && deletes().length === 0 && !w.sperre.has(801), "Freigabe: Liste unvollständig → bleibt gesperrt, keine Werbesperre, kein DELETE", r);
  liste = []; B.brevoSperrlisteVergessen();
}

console.log("── 21. Fund 3b: „Stopp“ und Lead-Abmeldung — die Brevo-Sperre bleibt ─");
{
  liste = []; B.brevoSperrlisteVergessen(); aufrufe.length = 0;
  const w = welt(); const z = werkzeuge(w);
  kunde(w, "stopp@kunde.invalid", [901]); w.nein.set("stopp@kunde.invalid", "„Stopp“ des Menschen (WhatsApp oder Postfach)");
  kunde(w, "leadab@kunde.invalid", [902]); w.nein.set("leadab@kunde.invalid", "Abmeldung über eine Lead-Mail");
  const s = await F.zahlungspostFreigeben("stopp@kunde.invalid", "abo_payment_reminder", z);
  const l = await F.zahlungspostFreigeben("leadab@kunde.invalid", "payment_reminder", z);
  ok(s?.freigegeben === false && /„Stopp“ des Menschen .* — bleibt gesperrt/.test(s.grund) && l?.freigegeben === false && /Lead-Mail — bleibt gesperrt/.test(l.grund),
    "„Stopp“ (WhatsApp/Postfach) oder Lead-Abmeldung → bleibt gesperrt", [s, l]);
  ok(deletes().length === 0 && w.sperre.size === 0 && !w.spur.some((x) => x.startsWith("brevo")), "… ohne Werbesperre, ohne Brevo-Abfrage, ohne DELETE", w.spur);
  const fg = quelle("server/lib/fiaon-zahlungspost-freigabe.ts");
  const fo = fg.slice(fg.indexOf("  async forderung(a) {"), fg.indexOf("  sperrGruende: brevoSperrGruende,"));
  ok(/EXISTS \(SELECT 1 FROM ids WHERE \$\{sqlPool\.unsafe\(KOPF_SQL\("ids\.id"\)\)\} IN \$\{sqlPool\.unsafe\(STOPP_KOEPFE_SQL\)\}\) AS stopp/.test(fo)
    && /IN \$\{sqlPool\.unsafe\(LEAD_ABGEMELDET_KOEPFE_SQL\)\}\)\s+OR \$\{a\} IN \$\{sqlPool\.unsafe\(LEAD_ABGEMELDET_ADRESSEN_SQL\)\}\) AS lead_abgemeldet/.test(fo),
    "forderung(): „Stopp“ (Familie) und Lead-Abmeldung (Familie oder genau diese Adresse) — dieselben Mengen wie Tür und Kette");
  ok(/if \(!f\.personen\.length \|\| !f\.offen\) return nein\("keine offene Rate und keine offene Erstzahlung"\);\s+if \(f\.nein\) return nein\(`\$\{f\.nein\} — bleibt gesperrt`\);\s+const s = await w\.sperrGruende\(adresse\);/.test(fg),
    "das Nein kommt VOR der Brevo-Abfrage (kein Brevo-Aufruf für einen, der Nein gesagt hat)");
}

console.log("── 22. Fund 3c: Last an der Tür — erst der Befund, dann die teuren Prüfungen ─");
{
  liste = []; B.brevoSperrlisteVergessen();
  const w = welt(); const z = werkzeuge(w);
  for (let i = 0; i < 20; i++) kunde(w, `normal${i}@kunde.invalid`, [1000 + i], { blockiert: false });
  w.spur.length = 0;
  for (let i = 0; i < 20; i++) await F.zahlungspostFreigeben(`normal${i}@kunde.invalid`, i % 2 ? "abo_payment_reminder" : "payment_reminder", z);
  ok(w.spur.length === 20 && w.spur.every((x) => x.startsWith("befund:")), "20 Zahlungsmails an nicht blockierte Adressen: je EINE Befund-Abfrage, keine Lage (kein Spam-Scan)", w.spur.slice(0, 4));
  const fg = quelle("server/lib/fiaon-zahlungspost-freigabe.ts");
  const befund = fg.slice(fg.indexOf("  async letzterBefund(a) {"), fg.indexOf("  async lage(a) {"));
  ok(!/zustellung = 'spam'|zahlungspost_freigabe|ZAHLUNGSPOST_FREIGABE_EVENT|COUNT\(/.test(befund) && /LIMIT 1/.test(befund), "der Befund liest nur den jüngsten Zustellbefund (kein Spam-Scan ohne Frist, kein Vermerk, kein Zähler)");
  const iB = fg.indexOf('if ((await w.letzterBefund(adresse)) !== "blockiert") return null;'), iL = fg.indexOf("const l = await w.lage(adresse);");
  ok(iB > 0 && iL > iB, "im Ablauf: Befund zuerst, Lage erst bei „blockiert“");
}

console.log("── 23. Fund 3d: Ablehnung beim Zusammenführen — und die Firmenrechnung ─");
{
  const ad = MF.ABLEHNUNG_DOKUMENTIERT_SQL("x.id");
  ok(/ad_w\.werbung_gesperrt_am IS NOT NULL\s+(--[^\n]*\n\s+)?AND ad_w\.werbesperre_quelle IS DISTINCT FROM 'zahlungspost_freigabe'/.test(ad),
    "ABLEHNUNG_DOKUMENTIERT_SQL: die Werbesperre der Freigabe ist keine dokumentierte Ablehnung (sonst keine Prüfaufgabe beim Zusammenführen)");
  ok(/abgelehnt\|kein_interesse\|kein interesse\|not_interested\|dsgvo\|loesch/.test(ad) && ad.includes(MF.STOPP_KOEPFE_SQL), "… Kontaktprotokoll und „Stopp“ zählen weiter");
  ok(!MF.istZahlungspost("global_zahlung_erinnerung") && /global_zahlung_erinnerung[\s\S]{0,200}globalMailSenden/.test(fq) && /nie durch sendMakeWebhookMitGrund/.test(fq),
    "Firmenrechnung ausdrücklich ausgenommen — der Kommentar sagt warum (geht über globalMailSenden, nie durch die Tür)");
  const ga = quelle("server/lib/fiaon-global-auftrag.ts");
  const gm = ga.slice(ga.indexOf("export async function globalMailSenden("), ga.indexOf("async function auftragsMailSenden("));
  ok(/mailDirektSenden\(event, nutzlast/.test(gm) && !/sendMakeWebhook/.test(gm), "nachgeprüft: globalMailSenden geht direkt an den Motor, nicht durch sendMakeWebhookMitGrund");
}

console.log("── Netz ─────────────────────────────────────────────────────────────");
ok(netz === 0, `Netzzähler 0 (Socket-Verbindungen und fremde Adressen) — Brevo nur als Attrappe (${aufrufe.length} Attrappen-Aufrufe zuletzt)`, netz);

console.log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} bestanden, ${schlecht} nicht.`);
process.exit(schlecht === 0 ? 0 : 1);
