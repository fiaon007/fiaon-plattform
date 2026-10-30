// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-466 (30.10.2026): DIE WEICHE META-SOFORTFORMULAR → FIAON GLOBAL + DIE ANZEIGEN-LANDINGPAGE
//
// Bis heute wurde jeder Meta-Lead ein PRIVAT-Lead (processIntake: Begrüßung, Kreditkarten-Strecke, WhatsApp fiaon_kk_*).
// Ein Lead aus einem Formular „FIAON Global …“ muss eine Global-Anfrage werden: fiaon_anfragen (art „global“), Firma im
// Firmen-Cockpit, dringende Aufgabe für die zuständige Person — und KEIN Privat-Lead.
//
//   A  REIN (immer, ohne Datenbank): Erkennung des Global-Formulars (grün und rot), lesbare Fragen, Text der Anfrage,
//      Quelltext-Wache (die Weiche steht VOR processIntake), Wortlaut der Landingpage gegen Wortwand und E-233/E-466.
//   B  LOKALE DATENBANK (DATABASE_URL auf 127.0.0.1:54329/fiaon_pruefstand…): die echte Funktion metaLeadEinspielen mit
//      erfundenen Menschen (example.com): Global-Formular → Anfrage + Firmen-Lead + Aufgabe, kein fiaon_leads-Eintrag,
//      zweiter Durchlauf = Dublette; Kampagnen-Rückfall; ein Privat-Formular läuft unverändert über processIntake.
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin node_modules/.bin/tsx scripts/pruef-meta-global-weiche.ts   (nur A)
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e466?sslmode=require' \
//     node_modules/.bin/tsx scripts/pruef-meta-global-weiche.ts
//
// Verschickt nichts: Schlüssel in der Umgebung → Abbruch. Danach die Prüfdatenbank verwerfen (dropdb).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
const URL_DB = String(process.env.DATABASE_URL);
const LOKAL_DB = /@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand[A-Za-z0-9_]*(\?|$)/.test(URL_DB);
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_APP_SECRET", "META_SYSTEM_TOKEN", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — dieser Prüfstand läuft nur ohne Schlüssel und nur gegen eine lokale Datenbank.`); process.exit(3); }
}

let geprueft = 0, fehler = 0;
const ok = (b: unknown, t: string) => { geprueft++; if (!b) { fehler++; console.log(`  ✗ ${t}`); } };
const gleich = (ist: unknown, soll: unknown, t: string) => ok(ist === soll, `${t} — ist: ${JSON.stringify(ist)}, soll: ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const M = await import("../server/lib/fiaon-meta-leads");

// ── A1 Erkennung ───────────────────────────────────────────────────────────
abschnitt("A1 Global-Formular erkennen");
ok(M.istGlobalFormular("FIAON Global · US-Gesellschaft · drei Fragen"), "Formularname „FIAON Global · …“");
ok(M.istGlobalFormular("  fiaon global – Test"), "klein geschrieben, mit Leerraum");
ok(M.istGlobalFormular("FIAON Global"), "nur „FIAON Global“");
ok(!M.istGlobalFormular("FIAON Kreditkarte Oktober"), "rot: Privat-Formular");
ok(!M.istGlobalFormular("Global FIAON"), "rot: falsche Reihenfolge");
ok(!M.istGlobalFormular("FIAON Globalisierung"), "rot: nur ein Wortanfang");
ok(!M.istGlobalFormular(null), "rot: ohne Namen");
ok(M.istGlobalFormular("Lead Form 3", "123456", ["123456"]), "Rückfall: Formular-ID in der Einstellung");
ok(!M.istGlobalFormular("Lead Form 3", "999", ["123456"]), "rot: andere ID");
gleich(M.META_GLOBAL_FORMULARE, "meta_global_formular_ids", "Name der Rückfall-Einstellung");

abschnitt("A2 Fragen und Text der Anfrage");
gleich(M.frageLesbar("wann_möchten_sie_gründen?"), "Wann möchten sie gründen?", "Meta-Schlüssel lesbar");
const felder = M.leadAusMeta({
  id: "x", platform: "ig", ad_name: "A2 Leistungs-Tafel", campaign_name: "FIAON Global · US-Gründung",
  field_data: [
    { name: "full_name", values: ["Erika Muster"] }, { name: "email", values: ["erika@example.com"] }, { name: "phone_number", values: ["+4915112345678"] },
    { name: "wann_möchten_sie_gründen?", values: ["In den nächsten drei Monaten"] },
    { name: "wofür_planen_sie_die_us-gesellschaft?", values: ["Kunden oder Partner in den USA"] },
    { name: "was_beschreibt_sie_am_besten?", values: ["Geschäftsführer/in"] },
  ],
});
const text = M.globalMetaText(felder, "FIAON Global · US-Gesellschaft · drei Fragen", { id: "x", ad_name: "A2 Leistungs-Tafel", campaign_name: "FIAON Global · US-Gründung" });
ok(text.includes("Meta-Sofortformular „FIAON Global · US-Gesellschaft · drei Fragen“"), "Formular steht in der Anfrage");
ok(text.includes("Wann möchten sie gründen?: In den nächsten drei Monaten"), "Antwort 1 in der Anfrage");
ok(text.includes("Wofür planen sie die us-gesellschaft?: Kunden oder Partner in den USA"), "Antwort 2 in der Anfrage");
ok(text.includes("Was beschreibt sie am besten?: Geschäftsführer/in"), "Antwort 3 in der Anfrage");
ok(text.includes("Anzeige: A2 Leistungs-Tafel"), "Anzeige steht in der Anfrage");
ok(!/erika@example\.com/.test(text), "Mailadresse steht nicht doppelt im Freitext");

abschnitt("A3 Quelltext-Wachen");
const quelle = lies("server/lib/fiaon-meta-leads.ts");
const einspielen = quelle.split("export async function metaLeadEinspielen(")[1]?.split("\n}\n")[0] ?? "";
const iWeiche = einspielen.indexOf("istGlobalFormular(");
const iPrivat = einspielen.indexOf("const { processIntake } = await import");
ok(iWeiche > 0 && iPrivat > 0 && iWeiche < iPrivat, "die Weiche steht VOR processIntake");
ok(/return globalMetaLeadEinspielen\(/.test(einspielen), "Global-Formular kehrt zurück, bevor processIntake läuft");
const globalTeil = quelle.split("async function globalMetaLeadEinspielen(")[1]?.split("\n}\n")[0] ?? "";
ok(!/processIntake|waSenden|whatsapp|sendMail|brevo/i.test(globalTeil), "Global-Eingang ruft keinen Privat-Weg, kein WhatsApp, keine Mail");
ok(/globalAnfrageAnnehmen\(/.test(globalTeil), "Global-Eingang nutzt globalAnfrageAnnehmen (wie die Website)");
const termin = lies("server/lib/fiaon-global-termin.ts");
ok(/herkunft\?: \{ wo: string; quelle: string; autor: string \}/.test(termin), "globalAnfrageAnnehmen kennt die Herkunft");
ok(!/von fiaon\.com\/business — das Unternehmen/.test(termin), "Aufgabentext nennt die echte Herkunft");

abschnitt("A4 Anzeigen-Landingpage /business/lp/us-firmengruendung");
const { LANDINGPAGES } = await import("../shared/fiaon-global-seiten/landingpages");
const { globalWortPruefen } = await import("../shared/fiaon-global-wortregeln");
const lp = LANDINGPAGES.find((l) => l.pfad === "/business/lp/us-firmengruendung")!;
ok(!!lp, "Landingpage gefunden");
const lpTexte = [lp.seo.titel, lp.seo.beschreibung, lp.auge, lp.h1, lp.h1b ?? "", lp.lead, ...lp.vorteile, ...lp.fragen.flatMap((q) => [q.f, q.a])];
const alles = lpTexte.join("\n");
ok(!/Team vor Ort|Team in Miami/i.test(alles), "kein „Team vor Ort“ / „Team in Miami“");
ok(!/ein Vertrag\b/i.test(alles), "kein „ein Vertrag“ als Zählangabe (E-233)");
ok(!/alle Gebühren inklusive/i.test(alles), "„inklusive“ nur mit „erstes Jahr“ (E-233)");
ok(!/Geld zurück/i.test(lp.vorteile.join(" ")), "„Geld zurück“ nicht ohne Bedingung in der Vorteilsliste");
ok(/ein Ansprechpartner/i.test(lp.h1b ?? ""), "Unterzeile nennt den einen Ansprechpartner");
for (const t of lpTexte) { const f = globalWortPruefen(t); ok(!f.length, `Wortwand grün: „${t.slice(0, 50)}“ ${f.map((x) => x.treffer).join(", ")}`); }
const lpSeite = lies("client/src/pages/site/global-lp.tsx");
ok(!/Drei Standorte, ein Vertrag/.test(lpSeite), "Seitenbaustein ohne „ein Vertrag“");
const og = lies("shared/fiaon-og-business.ts");
ok(/"\/business\/lp\/us-firmengruendung": \{[^}]*ein Ansprechpartner, ein Festpreis/.test(og), "Vorschaubild-Text der Landingpage neu");

// ── B lokale Datenbank ─────────────────────────────────────────────────────
if (LOKAL_DB) {
  abschnitt("B Echte Funktion gegen die lokale Prüfdatenbank");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const LAUF = randomBytes(3).toString("hex");
  await M.metaTabellen();
  const formG = `PRUEFG${LAUF}`, formP = `PRUEFP${LAUF}`;
  await sql`INSERT INTO fiaon_meta_formulare (id, name, status, sprache, geladen_am) VALUES
    (${formG}, 'FIAON Global · US-Gesellschaft · drei Fragen', 'ACTIVE', 'de_DE', NOW()),
    (${formP}, 'FIAON Kreditkarte Prüfstand', 'ACTIVE', 'de_DE', NOW()) ON CONFLICT (id) DO NOTHING`;
  const lead = (nr: number, form: string, kampagne = "Prüfstand") => ({
    id: `PRUEF${LAUF}${nr}`, created_time: new Date().toISOString(), form_id: form, ad_name: "Prüfanzeige", campaign_name: kampagne, platform: "ig",
    field_data: [
      { name: "full_name", values: [`Pruef Person${nr}`] }, { name: "email", values: [`pruef-${LAUF}-${nr}@example.com`] },
      { name: "phone_number", values: [`+49151000${String(nr).padStart(5, "0")}`] },
      { name: "wann_möchten_sie_gründen?", values: ["So bald wie möglich"] },
      { name: "wofür_planen_sie_die_us-gesellschaft?", values: ["Neues Geschäft in den USA"] },
      { name: "was_beschreibt_sie_am_besten?", values: ["Inhaber/in eines Unternehmens"] },
    ],
  });
  const mail = (nr: number) => `pruef-${LAUF}-${nr}@example.com`;

  const e1 = await M.metaLeadEinspielen(lead(1, formG), "meta_webhook", null);
  gleich(e1.status, "neu", "Global-Lead ist neu");
  gleich(e1.leadId, null, "Global-Lead hat KEINEN Privat-Lead");
  ok(Number(e1.globalAnfrageId) > 0, "Global-Anfrage-ID zurück");
  const [anf] = (await sql`SELECT art, email, text, zustaendig_agent_id FROM fiaon_anfragen WHERE id = ${e1.globalAnfrageId ?? 0}`) as any[];
  gleich(anf?.art, "global", "Anfrage art „global“");
  gleich(anf?.email, mail(1), "Anfrage trägt die Mailadresse");
  ok(/So bald wie möglich/.test(String(anf?.text)) && /Neues Geschäft in den USA/.test(String(anf?.text)) && /Inhaber\/in/.test(String(anf?.text)), "alle drei Antworten in der Anfrage");
  const [fl] = (await sql`SELECT id, quelle, status, zustaendig_agent_id FROM fiaon_firmen_leads WHERE LOWER(email) = ${mail(1)}`) as any[];
  ok(!!fl, "Firma im Firmen-Cockpit (fiaon_firmen_leads)");
  gleich(fl?.quelle, "global", "Firmen-Lead Quelle „global“");
  const [todo] = (await sql`SELECT titel, text, quelle FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${e1.globalAnfrageId}`}`) as any[];
  ok(!!todo, "dringende Aufgabe für die zuständige Person");
  ok(/Meta-Sofortformular/.test(String(todo?.text)), "Aufgabe nennt das Meta-Sofortformular als Herkunft");
  const privat = (await sql`SELECT id FROM fiaon_leads WHERE LOWER(email) = ${mail(1)}`.catch(() => [])) as any[];
  gleich(privat.length, 0, "KEIN Eintrag in fiaon_leads (Privat)");
  const [ml] = (await sql`SELECT lead_id, global_anfrage_id, weg FROM fiaon_meta_leads WHERE meta_lead_id = ${`PRUEF${LAUF}1`}`) as any[];
  gleich(ml?.lead_id, null, "fiaon_meta_leads ohne Privat-Lead");
  gleich(Number(ml?.global_anfrage_id), Number(e1.globalAnfrageId), "fiaon_meta_leads merkt die Global-Anfrage");
  gleich(ml?.weg, "meta_webhook", "Weg gemerkt");

  const e1b = await M.metaLeadEinspielen(lead(1, formG), "meta_nachhol", null);
  gleich(e1b.status, "dublette", "zweiter Durchlauf (Nachhol-Lauf) = Dublette");
  const anzahl = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_anfragen WHERE email = ${mail(1)}`) as any[];
  gleich(anzahl[0]?.n, 1, "keine zweite Anfrage");

  // Kampagnen-Rückfall: Formular unbekannt (Meta liefert den Namen nicht), Kampagne heißt „FIAON Global …“
  const e2 = await M.metaLeadEinspielen({ ...lead(2, `UNBEKANNT${LAUF}`, "FIAON Global · US-Gründung · Okt") }, "meta_webhook", null);
  ok(Number(e2.globalAnfrageId) > 0 && e2.leadId === null, "Kampagne „FIAON Global …“ → Global, auch ohne Formularnamen");

  // Rot-Probe: Privat-Formular läuft unverändert über processIntake
  const e3 = await M.metaLeadEinspielen(lead(3, formP), "meta_webhook", null);
  ok(e3.leadId !== null && !e3.globalAnfrageId, "Privat-Formular wird weiter ein Privat-Lead");
  const g3 = (await sql`SELECT id FROM fiaon_anfragen WHERE email = ${mail(3)}`) as any[];
  gleich(g3.length, 0, "Privat-Formular erzeugt keine Global-Anfrage");

  await sql.end?.();
} else {
  console.log("\n(B übersprungen — keine lokale Prüfdatenbank in DATABASE_URL)");
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen grün.`);
process.exit(fehler ? 1 : 0);
