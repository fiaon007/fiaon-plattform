// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM — DIE RAUMTOUR AUF DEM SERVER (E-489, 09.11.2026)
//
// Justin: „er soll durch die Räume geführt werden wie bei einer 3D-Tour."
//
//   · Bühnen für den Gast (GET /api/fiaon/datenraum/buehnen): NUR nach unterzeichneter Vereinbarung und nur für
//     die Themen, die sie in ihrer heutigen Fassung deckt — dieselbe Regel und dieselbe Abdeckung wie für Dokumente
//     (fiaon-datenraum-tour-regeln.ts, drAbgedeckteProjekte in fiaon-datenraum.ts). Protokoll nur über drProtokoll (Kette).
//   · Bühne speichern (scripts/datenraum.ts raum-anlegen → projekte[].buehne): geprüft mit drBuehnePruefen.
//   · Anfragen aus dem Raum (POST /api/fiaon/datenraum/anfrage): „Vertragsentwurf anfordern“ und „Frage stellen“ →
//     Zugriffsprüfung, Bremse, Protokollzeile, Meldung an Justin über den Mailweg des Datenraums (Brevo; mit
//     DATENRAUM_MAILS=aus abgeschaltet). Antworten auf die Meldung gehen direkt an den Gast.
//
// Die Spalte fiaon_dr_projekte.buehne legt drSchema() in fiaon-datenraum.ts an (wie jede andere Spalte).
// Inhalte nur in der Datenbank — das Repo ist öffentlich.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { drAbgedeckteProjekte, drProtokoll, drSchema, drStandardSender, type drSitzungGast, type DrKontext, type DrSender } from "./fiaon-datenraum";
import { drAnfrageGebremst, drAnfrageZugriff, drBuehnenFreigeben, DR_ANFRAGE_BREMSE, type DrTourLage } from "./fiaon-datenraum-tour-regeln";
import { drAnfragePruefen, drBuehneKurz, drBuehnePruefen, type DrBuehne } from "@shared/fiaon-datenraum-buehne";
import { NDA_FIAON, drVollName } from "@shared/fiaon-datenraum-nda";

type Lauf = any;
type Gast = NonNullable<Awaited<ReturnType<typeof drSitzungGast>>>;
type Erg<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; status: number; error: string; code?: string };
const nein = (status: number, error: string, code?: string) => ({ ok: false as const, status, error, ...(code ? { code } : {}) });
const zahl = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
function jsonWert(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && !Buffer.isBuffer(v)) return v;
  try { const x = JSON.parse(String(v)); return typeof x === "string" ? JSON.parse(x) : x; } catch { return null; }
}
const escHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Die Texte der Protokoll-Arten der Tour (Rundgang geöffnet, Vertragsentwurf angefordert …) stehen in DR_PROTOKOLL_TEXT
// in fiaon-datenraum.ts — Akte und CSV kennen sie dann auch, wenn dieses Modul nicht geladen ist.

/**
 * Die Projekte, die der Gast heute offen hat — null = noch keine Vereinbarung. DIESELBE Abdeckung wie bei Dokumenten
 * (Projekt-Nr. + Prüfsumme der §-1-Fassung): Ändert sich ein Thema nach der Unterschrift, ist auch seine Bühne zu, bis
 * der Gast den Nachtrag unterschreibt (vorher hing die Tour nur an der Projekt-Nr. und zeigte die Bühne weiter).
 */
const ndaProjekte = (g: Gast) => drAbgedeckteProjekte(g.id, g.raumId);
const lageVon = (g: Gast, nda: number[] | null): DrTourLage => ({ angemeldet: true, gastRaumId: g.raumId, gastGesperrt: g.gesperrt, raumArchiviert: g.raumArchiviert, ndaProjektIds: nda });

// ═══════════════════════════════════════════════════════════════════════════
// BÜHNEN FÜR DEN GAST
// ═══════════════════════════════════════════════════════════════════════════
export async function drBuehnenFuerGast(g: Gast, ctx: DrKontext): Promise<Erg<{ buehnen: Record<string, DrBuehne> }>> {
  await drSchema();
  const nda = await ndaProjekte(g);
  if (!nda) return nein(403, "Bitte unterzeichnen Sie zuerst die Vertraulichkeitsvereinbarung.", "NDA");
  const zeilen = (await sqlPool`
    SELECT id, buchstabe, buehne FROM fiaon_dr_projekte WHERE raum_id = ${g.raumId} AND entfernt_am IS NULL ORDER BY length(buchstabe), buchstabe, id`) as any[];
  const { buehnen, verworfen } = drBuehnenFreigeben(lageVon(g, nda), zeilen.map((p) => ({ id: zahl(p.id), raumId: g.raumId, buchstabe: String(p.buchstabe), buehne: jsonWert(p.buehne) })));
  if (verworfen.length) console.warn(`[DATENRAUM] Raum ${g.raumId}: Bühne ungültig, nicht gezeigt: ${verworfen.join(", ")}`);
  // „Rundgang geöffnet“ einmal am Tag je Gast — Justin sieht es im Protokoll der Akte.
  const [heute] = (await sqlPool`
    SELECT 1 FROM fiaon_dr_protokoll WHERE gast_id = ${g.id} AND art = 'tour'
       AND created_at >= (date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin') LIMIT 1`) as any[];
  if (!heute) await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "tour", detail: `${Object.keys(buehnen).length} ${Object.keys(buehnen).length === 1 ? "Bühne" : "Bühnen"}` }, ctx);
  return { ok: true, buehnen };
}

// ═══════════════════════════════════════════════════════════════════════════
// BÜHNE SPEICHERN (Skript; die Verwaltung im Chefbüro lässt die Spalte unberührt)
// ═══════════════════════════════════════════════════════════════════════════
/** Schlüssel wie projektPruefen in fiaon-datenraum.ts. */
export const drSchluesselNormal = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 60).toLowerCase().replace(/[^a-z0-9äöüß_-]+/g, "-").replace(/^-+|-+$/g, "");

/** roh = null entfernt die Bühne (der Raum zeigt dann Titel, Beschreibung und Unterlagen). */
export async function drBuehneSpeichern(projektId: number, roh: unknown, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ meldung: string; warnungen: string[]; entfernt: boolean }>> {
  await drSchema();
  const p = drBuehnePruefen(roh);
  if (!p.ok) return nein(400, `Bühne ungültig — ${p.fehler.join(" · ")}`, "BUEHNE");
  const [z] = (await lauf`
    UPDATE fiaon_dr_projekte SET buehne = ${p.wert ? JSON.stringify(p.wert) : null}::text::jsonb, updated_at = NOW()
     WHERE id = ${projektId} AND entfernt_am IS NULL RETURNING raum_id, buchstabe, titel`) as any[];
  if (!z) return nein(404, "Dieses Projekt gibt es nicht.");
  await drProtokoll({ raumId: zahl(z.raum_id), art: p.wert ? "buehne_gespeichert" : "buehne_entfernt", detail: `${z.buchstabe} · ${z.titel}${p.wert ? ` · ${drBuehneKurz(p.wert)}` : ""}`, wer }, null, lauf);
  return { ok: true, meldung: p.wert ? `Bühne für ${z.buchstabe} · ${z.titel} gespeichert (${drBuehneKurz(p.wert)}).` : `Bühne für ${z.buchstabe} entfernt.`, warnungen: p.warnungen, entfernt: !p.wert };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANFRAGEN AUS DEM RAUM — Vertragsentwurf anfordern, Frage stellen
// ═══════════════════════════════════════════════════════════════════════════
export const DR_ANFRAGE_TEXTE = {
  vertrag: (titel: string) => `Danke. Ihre Anforderung zu ${titel} ist bei uns — ${NDA_FIAON.kontaktName} meldet sich persönlich bei Ihnen.`,
  schon: (titel: string) => `Ihre Anforderung zu ${titel} liegt uns bereits vor — ${NDA_FIAON.kontaktName} meldet sich persönlich bei Ihnen.`,
  frage: `Danke für Ihre Frage. ${NDA_FIAON.kontaktName} antwortet Ihnen persönlich per E-Mail.`,
  gebremst: `Sie haben uns eben schon mehrere Nachrichten geschickt. Bitte versuchen Sie es etwas später noch einmal — oder schreiben Sie direkt an ${NDA_FIAON.kontaktEmail}.`,
} as const;

function chefLink(partnerFirmaId: number | null): string {
  return absoluteUrl(partnerFirmaId ? `/chef/s/global-auftraege?reiter=partner&partner=${partnerFirmaId}&akte=datenraum` : "/chef/s/global-auftraege?reiter=partner");
}

export async function drAnfrage(g: Gast, body: unknown, ctx: DrKontext, opt: { sender?: DrSender; mailsSofort?: boolean } = {}): Promise<Erg<{ meldung: string; schon?: boolean }>> {
  await drSchema();
  const a = drAnfragePruefen(body);
  if (!a.ok) return nein(400, a.error, "EINGABE");
  const { art, text } = a.wert;
  const nda = await ndaProjekte(g);
  const projekte = (await sqlPool`SELECT id, buchstabe, titel FROM fiaon_dr_projekte WHERE raum_id = ${g.raumId} AND entfernt_am IS NULL`) as any[];
  const p = a.wert.projekt ? projekte.find((x) => String(x.buchstabe).toUpperCase() === a.wert.projekt) : null;
  const z = drAnfrageZugriff(lageVon(g, nda), a.wert.projekt ? (p ? { id: zahl(p.id), raumId: g.raumId, buchstabe: String(p.buchstabe) } : "unbekannt") : null);
  if (!z.erlaubt) {
    await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "zugriff_verweigert", detail: `Anfrage ${art} · ${z.grund}${a.wert.projekt ? ` · ${a.wert.projekt}` : ""}` }, ctx);
    return nein(z.status, z.text, z.grund.toUpperCase());
  }
  const projekt = p ? { buchstabe: String(p.buchstabe), titel: String(p.titel) } : null;

  // Derselbe Vertragsentwurf noch einmal angefordert (Doppelklick, zweites Gerät) → keine zweite Meldung.
  if (art === "vertrag" && projekt) {
    const [schon] = (await sqlPool`
      SELECT 1 FROM fiaon_dr_protokoll WHERE gast_id = ${g.id} AND art = 'vertrag_angefordert' AND detail LIKE ${`${projekt.buchstabe} ·%`}
         AND created_at > NOW() - make_interval(mins => ${DR_ANFRAGE_BREMSE.vertragDoppeltMinuten}) LIMIT 1`) as any[];
    if (schon) return { ok: true, meldung: DR_ANFRAGE_TEXTE.schon(projekt.titel), schon: true };
  }
  const [b] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE gast_id = ${g.id} AND created_at > NOW() - INTERVAL '60 minutes')::int AS gast_stunde,
           COUNT(*) FILTER (WHERE gast_id = ${g.id})::int AS gast_tag,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '10 minutes')::int AS alle
      FROM fiaon_dr_protokoll WHERE art IN ('vertrag_angefordert', 'frage_gestellt') AND created_at > NOW() - INTERVAL '24 hours'`) as any[];
  if (drAnfrageGebremst({ gastStunde: zahl(b?.gast_stunde), gastTag: zahl(b?.gast_tag), alleZehnMinuten: zahl(b?.alle) })) {
    await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "anfrage_gebremst", detail: art }, ctx);
    return nein(429, DR_ANFRAGE_TEXTE.gebremst, "GEBREMST");
  }
  const kopf = projekt ? `${projekt.buchstabe} · ${projekt.titel}` : "ohne Thema";
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: art === "vertrag" ? "vertrag_angefordert" : "frage_gestellt", detail: text ? `${kopf} · ${text}` : kopf }, ctx);
  // Die Meldung geht nach der Antwort raus — der Gast wartet nicht auf Brevo. Scheitert sie, steht es im Protokoll.
  const mail = drAnfrageMelden(g, art, projekt, text, opt.sender ?? drStandardSender).catch((e) => console.error(`[DATENRAUM] Gast ${g.id}: Anfrage-Meldung:`, e));
  if (opt.mailsSofort) await mail;
  return { ok: true, meldung: art === "vertrag" && projekt ? DR_ANFRAGE_TEXTE.vertrag(projekt.titel) : DR_ANFRAGE_TEXTE.frage };
}

/** Die Meldung an Justin — „<Name> möchte den Vertragsentwurf zu <Projekt>“ bzw. die Frage im Wortlaut. */
async function drAnfrageMelden(g: Gast, art: "vertrag" | "frage", projekt: { buchstabe: string; titel: string } | null, text: string, sender: DrSender): Promise<boolean> {
  const { AUFRUF_MELDUNG_AN } = await import("./fiaon-global-angebot-aufrufe");
  const { mailProtokoll } = await import("./fiaon-mail-log");
  const name = drVollName(g.angaben);
  const wer = `${name}${g.angaben.firma ? ` (${g.angaben.firma})` : ""}`;
  const betreff = art === "vertrag"
    ? `${name} möchte den Vertragsentwurf zu ${projekt?.titel ?? "einem Projekt"}`
    : `Frage im Datenraum: ${name}${projekt ? ` zu ${projekt.titel}` : ""}`;
  const absaetze = art === "vertrag"
    ? [`${wer} hat eben im Datenraum „${g.raumTitel}“ den Vertragsentwurf zu ${projekt ? `${projekt.buchstabe} · ${projekt.titel}` : "einem Projekt"} angefordert.`, ...(text ? [`Anmerkung: „${text}“`] : [])]
    : [`${wer} hat im Datenraum „${g.raumTitel}“ eine Frage gestellt${projekt ? ` (zu ${projekt.buchstabe} · ${projekt.titel})` : ""}:`, `„${text}“`];
  absaetze.push("Antworten auf diese Mail gehen direkt an den Gast.");
  const daten = [
    { label: "E-Mail", wert: g.angaben.email }, { label: "Telefon", wert: g.angaben.telefon || "—" },
    ...(g.angaben.funktion ? [{ label: "Funktion", wert: g.angaben.funktion }] : []),
  ];
  const link = chefLink(g.partnerFirmaId);
  const r = await sender({
    an: AUFRUF_MELDUNG_AN, betreff, absender: "team", anrede: "Hallo Justin,", antwortAn: { email: g.angaben.email, name },
    text: [...absaetze, daten.map((d) => `${d.label}: ${d.wert}`).join("\n"), `Im Chefbüro: ${link}`].join("\n\n"),
    baustein: {
      betreff: escHtml(betreff), preheader: escHtml(art === "vertrag" ? `${name} · Vertragsentwurf angefordert` : `${name} · Frage im Datenraum`),
      titel: art === "vertrag" ? "Vertragsentwurf angefordert" : "Frage im Datenraum", persoenlich: true, du: true, bereich: "business", fussStartseite: true,
      kopfSatz: "Datenraum", rechtsSatz: "Vertraulich. Diese Nachricht und ihre Anlagen sind ausschließlich für den genannten Empfänger bestimmt.",
      absaetze: ["Hallo Justin,", ...absaetze.map(escHtml)], daten: daten.map((d) => ({ label: escHtml(d.label), wert: escHtml(d.wert) })),
      knopf: { text: "Im Chefbüro ansehen", url: link },
    },
  }).catch((e: unknown) => ({ ok: false, messageId: null, grund: e instanceof Error ? e.message : String(e) }));
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "mail_anfrage", detail: r.ok ? `gesendet: ${betreff}`.slice(0, 300) : `nicht gesendet: ${String(r.grund ?? "").slice(0, 200)}` });
  await mailProtokoll({
    event: art === "vertrag" ? "datenraum_vertrag_anfrage" : "datenraum_frage", empfaenger: AUFRUF_MELDUNG_AN, status: r.ok ? "versandt" : "fehlgeschlagen",
    grund: r.ok ? null : (r.grund ?? null), payload: { gast: g.id, projekt: projekt?.buchstabe ?? null }, ausgeloestVon: "Datenraum", brevoMessageId: r.messageId,
  }).catch(() => {});
  return r.ok;
}
