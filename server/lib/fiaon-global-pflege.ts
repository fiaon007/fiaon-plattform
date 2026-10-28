// ═══════════════════════════════════════════════════════════════════════════
// PFLEGE EINES GLOBAL-AUFTRAGS — die Bausteine für scripts/global-auftrag-pflegen.ts (E-432, 28.10.2026)
//
// Justin (28.10.2026): „… update alles bei ihm — seine gesamten Unterlagen in den Tresor … einfach alles perfekt abwickeln
// und synchron halten, sodass alles Hand und Fuß hat!“
//
// Das Repo ist öffentlich: Hier steht KEIN Kundendatum. Namen, Ausweise und Dateien kommen zur Laufzeit aus Dateien
// außerhalb des Repos; die Ausgabe zeigt Werte nur maskiert.
//
//   · unterlageErkennen(name)        Dateiname → Dokumentart, Titel für den Kunden und neutraler Dateiname (rein)
//   · unterlageOhneMetadaten(…)      Metadaten heraus, ohne das Dokument neu zu zeichnen:
//                                      JPEG/PNG über fiaon-bild-bereinigen (EXIF, XMP, IPTC, Kommentare, Text-Blöcke),
//                                      PDF über pdf-lib (Info-Wörterbuch und XMP-Datenströme).
//                                    Ein PDF mit digitaler Signatur oder Verschlüsselung bleibt UNVERÄNDERT (sonst bräche die
//                                    Signatur) — der Aufrufer erfährt es. HEIC lehnt es ab (Metadaten nicht sicher zu entfernen).
//                                    Gleiche Datei → gleiches Ergebnis (gleicher Hash) — „nie doppelt“ hängt daran.
//   · globalAkteNachtragen(…)        fehlende Personendaten (Anrede, Staatsangehörigkeit, Reisepass) aus der privaten Datei in
//                                    Person, Bestellung und Akte — nur LEERE Felder, nie überschreiben; dazu die Person an die Akte
//   · globalVertragsfrist(ref)       der späteste Zahltag laut Vertrag (Rechnung + Zahlungsziel des Angebotsteils)
//
// Die Schreibwege für Tresor, Fahrplan, Zahlungsfrist und Empfehlung sind die vorhandenen (globalMandatDokument,
// globalStationSpeichern, zahlungsfristSetzen, koopEmpfehlungAendern) — das Skript ruft sie auf, hier wird nichts doppelt gebaut.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { bildOhneMetadaten } from "./fiaon-bild-bereinigen";
import { GLOBAL_DATEI_MAX_BYTES, globalDateiTyp, type GlobalDateiTyp } from "./fiaon-global-bereich-regeln";
import type { GlobalDokumentArt } from "@shared/fiaon-global-bereich";

// ── 1 · WELCHE UNTERLAGE IST DAS? ────────────────────────────────────────────
export interface UnterlageErkannt { art: GlobalDokumentArt; titel: string; dateiname: string }

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
/** „…2026-08…“ / „…2026_08…“ / „…08.2026…“ → { jahr, monat } — sonst null. */
function monatAusName(name: string): { jahr: string; monat: string } | null {
  const a = name.match(/(20\d\d)[-_. ]?(0[1-9]|1[0-2])(?!\d)/);
  if (a) return { jahr: a[1], monat: a[2] };
  const b = name.match(/(?<!\d)(0[1-9]|1[0-2])[-_. ](20\d\d)/);
  return b ? { jahr: b[2], monat: b[1] } : null;
}
const monatText = (m: { jahr: string; monat: string } | null) => (m ? ` ${MONATE[Number(m.monat) - 1]} ${m.jahr}` : "");
const monatDatei = (m: { jahr: string; monat: string } | null) => (m ? ` ${m.jahr}-${m.monat}` : "");

/**
 * Dateiname → Art, Titel und neutraler Dateiname. Erkannt wird am Wort, nicht an einer Nummer; was keinem Wort entspricht,
 * bleibt liegen (null) — lieber nichts ablegen als unter falscher Art (die Art einer FIAON-Ablage lässt sich nicht ändern).
 */
export function unterlageErkennen(nameRoh: string): UnterlageErkannt | null {
  const name = String(nameRoh ?? "").normalize("NFC").replace(/\.[A-Za-z0-9]{1,5}$/, "");
  const klein = name.toLowerCase();
  const seite = /vorder|front/.test(klein) ? "Vorderseite" : /r(ue|ü)ck|back/.test(klein) ? "Rückseite" : "";
  const m = monatAusName(name);
  if (/personalausweis|identity ?card|\bid[- _]?card\b|\bausweis\b/.test(klein)) {
    return { art: "personalausweis", titel: `Personalausweis${seite ? ` – ${seite}` : ""}`, dateiname: `Personalausweis${seite ? ` ${seite}` : ""}` };
  }
  if (/reisepass|passport|(^|[^a-zäöü])pass([^a-zäöü]|$)/.test(klein)) return { art: "reisepass", titel: "Reisepass", dateiname: "Reisepass" };
  if (/gehalt|lohn|verdienst|salary|payslip|pay[- _]slip/.test(klein)) {
    return { art: "einkommensnachweis", titel: `Gehaltsnachweis${monatText(m)}`, dateiname: `Gehaltsnachweis${monatDatei(m)}` };
  }
  if (/einkommen|income/.test(klein)) return { art: "einkommensnachweis", titel: `Einkommensnachweis${monatText(m)}`, dateiname: `Einkommensnachweis${monatDatei(m)}` };
  if (/kontoauszug|bank[- _]?statement|account[- _]?statement/.test(klein)) {
    return { art: "kontoauszug", titel: `Kontoauszug${monatText(m)}`, dateiname: `Kontoauszug${monatDatei(m)}` };
  }
  if (/adressnachweis|meldebescheinigung|proof[- _]?of[- _]?address|nebenkosten|stromrechnung|utility/.test(klein)) {
    return { art: "adressnachweis", titel: "Adressnachweis", dateiname: "Adressnachweis" };
  }
  return null;
}

// ── 2 · METADATEN HERAUS ─────────────────────────────────────────────────────
export interface UnterlageBereinigt {
  daten: Buffer;
  typ: GlobalDateiTyp;
  /** Was entfernt wurde (Namen der Blöcke, nie Inhalte). */
  entfernt: string[];
  /** Gesetzt, wenn die Datei bewusst unverändert bleibt (z. B. PDF mit digitaler Signatur). */
  unveraendert?: string;
}

/** Metadaten aus einer Unterlage entfernen. Wirft mit einem lesbaren Satz, wenn die Datei nicht abgelegt werden darf. */
export async function unterlageOhneMetadaten(roh: Buffer, name: string): Promise<UnterlageBereinigt> {
  if (!roh?.length) throw new Error(`${name}: leere Datei.`);
  if (roh.length > GLOBAL_DATEI_MAX_BYTES) throw new Error(`${name}: größer als 15 MB.`);
  const typ = globalDateiTyp(roh);
  if (!typ) throw new Error(`${name}: weder PDF noch JPG, PNG oder HEIC (geprüft wird der Inhalt, nicht die Endung).`);
  if (typ.mime === "image/heic") throw new Error(`${name}: HEIC — die Metadaten lassen sich hier nicht sicher entfernen. Bitte als JPG oder PDF speichern.`);
  if (typ.mime === "image/jpeg" || typ.mime === "image/png") {
    // Die Endung muss zum Inhalt passen (fiaon-bild-bereinigen) — geprüft wird mit der Endung des ERKANNTEN Inhalts.
    const b = bildOhneMetadaten(roh, `${name.replace(/\.[A-Za-z0-9]{1,5}$/, "")}.${typ.endung}`, GLOBAL_DATEI_MAX_BYTES);
    return { daten: b.daten, typ, entfernt: b.entfernt };
  }
  return pdfOhneMetadaten(roh, name, typ);
}

async function pdfOhneMetadaten(roh: Buffer, name: string, typ: GlobalDateiTyp): Promise<UnterlageBereinigt> {
  const latin = roh.toString("latin1");
  // Eine digitale Signatur deckt die Bytes der Datei (ByteRange) — jedes Neuschreiben machte sie ungültig.
  if (/\/ByteRange\s*\[/.test(latin) || /\/Type\s*\/Sig\b/.test(latin)) return { daten: roh, typ, entfernt: [], unveraendert: "PDF mit digitaler Signatur — unverändert abgelegt, damit die Signatur gültig bleibt" };
  if (/\/Encrypt\b/.test(latin)) return { daten: roh, typ, entfernt: [], unveraendert: "verschlüsseltes PDF — unverändert abgelegt" };
  const { PDFDocument, PDFDict, PDFName, PDFRef, PDFStream } = await import("pdf-lib");
  let doc: Awaited<ReturnType<typeof PDFDocument.load>>;
  let seitenVorher = 0;
  try {
    doc = await PDFDocument.load(roh, { updateMetadata: false });
    seitenVorher = doc.getPageCount();
  } catch (e) {
    throw new Error(`${name}: PDF lässt sich nicht lesen (${e instanceof Error ? e.message.slice(0, 80) : "unbekannt"}) — nicht abgelegt.`);
  }
  if (seitenVorher < 1) throw new Error(`${name}: PDF ohne Seiten — nicht abgelegt.`);
  const ctx = doc.context;
  const entfernt: string[] = [];
  const info = ctx.trailerInfo.Info;
  if (info) {
    if (info instanceof PDFRef) ctx.delete(info);
    ctx.trailerInfo.Info = undefined;
    entfernt.push("Info (Titel, Autor, Programm, Datum)");
  }
  let xmp = 0;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : obj instanceof PDFStream ? obj.dict : null;
    if (!dict) continue;
    const art = dict.get(PDFName.of("Type"));
    if (art && art.toString() === "/Metadata") { ctx.delete(ref); xmp++; continue; }
    if (dict.has(PDFName.of("Metadata"))) dict.delete(PDFName.of("Metadata"));
  }
  if (xmp) entfernt.push(xmp === 1 ? "XMP-Metadaten" : `XMP-Metadaten (${xmp}×)`);
  // Nichts zu entfernen: die Datei bleibt Byte für Byte, wie sie ist — so ist ein zweiter Lauf über dieselbe Datei gleich.
  if (!entfernt.length) return { daten: roh, typ, entfernt };
  const daten = Buffer.from(await doc.save({ useObjectStreams: false }));
  const probe = await PDFDocument.load(daten, { updateMetadata: false }).catch(() => null);
  if (!probe || probe.getPageCount() !== seitenVorher) throw new Error(`${name}: nach dem Bereinigen nicht mehr lesbar — nicht abgelegt.`);
  if (daten.length > GLOBAL_DATEI_MAX_BYTES) throw new Error(`${name}: nach dem Bereinigen größer als 15 MB.`);
  return { daten, typ, entfernt };
}

// ── 3 · PERSONENDATEN DER AKTE NACHTRAGEN ────────────────────────────────────
/** Was die private Datei liefert (Kunde eines Angebots: kunde.* aus angebot-….json). */
export interface AkteQuelle {
  anrede?: unknown; vorname?: unknown; nachname?: unknown; email?: unknown; staatsangehoerigkeit?: unknown; telefon?: unknown;
  ausweise?: { art?: unknown; nummer?: unknown; gueltigBis?: unknown }[] | unknown;
}
export interface AkteZeile {
  wo: "Akte" | "Person" | "Bestellung";
  feld: string;
  /** neu = wird/wurde nachgetragen; da = steht schon; fehlt = auch die Datei hat nichts; hand = bewusst nicht automatisch. */
  stand: "neu" | "da" | "fehlt" | "hand";
  /** Maskierte Anzeige des neuen Werts (nie der Klartext eines Ausweises). */
  anzeige?: string;
}
type AkteErgebnis = { ok: true; zeilen: AkteZeile[]; geschrieben: number } | { ok: false; error: string };

const leer = (v: unknown) => v == null || String(v).trim() === "";
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const nameNorm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
/** „deutsch“ → „Deutschland“ — so steht die Staatsangehörigkeit in Person und Bestellung (häufigste Form im Bestand). */
const LAND_AUS_ADJEKTIV: Record<string, string> = { deutsch: "Deutschland", "österreichisch": "Österreich", oesterreichisch: "Österreich", schweizerisch: "Schweiz" };
export function staatsangehoerigkeitAlsLand(roh: unknown): string | null {
  const t = String(roh ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const bekannt = LAND_AUS_ADJEKTIV[t.toLowerCase()];
  if (bekannt) return bekannt;
  return t.slice(0, 1).toUpperCase() + t.slice(1, 60);
}
function reisepassAus(q: AkteQuelle): { nummer: string; gueltigBis: string | null } | null {
  const liste = Array.isArray(q.ausweise) ? (q.ausweise as { art?: unknown; nummer?: unknown; gueltigBis?: unknown }[]) : [];
  const p = liste.find((a) => norm(a?.art) === "reisepass");
  const nummer = String(p?.nummer ?? "").toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{6,12}$/.test(nummer)) return null;
  const bis = String(p?.gueltigBis ?? "");
  return { nummer, gueltigBis: /^\d{4}-\d{2}-\d{2}$/.test(bis) ? bis : null };
}

/**
 * Trägt fehlende Personendaten nach — nur LEERE Felder, nie überschreiben. Vorher die Probe, dass die Datei zu DIESEM Auftrag
 * gehört (E-Mail gleich mit Akte, Bestellung oder Person, sonst Vor- und Nachname gleich mit der Person). `schreiben: false` =
 * nur der Plan. Telefon steht bewusst nur im Plan: Eine Nummer gehört über Alias und Abgleich an die Person (Akte › Stammdaten).
 */
export async function globalAkteNachtragen(ref: string, q: AkteQuelle, opts: { schreiben: boolean; agent: { id: number; name: string } }): Promise<AkteErgebnis> {
  const [g] = (await sqlPool`SELECT ref, person_id, email FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  if (!g) return { ok: false, error: "Diesen Auftrag gibt es nicht." };
  const [a] = (await sqlPool`
    SELECT person_id, email, contact_email, nationality, passport_number, passport_expiry
      FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
  if (!a) return { ok: false, error: "Zu diesem Auftrag gibt es keine Bestellzeile." };
  const pid = a.person_id != null ? Number(a.person_id) : g.person_id != null ? Number(g.person_id) : null;
  const [p] = pid ? ((await sqlPool`SELECT id, anrede, nationality, primary_email, first_name, last_name FROM fiaon_persons WHERE id = ${pid} LIMIT 1`) as any[]) : [];

  // Gehört die Datei zu diesem Auftrag?
  const mail = norm(q.email);
  const mails = [g.email, a.email, a.contact_email, p?.primary_email].map(norm).filter(Boolean);
  const nameDatei = nameNorm(`${String(q.vorname ?? "")} ${String(q.nachname ?? "")}`);
  const namePerson = nameNorm(`${String(p?.first_name ?? "")} ${String(p?.last_name ?? "")}`);
  const passt = mail ? mails.includes(mail) : !!nameDatei && nameDatei === namePerson;
  if (!passt) return { ok: false, error: "Die Datei passt nicht zu diesem Auftrag (E-Mail bzw. Name verschieden) — nichts nachgetragen." };

  const zeilen: AkteZeile[] = [];
  const anrede = ["Herr", "Frau"].includes(String(q.anrede ?? "").trim()) ? String(q.anrede).trim() : null;
  const land = staatsangehoerigkeitAlsLand(q.staatsangehoerigkeit);
  const pass = reisepassAus(q);

  // Akte: die Person
  if (g.person_id != null) zeilen.push({ wo: "Akte", feld: "Person", stand: "da" });
  else zeilen.push(pid ? { wo: "Akte", feld: "Person", stand: "neu", anzeige: `Person ${pid}` } : { wo: "Akte", feld: "Person", stand: "fehlt" });
  // Person: Anrede, Staatsangehörigkeit
  if (!p) zeilen.push({ wo: "Person", feld: "Anrede, Staatsangehörigkeit", stand: "fehlt" });
  else {
    zeilen.push(!leer(p.anrede) ? { wo: "Person", feld: "Anrede", stand: "da" } : anrede ? { wo: "Person", feld: "Anrede", stand: "neu", anzeige: anrede } : { wo: "Person", feld: "Anrede", stand: "fehlt" });
    zeilen.push(!leer(p.nationality) ? { wo: "Person", feld: "Staatsangehörigkeit", stand: "da" } : land ? { wo: "Person", feld: "Staatsangehörigkeit", stand: "neu", anzeige: "aus der Datei" } : { wo: "Person", feld: "Staatsangehörigkeit", stand: "fehlt" });
  }
  // Bestellung: Staatsangehörigkeit, Reisepass
  zeilen.push(!leer(a.nationality) ? { wo: "Bestellung", feld: "Staatsangehörigkeit", stand: "da" } : land ? { wo: "Bestellung", feld: "Staatsangehörigkeit", stand: "neu", anzeige: "aus der Datei" } : { wo: "Bestellung", feld: "Staatsangehörigkeit", stand: "fehlt" });
  zeilen.push(!leer(a.passport_number) ? { wo: "Bestellung", feld: "Reisepass-Nummer", stand: "da" } : pass ? { wo: "Bestellung", feld: "Reisepass-Nummer", stand: "neu", anzeige: `${"•".repeat(pass.nummer.length)} (${pass.nummer.length} Zeichen)` } : { wo: "Bestellung", feld: "Reisepass-Nummer", stand: "fehlt" });
  zeilen.push(a.passport_expiry != null ? { wo: "Bestellung", feld: "Reisepass gültig bis", stand: "da" } : pass?.gueltigBis ? { wo: "Bestellung", feld: "Reisepass gültig bis", stand: "neu", anzeige: "aus der Datei" } : { wo: "Bestellung", feld: "Reisepass gültig bis", stand: "fehlt" });
  zeilen.push({ wo: "Person", feld: "Telefon", stand: leer(q.telefon) ? "fehlt" : "hand", ...(leer(q.telefon) ? {} : { anzeige: "steht in der Datei — bitte in der Akte › Stammdaten eintragen (Abgleich über Alias)" }) });

  if (!opts.schreiben) return { ok: true, zeilen, geschrieben: 0 };

  let geschrieben = 0;
  const neu = (wo: AkteZeile["wo"], feld: string) => zeilen.some((z) => z.wo === wo && z.feld === feld && z.stand === "neu");
  if (neu("Akte", "Person") && pid) {
    const r = await sqlPool`UPDATE fiaon_global_auftraege SET person_id = ${pid}, updated_at = NOW() WHERE ref = ${ref} AND person_id IS NULL`;
    geschrieben += r.count ?? 0;
  }
  if (p && neu("Person", "Anrede") && anrede) {
    const r = await sqlPool`UPDATE fiaon_persons SET anrede = ${anrede}, anrede_quelle = 'vertrag', updated_at = NOW() WHERE id = ${pid} AND (anrede IS NULL OR anrede = '')`;
    geschrieben += r.count ?? 0;
  }
  if (p && neu("Person", "Staatsangehörigkeit") && land) {
    const r = await sqlPool`UPDATE fiaon_persons SET nationality = ${land}, updated_at = NOW() WHERE id = ${pid} AND (nationality IS NULL OR nationality = '')`;
    geschrieben += r.count ?? 0;
  }
  if (neu("Bestellung", "Staatsangehörigkeit") && land) {
    const r = await sqlPool`UPDATE fiaon_applications SET nationality = ${land}, updated_at = NOW() WHERE ref = ${ref} AND (nationality IS NULL OR nationality = '')`;
    geschrieben += r.count ?? 0;
  }
  if (neu("Bestellung", "Reisepass-Nummer") && pass) {
    const r = await sqlPool`UPDATE fiaon_applications SET passport_number = ${pass.nummer}, updated_at = NOW() WHERE ref = ${ref} AND (passport_number IS NULL OR passport_number = '')`;
    geschrieben += r.count ?? 0;
  }
  if (neu("Bestellung", "Reisepass gültig bis") && pass?.gueltigBis) {
    const r = await sqlPool`UPDATE fiaon_applications SET passport_expiry = ${pass.gueltigBis}::date, updated_at = NOW() WHERE ref = ${ref} AND passport_expiry IS NULL`;
    geschrieben += r.count ?? 0;
  }
  if (geschrieben) {
    const felder = zeilen.filter((z) => z.stand === "neu").map((z) => `${z.wo}: ${z.feld}`).join(", ");
    const { verlaufSchreiben } = await import("./fiaon-global-bereich");
    await verlaufSchreiben(ref, { art: "akte", text: `Personendaten aus dem Vertrag nachgetragen (nur leere Felder): ${felder} (${opts.agent.name}).`, sichtbar: false, agentId: opts.agent.id || null });
  }
  return { ok: true, zeilen, geschrieben };
}

// ── 4 · DER SPÄTESTE ZAHLTAG LAUT VERTRAG ────────────────────────────────────
/**
 * Für eine Bestellzeile, an der ein angenommener Angebotsteil hängt: Rechnungstag (Berlin) + Zahlungsziel des Teils = der späteste
 * Zahltag, den der Vertrag zusagt (z. B. Fassung C bis 28.10.2026: „zahlbar binnen sieben Tagen“). Fällig ist der Betrag oft schon
 * mit dem Vertragsschluss; FRÜHER verlangen kann FIAON ihn trotzdem nicht (§ 271 Abs. 2 BGB) — eine kürzere Frist wäre eine
 * Vertragsänderung zu Lasten des Kunden. null = kein angenommener Angebotsteil an dieser Bestellung.
 */
export async function globalVertragsfrist(ref: string): Promise<{ tage: number; rechnungTag: string; spaetesterTag: string; teilNr: number; angebotRef: string } | null> {
  const [t] = (await sqlPool`
    SELECT t.nr, t.zahlungsziel_tage, t.rechnung_am, a.angebot_ref, b.invoice_date
      FROM fiaon_global_angebot_teile t
      JOIN fiaon_global_angebote a ON a.id = t.angebot_id
      LEFT JOIN fiaon_applications b ON b.ref = t.bestell_ref
     WHERE t.bestell_ref = ${ref} AND a.status = 'angenommen' AND t.entfallen_am IS NULL
     LIMIT 1`.catch(() => [])) as any[];
  if (!t) return null;
  const rechnung = t.invoice_date ?? t.rechnung_am;
  if (!rechnung) return null;
  const rechnungTag = berlinToday(new Date(rechnung));
  const tage = Math.max(0, Number(t.zahlungsziel_tage) || 0);
  const [y, m, d] = rechnungTag.split("-").map(Number);
  const spaetesterTag = new Date(Date.UTC(y, m - 1, d + tage)).toISOString().slice(0, 10);
  return { tage, rechnungTag, spaetesterTag, teilNr: Number(t.nr), angebotRef: String(t.angebot_ref) };
}
