// ═══════════════════════════════════════════════════════════════════════════
// FIRMEN-RADAR — DER MAIL-MOTOR (E-458, 29.10.2026)
//
// Justin: „Mara muss arbeiten, und das richtig, Tag und Nacht, und uns Geld einbringen … Ab heute, jede Stunde
// MINDESTENS 10 Mails an Firmen, die Kapitalbedarf haben, und 10 neue Kooperationspartner, die uns Kunden bringen —
// von 07.00 Uhr bis 19.00 Uhr — immer 100 % menschlich, mit Signatur, 100 % personalisiert.“
//
// ── ZWEI LÄUFE ──────────────────────────────────────────────────────────────
//   radarMotorVorbereiten  alle 5 Minuten, rund um die Uhr (mit Historie): füllt je Strom (Firmen, Partner) die
//                          Warteschlange bis zum Puffer — gekoppelt an das, was die Postfächer heute tragen, nicht ans
//                          Ziel (sonst bezahlte KI für Mails, die nie hinausgehen). Je Firma: Scan, falls das Signal
//                          ungeprüft ist → Entscheider auf der Website (kostenlos) → Websuche (bezahlt) → Mail schreiben
//                          (strenge Regeln) → Prüf-KI → motor_status „bereit“. KI-Pause oder Tagesdeckel beenden den
//                          Lauf; die Firma geht zurück in den Vorrat, nichts geht verloren.
//   radarMotorSenden       jede Minute (nurMitErgebnis), nur im Fenster: je Strom höchstens EINE Mail je Takt, wenn
//                          radarMotorSoll sie fällig nennt — gleichmäßig über die Stunde, nach einem Ausfall kein Schwall.
//                          Hat ein Strom nichts in der Warteschlange, füllt der andere die Lücke. Die Übernahme läuft
//                          unter pg_advisory_xact_lock(458001) mit motor_status = 'sendet' … RETURNING (atomar über
//                          Instanzen). Vor dem Senden prüft radarMailAusgeben ALLE Wände neu (Sperrliste, Gespräch, schon
//                          versendet, Österreich, Prüf-KI-Hash, strenge Regeln). Senden ruft keine KI — in der KI-Pause
//                          geht die Warteschlange weiter hinaus.
//
// Hauptschalter bleibt radar_auto_versand („Mara verkauft“). Die Schalter stehen in shared/fiaon-radar.ts
// (RADAR_MOTOR_SCHLUESSEL), das Chefbüro bedient sie unter Firmen-Radar › Automatik.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  ensureRadarTabellen, zeileLesen, radarScannen, radarMailAusgeben, radarPostfaecher, radarMotorEinstellung, radarAbsenderLesen, RadarFehler,
  radarVersandAbgleich, radarSendeFehlerArt, radarGmailVoruebergehend, sqlOesterreich, radarMailWand,
  type RadarSender,
} from "./fiaon-radar";
import { versandDns, type VersandDns } from "./fiaon-mx";
import { radarAutomatik } from "./fiaon-radar-faden";
import { gmailBereit, postfachProbe } from "./fiaon-gmail";
import { kiPausiert } from "./fiaon-ki-pause";
import { berlinToday } from "./fiaon-time";
import {
  RADAR_SIGNAL_AB, RADAR_STROEME, RADAR_HOECHSTENS_JE_TAG, RADAR_MOTOR_STATUS, RADAR_NACHFASS_TAGE,
  radarMotorImFenster, radarMotorSoll, radarMotorFensterStunden, radarMotorReststunden, radarBerlinTagMinute,
  radarPostfachWaehlen, radarMoeglich, radarAdressePersoenlich, radarAdressePruefen, radarPostfachGrenze, radarPostfachBereit,
  radarZustellWerte, radarBremseEntscheiden, type RadarZustellWerte, type RadarBremse,
  type RadarStrom, type RadarMotor, type RadarPostfachLage, type RadarMoeglich,
} from "@shared/fiaon-radar";

/** Der Schlüssel der Übernahme-Sperre (eigener Raum neben dem Brief, 339001). */
const MOTOR_SPERRE = 458001;
/** Höchstens so viele Firmen bereitet ein Lauf vor (drei gleichzeitig) — der nächste Takt macht weiter. */
const RUNDE_MAX = 6;
const PARALLEL = 3;

// ── Einspritzungen für den Prüfstand (ohne Netz, ohne KI) ───────────────────
export interface MotorSchritte {
  scannen: (id: number) => Promise<unknown>;
  entscheider: (id: number, websuche: boolean) => Promise<unknown>;
  fertig: (id: number) => Promise<{ ok: boolean; grund: string | null }>;
  /** E-458 (Befund): eine von Hand geänderte Mail nur PRÜFEN lassen — nie den Text eines Menschen überschreiben. */
  pruefen: (id: number) => Promise<{ ok: boolean; grund: string | null }>;
}
async function echteSchritte(): Promise<MotorSchritte> {
  const { entscheiderFinden } = await import("./fiaon-radar-entscheider");
  const { radarMailFertig, radarMailNurPruefen } = await import("./fiaon-radar-pruef");
  return {
    scannen: (id) => radarScannen(id),
    entscheider: (id, websuche) => entscheiderFinden(id, { websuche }),
    fertig: async (id) => { const r = await radarMailFertig(id); return { ok: r.ok, grund: r.grund }; },
    pruefen: async (id) => {
      // Erst die feste Wand (kostet nichts) — verletzt die Hand-Fassung sie, wird die Prüf-KI gar nicht erst gefragt.
      const wand = radarMailWand(await firmaLesen(id), await radarMotorEinstellung());
      if (wand.length) return { ok: false, grund: wand.slice(0, 2).join("; ") };
      const r = await radarMailNurPruefen(id);
      return { ok: r.bestanden, grund: r.gruende.slice(0, 2).join("; ") || null };
    },
  };
}

async function firmaLesen(id: number): Promise<any> {
  return zeileLesen(((await sqlPool`SELECT * FROM fiaon_radar_firmen WHERE id = ${id}`) as any[])[0]);
}

/**
 * Hat die Firma eine persönliche, geprüfte Adresse eines Entscheiders (so, wie radarMailAusgeben sie verlangt)?
 * E-458 (Befund): Ist die Ableitung aus (Chefbüro oder Ableitungs-Wache), zählt eine abgeleitete Adresse nicht mehr.
 */
export function persoenlicheAdresse(f: any, o: { ableitung?: boolean } = {}): boolean {
  const email = String(f?.email ?? "").trim().toLowerCase();
  if (!email) return false;
  const ungueltig = String(f?.email_ungueltig ?? "").split(",").map((x: string) => x.trim()).filter(Boolean);
  if (ungueltig.includes(email) || !radarAdressePruefen(email, f.domain, f.name).ok) return false;
  if (o.ableitung === false && f?.entscheider?.weg === "abgeleitet" && String(f.entscheider.email ?? "").toLowerCase() === email) return false;
  const namen = [f?.entscheider?.name, ...((Array.isArray(f?.impressum?.vertreter) ? f.impressum.vertreter : []).map((v: any) => v?.name || [v?.vorname, v?.nachname].filter(Boolean).join(" ")))].filter(Boolean) as string[];
  return radarAdressePersoenlich(email, namen);
}

// ── Postfächer: Bereitschaft, Grenze, heute gesendet, Reserve (Punkt 6) ──────
export interface PostfachBereitschaft {
  adresse: string; bereit: boolean; gruende: string[]; name: string | null; quelle: "gmail" | "karte" | null; signaturHtml: string | null;
  gmail: boolean | null; dns: VersandDns | null; am: number;
  /** E-458 (Befund): Gmail oder DNS waren beim letzten Prüfen nur gestört — es gilt der letzte gute Stand. */
  stoerung?: string[];
}
const bereitschaftCache = new Map<string, PostfachBereitschaft>();
/** Der letzte Stand, in dem das Postfach bereit war — er trägt über eine kurze Störung (höchstens 24 Stunden). */
const letzterGuter = new Map<string, PostfachBereitschaft>();
/** Gutes Ergebnis 6 Stunden, schlechtes oder gestörtes 10 Minuten — dann wird neu geprüft (wie absenderLesen). */
const BEREIT_GILT_MS = 6 * 3_600_000, NICHT_BEREIT_GILT_MS = 10 * 60_000, GUT_TRAEGT_MS = 24 * 3_600_000;

type PostfachProbe = (adresse: string) => Promise<{ ok: boolean; fehler?: string }>;
let probeErsatz: PostfachProbe | null = null;
/** Prüfstand: die Gmail-Probe ohne Netz (null = echtes Gmail). */
export function postfachProbeSetzen(fn: PostfachProbe | null): void { probeErsatz = fn; }

/**
 * Ist ein Postfach bereit? Gmail-Zugang (Probe), Person und Signatur aus Gmail (sendAs; js@ notfalls Justins Karte), bei
 * fremden Domänen MX, SPF, DKIM und DMARC. neu = sofort neu prüfen (Chefbüro).
 * E-458 (Befund): Nur „bereit“ gilt sechs Stunden; „nicht bereit“ wird nach zehn Minuten neu geprüft. Und eine
 * vorübergehende Störung (Netz, Gmail 5xx/429, DNS-Zeitüberschreitung) macht ein Postfach nicht „nicht bereit“: Für die
 * gestörten Teile gilt der letzte gute Stand — sonst stünde der Motor mit js@ allein nach einem Aussetzer stundenlang.
 */
export async function postfachBereitschaft(adresse: string, neu = false): Promise<PostfachBereitschaft> {
  const a = String(adresse || "").trim().toLowerCase();
  const im = bereitschaftCache.get(a);
  if (im && !neu && Date.now() - im.am < (im.bereit && !im.stoerung?.length ? BEREIT_GILT_MS : NICHT_BEREIT_GILT_MS)) return im;
  const domain = a.split("@")[1] ?? "";
  const eigen = domain === "fiaon.com";
  const gelesen = await radarAbsenderLesen(a).catch((e) => ({ absender: null, gestoert: radarGmailVoruebergehend(e) }));
  const probe = probeErsatz ? await probeErsatz(a).catch((e: any) => ({ ok: false, fehler: String(e?.message || e) }))
    : gmailBereit() ? await postfachProbe(a).catch((e: any) => ({ ok: false, fehler: String(e?.message || e) })) : null;
  const dnsRoh = eigen ? null : await versandDns(domain).catch(() => null);
  const gutRoh = letzterGuter.get(a);
  const gut = gutRoh && Date.now() - gutRoh.am < GUT_TRAEGT_MS ? gutRoh : null;
  const stoerung: string[] = [];
  // Je Teil: gestört UND ein guter Stand da → der gute Teil gilt weiter.
  let person: { name: string; signaturHtml: string; quelle: "gmail" | "karte" } | null = gelesen.absender
    ? { name: gelesen.absender.name, signaturHtml: gelesen.absender.signaturHtml, quelle: gelesen.absender.quelle } : null;
  if (!person && gelesen.gestoert && gut && gut.quelle && gut.name && gut.signaturHtml != null) {
    person = { name: gut.name, signaturHtml: gut.signaturHtml, quelle: gut.quelle };
    stoerung.push("Gmail-Unterschrift kurz nicht lesbar");
  }
  let gmail: boolean | null = probe ? probe.ok : null;
  if (probe && !probe.ok && gut && radarGmailVoruebergehend(probe.fehler)) { gmail = true; stoerung.push(`Gmail kurz gestört (${String(probe.fehler ?? "").slice(0, 80)})`); }
  let dns = dnsRoh;
  if (!eigen && (!dnsRoh || dnsRoh.unklar) && gut?.dns) { dns = gut.dns; stoerung.push("DNS kurz nicht lesbar"); }
  const urteil = radarPostfachBereit({ person, gmail, dns, eigeneDomain: eigen });
  const wert: PostfachBereitschaft = {
    adresse: a, ...urteil, name: person?.name ?? null, quelle: (person?.quelle as "gmail" | "karte" | undefined) ?? null, signaturHtml: person?.signaturHtml ?? null,
    gmail, dns, am: Date.now(), ...(stoerung.length ? { stoerung } : {}),
  };
  bereitschaftCache.set(a, wert);
  if (wert.bereit && !stoerung.length) letzterGuter.set(a, wert);
  return wert;
}

/** Prüfstand: den Zwischenspeicher der Bereitschaft leeren (auch den letzten guten Stand). */
export function postfachBereitschaftVergessen(): void { bereitschaftCache.clear(); letzterGuter.clear(); }

/** Pausen aus der Zustell-Bremse (Punkt 7): Postfach → bis. Steht in fiaon_settings (radar_postfach_pause). */
export async function postfachPausen(lauf: any = sqlPool): Promise<Record<string, string>> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'radar_postfach_pause'`.catch(() => [])) as any[];
  try { const p = JSON.parse(String(z?.value ?? "{}")); return p && typeof p === "object" ? p : {}; } catch { return {}; }
}

/**
 * E-458 (Befund Sendefehler): Störungen eines Postfachs beim Senden (Token, Zugang, Rate-Limit, Netz) — Postfach →
 * { bis, grund, n }. Bis dahin sendet es keine erste Mail; jede weitere Störung verdoppelt die Pause (15 Min bis 2 Std),
 * ein erfolgreicher Versand löscht sie. Steht in fiaon_settings (radar_postfach_stoerung), gilt über alle Instanzen.
 */
export async function postfachStoerungen(lauf: any = sqlPool): Promise<Record<string, { bis: string; grund: string; n: number }>> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'radar_postfach_stoerung'`.catch(() => [])) as any[];
  try { const p = JSON.parse(String(z?.value ?? "{}")); return p && typeof p === "object" ? p : {}; } catch { return {}; }
}
async function postfachStoerungSetzen(adresse: string, grund: string | null): Promise<void> {
  const alle = await postfachStoerungen();
  if (!grund) { if (!alle[adresse]) return; delete alle[adresse]; }
  else {
    const n = Math.min(4, Number(alle[adresse]?.n ?? 0) + 1);
    alle[adresse] = { bis: new Date(Date.now() + 15 * 60_000 * 2 ** (n - 1)).toISOString(), grund: grund.slice(0, 200), n };
  }
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('radar_postfach_stoerung', ${JSON.stringify(alle)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

/**
 * Der Stand aller Radar-Postfächer heute (Berliner Tag): Grenze mit Hochfahren, alles, was der Radar daraus sendet
 * (erste Mail, Nachfass, Mara — nicht Justins Antworten von Hand), fällige Nachfass-Mails als Reserve, Pause und
 * Bereitschaft (aus dem Zwischenspeicher; bereit = vorher mit postfachBereitschaft geprüft).
 * E-458 (Befund Bremse): Die Zustell-Bremse kürzt die Tagesgrenze (Grenze × Faktor) — der Takt je Postfach verteilt den
 * Rest über das Fenster, also halbiert die Bremse wirklich das Tempo, auch wenn die Postfächer der Engpass sind.
 * Pausiert ist ein Postfach aus dem Chefbüro, durch die Zustell-Bremse oder bei einer Störung beim Senden.
 */
export async function postfachLagen(jetzt: Date = new Date(), lauf: any = sqlPool, bereitschaft?: Map<string, PostfachBereitschaft>): Promise<RadarPostfachLage[]> {
  const tag = berlinToday(jetzt);
  const adressen = radarPostfaecher();
  if (!adressen.length) return [];
  const m = await radarMotorEinstellung();
  const faktor = await bremseFaktor(lauf);
  const stoerungen = await postfachStoerungen(lauf);
  const gesendet = (await lauf`
    SELECT postfach, COUNT(*) FILTER (WHERE (datum AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date)::int AS n,
           MAX(datum) AS letzte, MIN(datum) AS erster
      FROM fiaon_radar_post
     WHERE richtung = 'aus' AND art <> 'von_hand' AND postfach = ANY(${adressen})
     GROUP BY postfach`) as any[];
  const sendend = (await lauf`
    SELECT postfach, COUNT(*)::int AS n, MAX(motor_am) AS letzte FROM fiaon_radar_firmen
     WHERE motor_status = 'sendet' AND postfach = ANY(${adressen}) GROUP BY postfach`) as any[];
  const reserve = (await lauf`
    SELECT postfach, COUNT(*)::int AS n FROM fiaon_radar_firmen
     WHERE status = 'versendet' AND antwort_am IS NULL AND archiviert_am IS NULL AND nachfass_faellig IS NOT NULL
       AND nachfass_stufe < ${RADAR_NACHFASS_TAGE.length} AND postfach = ANY(${adressen})
       AND (nachfass_faellig AT TIME ZONE 'Europe/Berlin')::date <= ${tag}::date
     GROUP BY postfach`) as any[];
  const pausen = await postfachPausen(lauf);
  const je = (liste: any[], p: string) => liste.find((x) => String(x.postfach) === p);
  return adressen.map((adresse) => {
    const g = je(gesendet, adresse), s = je(sendend, adresse), r = je(reserve, adresse);
    const letzte = [g?.letzte, s?.letzte].filter(Boolean).map((d) => new Date(d).getTime());
    const bis = pausen[adresse] ? new Date(pausen[adresse]).getTime() : NaN;
    const stoerBis = stoerungen[adresse]?.bis ? new Date(stoerungen[adresse].bis).getTime() : NaN;
    const b = bereitschaft?.get(adresse) ?? bereitschaftCache.get(adresse);
    return {
      adresse,
      grenze: Math.floor(radarPostfachGrenze({ ersterVersand: g?.erster ?? null, jetzt, jeTag: m.postfachJeTag, rampe: m.postfachRampe }) * faktor),
      heute: Number(g?.n ?? 0) + Number(s?.n ?? 0), reserve: Number(r?.n ?? 0),
      letzteAm: letzte.length ? new Date(Math.max(...letzte)) : null,
      bereit: b ? b.bereit : false,
      pause: m.postfachAus.includes(adresse) || (Number.isFinite(bis) && bis > jetzt.getTime()) || (Number.isFinite(stoerBis) && stoerBis > jetzt.getTime()),
    };
  });
}

/** Die ehrliche Leistung heute (Punkt 6) — für Puffer, Kachel und Satz. */
export async function motorMoeglich(m: RadarMotor, jetzt: Date = new Date(), bremse = 1): Promise<RadarMoeglich & { postfaecher: RadarPostfachLage[] }> {
  for (const a of radarPostfaecher()) await postfachBereitschaft(a);
  const postfaecher = await postfachLagen(jetzt);
  const r = radarMoeglich({
    postfaecher, reststunden: radarMotorReststunden(jetzt, m) || radarMotorFensterStunden(m), fensterStunden: radarMotorFensterStunden(m),
    ziele: { firma: m.firmenJeStunde, partner: m.partnerJeStunde }, bremse, grenzeVoll: m.postfachJeTag,
  });
  return { ...r, postfaecher };
}

// ── DIE WARTESCHLANGE PFLEGEN ──────────────────────────────────────────────
/**
 * Veraltete und hängende Einträge (alle 5 Minuten):
 *   „bereit“ zu alt   → zurück in den Vorrat, neu vorbereiten (höchstens zweimal, dann „abgelaufen“) — E-458, Befund
 *   „sendet“ > 10 Min → gebucht: „gesendet“; Gmail nie gerufen: zurück auf „bereit“; Gmail gerufen (versand_lauf): der
 *                        Gesendet-Ordner entscheidet (radarVersandAbgleich) — nie ein blinder zweiter Versand
 *   „arbeit“ > 30 Min → zurück in den Vorrat (ab drei Versuchen verworfen)
 *   „verworfen“ wegen Sendefehlern → nach einem Tag einmal zurück auf „bereit“ (die Mail ist geprüft, nur Gmail war gestört)
 */
export async function warteschlangeAufraeumen(m: RadarMotor): Promise<void> {
  await sqlPool`UPDATE fiaon_radar_firmen SET motor_versuche = motor_versuche + 1, motor_am = NOW(),
                        motor_status = CASE WHEN motor_versuche + 1 >= 3 THEN 'abgelaufen' ELSE NULL END,
                        motor_grund = ${`Älter als ${m.haltbarTage} Tage — wird neu vorbereitet`}
                 WHERE motor_status = 'bereit' AND motor_am < NOW() - make_interval(days => ${m.haltbarTage})`;
  await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'gesendet', motor_am = NOW()
                 WHERE motor_status = 'sendet' AND motor_am < NOW() - INTERVAL '10 minutes' AND versand_lauf IS NULL
                   AND versendet_am IS NOT NULL AND status <> 'unzustellbar'`;
  await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'bereit', motor_am = NOW()
                 WHERE motor_status = 'sendet' AND motor_am < NOW() - INTERVAL '10 minutes' AND versand_lauf IS NULL`;
  const offen = (await sqlPool`
    SELECT id, (versand_lauf->>'am') AS seit FROM fiaon_radar_firmen
     WHERE motor_status = 'sendet' AND motor_am < NOW() - INTERVAL '10 minutes' AND versand_lauf IS NOT NULL
     ORDER BY motor_am ASC LIMIT 10`) as any[];
  for (const z of offen) {
    const r = await radarVersandAbgleich(Number(z.id)).catch(() => "unklar" as const);
    if (r === "gesendet") {
      await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'gesendet', motor_am = NOW(), motor_grund = 'Im Gesendet-Ordner gefunden — nachgebucht' WHERE id = ${z.id} AND motor_status = 'sendet'`;
    } else if (r === "offen") {
      await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'bereit', motor_am = NOW(), motor_grund = 'Nicht im Gesendet-Ordner — neuer Versuch' WHERE id = ${z.id} AND motor_status = 'sendet'`;
    } else if (Date.now() - new Date(String(z.seit)).getTime() > 24 * 3_600_000) {
      await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'verworfen', motor_am = NOW(), motor_grund = 'Unklar, ob gesendet — bitte im Gesendet-Ordner des Postfachs prüfen' WHERE id = ${z.id} AND motor_status = 'sendet'`;
    }
  }
  await sqlPool`UPDATE fiaon_radar_firmen SET motor_versuche = motor_versuche + 1,
                        motor_status = CASE WHEN motor_versuche + 1 >= 3 THEN 'verworfen' ELSE NULL END,
                        motor_grund = 'Vorbereitung abgebrochen (Neustart oder Zeitgrenze)', motor_am = NOW()
                 WHERE motor_status = 'arbeit' AND motor_am < NOW() - INTERVAL '30 minutes'`;
  await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'bereit', motor_am = NOW(), motor_sendefehler = 0, motor_versuche = motor_versuche + 1,
                        motor_grund = 'Nach Sendefehlern zurück in der Warteschlange'
                 WHERE motor_status = 'verworfen' AND motor_grund LIKE 'Senden fehlgeschlagen%' AND motor_am < NOW() - INTERVAL '1 day'
                   AND versendet_am IS NULL AND motor_versuche < 2 AND archiviert_am IS NULL`;
}

/**
 * Nimmt die beste offene Firma eines Stroms in Arbeit (atomar, über Instanzen). Österreich, Sperrliste und Archiv nie;
 * Partner nur aus eingeschalteten Gruppen (E-458, Befund); eine widerlegte Ableitung (Rückläufer) geht in den Brief, nicht
 * noch einmal in die bezahlte Suche.
 */
export async function kandidatNehmen(strom: RadarStrom, abPassung: number, gruppen: readonly string[] = []): Promise<number | null> {
  const [z] = (await sqlPool`
    UPDATE fiaon_radar_firmen SET motor_status = 'arbeit', motor_am = NOW(), motor_grund = NULL
     WHERE id = (
       SELECT r.id FROM fiaon_radar_firmen r
        WHERE r.strom = ${strom} AND r.motor_status IS NULL AND r.archiviert_am IS NULL
          AND (${strom} <> 'partner' OR r.bereich = ANY(${[...gruppen]}::text[]))
          AND ((r.status IN ('neu', 'gescannt', 'mail') AND r.versendet_am IS NULL)
               OR (r.status = 'unzustellbar' AND r.email IS NOT NULL AND position(r.email in COALESCE(r.email_ungueltig, '')) = 0
                   AND COALESCE(r.entscheider->>'muster_widerlegt', '') <> 'true'))
          AND r.brief_versendet_am IS NULL AND COALESCE(r.brief_status, '') NOT IN ('sendet', 'uebergeben', 'versendet')
          AND (r.signal_staerke IS NULL OR r.signal_staerke >= ${RADAR_SIGNAL_AB})
          AND COALESCE(r.passung, 0) >= ${abPassung}
          AND NOT ${sqlOesterreich()}
          AND NOT EXISTS (SELECT 1 FROM fiaon_radar_sperre x WHERE x.wert = r.domain OR x.wert = lower(COALESCE(r.email, '')))
        ORDER BY COALESCE(r.signal_staerke, ${RADAR_SIGNAL_AB}) DESC, r.passung DESC NULLS LAST, r.created_at DESC
        LIMIT 1 FOR UPDATE SKIP LOCKED)
       AND motor_status IS NULL
    RETURNING id`) as any[];
  return z ? Number(z.id) : null;
}

async function verwerfen(id: number, grund: string): Promise<{ ergebnis: "verworfen"; grund: string }> {
  await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'verworfen', motor_am = NOW(), motor_grund = ${grund.slice(0, 400)}, updated_at = NOW()
                 WHERE id = ${id} AND motor_status = 'arbeit'`;
  return { ergebnis: "verworfen", grund };
}

/** Bereitet EINE Firma vor: Signal → Entscheider (Website, dann Websuche) → Mail + Prüf-KI → „bereit“. */
export async function vorbereitenEine(id: number, strom: RadarStrom, schritte: MotorSchritte, o: { ableitung?: boolean } = {}): Promise<{ ergebnis: "bereit" | "verworfen" | "zurueck"; grund?: string }> {
  try {
    let f = await firmaLesen(id);
    if (!f) return { ergebnis: "zurueck", grund: "Firma nicht gefunden" };
    // 1. Signal ungeprüft oder kein Scan → scannen (bezahlt; ohne Scan gibt es keinen belegten Aufhänger).
    if (f.signal_staerke == null || !f.scan) { await schritte.scannen(id); f = await firmaLesen(id); }
    if (Number(f.signal_staerke ?? 0) < RADAR_SIGNAL_AB) {
      // Nicht qualifiziert (Justin: „nur noch qualifizierte Unternehmen“) — Firmen ins Archiv wie bisher.
      if (strom === "firma") await sqlPool`UPDATE fiaon_radar_firmen SET archiviert_am = NOW(), archiv_grund = ${`Kapitalsignal ${Number(f.signal_staerke ?? 0)} von 5 (Scan)`} WHERE id = ${id}`;
      return verwerfen(id, `Signal ${Number(f.signal_staerke ?? 0)} von 5 — nicht qualifiziert`);
    }
    // 2. Der Entscheider: erst die Website (kostenlos; ab Punkt 5 mit belegtem Adress-Muster), dann die Websuche (bezahlt).
    // E-458 (Befund): Bei abgeschalteter Ableitung zählt eine abgeleitete Adresse nicht (dann Suche oder Brief).
    const persoenlich = (x: any) => persoenlicheAdresse(x, { ableitung: o.ableitung });
    if (!persoenlich(f)) {
      await schritte.entscheider(id, false);
      f = await firmaLesen(id);
      if (!persoenlich(f)) { await schritte.entscheider(id, true); f = await firmaLesen(id); }
      if (!persoenlich(f)) return verwerfen(id, "Keine persönliche Adresse des Entscheiders — bleibt für den Brief");
    }
    // 3. Mail schreiben (strenge Regeln) und von der Prüf-KI lesen lassen (höchstens einmal neu). E-458 (Befund): Eine von
    // Hand verbesserte Mail wird nie überschrieben — die Prüf-KI liest sie nur; besteht sie nicht, bleibt sie für die Akte.
    const handarbeit = !!f.mail?.geaendert;
    const r = handarbeit ? await schritte.pruefen(id) : await schritte.fertig(id);
    if (!r.ok) return verwerfen(id, `Mail: ${handarbeit ? "von Hand geändert, Prüf-KI: " : ""}${r.grund ?? "nicht freigegeben"}`);
    const [bereit] = (await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'bereit', motor_am = NOW(), motor_grund = NULL, updated_at = NOW()
                                     WHERE id = ${id} AND motor_status = 'arbeit' RETURNING id`) as any[];
    return bereit ? { ergebnis: "bereit" } : { ergebnis: "zurueck", grund: "Stand hat sich währenddessen geändert" };
  } catch (e: any) {
    if (e instanceof RadarFehler && (e.status === 429 || e.status === 503)) {
      // KI-Pause oder Tagesdeckel: zurück in den Vorrat — nichts geht verloren. Der Lauf endet (der Fehler geht nach oben).
      await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = NULL, motor_grund = ${String(e.message).slice(0, 300)} WHERE id = ${id} AND motor_status = 'arbeit'`;
      throw e;
    }
    const grund = String(e?.message || e).slice(0, 300);
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_versuche = motor_versuche + 1,
                          motor_status = CASE WHEN motor_versuche + 1 >= 3 THEN 'verworfen' ELSE NULL END,
                          motor_grund = ${grund}, motor_am = NOW()
                   WHERE id = ${id} AND motor_status = 'arbeit'`;
    return { ergebnis: "zurueck", grund };
  }
}

export interface VorbereitenErgebnis {
  aus?: boolean; grund?: string; bereit: number; verworfen: number; zurueck: number;
  warteschlange: Record<RadarStrom, number>; puffer: Record<RadarStrom, number>;
}

/** Füllt die Warteschlange je Strom bis zum Puffer. Rund um die Uhr; KI-Pause und Tagesdeckel beenden den Lauf. */
export async function radarMotorVorbereiten(opt: { jetzt?: Date; max?: number; schritte?: MotorSchritte; ohneHauptschalter?: boolean } = {}): Promise<VorbereitenErgebnis> {
  const jetzt = opt.jetzt ?? new Date();
  const erg: VorbereitenErgebnis = { bereit: 0, verworfen: 0, zurueck: 0, warteschlange: { firma: 0, partner: 0 }, puffer: { firma: 0, partner: 0 } };
  const a = await radarAutomatik();
  if (!a.versand && !opt.ohneHauptschalter) return { ...erg, aus: true, grund: "aus" };
  await ensureRadarTabellen();
  const m = await radarMotorEinstellung();
  await warteschlangeAufraeumen(m);
  if (!opt.schritte && (await kiPausiert())) return { ...erg, grund: "KI pausiert" };
  const leistung = await motorMoeglich(m, jetzt);
  const zaehlen = async () => Object.fromEntries(((await sqlPool`
    SELECT strom, COUNT(*) FILTER (WHERE motor_status IN ('bereit', 'arbeit'))::int AS n FROM fiaon_radar_firmen
     WHERE strom <> 'partner' OR bereich = ANY(${m.partnerGruppen}::text[]) GROUP BY strom`) as any[])
    .map((z) => [String(z.strom), Number(z.n)])) as Record<string, number>;
  // Der Puffer hängt an der Leistung der Postfächer (tagJe), nicht am Ziel. Hat ein Strom gar keinen Vorrat, übernimmt
  // der andere seinen Teil — die Lücke füllt beim Senden der andere Strom. Partner zählen nur aus eingeschalteten Gruppen.
  const vorrat = Object.fromEntries(((await sqlPool`
    SELECT strom, COUNT(*)::int AS n FROM fiaon_radar_firmen
     WHERE motor_status IS NULL AND archiviert_am IS NULL AND versendet_am IS NULL AND status IN ('neu', 'gescannt', 'mail')
       AND (strom <> 'partner' OR bereich = ANY(${m.partnerGruppen}::text[]))
     GROUP BY strom`) as any[]).map((z) => [String(z.strom), Number(z.n)])) as Record<string, number>;
  let schlange = await zaehlen();
  const ziel = { firma: m.firmenJeStunde, partner: m.partnerJeStunde } as Record<RadarStrom, number>;
  for (const s of RADAR_STROEME) erg.puffer[s] = ziel[s] > 0 ? Math.ceil(leistung.tagJe[s] * m.puffer) : 0;
  for (const s of RADAR_STROEME) {
    const anderer: RadarStrom = s === "firma" ? "partner" : "firma";
    if (ziel[s] > 0 && ziel[anderer] > 0 && !vorrat[anderer] && !schlange[anderer]) erg.puffer[s] += Math.ceil(leistung.tagJe[anderer] * m.puffer);
  }
  const schritte = opt.schritte ?? (await echteSchritte());
  let rest = Math.max(0, opt.max ?? RUNDE_MAX);
  const stopp: { fehler: RadarFehler | null } = { fehler: null };
  // Reihum: der Strom mit dem größten Fehlbestand zuerst, immer höchstens PARALLEL Firmen gleichzeitig.
  while (rest > 0 && !stopp.fehler) {
    const offen = RADAR_STROEME.filter((s) => erg.puffer[s] > (schlange[s] ?? 0));
    if (!offen.length) break;
    offen.sort((x, y) => (erg.puffer[y] - (schlange[y] ?? 0)) - (erg.puffer[x] - (schlange[x] ?? 0)));
    const runde: { id: number; strom: RadarStrom }[] = [];
    for (const s of offen) {
      const bedarf = Math.min(erg.puffer[s] - (schlange[s] ?? 0), PARALLEL - runde.length, rest - runde.length);
      for (let i = 0; i < bedarf; i++) {
        const id = await kandidatNehmen(s, a.abPassung, m.partnerGruppen);
        if (!id) break;
        runde.push({ id, strom: s });
      }
    }
    if (!runde.length) { erg.grund = erg.grund ?? "kein passender Vorrat mehr"; break; }
    rest -= runde.length;
    const ergebnisse = await Promise.all(runde.map((k) => vorbereitenEine(k.id, k.strom, schritte, { ableitung: m.ableitung }).catch((e) => {
      if (e instanceof RadarFehler) stopp.fehler = stopp.fehler ?? e;
      return { ergebnis: "zurueck" as const, grund: String(e?.message || e) };
    })));
    for (const r of ergebnisse) erg[r.ergebnis]++;
    schlange = await zaehlen();
  }
  for (const s of RADAR_STROEME) erg.warteschlange[s] = schlange[s] ?? 0;
  if (stopp.fehler) erg.grund = stopp.fehler.message;
  return erg;
}

// ── SENDEN ────────────────────────────────────────────────────────────────────
interface StromStand { gesendet: number; letzte: Date | null; schlange: number }

/**
 * Wer ist jetzt dran? Je Strom das Soll; hat ein Strom nichts in der Warteschlange, füllt der andere die Lücke. Sind beide
 * dran, kommt zuerst, wer im Verhältnis zu seinem Ziel weiter zurückliegt — sonst nähme bei nur einem Postfach (Abstand
 * 3 Minuten) immer derselbe Strom den Platz. Rein.
 */
export function motorDran(jetzt: Date, m: RadarMotor, st: Record<RadarStrom, StromStand>, bremse = 1, bremseSeit: Date | string | null = null): { strom: RadarStrom; fuer: RadarStrom | "beide"; rueckstand: number }[] {
  const ziel = { firma: m.firmenJeStunde, partner: m.partnerJeStunde } as Record<RadarStrom, number>;
  const dran: { strom: RadarStrom; fuer: RadarStrom | "beide"; rueckstand: number }[] = [];
  const leer = (s: RadarStrom) => ziel[s] > 0 && st[s].schlange <= 0;
  const aktiv = (s: RadarStrom) => ziel[s] > 0 && st[s].schlange > 0;
  if ((leer("firma") && aktiv("partner")) || (leer("partner") && aktiv("firma"))) {
    // Einer hat nichts in der Warteschlange: Der andere sendet für beide (Ziele und Gesendetes zusammen). Ein Strom mit
    // Ziel 0 ist aus — er füllt keine Lücke und hinterlässt keine.
    const voll: RadarStrom = aktiv("firma") ? "firma" : "partner";
    const letzte = [st.firma.letzte, st.partner.letzte].filter(Boolean).map((d) => (d as Date).getTime());
    const gesendet = st.firma.gesendet + st.partner.gesendet;
    const s = radarMotorSoll({ jetzt, m, jeStunde: ziel.firma + ziel.partner, gesendetHeute: gesendet, letzteAm: letzte.length ? new Date(Math.max(...letzte)) : null, bremse, bremseSeit });
    if (s.faellig) dran.push({ strom: voll, fuer: "beide", rueckstand: (s.soll - gesendet) / Math.max(1, ziel.firma + ziel.partner) });
    return dran;
  }
  for (const strom of RADAR_STROEME) {
    if (ziel[strom] <= 0 || st[strom].schlange <= 0) continue;
    const s = radarMotorSoll({ jetzt, m, jeStunde: ziel[strom], gesendetHeute: st[strom].gesendet, letzteAm: st[strom].letzte, bremse, bremseSeit });
    if (s.faellig) dran.push({ strom, fuer: strom, rueckstand: (s.soll - st[strom].gesendet) / ziel[strom] });
  }
  return dran.sort((x, y) => y.rueckstand - x.rueckstand);
}

/**
 * Stand je Strom heute (Berliner Tag): gesendete erste Mails, die letzte, die Warteschlange. Die Warteschlange zählt nur, was
 * jetzt gesendet werden darf (Partner aus eingeschalteten Gruppen, nicht in einer Pause nach einem Sendefehler).
 */
async function stromStand(lauf: any, jetzt: Date, gruppen: readonly string[]): Promise<Record<RadarStrom, StromStand>> {
  const tag = berlinToday(jetzt);
  const gesendet = (await lauf`
    SELECT f.strom, COUNT(*)::int AS n, MAX(p.datum) AS letzte
      FROM fiaon_radar_post p JOIN fiaon_radar_firmen f ON f.id = p.firma_id
     WHERE p.richtung = 'aus' AND p.art = 'erstmail' AND (p.datum AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date
     GROUP BY f.strom`) as any[];
  const offen = (await lauf`
    SELECT strom,
           COUNT(*) FILTER (WHERE motor_status = 'bereit' AND motor_am <= NOW() AND (strom <> 'partner' OR bereich = ANY(${[...gruppen]}::text[])))::int AS schlange,
           COUNT(*) FILTER (WHERE motor_status = 'sendet')::int AS sendet,
           MAX(motor_am) FILTER (WHERE motor_status = 'sendet') AS letzte
      FROM fiaon_radar_firmen WHERE motor_status IN ('bereit', 'sendet') GROUP BY strom`) as any[];
  const aus = {} as Record<RadarStrom, StromStand>;
  for (const s of RADAR_STROEME) {
    const g = gesendet.find((x) => x.strom === s), o = offen.find((x) => x.strom === s);
    const zeiten = [g?.letzte, o?.letzte].filter(Boolean).map((d) => new Date(d).getTime());
    aus[s] = { gesendet: Number(g?.n ?? 0) + Number(o?.sendet ?? 0), letzte: zeiten.length ? new Date(Math.max(...zeiten)) : null, schlange: Number(o?.schlange ?? 0) };
  }
  return aus;
}

/** Die Zustell-Bremse (Punkt 7): 1 = volle Fahrt. Steht als JSON in fiaon_settings (radar_motor_bremse). */
export async function bremseFaktor(lauf: any = sqlPool): Promise<number> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'radar_motor_bremse'`.catch(() => [])) as any[];
  try { const f = Number(JSON.parse(String(z?.value ?? "{}"))?.faktor); return Number.isFinite(f) && f > 0 && f <= 1 ? f : 1; } catch { return 1; }
}

/**
 * Übernimmt unter der Sperre die nächste fertige Mail eines Stroms, wenn sie dran ist — samt Postfach. Zwei Instanzen
 * zählen hier hintereinander: Die zweite sieht die „sendet“-Zeile der ersten und hält sich zurück.
 * E-458 (Befund): nur Partner aus eingeschalteten Gruppen; abgeleitete Adressen nur, solange die Ableitung an ist; eine
 * Mail nach einem Sendefehler erst nach ihrer Wartezeit (motor_am in der Zukunft); jedes Postfach in seinem Takt.
 */
async function uebernehmen(jetzt: Date, m: RadarMotor, bremse: RadarBremse | null, nurStrom: RadarStrom | null, ohneSoll: boolean): Promise<{ id: number; strom: RadarStrom; postfach: string }[]> {
  const faktor = bremse && bremse.faktor > 0 && bremse.faktor <= 1 ? bremse.faktor : 1;
  return (await sqlPool.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(${MOTOR_SPERRE})`;
    const st = await stromStand(tx, jetzt, m.partnerGruppen);
    const dran = ohneSoll
      ? RADAR_STROEME.filter((s) => st[s].schlange > 0 && (!nurStrom || s === nurStrom)).slice(0, 1).map((s) => ({ strom: s, fuer: s, rueckstand: 0 }))
      : motorDran(jetzt, m, st, faktor, bremse?.seit ?? null).filter((d) => !nurStrom || d.strom === nurStrom);
    const aus: { id: number; strom: RadarStrom; postfach: string }[] = [];
    let lagen = await postfachLagen(jetzt, tx);
    // Der Takt je Postfach verteilt seinen Rest über das restliche Fenster („Jetzt eine senden“ nur mit Mindestabstand).
    const restSek = ohneSoll ? null : radarMotorReststunden(jetzt, m) * 3600;
    // E-458 (Punkt 5): höchstens radar_ableitung_anteil Prozent der Mails je Stunde an abgeleitete Adressen — gezählt nach
    // der Herkunft am Eintrag (adress_weg), nicht nach dem Entscheider, der sich später ändern kann.
    const [st1] = (await tx`
      SELECT COUNT(*) FILTER (WHERE p.adress_weg = 'abgeleitet')::int AS abg, COUNT(*)::int AS alle
        FROM fiaon_radar_post p
       WHERE p.richtung = 'aus' AND p.art = 'erstmail' AND p.datum > NOW() - INTERVAL '1 hour'`) as any[];
    let abg = Number(st1?.abg ?? 0), alle = Number(st1?.alle ?? 0);
    for (const d of dran) {
      const p = radarPostfachWaehlen(lagen, jetzt, restSek);
      if (!p) break;
      const abgeleitetErlaubt = m.ableitung && ((abg + 1) / (alle + 1)) * 100 <= m.ableitungAnteil;
      const [z] = (await tx`
        UPDATE fiaon_radar_firmen SET motor_status = 'sendet', motor_am = NOW(), postfach = ${p.adresse}
         WHERE id = (SELECT id FROM fiaon_radar_firmen WHERE motor_status = 'bereit' AND strom = ${d.strom} AND motor_am <= NOW()
                        AND (strom <> 'partner' OR bereich = ANY(${m.partnerGruppen}::text[]))
                        AND (${abgeleitetErlaubt} OR COALESCE(entscheider->>'weg', '') <> 'abgeleitet')
                      ORDER BY COALESCE(signal_staerke, 0) DESC, passung DESC NULLS LAST, motor_am ASC LIMIT 1 FOR UPDATE SKIP LOCKED)
           AND motor_status = 'bereit'
        RETURNING id, (entscheider->>'weg') AS weg`) as any[];
      if (!z) continue;
      alle++; if (z.weg === "abgeleitet") abg++;
      aus.push({ id: Number(z.id), strom: d.strom, postfach: p.adresse });
      lagen = lagen.map((x) => (x.adresse === p.adresse ? { ...x, heute: x.heute + 1, letzteAm: jetzt } : x));
    }
    return aus;
  })) as { id: number; strom: RadarStrom; postfach: string }[];
}

export interface SendenErgebnis { gesendet: number; je: Record<RadarStrom, number>; verworfen: number; zurueck: number; grund?: string }

let letzterPuls = 0;
/**
 * Jede Minute, nur im Fenster: je Strom höchstens EINE erste Mail, wenn sie dran ist. Keine KI, keine KI-Pause — die
 * Warteschlange geht auch dann hinaus. opt.jetzt / opt.sender nur für den Prüfstand; opt.einmal = „Jetzt eine senden“.
 *
 * E-458 (Befund Sendefehler) — was ein Fehler beim Senden mit der Mail macht:
 *   Wand (400/404/409: gesperrt, Gespräch, Österreich, Regeln, Prüf-KI, schon Partner) → „verworfen“, endgültig.
 *   Unklar (Netz, 5xx nach dem Aufruf) → bleibt „sendet“; nach 10 Minuten entscheidet der Gesendet-Ordner (nie doppelt).
 *   Postfach gestört (Token, Zugang, Rate-Limit, keine Unterschrift) → die Mail zurück auf „bereit“ ohne Strafe, das
 *     POSTFACH pausiert 15 Minuten (dann 30, 60, 120) — eine Stunde Gmail-Störung verbrennt keine geprüften Top-Firmen mehr.
 *   Gmail lehnt genau diese Mail ab → zurück auf „bereit“ mit Wartezeit (30 Min × Versuch), ab drei Sendefehlern verworfen
 *     (nach einem Tag einmal zurück, warteschlangeAufraeumen).
 */
export async function radarMotorSenden(opt: { jetzt?: Date; sender?: RadarSender | null; einmal?: boolean } = {}): Promise<SendenErgebnis> {
  const jetzt = opt.jetzt ?? new Date();
  const erg: SendenErgebnis = { gesendet: 0, je: { firma: 0, partner: 0 }, verworfen: 0, zurueck: 0 };
  const a = await radarAutomatik();
  if (!a.versand) return { ...erg, grund: "aus" };
  const m = await radarMotorEinstellung();
  if (!radarMotorImFenster(jetzt, m)) return { ...erg, grund: "außerhalb des Sendefensters" };
  if (!opt.sender && !gmailBereit()) return { ...erg, grund: "Gmail-Anbindung fehlt" };
  await ensureRadarTabellen();
  const bremse = await bremseLesen();
  // Die Bereitschaft der Postfächer VOR der Sperre prüfen (Gmail, DNS — Netz gehört nicht in die Transaktion).
  for (const a of radarPostfaecher()) await postfachBereitschaft(a);
  const genommen = await uebernehmen(jetzt, m, bremse, null, !!opt.einmal);
  if (!genommen.length) return { ...erg, grund: "nichts fällig" };
  for (const g of genommen) {
    try {
      await radarMailAusgeben(g.id, { art: "senden", postfach: g.postfach, von: null, sender: opt.sender ?? null, grenzeGeprueft: true });
      await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'gesendet', motor_am = NOW(), motor_grund = NULL WHERE id = ${g.id}`;
      await postfachStoerungSetzen(g.postfach, null);
      erg.gesendet++; erg.je[g.strom]++;
    } catch (e: any) {
      const grund = String(e?.message || e).slice(0, 400);
      const wand = e instanceof RadarFehler && [400, 404, 409].includes(e.status);
      const unklar = e?.versandUnklar === true;
      const postfachStoerung = (e instanceof RadarFehler && [403, 429, 503].includes(e.status)) || (!(e instanceof RadarFehler) && radarSendeFehlerArt(e) === "postfach");
      if (wand) {
        await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'verworfen', motor_am = NOW(), motor_grund = ${`Beim Senden: ${grund}`} WHERE id = ${g.id} AND motor_status = 'sendet'`;
        erg.verworfen++;
      } else if (unklar) {
        // Bleibt „sendet“ — der Abgleich mit dem Gesendet-Ordner entscheidet (warteschlangeAufraeumen). Das Postfach ruht kurz.
        await sqlPool`UPDATE fiaon_radar_firmen SET motor_grund = ${`Unklar, ob gesendet: ${grund}`.slice(0, 400)} WHERE id = ${g.id} AND motor_status = 'sendet'`;
        await postfachStoerungSetzen(g.postfach, `Unklar, ob gesendet (${grund.slice(0, 120)})`);
        erg.zurueck++;
        console.error(`[MAIL-MOTOR] Senden ${g.id} unklar:`, grund);
      } else if (postfachStoerung) {
        await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'bereit', motor_grund = ${`Postfach gestört, kommt wieder: ${grund}`.slice(0, 400)}
                       WHERE id = ${g.id} AND motor_status = 'sendet'`;
        await postfachStoerungSetzen(g.postfach, grund);
        erg.zurueck++;
        console.error(`[MAIL-MOTOR] Postfach ${g.postfach} gestört:`, grund);
      } else {
        await sqlPool`UPDATE fiaon_radar_firmen SET motor_sendefehler = motor_sendefehler + 1,
                              motor_status = CASE WHEN motor_sendefehler + 1 >= 3 THEN 'verworfen' ELSE 'bereit' END,
                              motor_am = NOW() + make_interval(mins => ${30} * (motor_sendefehler + 1)),
                              motor_grund = ${`Senden fehlgeschlagen: ${grund}`}
                       WHERE id = ${g.id} AND motor_status = 'sendet'`;
        erg.zurueck++;
        console.error(`[MAIL-MOTOR] Senden ${g.id}:`, grund);
      }
    }
  }
  return erg;
}

/**
 * E-458 (Befund): „Zurück in den Vorrat“ (Akte) — eine verworfene oder abgelaufene Firma wird wieder vorbereitet (neuer
 * Text, neue Prüfung). Nie für Firmen, die schon eine erste Mail bekamen.
 */
export async function radarZurueckInVorrat(id: number): Promise<void> {
  await ensureRadarTabellen();
  const [z] = (await sqlPool`
    UPDATE fiaon_radar_firmen SET motor_status = NULL, motor_grund = NULL, motor_versuche = 0, motor_sendefehler = 0, motor_am = NOW(), updated_at = NOW()
     WHERE id = ${id} AND motor_status IN ('verworfen', 'abgelaufen') AND versendet_am IS NULL
    RETURNING id`) as any[];
  if (!z) throw new RadarFehler("Nur verworfene oder abgelaufene Firmen ohne erste Mail gehen zurück in den Vorrat.", 409);
}

/** Für den Minutentakt (nurMitErgebnis): eine Historienzeile, wenn gesendet wurde — und einmal je Stunde als Lebenszeichen. */
export async function radarMotorSendenTakt(): Promise<boolean> {
  const r = await radarMotorSenden();
  if (r.gesendet > 0 || r.verworfen > 0 || r.zurueck > 0) { letzterPuls = Date.now(); return true; }
  if (Date.now() - letzterPuls >= 60 * 60_000) { letzterPuls = Date.now(); return true; }
  return false;
}

// ── SCHUTZ DER ABLEITUNG (E-458 Punkt 5) ──────────────────────────────────────
/** Aufgabe für Justin über die TODO-Pipeline (einmal je Schlüssel). */
async function aufgabeMotor(titel: string, text: string, schluessel: string): Promise<void> {
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: null, ref: null, titel: titel.slice(0, 160), text: text.slice(0, 1500), dringend: true,
      schluessel, quelle: "radar", bereich: "postmeister", anBetreiber: true,
      link: "/chef/s/firmen-radar?reiter=automatik", autorName: "Mara (Mail-Motor)", anlageText: "Angelegt vom Mail-Motor (E-458).",
    });
  } catch (e: any) {
    console.error("[MAIL-MOTOR] Aufgabe:", e?.message || e);
  }
}

/**
 * Prüft die Rückläufer der ABGELEITETEN Adressen (7 Tage, ab 30 Sendungen). Über radar_ableitung_rueck_max schaltet sie
 * die Ableitung ab (radar_ableitung = aus) und legt eine dringende Aufgabe an. Läuft im 10-Minuten-Lauf radar_versand.
 */
export async function radarAbleitungWache(): Promise<{ quote: number | null; abgeschaltet: boolean }> {
  const m = await radarMotorEinstellung();
  if (!m.ableitung) return { quote: null, abgeschaltet: false };
  // E-458 (Befund): gezählt nach der Herkunft AM EINTRAG (adress_weg) — die erste Mail trägt sie beim Senden, der Rückläufer
  // bekommt sie von dieser Mail. Vorher fielen Sendung und Rückläufer heraus, sobald der Entscheider überschrieben wurde.
  const [z] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE p.richtung = 'aus' AND p.art = 'erstmail')::int AS gesendet,
           COUNT(*) FILTER (WHERE p.richtung = 'ein' AND p.art = 'unzustellbar')::int AS rueck
      FROM fiaon_radar_post p
     WHERE p.adress_weg = 'abgeleitet' AND p.datum > NOW() - INTERVAL '7 days'`) as any[];
  const { radarAbleitungUrteil } = await import("@shared/fiaon-radar");
  const u = radarAbleitungUrteil({ gesendet: Number(z?.gesendet ?? 0), rueck: Number(z?.rueck ?? 0), rueckMax: m.ableitungRueckMax });
  if (!u.abschalten) return { quote: u.quote, abgeschaltet: false };
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('radar_ableitung', 'aus') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  await aufgabeMotor("Mail-Motor: Adress-Ableitung abgeschaltet (Rückläufer)",
    `Abgeleitete Chef-Adressen kamen in 7 Tagen zu ${String(u.quote).replace(".", ",")} % zurück (Grenze ${String(m.ableitungRueckMax).replace(".", ",")} %, ${z?.gesendet} Sendungen). Die Ableitung ist aus; Mails gehen nur noch an belegte Adressen. Wieder einschalten unter Automatik › Adressen, wenn die Ursache klar ist.`,
    `radar-ableitung:${berlinToday()}`);
  return { quote: u.quote, abgeschaltet: true };
}

// ── ZUSTELLUNG SCHÜTZEN (E-458 Punkt 7) ───────────────────────────────────────
/** Die Bremse aus fiaon_settings (radar_motor_bremse). */
export async function bremseLesen(): Promise<RadarBremse | null> {
  const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'radar_motor_bremse'`.catch(() => [])) as any[];
  try { const b = JSON.parse(String(z?.value ?? "null")); return b && typeof b === "object" ? b : null; } catch { return null; }
}

/** Die Werte der letzten 7 Tage — gesamt und je Postfach: Sendungen des Radars, Rückläufer, Beschwerden. */
export async function zustellWerte(m: RadarMotor): Promise<{ gesamt: RadarZustellWerte; je: Record<string, RadarZustellWerte> }> {
  const zeilen = (await sqlPool`
    SELECT postfach,
           COUNT(*) FILTER (WHERE richtung = 'aus' AND art <> 'von_hand')::int AS gesendet,
           COUNT(*) FILTER (WHERE richtung = 'ein' AND art = 'unzustellbar')::int AS rueck,
           COUNT(*) FILTER (WHERE richtung = 'ein' AND beschwerde)::int AS beschwerden
      FROM fiaon_radar_post WHERE datum > NOW() - INTERVAL '7 days' GROUP BY postfach`) as any[];
  const summe = zeilen.reduce((a, z) => ({ gesendet: a.gesendet + Number(z.gesendet), rueck: a.rueck + Number(z.rueck), beschwerden: a.beschwerden + Number(z.beschwerden) }), { gesendet: 0, rueck: 0, beschwerden: 0 });
  return {
    gesamt: radarZustellWerte({ ...summe, basis: m.zustellBasis }),
    je: Object.fromEntries(zeilen.map((z) => [String(z.postfach), radarZustellWerte({ gesendet: Number(z.gesendet), rueck: Number(z.rueck), beschwerden: Number(z.beschwerden), basis: m.zustellBasis })])),
  };
}

/**
 * Die Zustell-Wache (im 10-Minuten-Lauf radar_versand): Rückläufer über radar_zustell_rueck_max oder Beschwerden über
 * radar_zustell_beschwerde_max in 7 Tagen → radar_motor_bremse halbiert das Tempo (Stundenziele UND Tagesgrenze der
 * Postfächer; nach 48 h weiter drüber: ein Viertel) und Justin bekommt eine dringende Aufgabe (einmal je Tag). Drei Tage
 * unter beiden Grenzen → volle Fahrt und eine Meldung.
 * E-458 (Befund): Ein einzelnes Postfach über der Grenze pausiert 48 Stunden NUR, wenn ein anderes Postfach sauber weiter
 * sendet — mit js@ allein hieße die Pause Vollstopp; dann bremst allein der Faktor.
 */
export async function radarZustellWache(jetzt: Date = new Date()): Promise<{ bremse: number; pausiert: string[] }> {
  const m = await radarMotorEinstellung();
  const werte = await zustellWerte(m);
  const alt = await bremseLesen();
  const grenzen = { rueckMax: m.zustellRueckMax, beschwerdeMax: m.zustellBeschwerdeMax };
  const neu = radarBremseEntscheiden({ werte: werte.gesamt, bremse: alt, jetzt, grenzen });
  const { neu: istNeu, geloest, ...speichern } = neu;
  if (JSON.stringify(speichern) !== JSON.stringify(alt ?? {})) {
    await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('radar_motor_bremse', ${JSON.stringify(speichern)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  const zahl = (n: number | null) => (n == null ? "—" : `${String(n).replace(".", ",")} %`);
  if (istNeu) {
    await aufgabeMotor(`Mail-Motor gebremst auf ×${String(neu.faktor).replace(".", ",")} (Zustellung)`,
      `${neu.grund}. 7 Tage: ${werte.gesamt.gesendet} Sendungen, ${werte.gesamt.rueck} Rückläufer (${zahl(werte.gesamt.rueckQuote)}), ${werte.gesamt.beschwerden} Beschwerden (${zahl(werte.gesamt.beschwerdeQuote)}). Der Motor sendet langsamer, bis die Werte drei Tage unter den Grenzen liegen. Prüfen: Adressen, Texte, Postfächer — „Bremse lösen“ unter Automatik › Zustellung.`,
      `radar-zustellung:${berlinToday(jetzt)}`);
  }
  if (geloest) {
    console.log("[MAIL-MOTOR] Zustell-Bremse gelöst — drei Tage unter beiden Grenzen.");
    await aufgabeMotor("Mail-Motor: Bremse gelöst", "Rückläufer und Beschwerden liegen seit drei Tagen unter den Grenzen — der Mail-Motor fährt wieder mit vollem Takt.", `radar-zustellung-frei:${berlinToday(jetzt)}`);
  }
  // Ein Postfach über der Grenze pausiert 48 Stunden — nur, wenn ein anderes Radar-Postfach (frei, nicht pausiert) in
  // diesen 7 Tagen gesendet hat und selbst unter beiden Grenzen liegt. Sonst wäre die Pause ein Vollstopp.
  const pausen = await postfachPausen();
  const pausiert: string[] = [];
  const radar = new Set(radarPostfaecher());
  const ueber = (w: RadarZustellWerte) => (w.rueckQuote != null && w.rueckQuote > grenzen.rueckMax) || (w.beschwerdeQuote != null && w.beschwerdeQuote > grenzen.beschwerdeMax);
  const laeuftPause = (a: string) => !!pausen[a] && new Date(pausen[a]).getTime() > jetzt.getTime();
  for (const [adresse, w] of Object.entries(werte.je)) {
    const drueber = ueber(w);
    const laeuft = laeuftPause(adresse);
    const andereSauber = Object.entries(werte.je).some(([b, wb]) => b !== adresse && radar.has(b) && wb.gesendet > 0 && !ueber(wb)
      && !laeuftPause(b) && !m.postfachAus.includes(b));
    if (drueber && !laeuft && andereSauber) {
      pausen[adresse] = new Date(jetzt.getTime() + 48 * 3_600_000).toISOString();
      pausiert.push(adresse);
      await aufgabeMotor(`Mail-Motor: Postfach ${adresse} pausiert (48 h)`,
        `Aus ${adresse}: ${w.gesendet} Sendungen in 7 Tagen, Rückläufer ${zahl(w.rueckQuote)}, Beschwerden ${zahl(w.beschwerdeQuote)}. Das Postfach sendet 48 Stunden keine ersten Mails.`,
        `radar-zustellung:${adresse}:${berlinToday(jetzt)}`);
    }
  }
  if (pausiert.length) await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('radar_postfach_pause', ${JSON.stringify(pausen)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return { bremse: neu.faktor, pausiert };
}

/** „Bremse lösen“ (Chefbüro, mit Bestätigung): volle Fahrt sofort. */
export async function radarBremseLoesen(): Promise<void> {
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('radar_motor_bremse', ${JSON.stringify({ faktor: 1, seit: null, grund: null, unterSeit: null })}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

// ── FÜR DAS CHEFBÜRO ─────────────────────────────────────────────────────────
/** Der Stand des Motors: Schalter, Fenster, Warteschlange je Strom, gesendet je Stunde, ehrliche Leistung. */
export async function radarMotorStand(jetzt: Date = new Date()): Promise<any> {
  await ensureRadarTabellen();
  const m = await radarMotorEinstellung();
  const a = await radarAutomatik();
  const bremse = await bremseFaktor();
  const leistung = await motorMoeglich(m, jetzt, bremse);
  const tag = berlinToday(jetzt);
  const schlange = (await sqlPool`
    SELECT strom, motor_status, COUNT(*)::int AS n FROM fiaon_radar_firmen WHERE motor_status IS NOT NULL
       AND (motor_status IN ('arbeit', 'bereit', 'sendet') OR (motor_am AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date)
     GROUP BY strom, motor_status`) as any[];
  const je = (strom: RadarStrom, status: string) => Number(schlange.find((z) => z.strom === strom && z.motor_status === status)?.n ?? 0);
  const gruende = (await sqlPool`
    SELECT strom, motor_grund AS grund, COUNT(*)::int AS n FROM fiaon_radar_firmen
     WHERE motor_status = 'verworfen' AND (motor_am AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date AND motor_grund IS NOT NULL
     GROUP BY strom, motor_grund ORDER BY n DESC LIMIT 8`) as any[];
  const stunden = (await sqlPool`
    SELECT f.strom, EXTRACT(HOUR FROM (p.datum AT TIME ZONE 'Europe/Berlin'))::int AS stunde, COUNT(*)::int AS n
      FROM fiaon_radar_post p JOIN fiaon_radar_firmen f ON f.id = p.firma_id
     WHERE p.richtung = 'aus' AND p.art = 'erstmail' AND (p.datum AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date
     GROUP BY f.strom, stunde`) as any[];
  const vorrat = (await sqlPool`
    SELECT strom, COUNT(*)::int AS n FROM fiaon_radar_firmen
     WHERE motor_status IS NULL AND archiviert_am IS NULL AND versendet_am IS NULL AND status IN ('neu', 'gescannt', 'mail')
       AND (signal_staerke IS NULL OR signal_staerke >= ${RADAR_SIGNAL_AB}) GROUP BY strom`) as any[];
  const { minute } = radarBerlinTagMinute(jetzt);
  const zustellung = await zustellWerte(m).catch(() => null);
  // Prüf-KI heute (Punkt 4): gelesen, freigegeben, neu geschrieben, verworfen — und die nächste Mail als Vorschau.
  const [pk] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE (pruef_ki_am AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date)::int AS geprueft,
           COUNT(*) FILTER (WHERE (pruef_ki_am AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date AND pruef_ki->>'ok' = 'true')::int AS bestanden,
           COUNT(*) FILTER (WHERE (pruef_ki_am AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date AND COALESCE((pruef_ki->>'versuch')::int, 1) >= 2)::int AS neu,
           COUNT(*) FILTER (WHERE motor_status = 'verworfen' AND motor_grund LIKE 'Mail:%' AND (motor_am AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date)::int AS verworfen
      FROM fiaon_radar_firmen`.catch(() => [{}])) as any[];
  const pkGruende = ((await sqlPool`
    SELECT motor_grund FROM fiaon_radar_firmen WHERE motor_status = 'verworfen' AND motor_grund LIKE 'Mail:%' ORDER BY motor_am DESC LIMIT 5`.catch(() => [])) as any[]).map((z) => String(z.motor_grund));
  const [naechste] = ((await sqlPool`
    SELECT id, name, strom, mail FROM fiaon_radar_firmen WHERE motor_status = 'bereit'
     ORDER BY COALESCE(signal_staerke, 0) DESC, passung DESC NULLS LAST, motor_am ASC LIMIT 1`.catch(() => [])) as any[]).map((z) => zeileLesen(z));
  // Partner je Gruppe (Punkt 2): Vorrat, Warteschlange, gesendet.
  const partnerJe = (await sqlPool`
    SELECT bereich,
           COUNT(*) FILTER (WHERE motor_status IS NULL AND archiviert_am IS NULL AND versendet_am IS NULL AND status IN ('neu', 'gescannt', 'mail'))::int AS vorrat,
           COUNT(*) FILTER (WHERE motor_status = 'bereit')::int AS bereit,
           COUNT(*) FILTER (WHERE versendet_am IS NOT NULL)::int AS gesendet,
           COUNT(*) FILTER (WHERE partner_firma_id IS NOT NULL)::int AS im_crm
      FROM fiaon_radar_firmen WHERE strom = 'partner' GROUP BY bereich`.catch(() => [])) as any[];
  // Adressen (Punkt 5): Anteil abgeleiteter Adressen, ihre Rückläufer (nach der Herkunft am Eintrag); Österreich im
  // Brief-Vorrat (Punkt 8, „Österreich gewinnt“).
  const [adr] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE p.richtung = 'aus' AND p.art = 'erstmail')::int AS gesendet,
           COUNT(*) FILTER (WHERE p.richtung = 'aus' AND p.art = 'erstmail' AND p.adress_weg = 'abgeleitet')::int AS abgeleitet,
           COUNT(*) FILTER (WHERE p.richtung = 'ein' AND p.art = 'unzustellbar' AND p.adress_weg = 'abgeleitet')::int AS rueck_abgeleitet
      FROM fiaon_radar_post p WHERE p.datum > NOW() - INTERVAL '7 days'`.catch(() => [{}])) as any[];
  const [oesterreich] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_radar_firmen r
     WHERE r.archiviert_am IS NULL AND r.versendet_am IS NULL AND r.brief_versendet_am IS NULL AND COALESCE(r.signal_staerke, 0) >= ${RADAR_SIGNAL_AB}
       AND r.status IN ('neu', 'gescannt', 'mail', 'ohne_kontakt')
       AND ${sqlOesterreich()}`.catch(() => [{ n: 0 }])) as any[];
  const stoerungen = await postfachStoerungen();
  const brief = await (async () => { try { const { radarBriefEinstellung } = await import("./fiaon-radar-brief"); return await radarBriefEinstellung(); } catch { return null; } })();
  return {
    pruefKi: { geprueft: Number(pk?.geprueft ?? 0), bestanden: Number(pk?.bestanden ?? 0), neuGeschrieben: Number(pk?.neu ?? 0), verworfen: Number(pk?.verworfen ?? 0), gruende: pkGruende,
      naechste: naechste?.mail ? { name: naechste.name, strom: naechste.strom, betreff: naechste.mail.betreff, anrede: naechste.mail.anrede, absaetze: naechste.mail.absaetze, frage: naechste.mail.frage, schluss: naechste.mail.schluss ?? null } : null,
      kiKlangMax: m.kiKlangMax, aehnlichMax: m.aehnlichMax },
    partner: { gruppen: m.partnerGruppen, tagesziel: m.partnerTagesziel, je: Object.fromEntries(partnerJe.map((z) => [String(z.bereich), { vorrat: Number(z.vorrat), bereit: Number(z.bereit), gesendet: Number(z.gesendet), imCrm: Number(z.im_crm) }])) },
    adressen: { ableitung: m.ableitung, anteilMax: m.ableitungAnteil, rueckMax: m.ableitungRueckMax, gesendet7: Number(adr?.gesendet ?? 0), abgeleitet7: Number(adr?.abgeleitet ?? 0), rueckAbgeleitet7: Number(adr?.rueck_abgeleitet ?? 0),
      oesterreichBrief: Number(oesterreich?.n ?? 0), briefVersand: brief ? brief.versand : null, briefTest: brief ? brief.testmodus : null },
    zustellung: zustellung ? { ...zustellung, grenzen: { rueckMax: m.zustellRueckMax, beschwerdeMax: m.zustellBeschwerdeMax, basis: m.zustellBasis }, bremse: await bremseLesen(), pausen: await postfachPausen() } : null,
    einstellung: m, an: a.versand, abPassung: a.abPassung, imFenster: radarMotorImFenster(jetzt, m), jetztMinute: minute, bremse,
    leistung: { ziel: leistung.ziel, moeglich: leistung.moeglich, leistungJeStunde: leistung.leistung, je: leistung.je, tagJe: leistung.tagJe, satz: leistung.satz, postfaecherNoetig: leistung.postfaecherNoetig },
    postfaecher: leistung.postfaecher.map((p) => {
      const b = bereitschaftCache.get(p.adresse);
      const s = stoerungen[p.adresse] && new Date(stoerungen[p.adresse].bis).getTime() > jetzt.getTime() ? stoerungen[p.adresse] : null;
      const uhr = s ? (() => { const min = radarBerlinTagMinute(new Date(s.bis)).minute; return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; })() : "";
      return { ...p, name: b?.name ?? null, quelle: b?.quelle ?? null, gruende: b?.gruende ?? [], gmail: b?.gmail ?? null, dns: b?.dns ?? null, signaturHtml: b?.signaturHtml ?? null,
        stoerung: [...(b?.stoerung ?? []), ...(s ? [`Sendet wieder ab ${uhr} Uhr: ${s.grund}`] : [])] };
    }),
    stroeme: Object.fromEntries(RADAR_STROEME.map((s) => [s, {
      bereit: je(s, "bereit"), arbeit: je(s, "arbeit"), sendet: je(s, "sendet"), gesendetHeute: je(s, "gesendet"), verworfenHeute: je(s, "verworfen"),
      vorrat: Number(vorrat.find((z) => z.strom === s)?.n ?? 0),
      gruende: gruende.filter((z) => z.strom === s).map((z) => ({ grund: String(z.grund), n: Number(z.n) })),
      stunden: stunden.filter((z) => z.strom === s).map((z) => ({ stunde: Number(z.stunde), n: Number(z.n) })),
    }])),
    status: RADAR_MOTOR_STATUS,
  };
}

/** Ein Postfach im Chefbüro pausieren oder wieder freigeben (radar_postfach_aus). */
export async function radarPostfachPausieren(adresse: string, pause: boolean): Promise<string[]> {
  const a = String(adresse || "").trim().toLowerCase();
  if (!radarPostfaecher().includes(a)) throw new RadarFehler("Dieses Postfach ist für den Radar nicht freigegeben.", 403);
  const m = await radarMotorEinstellung();
  const liste = pause ? Array.from(new Set([...m.postfachAus, a])) : m.postfachAus.filter((x) => x !== a);
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('radar_postfach_aus', ${liste.join(",")}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  if (!pause) {
    // Auch eine Pause der Zustell-Bremse für dieses Postfach endet mit dem Klick.
    const pausen = await postfachPausen();
    if (pausen[a]) { delete pausen[a]; await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('radar_postfach_pause', ${JSON.stringify(pausen)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`; }
  }
  return liste;
}

/** Setzt Motor-Schalter — nur bekannte Schlüssel, nur gültige Werte. */
export async function radarMotorSetzen(ein: Record<string, unknown>): Promise<RadarMotor> {
  const { RADAR_MOTOR_SCHLUESSEL: k, RADAR_MOTOR_HOECHSTENS_JE_STUNDE, radarUhrzeitMinuten } = await import("@shared/fiaon-radar");
  const setzen: [string, string][] = [];
  const ganz = (x: unknown, min: number, max: number, was: string) => {
    const n = Number(x);
    if (!Number.isInteger(n) || n < min || n > max) throw new RadarFehler(`${was}: ${min} bis ${max}.`);
    return String(n);
  };
  if (ein.tage !== undefined) {
    const liste = (Array.isArray(ein.tage) ? ein.tage : String(ein.tage).split(/[,;\s]+/)).map(Number);
    if (!liste.length || liste.some((n) => !Number.isInteger(n) || n < 1 || n > 7)) throw new RadarFehler("Tage: 1 (Montag) bis 7 (Sonntag).");
    setzen.push([k.tage, Array.from(new Set(liste)).sort((x, y) => x - y).join(",")]);
  }
  const von = ein.von !== undefined ? String(ein.von).trim() : null, bis = ein.bis !== undefined ? String(ein.bis).trim() : null;
  if (von !== null || bis !== null) {
    const aktuell = await radarMotorEinstellung();
    const v = radarUhrzeitMinuten(von ?? aktuell.von), b = radarUhrzeitMinuten(bis ?? aktuell.bis);
    if (v == null || b == null || v >= b) throw new RadarFehler("Fenster: von und bis als HH:MM, von vor bis.");
    if (von !== null) setzen.push([k.von, von]);
    if (bis !== null) setzen.push([k.bis, bis]);
  }
  if (ein.firmenJeStunde !== undefined) setzen.push([k.firmenJeStunde, ganz(ein.firmenJeStunde, 0, RADAR_MOTOR_HOECHSTENS_JE_STUNDE, "Firmen je Stunde")]);
  if (ein.partnerJeStunde !== undefined) setzen.push([k.partnerJeStunde, ganz(ein.partnerJeStunde, 0, RADAR_MOTOR_HOECHSTENS_JE_STUNDE, "Partner je Stunde")]);
  if (ein.puffer !== undefined) {
    const n = Number(String(ein.puffer).replace(",", "."));
    if (!Number.isFinite(n) || n < 0.1 || n > 5) throw new RadarFehler("Puffer: 0,1 bis 5 Tage.");
    setzen.push([k.puffer, String(n)]);
  }
  if (ein.haltbarTage !== undefined) setzen.push([k.haltbarTage, ganz(ein.haltbarTage, 1, 30, "Haltbar")]);
  if (ein.link !== undefined) {
    if (!["termin", "keiner"].includes(String(ein.link))) throw new RadarFehler("Link: „termin“ oder „keiner“.");
    setzen.push([k.link, String(ein.link)]);
  }
  if (ein.kiKlangMax !== undefined) setzen.push([k.kiKlangMax, ganz(ein.kiKlangMax, 0, 10, "KI-Klang")]);
  if (ein.aehnlichMax !== undefined) {
    const n = Number(String(ein.aehnlichMax).replace(",", "."));
    if (!Number.isFinite(n) || n < 0.05 || n > 1) throw new RadarFehler("Ähnlichkeit: 0,05 bis 1.");
    setzen.push([k.aehnlichMax, String(n)]);
  }
  if (ein.sucheTagesziel !== undefined) setzen.push([k.sucheTagesziel, ganz(ein.sucheTagesziel, 0, 500, "Suche Tagesziel")]);
  if (ein.sucheLaeufe !== undefined) setzen.push([k.sucheLaeufe, ganz(ein.sucheLaeufe, 0, 200, "Suchläufe")]);
  if (ein.partnerGruppen !== undefined) {
    const { radarPartnerGruppe } = await import("@shared/fiaon-radar");
    const liste = (Array.isArray(ein.partnerGruppen) ? ein.partnerGruppen : String(ein.partnerGruppen).split(/[,;\s]+/)).map(String).filter(Boolean);
    if (liste.some((g) => !radarPartnerGruppe(g))) throw new RadarFehler("Unbekannte Partner-Gruppe.");
    setzen.push([k.partnerGruppen, Array.from(new Set(liste)).join(",")]);
  }
  if (ein.ableitung !== undefined) setzen.push([k.ableitung, ein.ableitung === true || ein.ableitung === "an" ? "an" : "aus"]);
  if (ein.ableitungAnteil !== undefined) setzen.push([k.ableitungAnteil, ganz(ein.ableitungAnteil, 0, 100, "Anteil abgeleiteter Adressen")]);
  if (ein.ableitungRueckMax !== undefined) {
    const n = Number(String(ein.ableitungRueckMax).replace(",", "."));
    if (!Number.isFinite(n) || n < 0.5 || n > 50) throw new RadarFehler("Rückläufer-Grenze der Ableitung: 0,5 bis 50 Prozent.");
    setzen.push([k.ableitungRueckMax, String(n)]);
  }
  if (ein.postfachJeTag !== undefined) setzen.push([k.postfachJeTag, ganz(ein.postfachJeTag, 1, RADAR_HOECHSTENS_JE_TAG, "Mails je Postfach und Tag")]);
  if (ein.postfachRampe !== undefined) {
    const r = (Array.isArray(ein.postfachRampe) ? ein.postfachRampe : String(ein.postfachRampe).split(/[,;\s]+/)).map(Number).filter((n) => !Number.isNaN(n));
    if (!r.length || r.length > 4 || r.some((n) => !Number.isInteger(n) || n < 1 || n > RADAR_HOECHSTENS_JE_TAG)) throw new RadarFehler(`Hochfahren: eine bis vier Zahlen von 1 bis ${RADAR_HOECHSTENS_JE_TAG} (Woche 1, Woche 2 …).`);
    setzen.push([k.postfachRampe, r.join(",")]);
  }
  const prozent = (x: unknown, min: number, max: number, was: string, key: string) => {
    const n = Number(String(x).replace(",", "."));
    if (!Number.isFinite(n) || n < min || n > max) throw new RadarFehler(`${was}: ${String(min).replace(".", ",")} bis ${String(max).replace(".", ",")} Prozent.`);
    setzen.push([key, String(n)]);
  };
  if (ein.zustellRueckMax !== undefined) prozent(ein.zustellRueckMax, 0.5, 20, "Rückläufer-Grenze", k.zustellRueckMax);
  if (ein.zustellBeschwerdeMax !== undefined) prozent(ein.zustellBeschwerdeMax, 0.05, 5, "Beschwerde-Grenze", k.zustellBeschwerdeMax);
  if (ein.zustellBasis !== undefined) setzen.push([k.zustellBasis, ganz(ein.zustellBasis, 10, 1000, "Bremse rechnet ab so vielen Mails")]);
  if (ein.partnerTagesziel !== undefined) setzen.push([k.partnerTagesziel, ganz(ein.partnerTagesziel, 0, 500, "Partner je Tag")]);
  if (ein.partnerProvisionText !== undefined) {
    const t = String(ein.partnerProvisionText).replace(/[\r\n]+/g, " ").trim();
    if (t.length < 10 || t.length > 120 || !/prozent|%/i.test(t)) throw new RadarFehler("Provisions-Satz: 10 bis 120 Zeichen, mit „Prozent“.");
    setzen.push([k.partnerProvisionText, t]);
  }
  for (const [key, value] of setzen) {
    await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  return radarMotorEinstellung();
}
