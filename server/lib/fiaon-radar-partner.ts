// ═══════════════════════════════════════════════════════════════════════════
// FIRMEN-RADAR — DER PARTNER-STROM: SUCHEN (E-458, 29.10.2026)
//
// Justin: „Mara soll sich auch Steuerberater, Finanzierer, Kreditvermittler, Anwälte und was weiß ich suchen und
// anschreiben als Kooperationspartner … und 10 neue Kooperationspartner, die uns Kunden bringen, jede Stunde.“
//
// Die Suche läuft wie bei den Firmen (fiaon-radar.ts): Die KI schlägt vor, der Server prüft — Website erreichbar, Name
// auf der Seite, Impressum, Entscheider mit persönlicher, wörtlich belegter Adresse (Kanzlei-Teamseiten liefern sie
// oft) — und speichert mit strom = 'partner' und der Gruppe in der Spalte bereich. Gruppen, Zielbild und Signale stehen
// in shared/fiaon-radar.ts (RADAR_PARTNER_GRUPPEN, RADAR_PARTNER_ZIELBILD, RADAR_PARTNER_SIGNALE).
//
// Nie eine Kaltmail an jemanden, der schon Partner ist: Domänen aus dem Partner-CRM (Website, E-Mail, Kontakte) und aus
// den Kooperationsverträgen (IA-KOOP-) kommen gar nicht erst in den Radar. Österreich: finden und speichern, aber keine
// Mail (Brief-Vorrat, E-458 Punkt 8).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  ensureRadarTabellen, radarKi, ausgeschlosseneDomains, vorschlagPruefen, begrenzt, schemaSignal, RadarFehler,
} from "./fiaon-radar";
import { berlinToday } from "./fiaon-time";
import {
  RADAR_PARTNER_ZIELBILD, RADAR_PARTNER_SIGNALE, RADAR_FREEMAIL, radarPartnerGruppe, radarDomain, type RadarLand,
} from "@shared/fiaon-radar";

/** Domänen, die nie eine Partner-Kaltmail bekommen: Partner-CRM (Website, E-Mail, Kontakte) und Kooperationsverträge. */
export async function partnerAusschluss(): Promise<Set<string>> {
  const aus = new Set<string>();
  const nimm = (roh: unknown) => {
    const s = String(roh ?? "").trim().toLowerCase();
    if (!s) return;
    const d = s.includes("@") ? s.split("@").pop() ?? "" : radarDomain(s) ?? "";
    if (d && !RADAR_FREEMAIL.has(d)) aus.add(d.replace(/^www\./, ""));
  };
  const firmen = (await sqlPool`SELECT website, email FROM fiaon_partner_firmen`.catch(() => [])) as any[];
  for (const f of firmen) { nimm(f.website); nimm(f.email); }
  const kontakte = (await sqlPool`SELECT email FROM fiaon_partner_kontakte WHERE email IS NOT NULL`.catch(() => [])) as any[];
  for (const k of kontakte) nimm(k.email);
  const koop = (await sqlPool`SELECT kunde->>'email' AS email FROM fiaon_global_angebote WHERE fassung LIKE 'IA-KOOP-%'`.catch(() => [])) as any[];
  for (const k of koop) nimm(k.email);
  return aus;
}

const SCHEMA_PARTNER = {
  type: "object", additionalProperties: false,
  properties: {
    partner: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          name: { type: "string" }, website: { type: "string" }, land: { type: "string", enum: ["DE", "AT", "CH"] }, ort: { type: "string" },
          kurz: { type: "string" }, passung: { type: "integer" },
          gruende: { type: "array", items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, url: { type: "string" } }, required: ["text", "url"] } },
          signale: { type: "array", items: { type: "string" } },
          partner_signal: schemaSignal("partner"),
          entscheider: {
            type: "object", additionalProperties: false,
            properties: { name: { type: "string" }, rolle: { type: "string" }, email: { type: "string" }, url: { type: "string" } },
            required: ["name", "rolle", "email", "url"],
          },
        },
        required: ["name", "website", "land", "ort", "kurz", "passung", "gruende", "signale", "partner_signal", "entscheider"],
      },
    },
  },
  required: ["partner"],
};

/** Die Such-Anweisung für eine Partner-Gruppe — EINE Stelle für Tageslauf und Knopfsuche. */
export function partnerSucheAnweisung(gruppeKey: string): string {
  const g = radarPartnerGruppe(gruppeKey);
  return [
    "Du recherchierst für FIAON Global neue Kooperationspartner: Menschen, deren Mandanten oder Kunden eine eigene US-Gesellschaft, ein Geschäftskonto, Firmenkarten oder Kapital brauchen. FIAON Global gründet für Unternehmer aus Deutschland, Österreich und der Schweiz eine US-Gesellschaft (LLC) mit Team vor Ort, kümmert sich um Konto und Karten und begleitet auf dem Weg zu US-Funding, zum Festpreis.",
    `Gruppe: ${g?.label ?? gruppeKey} — ${g?.suche ?? ""}.`,
    "Das Zielbild eines guten Partners:",
    ...RADAR_PARTNER_ZIELBILD.muss.map((z) => `- MUSS: ${z}`),
    ...RADAR_PARTNER_ZIELBILD.nie.map((z) => `- NIE: ${z}`),
    "Regeln:",
    "- Nutze die Websuche. Gib NUR real existierende Kanzleien oder Firmen zurück, deren EIGENE Website du gefunden hast (keine Verzeichnisse, keine Portale, keine Social-Media-Profile).",
    "- website = die Startseite (https://…). Erfinde nichts; lieber weniger als ein unsicherer Fund.",
    "- kurz = ein sachlicher Satz, was der Partner macht und für wen. ort = Stadt des Sitzes.",
    "- passung = 0 bis 100, wie gut der Partner ins Zielbild passt. gruende = 2 bis 3 konkrete, überprüfbare Gründe mit URL. signale = kurze Stichworte (z. B. „berät Onlinehändler“, „internationales Steuerrecht“).",
    "- partner_signal = das STÄRKSTE Zeichen, dass die Mandanten oder Kunden zu uns passen. art aus: " + RADAR_PARTNER_SIGNALE.map((x) => `${x.key} (${x.label}, Stärke ${x.staerke}: ${x.suche})`).join(" · ") + ". beleg = ein WÖRTLICHES Zitat (mindestens 8 Wörter, exakt wie auf der Seite), url = die Seite. staerke 1 bis 5. Ohne Beleg: art leer, staerke 0 — und lieber einen anderen Partner nehmen.",
    "- entscheider = Inhaberin, Partner oder Geschäftsführung mit PERSÖNLICHER geschäftlicher E-Mail-Adresse, die WÖRTLICH auf einer öffentlichen Seite steht (Teamseiten von Kanzleien zeigen sie oft; url = diese Seite). Keine Sammeladressen (info@, kanzlei@, office@, kontakt@). Nichts erraten. Findest du keine: alle Felder leer. Partner mit erreichbarem Entscheider haben Vorrang.",
    "- Keine Firma aus der Ausschlussliste. Antworte ausschließlich im vorgegebenen JSON.",
  ].join("\n");
}

export interface PartnerSuchErgebnis { laufId: number; vorgeschlagen: number; neu: number[]; verworfen: { name: string; website: string; grund: string }[] }

/** Sucht Partner einer Gruppe (KI mit Websuche), prüft jeden Vorschlag wie bei den Firmen und speichert mit strom = 'partner'. */
export async function radarPartnerSuchen(ein: { gruppe: string; land?: RadarLand | null; anzahl?: number; quelle: "suche" | "tageslauf"; von?: number | null; laufId?: number }): Promise<PartnerSuchErgebnis> {
  await ensureRadarTabellen();
  const g = radarPartnerGruppe(ein.gruppe);
  if (!g) throw new RadarFehler("Unbekannte Partner-Gruppe.");
  const anzahl = Math.max(3, Math.min(15, Math.round(ein.anzahl ?? 10)));
  const laufId = ein.laufId ?? Number(((await sqlPool`
    INSERT INTO fiaon_radar_laeufe (art, bereich, land, stichwort, von) VALUES (${ein.quelle}, ${g.key}, ${ein.land ?? null}, ${"partner"}, ${ein.von ?? null}) RETURNING id`) as any[])[0].id);
  const start = Date.now();
  try {
    const aus = await ausgeschlosseneDomains();
    // Bestehende Partner (CRM, IA-KOOP) bekommen nie eine Kaltmail.
    for (const d of Array.from(await partnerAusschluss())) aus.add(d);
    const bekannte = ((await sqlPool`SELECT domain FROM fiaon_radar_firmen WHERE strom = 'partner' AND bereich = ${g.key} ORDER BY created_at DESC LIMIT 150`) as any[]).map((r) => r.domain);
    const eingabe = [
      `Gruppe: ${g.label} — ${g.suche}.`,
      ein.land ? `Land: nur ${ein.land === "DE" ? "Deutschland" : ein.land === "AT" ? "Österreich" : "Schweiz"}.` : "Länder: Deutschland und Schweiz.",
      `Finde ${Math.min(16, Math.ceil(anzahl * 1.6))} passende Partner, die besten zuerst.`,
      bekannte.length ? `Ausschlussliste (schon bekannt): ${bekannte.join(", ")}` : "",
    ].filter(Boolean).join("\n");
    const { daten } = await radarKi<{ partner: any[] }>({ zweck: "radar_partner_suche", anweisung: partnerSucheAnweisung(g.key), eingabe, schema: SCHEMA_PARTNER, webSuche: true, aufwand: "medium" });
    const vorschlaege = (daten?.partner ?? []).filter((v) => v && v.name && v.website).sort((a, b) => (b.passung || 0) - (a.passung || 0))
      .map((v) => ({ ...v, kapital_signal: v.partner_signal }));
    const tag = berlinToday();
    const ergebnisse = await begrenzt(vorschlaege, 4, (v: any) => vorschlagPruefen(v, { bereich: g.key, quelle: ein.quelle, tag, aus, strom: "partner" })
      .catch((e: any) => ({ ok: false as const, name: v.name, website: v.website, grund: `Prüfung abgebrochen: ${String(e?.message || e).slice(0, 80)}` })));
    const neu = ergebnisse.filter((r): r is { ok: true; id: number } => r.ok).map((r) => r.id);
    const verworfen = ergebnisse.filter((r): r is { ok: false; name: string; website: string; grund: string } => !r.ok);
    await sqlPool`UPDATE fiaon_radar_laeufe SET status = 'fertig', vorgeschlagen = ${vorschlaege.length}, neu = ${neu.length}, verworfen = ${sqlPool.json(verworfen)},
                   dauer_ms = ${Date.now() - start}, fertig_am = NOW() WHERE id = ${laufId}`;
    return { laufId, vorgeschlagen: vorschlaege.length, neu, verworfen };
  } catch (e: any) {
    await sqlPool`UPDATE fiaon_radar_laeufe SET status = 'fehler', fehler = ${String(e?.message || e).slice(0, 400)}, dauer_ms = ${Date.now() - start}, fertig_am = NOW() WHERE id = ${laufId}`.catch(() => {});
    throw e;
  }
}

/** Die Knopfsuche aus dem Chefbüro läuft im Hintergrund; die Oberfläche fragt den Lauf ab. */
export async function radarPartnerSucheStarten(ein: { gruppe: string; land?: RadarLand | null; anzahl?: number; von?: number | null }): Promise<number> {
  await ensureRadarTabellen();
  const g = radarPartnerGruppe(ein.gruppe);
  if (!g) throw new RadarFehler("Bitte eine Partner-Gruppe wählen.");
  const offen = (await sqlPool`SELECT id FROM fiaon_radar_laeufe WHERE status = 'laeuft' AND art = 'suche' AND created_at > NOW() - INTERVAL '10 minutes'`) as any[];
  if (offen.length >= 2) throw new RadarFehler("Es laufen schon zwei Suchen — bitte kurz warten.", 429);
  const [r] = (await sqlPool`INSERT INTO fiaon_radar_laeufe (art, bereich, land, stichwort, von) VALUES ('suche', ${g.key}, ${ein.land ?? null}, ${"partner"}, ${ein.von ?? null}) RETURNING id`) as any[];
  const laufId = Number(r.id);
  void radarPartnerSuchen({ ...ein, quelle: "suche", laufId }).catch((e) => console.error(`[RADAR-PARTNER] Suche ${laufId} (${g.key}):`, e?.message || e));
  return laufId;
}
