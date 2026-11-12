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
//   E-490 (09.11.2026): A5 rein — neue Formulare (F1) und die alte Formular-Fassung in laufenden Anzeigen (F5). B2/B3 gegen
//      ein SCHEIN-Meta im Prozess (META_GRAPH_URL auf eine .invalid-Adresse, fetch abgefangen, erfundene Schlüssel erst NACH
//      der Schlüssel-Wand gesetzt): der Nachhol-Lauf findet ein neues Formular selbst (Seiten-Token), holt seine Leads ab der
//      Anlage als „meta_nachhol“, höchstens 89 Tage, höchstens stündlich gesucht, ein Fehler wird nachgeholt, der Rückstand von
//      Hand bleibt unberührt; die Anzeigen-Abfrage meldet nur laufende Anzeigen mit der alten Fassung, fragt höchstens
//      stündlich, und bei einem Meta-Fehler gibt es keine Aussage.
//   E-490 Nachbesserung (Gutachten 09.11.2026): von selbst höchstens 3 Tage ab der Anlage (älteres Formular → gelber Hinweis
//      „Rückstand nachholen“, der Rückstand schließt ihn), Suche alle 15 Minuten (bekannte Formulare nur der Kopf), ohne
//      Anlage-Zeit nicht in die Liste, die Kurzfassung überschreibt keine Fragen; F5 als eigener gelber Alarm (atomar, nur
//      laufende Anzeigengruppen, Meta-Fehler = keine Aussage). Das Schein-Meta liefert nur die angefragten Felder.
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
// E-476 Scheibe 3 (Gutachten 0, Mangel 22): Die Formular-Fassung 2 mit dem Danke-Knopf /gb MUSS mit „FIAON Global“ beginnen,
// sonst greift die Weiche nicht und der Lead würde ein Privat-Lead.
{
  const { META_FASSUNG2_NAMEN, META_DANKE_URL } = await import("../shared/fiaon-lead-weg");
  ok(M.istGlobalFormular(META_FASSUNG2_NAMEN.kapital), "Fassung 2 Kapital → Global-Weiche");
  ok(M.istGlobalFormular(META_FASSUNG2_NAMEN.us), "Fassung 2 US-Gesellschaft → Global-Weiche");
  ok(META_DANKE_URL === "https://fiaon.com/gb?lid={{lead_id}}", "Danke-Knopf der Fassung 2 zeigt auf /gb mit der Lead-Kennung");
}

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
// E-476 (05.11.2026), bewusst umgestellt — VORHER: „Frage?: Antwort“ (z. B. „Wann möchten sie gründen?: In den nächsten
// drei Monaten“); NACHHER: „Frage? — Antwort“, dieselbe Zeile wie im Lead-Dossier (antwortZeile). Ohne gespeicherte
// Formular-Definition bleibt es beim lesbaren Schlüssel; MIT Definition kommen Fragetext und Antwort im Klartext aus
// fiaon_meta_formulare (statt „vorhaben_3“) — geprüft in scripts/pruef-lead-dossier.ts (alle Kombinationen).
ok(text.includes("Wann möchten sie gründen? — In den nächsten drei Monaten"), "Antwort 1 in der Anfrage");
ok(text.includes("Wofür planen sie die us-gesellschaft? — Kunden oder Partner in den USA"), "Antwort 2 in der Anfrage");
ok(text.includes("Was beschreibt sie am besten? — Geschäftsführer/in"), "Antwort 3 in der Anfrage");
const mitDef = M.globalMetaText(M.leadAusMeta({ id: "z", field_data: [{ name: "vorhaben", values: ["vorhaben_3"] }] }), null, { id: "z" },
  [{ key: "vorhaben", label: "Was planen Sie mit Ihrer US-Gesellschaft?", options: [{ key: "vorhaben_3", value: "Beides" }] }]);
ok(mitDef.includes("Was planen Sie mit Ihrer US-Gesellschaft? — Beides") && !mitDef.includes("vorhaben_3"), "mit Formular-Definition: Klartext statt Code (E-476)");
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
// Der Standort-Kasten im Fuß steht auch auf der Landingpage (im Browser gebaut, nicht im Server-HTML).
const { GLOBAL_STANDORTE } = await import("../shared/fiaon-global-partner");
for (const o of GLOBAL_STANDORTE) ok(!/Team vor Ort|team on the ground/i.test(`${o.rolle} ${o.en.rolle}`), `Fuß-Kasten ${o.stadt}: Rolle ohne „Team vor Ort“`);
ok(GLOBAL_STANDORTE.every((o) => !/Schwarzott (Capital Partners|Global LLC)/.test(o.gesellschaft)), "Fuß-Kasten nennt nur „Schwarzott Group“, nie AG/LLC");
const lpSeite = lies("client/src/pages/site/global-lp.tsx");
ok(!/Drei Standorte, ein Vertrag/.test(lpSeite), "Seitenbaustein ohne „ein Vertrag“");
const og = lies("shared/fiaon-og-business.ts");
// E-509 (12.11.2026): ein Produkt statt vier Pakete — die Anzeigenseite sagt „ein Ansprechpartner, ein Auftrag“ (vorher: „… ein Festpreis“).
ok(/"\/business\/lp\/us-firmengruendung": \{[^}]*ein Ansprechpartner, ein Auftrag/.test(og) && !/Festpreis/.test(og), "Vorschaubild-Text der Landingpage neu (ohne „Festpreis“)");

// ── A5 E-490: neue Formulare (F1) und die alte Fassung in laufenden Anzeigen (F5) — rein ─────────────────────────────
abschnitt("A5 E-490 F1/F5: neue Formulare ab der Anlage, alte Formular-Fassung in laufenden Anzeigen (rein)");
{
  const jetzt = new Date("2026-11-09T15:00:00.000Z");
  ok(M.formularSucheFaellig(null, jetzt) && M.formularSucheFaellig("", jetzt) && M.formularSucheFaellig("kaputt", jetzt), "Formular-Suche: ohne (gültigen) Merker fällig");
  ok(!M.formularSucheFaellig("2026-11-09T14:46:00.000Z", jetzt) && M.formularSucheFaellig("2026-11-09T14:45:00.000Z", jetzt) && M.FORMULAR_SUCHE_MIN === 15,
    "… alle 15 Minuten (14 nein, 15 ja) — Nachbesserung (Gutachten): vorher stündlich, Leads eines neuen Formulars kamen bis ~65 Minuten spät");
  const a1 = M.abAnlageZeit("2026-11-09T10:24:22.000Z", jetzt);
  ok(a1?.ab.toISOString() === "2026-11-09T10:23:22.000Z" && a1.gekappt === false && a1.anlage.toISOString() === "2026-11-09T10:24:22.000Z", "ab der Anlage (eine Minute Spielraum), nicht gekappt");
  const a2 = M.abAnlageZeit("2026-06-01T00:00:00.000Z", jetzt);
  ok(a2?.ab.toISOString() === new Date(jetzt.getTime() - 3 * 86_400_000).toISOString() && a2.gekappt === true && M.NACHHOL_AB_ANLAGE_TAGE === 3,
    "Nachbesserung (Gutachten): ein altes Formular holt der Lauf VON SELBST höchstens 3 Tage zurück (wie Willkommen, Dossier, T1) — der Rest ist „gekappt“");
  const a3 = M.abAnlageZeit("2026-11-06T15:00:30.000Z", jetzt);
  ok(a3?.gekappt === false && a3.ab.toISOString() === "2026-11-06T15:00:00.000Z", "an der Grenze (Anlage 30 s nach der 3-Tage-Grenze): nicht gekappt — vor der Anlage gibt es keine Leads");
  const a4 = M.abAnlageZeit("2026-11-06T14:59:30.000Z", jetzt);
  ok(a4?.gekappt === true && a4.ab.toISOString() === "2026-11-06T15:00:00.000Z", "… 30 s vor der Grenze angelegt: gekappt (der Rückstand-Hinweis nennt den Rest)");
  ok(M.abAnlageZeit(null, jetzt) === null && M.abAnlageZeit("unbekannt", jetzt) === null, "ohne Anlage-Zeit: null (nie blind zurück)");
  ok(M.kennungsListe(" 111, 222;333 111 x/y ").join() === "111,222,333", "Kennungsliste: getrennt, eindeutig, nur saubere Kennungen");
  // Der gelbe Rückstand-Hinweis: Formularname, Seite, Tage — keine Kundendaten.
  const zAlt = M.rueckstandZeile({ formularId: "123", name: "FIAON Global · Kapital · drei Fragen", seiteId: "456", ab: "2026-08-12T10:00:00.000Z", grund: "aelter", anlage: "2026-08-12T10:01:00.000Z" });
  ok(/Formular „FIAON Global · Kapital · drei Fragen“ \(Seite 456\), angelegt am 12\.08\.2026, ist neu aufgetaucht — seine Leads der letzten 3 Tage sind geholt\. Ältere bitte im Lead-Motor über „Rückstand nachholen“ ab dem 12\.08\.2026 holen\./.test(zAlt), `Rückstand-Zeile (älteres Formular): ${zAlt}`);
  const zAb = M.rueckstandZeile({ formularId: "789", name: null, seiteId: null, ab: "2026-11-08T22:30:00.000Z", grund: "abgeschnitten", anzahl: 2000 });
  ok(/Formular mit der Kennung 789: mehr Leads, als auf einmal abrufbar sind \(2000\) — nur die neuesten sind geholt\. Den Rest bitte im Lead-Motor über „Rückstand nachholen“ ab dem 08\.11\.2026 holen\./.test(zAb), `Rückstand-Zeile (abgeschnitten, Berliner Tag): ${zAb}`);
  // F5: die Formular-Kennungen im Motiv — wo auch immer Meta sie ablegt
  const motiv = {
    object_story_spec: { page_id: "1", link_data: { call_to_action: { type: "SIGN_UP", value: { lead_gen_form_id: "1000001" } } }, video_data: { call_to_action: { value: { lead_gen_form_id: 1000002 } } } },
    asset_feed_spec: { call_to_actions: [{ value: { lead_gen_form_id: "1000003" } }, { value: { lead_gen_form_id: "1000001" } }], titles: [{ text: "lead_gen_form_id" }] },
  };
  gleich(M.formularIdsAusMotiv(motiv).sort().join(), "1000001,1000002,1000003", "Formular-Kennungen aus object_story_spec (link/video) und asset_feed_spec, ohne Doppelte");
  ok(M.formularIdsAusMotiv(null).length === 0 && M.formularIdsAusMotiv({ lead_gen_form_id: "abc" }).length === 0, "nichts oder Unsinn → keine Kennung");
  const { META_FASSUNG2_NAMEN } = await import("../shared/fiaon-lead-weg");
  const waNamen = Object.values(META_FASSUNG2_NAMEN) as string[];
  ok(M.formularMitWaSatz(META_FASSUNG2_NAMEN.kapital, waNamen) && M.formularMitWaSatz("FIAON Global · Kapital · WhatsApp", waNamen) && !M.formularMitWaSatz("FIAON Global · Kapital · drei Fragen", waNamen), "WhatsApp-Satz: Fassung 2 oder „WhatsApp“ im Namen — sonst alte Fassung");
  const formulare = new Map<string, string | null>([
    ["2000001", "FIAON Global · Kapital · drei Fragen"], ["2000002", META_FASSUNG2_NAMEN.kapital], ["2000003", "FIAON Kreditkarte Prüfstand"], ["2000004", null],
  ]);
  const anz = (id: string, name: string, status: string, form: string, adset?: Record<string, unknown>) => ({ id, name, effective_status: status, ...(adset ? { adset } : {}), creative: { object_story_spec: { link_data: { call_to_action: { value: { lead_gen_form_id: form } } } } } });
  const jMs = jetzt.getTime();
  const alt = M.alteFassungAnzeigen([
    anz("A1", "Prüfanzeige alt", "ACTIVE", "2000001"), anz("A2", "Prüfanzeige neu", "ACTIVE", "2000002"), anz("A3", "Prüfanzeige pausiert", "PAUSED", "2000001"),
    anz("A4", "Prüfanzeige Privat", "ACTIVE", "2000003"), anz("A5", "Prüfanzeige in Prüfung", "PENDING_REVIEW", "2000001"), anz("A6", "Prüfanzeige ohne Namen", "ACTIVE", "2000004"),
    anz("A7", "Prüfanzeige Gruppe läuft", "ACTIVE", "2000001", { effective_status: "ACTIVE", end_time: "2026-12-31T00:00:00+0100" }),
    anz("A8", "Prüfanzeige Gruppe abgelaufen", "ACTIVE", "2000001", { effective_status: "ACTIVE", end_time: "2026-11-01T00:00:00+0100" }),
    anz("A9", "Prüfanzeige Gruppe pausiert", "ACTIVE", "2000001", { effective_status: "PAUSED" }),
  ], formulare, { waNamen, jetztMs: jMs });
  gleich(alt.map((a) => a.anzeige).join(" | "), "Prüfanzeige alt | Prüfanzeige in Prüfung | Prüfanzeige Gruppe läuft",
    "alte Fassung: nur laufende (auch in Prüfung) Anzeigen mit einem Global-Formular ohne WhatsApp-Satz — nicht Fassung 2, nicht pausiert, nicht Privat, nicht ohne Namen, und (Nachbesserung) nicht in einer abgelaufenen oder pausierten Anzeigengruppe");
  ok(M.alteFassungAnzeigen([anz("A7", "Prüfanzeige Rückfall", "ACTIVE", "2000005")], new Map([["2000005", "Lead Form 3"]]), { waNamen, globalIds: ["2000005"], jetztMs: jMs }).length === 1, "ein Global-Formular über die Rückfall-Einstellung (andere Benennung) zählt mit");
  const st = M.anzeigenStandLesen(JSON.stringify({ am: jetzt.toISOString(), ok: true, anzeigen: 3, alt: [{ anzeigeId: "A1", anzeige: "Prüfanzeige alt", formularId: "2000001", formular: "x" }], fehler: null }));
  ok(!!st && st.ok && st.alt.length === 1 && M.anzeigenStandLesen("{kaputt") === null && M.anzeigenStandLesen(JSON.stringify({ am: "nie" })) === null, "Zwischenspeicher robust gelesen");
  const u1 = M.alteFassungUrteil(alt);
  ok(u1.an && /3 laufende Anzeigen nutzen noch die alte Formular-Fassung/.test(u1.titel) && /Die Anzeige „Prüfanzeige alt“ läuft noch mit dem Formular „FIAON Global · Kapital · drei Fragen“ OHNE WhatsApp-Satz \(alte Fassung\)/.test(u1.text),
    "eigener gelber Alarm: Titel mit der Zahl, Text mit dem NAMEN jeder Anzeige");
  ok(!M.alteFassungUrteil([]).an && M.ALTE_FASSUNG_ALARM === "lead-motor:alte-fassung", "keine alte Fassung → aus; fester Schlüssel lead-motor:alte-fassung");
  // Quelltext-Wände
  const q = lies("server/lib/fiaon-meta-leads.ts");
  const nachhol = q.split("export async function nachholLauf(")[1]?.split("\n}\n")[0] ?? "";
  ok(nachhol.indexOf("await abAnlageListe(lauf)") > 0 && nachhol.indexOf("await abAnlageListe(lauf)") < nachhol.indexOf("await formulareSuchen(lauf, jetzt)"), "F1: erst die Grundlinie, dann die Suche (ein eben gefundenes Formular gilt nie als längst nachgeholt)");
  ok(/metaLeadEinspielen\(roh, opts\.weg \?\? "meta_nachhol"/.test(nachhol) && (nachhol.split("const neuesFormular")[1] ?? "").length > 0 && !/metaLeadEinspielen\([^)]*"meta_rueckstand"/.test(nachhol), "F1: auch die Leads ab der Anlage laufen als „meta_nachhol“ (Willkommen und Dossier bleiben möglich), nie als „meta_rueckstand“");
  ok(/value: abF \}/.test(nachhol) && /const regulaer = !opts\.seit;/.test(nachhol) && /regulaer \? await formulareSuchen/.test(nachhol), "F1: je Formular das eigene Fenster; Suche und Liste nur im regulären Lauf (nicht beim Rückstand von Hand)");
  ok(/CONCAT_WS\(',', NULLIF\(value, ''\), \$\{erg\.abAnlageFormulare\.join\(","\)\}::text\)/.test(nachhol), "F1: die Liste wird atomar ergänzt (zwei Prozesse verlieren keine Kennung)");
  ok(/if \(!anlage\) \{/.test(nachhol) && nachhol.indexOf("if (!anlage) {") < nachhol.indexOf("abAnlage!.add(String(f.id));"), "Nachbesserung (Gutachten): ohne Anlage-Zeit kommt ein Formular NICHT in die Liste (nur mit Anlage)");
  ok(/if \(leads\.length >= hoechstens\) \{/.test(nachhol) && /grund: "abgeschnitten"/.test(nachhol) && /if \(regulaer && erg\.luecken\.length\) await rueckstandMelden\(erg\.luecken, lauf\);/.test(nachhol),
    "Nachbesserung (Gutachten): eine abgeschnittene Abfrage steht nie mehr still da — gelber Rückstand-Hinweis");
  ok(/opts\.weg === "meta_rueckstand" && !erg\.fehler\.length\) erg\.rueckstandErledigt = await rueckstandErledigtPruefen\(seit, jetzt, lauf\)/.test(nachhol), "… ein Rückstand von Hand ohne Fehler ab dem gemeldeten Tag schließt den Hinweis");
  const laden = q.split("export async function formulareLaden(")[1]?.split("\n}\n")[0] ?? "";
  ok(/const token = await seitenToken\(seite\);/.test(laden) && /graphAlle\(`\$\{seite\}\/leadgen_forms`[\s\S]*token,/.test(laden), "F1: Formulare der Seite mit dem SEITEN-Token (mit dem Systemnutzer-Token käme Fehler #190)");
  ok(/if \(opt\.nurNeueVoll && !istNeu && !bekannt\.get\(id\)\) \{\s*await formularSpeichern\(kurz, seite, lauf, \{ nurKopf: true \}\);/.test(laden) && /\{ nurKopf: !voll \}/.test(laden),
    "Nachbesserung (Gutachten): die schnelle Suche lädt nur neue Formulare ganz; nicht lesbar → nur der Kopf (Fragen und Einwilligung bleiben)");
  const speichern = q.split("async function formularSpeichern(")[1]?.split("\n}\n")[0] ?? "";
  const kopfZweig = speichern.split("if (opt.nurKopf) {")[1]?.split("return;")[0] ?? "";
  ok((speichern.match(/erstellt_am = COALESCE\(fiaon_meta_formulare\.erstellt_am, EXCLUDED\.erstellt_am\)/g) ?? []).length === 2 && kopfZweig.length > 100
    && !/fragen = |kaestchen = |einwilligung_schluessel = |einwilligung_von = /.test(kopfZweig.split("ON CONFLICT")[1] ?? "x"),
    "Nachbesserung (Gutachten): erstellt_am wird nachgezogen, wenn es fehlt; der Kopf-Zweig fasst Fragen, Kästchen und Einwilligung nicht an");
  const auffr = q.split("export async function anzeigenFormulareAuffrischen(")[1]?.split("\n}\n")[0] ?? "";
  ok(/graphAlle\(`\$\{konto\}\/ads`/.test(auffr) && !/methode: "POST"|methode: "DELETE"/.test(auffr) && /effective_status: JSON\.stringify\(ANZEIGEN_LAUFEND\)/.test(auffr) && /adset\{effective_status,end_time\},creative\{object_story_spec,asset_feed_spec\}/.test(auffr),
    "F5: Meta nur lesend (GET), laufende Anzeigen samt Anzeigengruppe (Status, Ende) und Motiv");
  ok(/ANZEIGEN_FORMULARE_GEFRAGT\} AND COALESCE\(value, ''\) = \$\{alt\} RETURNING key/.test(auffr) && /ANZEIGEN_ABFRAGE_MIN \* 60_000\) return null;/.test(auffr),
    "F5 (Gutachten): höchstens stündlich und ATOMAR beansprucht — beim Deploy fragt nur ein Prozess Meta");
  ok(/gespeicherteWerbekonten\(lauf\)/.test(auffr) && /export async function gespeicherteWerbekonten\(/.test(lies("server/lib/fiaon-meta-kosten.ts")), "F5: Werbekonto wie der Kostenabruf (Umgebung, sonst Einstellung meta_werbekonto) — ohne zu schreiben");
  const waechter = q.split("export async function alteFassungWaechter(")[1]?.split("\n}\n")[0] ?? "";
  ok(/if \(!neu \|\| !neu\.ok\) return null;/.test(waechter) && /stufe: "gelb"/.test(waechter) && /alarmVorbei\(ALTE_FASSUNG_ALARM/.test(waechter)
    && /if \(\(await alteFassungWaechter\(lauf\)\) === true\) aktiv\.push\("alte-fassung"\);/.test(q.split("export async function waechterLauf(")[1] ?? ""),
    "F5 (Gutachten): eigener gelber Alarm im Lauf meta_waechter; Meta-Fehler = keine Aussage (der Alarm bleibt, wie er ist — kein Flattern)");
}

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

  // E-476 Nachbesserung (Gutachten Technik, Mangel 4): eine verwaiste Beanspruchung (Prozess starb zwischen Beanspruchen und
  // Annehmen) — frisch = „in Arbeit“ (Dublette), älter als drei Minuten = neu beansprucht, der Lead kommt an.
  await sql`INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, weg, gesehen_am) VALUES (${`PRUEF${LAUF}4`}, NULL, ${formG}, 'meta_webhook', NOW())`;
  const e4a = await M.metaLeadEinspielen(lead(4, formG), "meta_nachhol", null);
  ok(e4a.status === "dublette" && !e4a.globalAnfrageId, "frische Beanspruchung ohne Ziel: „in Arbeit“ (Dublette, keine zweite Annahme)");
  await sql`UPDATE fiaon_meta_leads SET gesehen_am = NOW() - INTERVAL '5 minutes' WHERE meta_lead_id = ${`PRUEF${LAUF}4`}`;
  const e4b = await M.metaLeadEinspielen(lead(4, formG), "meta_nachhol", null);
  ok(e4b.status === "neu" && Number(e4b.globalAnfrageId) > 0, `verwaiste Beanspruchung (älter als 3 Min.): neu beansprucht, der Lead kommt an (${e4b.status})`);
  const [ml4] = (await sql`SELECT global_anfrage_id, weg FROM fiaon_meta_leads WHERE meta_lead_id = ${`PRUEF${LAUF}4`}`) as any[];
  ok(Number(ml4?.global_anfrage_id) === Number(e4b.globalAnfrageId) && ml4?.weg === "meta_nachhol", "… die Zeile trägt jetzt die Anfrage und den Weg");
  gleich(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_anfragen WHERE email = ${mail(4)}`) as any[])[0]?.n, 1, "… genau eine Anfrage");
  // Webhook und Nachhol-Lauf gleichzeitig: genau einer nimmt an.
  const [p5a, p5b] = await Promise.all([M.metaLeadEinspielen(lead(5, formG), "meta_webhook", null), M.metaLeadEinspielen(lead(5, formG), "meta_nachhol", null)]);
  ok([p5a.status, p5b.status].sort().join("+") === "dublette+neu", `gleichzeitig: einer „neu“, einer „Dublette“ (${p5a.status}+${p5b.status})`);
  gleich(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_anfragen WHERE email = ${mail(5)}`) as any[])[0]?.n, 1, "… genau eine Anfrage");
  // Ohne Mail und Telefon: eigener Weg-Wert — nie als verwaist neu versucht.
  const ohne = { ...lead(6, formG), field_data: lead(6, formG).field_data.filter((x) => x.name !== "email" && x.name !== "phone_number") };
  const e6 = await M.metaLeadEinspielen(ohne, "meta_webhook", null);
  gleich(e6.status, "ungueltig", "Global-Formular ohne Mail und Telefon: ungültig");
  await sql`UPDATE fiaon_meta_leads SET gesehen_am = NOW() - INTERVAL '1 hour' WHERE meta_lead_id = ${`PRUEF${LAUF}6`}`;
  const [ml6] = (await sql`SELECT weg FROM fiaon_meta_leads WHERE meta_lead_id = ${`PRUEF${LAUF}6`}`) as any[];
  gleich(ml6?.weg, M.META_UNGUELTIG, "… Weg „meta_ungueltig“");
  gleich((await M.metaLeadEinspielen(ohne, "meta_nachhol", null)).status, "dublette", "… und der Nachhol-Lauf versucht ihn nicht alle fünf Minuten neu");

  // Kampagnen-Rückfall: Formular unbekannt (Meta liefert den Namen nicht), Kampagne heißt „FIAON Global …“
  const e2 = await M.metaLeadEinspielen({ ...lead(2, `UNBEKANNT${LAUF}`, "FIAON Global · US-Gründung · Okt") }, "meta_webhook", null);
  ok(Number(e2.globalAnfrageId) > 0 && e2.leadId === null, "Kampagne „FIAON Global …“ → Global, auch ohne Formularnamen");

  // Rot-Probe: Privat-Formular läuft unverändert über processIntake
  const e3 = await M.metaLeadEinspielen(lead(3, formP), "meta_webhook", null);
  ok(e3.leadId !== null && !e3.globalAnfrageId, "Privat-Formular wird weiter ein Privat-Lead");
  const g3 = (await sql`SELECT id FROM fiaon_anfragen WHERE email = ${mail(3)}`) as any[];
  gleich(g3.length, 0, "Privat-Formular erzeugt keine Global-Anfrage");

  // ── B2/B3 E-490: ein SCHEIN-Meta im Prozess ───────────────────────────────────────────────────────────────────────
  // Erfundene Schlüssel erst JETZT (die Schlüssel-Wand oben hat echte ausgeschlossen); META_GRAPH_URL zeigt auf eine
  // .invalid-Adresse, jede Anfrage beantwortet dieser Prozess selbst — nichts verlässt den Rechner (alles andere: gesperrt).
  // Nachbesserung (Gutachten, Rotprobe M21/M22): Das Schein-Meta liefert wie das echte NUR die angefragten Felder (`fields`, auch
  // verschachtelt wie legal_content{custom_disclaimer}) und filtert Anzeigen nach `effective_status`.
  const MF = await import("../server/lib/fiaon-meta");
  const SEITE = `PRUEFSEITE${LAUF}`;
  const KONTO = "act_900000001";
  const t0 = new Date();
  const vor = (min: number, von: Date = t0) => new Date(von.getTime() - min * 60_000).toISOString();
  const nach = (min: number) => new Date(t0.getTime() + min * 60_000);
  const formNeu = `PRUEFN${LAUF}`, formAlt = `PRUEFA${LAUF}`, formFehl = `PRUEFF${LAUF}`, formOhne = `PRUEFO${LAUF}`;
  const { META_FASSUNG2_NAMEN } = await import("../shared/fiaon-lead-weg");
  const FRAGEN = [{ key: "email", label: "E-Mail", type: "EMAIL" }, { key: "phone_number", label: "Telefon", type: "PHONE" }];
  const metaFormulare: any[] = [
    { id: formG, name: "FIAON Global · US-Gesellschaft · drei Fragen", status: "ACTIVE", locale: "de_DE", created_time: vor(60 * 24 * 10) },
    { id: formP, name: "FIAON Kreditkarte Prüfstand", status: "ACTIVE", locale: "de_DE", created_time: vor(60 * 24 * 20) },
    { id: formNeu, name: META_FASSUNG2_NAMEN.us, status: "ACTIVE", locale: "de_DE", created_time: vor(180) },
  ];
  const nurEinzeln: any[] = [];
  // Zwei Leads des neuen Formulars — 2:50 und 2:00 Stunden alt, also VOR dem normalen Fenster (Stand minus 10 Minuten).
  const metaLeads: Record<string, any[]> = { [formNeu]: [{ ...lead(11, formNeu), created_time: vor(170) }, { ...lead(12, formNeu), created_time: vor(120) }] };
  let anzeigen: any[] = [];
  const gestoert = new Set<string>();
  const aufrufe: { pfad: string; token: string; ab: number | null; fields: string | null }[] = [];
  // Ein Feld-Baum aus „id,name,legal_content{custom_disclaimer},adset{effective_status,end_time}“.
  const feldBaum = (roh: string): Record<string, any> => {
    const baum: Record<string, any> = {};
    let i = 0;
    const lies = (ziel: Record<string, any>) => {
      let name = "";
      while (i < roh.length) {
        const c = roh[i++];
        if (c === ",") { if (name.trim()) ziel[name.trim()] = true; name = ""; }
        else if (c === "{") { const sub: Record<string, any> = {}; lies(sub); ziel[name.trim()] = sub; name = ""; }
        else if (c === "}") { if (name.trim()) ziel[name.trim()] = true; return; }
        else name += c;
      }
      if (name.trim()) ziel[name.trim()] = true;
    };
    lies(baum);
    return baum;
  };
  const nurFelder = (x: any, baum: Record<string, any> | null): any => {
    if (!baum || x === null || typeof x !== "object") return x;
    if (Array.isArray(x)) return x.map((y) => nurFelder(y, baum));
    const aus: Record<string, any> = {};
    for (const [k, v] of Object.entries(baum)) if (k in x) aus[k] = v === true ? x[k] : nurFelder(x[k], v);
    return aus;
  };
  const echtesFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    const u = new URL(String(input?.url ?? input));
    if (u.hostname !== "meta.pruefstand.invalid") throw new Error(`Prüfstand: Netz gesperrt (${u.hostname})`);
    const pfad = u.pathname.replace(/^\/v[0-9.]+\//, "");
    const filt = u.searchParams.get("filtering");
    const ab = filt ? Number(JSON.parse(filt)?.[0]?.value) : null;
    const fields = u.searchParams.get("fields");
    aufrufe.push({ pfad, token: String(u.searchParams.get("access_token") ?? ""), ab, fields });
    const baum = fields ? feldBaum(fields) : null;
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "Content-Type": "application/json" } });
    const liste = (data: any[]) => json({ data: nurFelder(data, baum) });
    if (gestoert.has(pfad)) return json({ error: { message: "Prüfstand: gestört", code: 100, error_subcode: 33 } }, 400);
    if (pfad === SEITE && fields === "access_token") return json({ access_token: "pruef-seiten-token" });
    if (pfad === `${SEITE}/leadgen_forms`) return liste(metaFormulare);
    if (pfad === `${KONTO}/ads`) {
      const status = new Set<string>(JSON.parse(u.searchParams.get("effective_status") ?? "null") ?? []);
      return liste(anzeigen.filter((a) => !status.size || status.has(String(a.effective_status))));
    }
    const lm = pfad.match(/^([A-Za-z0-9_]+)\/leads$/);
    if (lm) return liste((metaLeads[lm[1]] ?? []).filter((l) => ab === null || Date.parse(l.created_time) / 1000 > ab));
    const f = [...metaFormulare, ...nurEinzeln].find((x) => x.id === pfad);
    if (f) return json(nurFelder({ ...f, questions: f.questions ?? FRAGEN, legal_content: { custom_disclaimer: { checkboxes: [] } } }, baum));
    return json({ error: { message: `Prüfstand: unbekannt ${pfad}`, code: 100, error_subcode: 33 } }, 400);
  }) as typeof fetch;
  const zuvor = { id: process.env.META_APP_ID, geheim: process.env.META_APP_SECRET, token: process.env.META_SYSTEM_TOKEN, url: process.env.META_GRAPH_URL };
  process.env.META_APP_ID = "pruef-app"; process.env.META_APP_SECRET = "pruef-geheim"; process.env.META_SYSTEM_TOKEN = "pruef-system";
  process.env.META_GRAPH_URL = "http://meta.pruefstand.invalid";
  MF.seitenTokensVergessen();
  const setze = (k: string, v: string) => sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${v}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  const wert = async (k: string) => String(((await sql`SELECT value FROM fiaon_settings WHERE key = ${k}`) as any[])[0]?.value ?? "");
  const leadsAufruf = (form: string) => aufrufe.filter((a) => a.pfad === `${form}/leads`).at(-1);
  const alarm = async (k: string) => ((await sql`SELECT stufe, titel, text, vorbei_am, endet_nach_stunden FROM fiaon_system_alarme WHERE schluessel = ${k}`.catch(() => [])) as any[])[0];
  const formZeile = async (id: string) => ((await sql`SELECT name, erstellt_am, fragen, einwilligung_schluessel FROM fiaon_meta_formulare WHERE id = ${id}`) as any[])[0];
  const fragenZahl = (v: unknown) => { let o: any = v; if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } } return Array.isArray(o) ? o.length : 0; };
  try {
    abschnitt("B2 E-490 F1: der Nachhol-Lauf findet ein neues Formular selbst und holt ab der Anlage (Schein-Meta)");
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${[M.META_FORMULARE_AB_ANLAGE, M.META_FORMULARE_GESUCHT, M.ANZEIGEN_FORMULARE_STAND, M.ANZEIGEN_FORMULARE_GEFRAGT, M.META_RUECKSTAND_AB]})`;
    const { alarmVorbei } = await import("../server/lib/fiaon-system-alarme");
    await alarmVorbei(M.RUECKSTAND_ALARM, "Prüfstand: Neubeginn"); await alarmVorbei(M.ALTE_FASSUNG_ALARM, "Prüfstand: Neubeginn");
    await setze(M.META_SEITEN, SEITE);
    await setze(M.META_NACHHOL_BIS, vor(5));
    await sql`UPDATE fiaon_meta_formulare SET erstellt_am = NOW() - INTERVAL '10 days', seite_id = ${SEITE} WHERE id IN (${formG}, ${formP})`;

    const e1 = await M.nachholLauf({ jetzt: t0 });
    ok(e1.fehler.length === 0, `erster Lauf ohne Fehler (${e1.fehler.join(" · ")})`);
    ok(new Set(M.kennungsListe(await wert(M.META_FORMULARE_AB_ANLAGE))).has(formG), "Grundlinie: die Formulare von vorher gelten als nachgeholt (kein Altbestand wird neu geholt)");
    ok(e1.suche?.gesucht === true && e1.suche.neu === 1, `die Suche lief und fand EIN neues Formular (${JSON.stringify(e1.suche)})`);
    const lf = aufrufe.find((a) => a.pfad === `${SEITE}/leadgen_forms`);
    ok(!!lf && lf.token === "pruef-seiten-token", "die Formulare der Seite mit dem SEITEN-Token (nicht dem Systemnutzer-Token — sonst Fehler #190)");
    ok(e1.abAnlage === 1 && e1.abAnlageFormulare.join() === formNeu && e1.luecken.length === 0, "das neue Formular wurde ab der Anlage gefragt (jung — keine Lücke)");
    const erstellt = Date.parse(metaFormulare[2].created_time);
    gleich(leadsAufruf(formNeu)?.ab, Math.floor((erstellt - 60_000) / 1000), "… ab created_time (eine Minute Spielraum)");
    gleich(leadsAufruf(formG)?.ab, Math.floor((Date.parse(vor(5)) - 10 * 60_000) / 1000), "ein bekanntes Formular: das normale Fenster (Stand minus 10 Minuten)");
    ok(e1.neu === 2, `beide Leads des neuen Formulars angelegt — sie lagen VOR dem normalen Fenster (neu: ${e1.neu})`);
    const wege = (await sql`SELECT meta_lead_id, weg, global_anfrage_id FROM fiaon_meta_leads WHERE meta_lead_id IN (${`PRUEF${LAUF}11`}, ${`PRUEF${LAUF}12`}) ORDER BY 1`) as any[];
    ok(wege.length === 2 && wege.every((w) => w.weg === "meta_nachhol" && Number(w.global_anfrage_id) > 0), "… mit dem Weg „meta_nachhol“ (nie „meta_rueckstand“ — sonst kein Willkommen, kein Dossier), je eine Global-Anfrage");
    ok(M.kennungsListe(await wert(M.META_FORMULARE_AB_ANLAGE)).includes(formNeu), "das Formular steht jetzt in der Liste „ab der Anlage geholt“");
    const zNeu = await formZeile(formNeu);
    ok(!!zNeu?.erstellt_am && fragenZahl(zNeu?.fragen) === 2, "das neue Formular wurde GANZ geladen (Anlage-Zeit und Fragen — mit den angefragten Feldern)");
    const listenAufruf = aufrufe.find((a) => a.pfad === `${SEITE}/leadgen_forms`)?.fields ?? "";
    const zG = await formZeile(formG);
    ok(listenAufruf === "id,name,status,locale,created_time" && aufrufe.some((a) => a.pfad === formG) && fragenZahl(zG?.fragen) === 2,
      "die Suche fragt die Liste mit created_time; ein bekanntes Formular OHNE Fragen lädt sie einmal ganz nach");
    const einzelG = () => aufrufe.filter((a) => a.pfad === formG).length;
    const einzelGVorher = einzelG();

    const e2 = await M.nachholLauf({ jetzt: nach(5) });
    ok(e2.suche?.gesucht === false && e2.abAnlage === 0, "fünf Minuten später: keine neue Suche (alle 15 Minuten), kein zweites Holen ab der Anlage");
    ok((leadsAufruf(formNeu)?.ab ?? 0) > Math.floor(erstellt / 1000) + 3600, "… das Formular läuft jetzt im normalen Fenster");
    ok(e2.neu === 0, "keine Dublette angelegt");

    // Nachbesserung (Gutachten): Ein ALTES Formular, das erst spät gefunden wird (z. B. eine weitere Seite), holt der Lauf von
    // selbst nur 3 Tage zurück — der Rest kommt als gelber Hinweis mit dem Tag für „Rückstand nachholen“.
    metaFormulare.push({ id: formAlt, name: "FIAON Global · Kapital · drei Fragen", status: "ACTIVE", locale: "de_DE", created_time: vor(60 * 24 * 120) });
    metaLeads[formAlt] = [
      { ...lead(13, formAlt), created_time: vor(60 * 24 * 100) }, { ...lead(14, formAlt), created_time: vor(60 * 24 * 30) }, { ...lead(16, formAlt), created_time: vor(60 * 24 * 2) },
    ];
    const t3 = nach(61);
    const e3 = await M.nachholLauf({ jetzt: t3 });
    ok(e3.suche?.gesucht === true && e3.abAnlageFormulare.includes(formAlt), "eine Stunde später sucht der Lauf wieder und findet das späte Formular");
    ok(einzelG() === einzelGVorher, "… ein bekanntes Formular MIT Fragen lädt die schnelle Suche nicht mehr einzeln (nur der Kopf aus der Liste — ein Aufruf je Seite)");
    gleich(leadsAufruf(formAlt)?.ab, Math.floor((t3.getTime() - 3 * 86_400_000) / 1000), "… von selbst höchstens 3 Tage zurück (vorher 89 — alte Leads wären als frische Anfragen gekommen)");
    ok(e3.neu === 1, `… nur der Lead der letzten 3 Tage (neu: ${e3.neu}) — der 30 und der 100 Tage alte NICHT`);
    const l3 = e3.luecken.find((l) => l.formularId === formAlt);
    ok(!!l3 && l3.grund === "aelter" && Math.abs(Date.parse(l3.ab) - (t3.getTime() - 89 * 86_400_000)) < 1000, `die Lücke: älteres Formular, „Rückstand nachholen“ ab 89 Tagen zurück (Meta hält 90) (${JSON.stringify(l3)})`);
    const r3 = await alarm(M.RUECKSTAND_ALARM);
    ok(r3?.stufe === "gelb" && !r3?.vorbei_am && /„FIAON Global · Kapital · drei Fragen“/.test(String(r3?.text)) && /Rückstand nachholen“ ab dem/.test(String(r3?.text)) && Number(r3?.endet_nach_stunden) === M.RUECKSTAND_ALARM_STUNDEN,
      `gelber Hinweis im Lagezimmer mit Formular und Tag (${String(r3?.text).slice(0, 160)})`);
    ok(Math.abs(Date.parse(await wert(M.META_RUECKSTAND_AB)) - Date.parse(l3?.ab ?? "")) < 1000, "… und der Merker, ab welchem Tag der Rückstand alles schließt");

    // Scheitert das Holen ab der Anlage, bleibt das Formular offen — der nächste Lauf holt es nach.
    metaFormulare.push({ id: formFehl, name: "FIAON Global · US-Gesellschaft · drei Fragen", status: "ACTIVE", locale: "de_DE", created_time: vor(60) });
    metaLeads[formFehl] = [{ ...lead(15, formFehl), created_time: vor(55) }];
    gestoert.add(`${formFehl}/leads`);
    const standVorher = await wert(M.META_NACHHOL_BIS);
    const e4 = await M.nachholLauf({ jetzt: nach(122) });
    ok(e4.fehler.some((x) => x.includes(formFehl)) && !e4.abAnlageFormulare.includes(formFehl) && !M.kennungsListe(await wert(M.META_FORMULARE_AB_ANLAGE)).includes(formFehl), "Meta-Fehler beim neuen Formular → es bleibt offen (nicht in der Liste)");
    gleich(await wert(M.META_NACHHOL_BIS), standVorher, "… und der gemerkte Stand rückt nicht vor (keine Lücke)");
    gestoert.delete(`${formFehl}/leads`);
    const e5 = await M.nachholLauf({ jetzt: nach(127) });
    ok(e5.abAnlageFormulare.includes(formFehl) && e5.neu === 1 && e5.suche?.gesucht === false, "der nächste Lauf holt es ab der Anlage nach (ohne neue Suche — es steht schon in der Tabelle)");

    // Nachbesserung (Gutachten): Ein neues Formular OHNE Anlage-Zeit kommt nicht still in die Liste — erst, wenn die Zeit da ist.
    metaFormulare.push({ id: formOhne, name: "FIAON Global · US-Gesellschaft · ohne Zeit", status: "ACTIVE", locale: "de_DE" });
    metaLeads[formOhne] = [{ ...lead(17, formOhne), created_time: vor(150) }];
    const e6a = await M.nachholLauf({ jetzt: nach(140) });
    ok(e6a.suche?.gesucht === true && !e6a.abAnlageFormulare.includes(formOhne) && !M.kennungsListe(await wert(M.META_FORMULARE_AB_ANLAGE)).includes(formOhne) && !(await formZeile(formOhne))?.erstellt_am,
      "Meta nennt keine Anlage-Zeit → das Formular läuft im normalen Fenster und steht NICHT in der Liste");
    metaFormulare[metaFormulare.length - 1] = { ...metaFormulare[metaFormulare.length - 1], created_time: vor(160) };
    const e6b = await M.nachholLauf({ jetzt: nach(156) });
    ok(!!(await formZeile(formOhne))?.erstellt_am && e6b.abAnlageFormulare.includes(formOhne) && leadsAufruf(formOhne)?.ab === Math.floor((Date.parse(vor(160)) - 60_000) / 1000),
      "… die nächste Suche zieht die Anlage-Zeit nach (erstellt_am war leer), und der Lauf holt ab der Anlage");

    // Ein Lead eines UNBEKANNTEN Formulars (Webhook/Danke-Knopf vor der Suche): das Formular wird einzeln geladen — mit Anlage-Zeit
    // (Rotprobe M21: fehlte created_time in formularLesen, bliebe erstellt_am leer, und das Formular würde nie ab der Anlage geholt).
    const formEinzeln = `PRUEFE${LAUF}`;
    nurEinzeln.push({ id: formEinzeln, name: "FIAON Global · Kapital · drei Fragen", status: "ACTIVE", locale: "de_DE", created_time: vor(30) });
    const e7 = await M.metaLeadEinspielen({ ...lead(18, formEinzeln) }, "meta_webhook", SEITE);
    const zE = await formZeile(formEinzeln);
    ok(e7.status === "neu" && !!zE?.erstellt_am && Math.abs(new Date(zE.erstellt_am).getTime() - Date.parse(vor(30))) < 1000 && fragenZahl(zE?.fragen) === 2,
      "ein unbekanntes Formular eines ankommenden Leads wird ganz geladen — mit Anlage-Zeit und Fragen (nur angefragte Felder)");

    // Nachbesserung (Gutachten): Ist das volle Formular nicht lesbar, überschreibt die Kurzfassung Fragen und Einwilligung NICHT.
    await sql`UPDATE fiaon_meta_formulare SET einwilligung_schluessel = 'kontakt_ok', einwilligung_von = 'erkannt' WHERE id = ${formNeu}`;
    gestoert.add(formNeu);
    await M.formulareLaden();
    gestoert.delete(formNeu);
    const zN2 = await formZeile(formNeu);
    ok(fragenZahl(zN2?.fragen) === 2 && zN2?.einwilligung_schluessel === "kontakt_ok" && zN2?.name === META_FASSUNG2_NAMEN.us,
      "„Formulare neu laden“, das volle Formular scheitert → nur der Kopf: Fragen und Einwilligung bleiben stehen (vorher leer bis zum nächsten Laden)");

    // Der Rückstand von Hand: kein Suchen, keine Liste — und ab einem zu SPÄTEN Tag bleibt der Hinweis offen.
    const listeVorher = await wert(M.META_FORMULARE_AB_ANLAGE);
    const gefragtVorher = aufrufe.filter((a) => a.pfad === `${SEITE}/leadgen_forms`).length;
    const e8 = await M.nachholLauf({ seit: new Date(t0.getTime() - 86_400_000), weg: "meta_rueckstand", jetzt: nach(200) });
    ok(e8.suche === null && e8.abAnlage === 0 && (await wert(M.META_FORMULARE_AB_ANLAGE)) === listeVorher && aufrufe.filter((a) => a.pfad === `${SEITE}/leadgen_forms`).length === gefragtVorher,
      "Rückstand von Hand: sucht nicht, führt die Liste nicht (unverändert wie vor E-490)");
    ok(!e8.rueckstandErledigt && !(await alarm(M.RUECKSTAND_ALARM))?.vorbei_am, "… ab gestern: der gelbe Hinweis bleibt (der Tag reicht nicht zurück)");
    const e9 = await M.nachholLauf({ seit: new Date(t0.getTime() - 100 * 86_400_000), weg: "meta_rueckstand", jetzt: nach(201) });
    const [w14] = (await sql`SELECT weg FROM fiaon_meta_leads WHERE meta_lead_id = ${`PRUEF${LAUF}14`}`) as any[];
    ok(e9.rueckstandErledigt && !!(await alarm(M.RUECKSTAND_ALARM))?.vorbei_am && !(await wert(M.META_RUECKSTAND_AB)) && w14?.weg === "meta_rueckstand",
      "… ab einem Tag weit genug zurück: der 30 Tage alte Lead kommt als „meta_rueckstand“, der Hinweis geht aus, der Merker ist leer");

    abschnitt("B3 E-490 F5: welche LAUFENDE Anzeige nutzt noch die alte Formular-Fassung? (Schein-Meta, eigener Alarm)");
    await setze("meta_werbekonto", KONTO);
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${[M.ANZEIGEN_FORMULARE_STAND, M.ANZEIGEN_FORMULARE_GEFRAGT]})`;
    // Meta-Kennungen sind Ziffern — die Anzeigen-Abfrage nimmt nur solche (Unsinn im Motiv zählt nie).
    const ziffern = String(parseInt(LAUF, 16)).padStart(8, "0");
    const fAlt = `97${ziffern}1`, fNeu2 = `97${ziffern}2`;
    const fUnb = `97${ziffern}3`;
    await sql`INSERT INTO fiaon_meta_formulare (id, seite_id, name, status, geladen_am) VALUES
      (${fAlt}, ${SEITE}, 'FIAON Global · US-Gesellschaft · drei Fragen', 'ACTIVE', NOW()),
      (${fNeu2}, ${SEITE}, ${META_FASSUNG2_NAMEN.kapital}, 'ACTIVE', NOW()) ON CONFLICT (id) DO NOTHING`;
    nurEinzeln.push({ id: fUnb, name: "FIAON Global · Kapital · drei Fragen", status: "ACTIVE", created_time: vor(60 * 24 * 5) });
    const cta = (form: string) => ({ object_story_spec: { link_data: { call_to_action: { value: { lead_gen_form_id: form } } } } });
    anzeigen = [
      { id: "A1", name: `Prüfanzeige alt ${LAUF}`, effective_status: "ACTIVE", adset: { effective_status: "ACTIVE" }, creative: cta(fAlt), tracking_specs: "darf nicht mitkommen" },
      { id: "A2", name: `Prüfanzeige Fassung 2 ${LAUF}`, effective_status: "ACTIVE", creative: cta(fNeu2) },
      { id: "A3", name: `Prüfanzeige pausiert ${LAUF}`, effective_status: "PAUSED", creative: cta(fAlt) },
      { id: "A4", name: `Prüfanzeige dynamisch ${LAUF}`, effective_status: "WITH_ISSUES", creative: { asset_feed_spec: { call_to_actions: [{ value: { lead_gen_form_id: fUnb } }] } } },
      { id: "A5", name: `Prüfanzeige Gruppe abgelaufen ${LAUF}`, effective_status: "ACTIVE", adset: { effective_status: "ACTIVE", end_time: vor(60 * 24) }, creative: cta(fAlt) },
    ];
    const waNamen = Object.values(META_FASSUNG2_NAMEN) as string[];
    const adsAufrufe = () => aufrufe.filter((a) => a.pfad === `${KONTO}/ads`).length;
    const r1 = await M.alteFassungInAnzeigen(sql, { waNamen, jetzt: t0 });
    gleich((r1 ?? []).map((a) => a.anzeige).sort().join(" | "), [`Prüfanzeige alt ${LAUF}`, `Prüfanzeige dynamisch ${LAUF}`].sort().join(" | "),
      "gemeldet: die laufenden Anzeigen mit einem Global-Formular OHNE WhatsApp-Satz — nicht die Fassung 2, nicht die pausierte, nicht die in einer abgelaufenen Anzeigengruppe");
    const adsFelder = aufrufe.filter((a) => a.pfad === `${KONTO}/ads`).at(-1)?.fields ?? "";
    ok(/adset\{effective_status,end_time\}/.test(adsFelder) && /creative\{object_story_spec,asset_feed_spec\}/.test(adsFelder), `die Abfrage fragt Anzeigengruppe (Status, Ende) und Motiv ausdrücklich an (${adsFelder})`);
    ok(!!(await sql`SELECT 1 FROM fiaon_meta_formulare WHERE id = ${fUnb}`.then((r: any) => r[0])), "ein unbekanntes Formular einer Anzeige wurde geladen wie beim Eingang (Seiten-Token)");
    const st1 = M.anzeigenStandLesen(await wert(M.ANZEIGEN_FORMULARE_STAND));
    ok(!!st1 && st1.ok && st1.alt.length === 2 && st1.anzeigen === 4, `Zwischenspeicher geschrieben (Meta filterte die pausierte Anzeige selbst: ${st1?.anzeigen} Anzeigen, 2 Treffer)`);
    const n1 = adsAufrufe();
    const r2 = await M.alteFassungInAnzeigen(sql, { waNamen, jetzt: nach(59) });
    ok(adsAufrufe() === n1 && (r2 ?? []).length === 2, "59 Minuten später: aus dem Zwischenspeicher, KEIN neuer Aufruf bei Meta (höchstens stündlich)");
    // Atomar beansprucht: zwei Prozesse gleichzeitig (Deploy) → genau EIN Aufruf bei Meta.
    const [p1, p2] = await Promise.all([M.anzeigenFormulareAuffrischen(sql, { waNamen, jetzt: nach(61) }), M.anzeigenFormulareAuffrischen(sql, { waNamen, jetzt: nach(61) })]);
    ok(adsAufrufe() === n1 + 1 && [p1, p2].filter(Boolean).length === 1, "zwei gleichzeitige Abfragen (beim Deploy) → genau EIN Aufruf bei Meta (atomar beansprucht)");

    // Der EIGENE gelbe Alarm (meta_waechter): an mit den Namen, bei Meta-Fehler unverändert, nach dem Tausch aus.
    const w1 = await M.alteFassungWaechter(sql, { jetzt: nach(62), immer: true });
    const af1 = await alarm(M.ALTE_FASSUNG_ALARM);
    ok(w1 === true && af1?.stufe === "gelb" && !af1?.vorbei_am && new RegExp(`Prüfanzeige alt ${LAUF}`).test(String(af1?.text)), "eigener gelber Alarm „alte Formular-Fassung“ mit dem Namen der Anzeige");
    gestoert.add(`${KONTO}/ads`);
    const w2 = await M.alteFassungWaechter(sql, { jetzt: nach(63), immer: true });
    const af2 = await alarm(M.ALTE_FASSUNG_ALARM);
    const st2 = M.anzeigenStandLesen(await wert(M.ANZEIGEN_FORMULARE_STAND));
    ok(w2 === null && !af2?.vorbei_am && !!st2 && !st2.ok && !!st2.fehler, "Meta-Fehler → keine Aussage: der Alarm bleibt an (kein Flattern), der Fehler steht im Zwischenspeicher");
    ok((await M.alteFassungInAnzeigen(sql, { waNamen, jetzt: nach(70) })) === null, "… alteFassungInAnzeigen sagt dann „keine Aussage“ (null)");
    const n4 = adsAufrufe();
    ok((await M.alteFassungWaechter(sql, { jetzt: nach(75) })) === null && adsAufrufe() === n4, "… und Meta wird nicht alle 15 Minuten neu gefragt (höchstens stündlich)");
    gestoert.delete(`${KONTO}/ads`);
    anzeigen = anzeigen.map((a) => (a.id === "A1" ? { ...a, creative: cta(fNeu2) } : a.id === "A4" ? { ...a, effective_status: "PAUSED" } : a));
    const w3 = await M.alteFassungWaechter(sql, { jetzt: nach(130) });
    ok(w3 === false && !!(await alarm(M.ALTE_FASSUNG_ALARM))?.vorbei_am, "nach dem Tausch (eine Stunde später neu gefragt): der Alarm geht von selbst aus — ohne 24 Stunden Fehlalarm");
    await sql`DELETE FROM fiaon_settings WHERE key = 'meta_werbekonto'`;
    ok((await M.alteFassungInAnzeigen(sql, { waNamen, jetzt: nach(200), immer: true })) === null && (await M.alteFassungWaechter(sql, { jetzt: nach(201), immer: true })) === null, "ohne Werbekonto → keine Aussage (der Alarm bleibt, wie er ist)");
  } finally {
    globalThis.fetch = echtesFetch;
    for (const [k, v] of [["META_APP_ID", zuvor.id], ["META_APP_SECRET", zuvor.geheim], ["META_SYSTEM_TOKEN", zuvor.token], ["META_GRAPH_URL", zuvor.url]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    MF.seitenTokensVergessen();
  }

  await sql.end?.();
} else {
  console.log("\n(B übersprungen — keine lokale Prüfdatenbank in DATABASE_URL)");
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen grün.`);
process.exit(fehler ? 1 : 0);
