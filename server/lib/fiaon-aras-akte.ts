// ═══════════════════════════════════════════════════════════════════════════
// ARAS IN DER AKTE (E-408 Scheibe 2, Nachtrag Akte-Steuerung 19.10.2026)
//
// Justin: „in der Akte ein Knopf wie ‚ARAS anrufen lassen‘ mit Erklärung … man
// sollte auch individuelle Sachen eintippen können … oder mit 1 Klick die Arbeit
// abgeben (das, was offen ist bei dem Kunden).“
//
// Diese Datei liefert der Karte „Aras“ in der Akte (client: ArasKarte.tsx) alles:
//   · arasAkteLage      was offen ist, was bei dir bleibt, geplante Anrufe, Verlauf,
//                       Sperre je Kunde, „Was Aras wissen muss“ — und in EINEM Satz,
//                       warum Aras gerade nicht anrufen kann (nie ein stummer Knopf)
//   · arasAuftragGeben  „Aras anrufen lassen“ und „Offenes an Aras abgeben“ — beide
//                       reihen nur EINEN Anruf ein (Spielart auftrag); gewählt wird
//                       vom Takt mit allen Wänden (Fenster, 1/Tag, 3/Woche, Deckel …)
//   · arasAuftragZuruecknehmen, arasFuerPersonSchalten, arasNotizSetzen, arasAnrufUrteil
// Rechte prüft die Route (darfAnKunde: Betreuer und Leitung). Kein Wählen hier.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";
import { arasEinstellungenLesen, planEinreihen, versucheHeute, vertragsKunde, arasKostenHeute } from "./fiaon-aras-plan";
import { telefonGesperrt, nummerKern } from "./fiaon-aras-sperre";
import { einwilligungGueltig } from "./fiaon-telefon-einwilligung";
import { arasEreignis } from "./fiaon-aras-ereignis";
import { waehlbareNummer } from "./fiaon-telefon";
import { istGlobalKunde } from "./fiaon-global-kunde";
import { ERINNERBARE_BESTELLUNG_SQL, RATE_NACH_ENDE_SQL_FUER } from "./fiaon-raten-storno";
import { nennform } from "../../shared/fiaon-mitarbeiter-name";
import { euroText } from "../../shared/fiaon-auskunft";
import { stufeAusAntrag } from "../../shared/fiaon-mara-ton";
import { ERGEBNIS_TEXT, istErgebnis } from "../../shared/fiaon-kontakt-ergebnis-liste";
import { auftragPruefen } from "../../shared/fiaon-aras-regeln";
import {
  SPIELART_TEXT, BLEIBT_BEI_DIR, AUFTRAG_GUELTIG_STUNDEN, AUFTRAG_VERSUCHE, ARAS_NOTIZ_MAX_ZEICHEN, berlinTeile, istSpielart, kundenAnrufeAn, offenReihen, stufenGrenzen,
  auftragSaubern, istOffenArt, type OffenPunkt, type OffenArt, type AuftragWann,
} from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;
const artText = (v: unknown): string => { const x = String(v ?? ""); return istSpielart(x) ? SPIELART_TEXT[x] : x; };

const tag = (d: unknown): string => {
  const x = new Date(d as any);
  return Number.isFinite(x.getTime()) ? x.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }) : "";
};
const SYSTEMWORT = /\b(akte|stufe|lead|status|tier|ticket|vorgang|claimed_paid|pending_payment|system)\b/gi;
const sauber = (t: unknown, n = 160) => String(t ?? "").replace(/\s+/g, " ").replace(SYSTEMWORT, "…").trim().slice(0, n);

export interface ArasAkteVerlauf {
  arasAnrufId: number; callId: number; am: string; spielart: string; art: string; ergebnis: string | null; ergebnisText: string;
  dauerSek: number; kostenEuro: number; zusammenfassung: string | null; kiHinweis: boolean; aufnahme: "ja" | "nein" | null;
  transkript: { wer: "kunde" | "aras"; text: string }[] | null; hatAufnahme: boolean; urteil: string | null; urteilGrund: string | null;
  auftragVon: string | null; laeuft: boolean;
}
export interface ArasAkteGeplant {
  id: number; spielart: string; art: string; status: string; ab: string; bis: string; von: string | null; auftrag: string | null;
  punkte: string[]; versuch: number; grund: string | null;
  /** Darf der Fragende diesen Auftrag zurücknehmen? (wer ihn gab, oder die Leitung — nur Aufträge, die noch warten) */
  zuruecknehmbar: boolean;
}
export interface ArasAkteLage {
  ok: true;
  aras: { kundenAn: boolean; stufe: number; notaus: boolean };
  /** Kann Aras diesen Kunden anrufen? Sonst EIN Satz, warum nicht — der Knopf ist dann grau mit genau diesem Grund. */
  geht: { ok: boolean; grund: string | null };
  /** Ein Satz zur Lage, der nicht sperrt (z. B. Versuche diese Woche, Tagesdeckel). */
  hinweis: string | null;
  sperre: { aus: boolean; grund: string | null; am: string | null; von: string | null; telefonGesperrt: boolean };
  notiz: { text: string; am: string | null; von: string | null };
  offen: OffenPunkt[];
  bleibtBeiDir: string[];
  geplant: ArasAkteGeplant[];
  verlauf: ArasAkteVerlauf[];
}

/** Was bei diesem Kunden offen ist — in der Reihenfolge, in der Aras es in EINEM Gespräch abarbeitet. */
export async function offenePunkte(personId: number, lauf: Lauf = sqlPool): Promise<{ punkte: OffenPunkt[]; bleibt: string[] }> {
  const punkte: OffenPunkt[] = [];
  const bleibt: string[] = [];
  const [a] = (await lauf`
    SELECT ref, status, payment_status, current_step, submitted_at, gekuendigt_am, abo_gestoppt_am, claimed_paid_at, payment_reference
      FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL AND archived_at IS NULL
       AND COALESCE(ist_entwurf, FALSE) = FALSE AND COALESCE(type, '') <> 'schufa' AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%'
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`.catch(() => [])) as any[];
  const stufe = stufeAusAntrag(a ?? null);
  if (a?.gekuendigt_am) bleibt.push(`Kündigung vom ${tag(a.gekuendigt_am)}`);

  if (stufe === "zahlung_gemeldet") {
    punkte.push({ art: "zahlung_gemeldet", label: `Zahlung gemeldet${a?.claimed_paid_at ? ` am ${tag(a.claimed_paid_at)}` : ""}, noch nicht zugeordnet`,
      satz: `Er hat gemeldet, dass er überwiesen hat${a?.claimed_paid_at ? ` (am ${tag(a.claimed_paid_at)})` : ""} — zugeordnet ist sie noch nicht: Datum, Bank und Verwendungszweck klären (zahlung_gemeldet).` });
  }
  if (a?.ref && (stufe === "kunde" || stufe === "zahlung_gemeldet")) {
    const [r] = (await lauf.unsafe(`
      SELECT r.rate_nr, r.betrag_cents, r.faellig_am FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
       WHERE r.ref = $1 AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL AND r.faellig_am <= CURRENT_DATE + 1
         AND ${ERINNERBARE_BESTELLUNG_SQL("a")} AND a.abo_gestoppt_am IS NULL AND NOT ${RATE_NACH_ENDE_SQL_FUER("a", "r")}
       ORDER BY r.faellig_am LIMIT 1`, [String(a.ref)]).catch(() => [])) as any[];
    if (r) {
      const betrag = euroText(Number(r.betrag_cents ?? 0));
      punkte.push({ art: "rate", label: `Rate ${r.rate_nr} über ${betrag}, fällig am ${tag(r.faellig_am)}`,
        satz: `Offene Rate ${r.rate_nr} über ${betrag}, fällig am ${tag(r.faellig_am)} — ruhig ansprechen: heute überweisen oder einen Tag nennen (zahlungszusage_merken).` });
    }
    const [z] = (await lauf`
      SELECT cl.promised_date FROM fiaon_contact_log cl
       WHERE cl.ref = ${String(a.ref)} AND cl.type = 'result' AND cl.outcome = 'erreicht_zahlt_am' AND cl.voided_at IS NULL
         AND (cl.promised_date AT TIME ZONE 'Europe/Berlin')::date < (NOW() AT TIME ZONE 'Europe/Berlin')::date
         AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = cl.ref AND r.bezahlt_am > cl.created_at)
       ORDER BY cl.created_at DESC LIMIT 1`.catch(() => [])) as any[];
    if (z && !punkte.some((p) => p.art === "rate")) {
      punkte.push({ art: "zusage", label: `Zusage für den ${tag(z.promised_date)} — noch nichts angekommen`,
        satz: `Er wollte am ${tag(z.promised_date)} überweisen; angekommen ist nichts — freundlich nachfragen, ohne Vorwurf ein neuer Tag (zahlungszusage_merken).` });
    }
    try {
      const { dokumentLage } = await import("./fiaon-kundenlage");
      const d = await dokumentLage(personId);
      if (d.fehlend.length) {
        const was = d.fehlend.map((f) => f.label).join(", ");
        punkte.push({ art: "unterlagen", label: `Unterlagen fehlen: ${was}`,
          satz: `Es fehlen noch: ${sauber(was, 120)}. Sag genau, was fehlt, und dass der Link zum Hochladen gleich per Mail kommt.` });
      }
    } catch { /* Unterlagen sind Zusatz — ohne sie die übrigen Punkte */ }
  }
  if (stufe === "zahlung_offen") {
    punkte.push({ art: "erste_rate", label: "Antrag abgeschickt, erste Rate offen",
      satz: "Sein Antrag ist abgeschickt, die erste Rate offen — Ziel ist der Start heute (Verkaufssatz, Link über den Hintergrund, dranbleiben)." });
  }
  const rueck = (await lauf`
    SELECT anliegen, created_at FROM fiaon_rueckrufe WHERE person_id = ${personId} AND status = 'offen' ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (rueck[0]) {
    punkte.push({ art: "rueckruf", label: `Bittet um einen Anruf: „${String(rueck[0].anliegen ?? "").slice(0, 80)}“`,
      satz: `Er hat um einen Anruf gebeten (seine Worte: „${sauber(rueck[0].anliegen, 140)}“) — erst fragen, worum es geht, dann beantworten.` });
  }
  return { punkte: offenReihen(punkte), bleibt };
}

/** Die ganze Lage für die Karte „Aras“ in der Akte. */
export async function arasAkteLage(personId: number, agentId: number | null, leitung = false, lauf: Lauf = sqlPool): Promise<ArasAkteLage | null> {
  await arasSchema(lauf);
  const [p] = (await lauf`
    SELECT id, primary_phone, country, is_blocked, ist_test_am IS NOT NULL AS test, werbung_gesperrt_am IS NOT NULL AS werbesperre
      FROM fiaon_persons WHERE id = ${personId}`) as any[];
  if (!p) return null;
  const einst = await arasEinstellungenLesen(false, lauf);
  const kundenAn = kundenAnrufeAn(einst);
  const nummer = p.primary_phone ? waehlbareNummer([{ nummer: p.primary_phone }], p.country).waehlbar ?? null : null;
  const [ap] = (await lauf`SELECT * FROM fiaon_aras_person WHERE person_id = ${personId}`) as any[];
  const gesperrt = nummer ? await telefonGesperrt(nummerKern(nummer), personId, lauf) : false;
  const global = await istGlobalKunde(personId, lauf).catch(() => false);
  const { punkte, bleibt } = await offenePunkte(personId, lauf);

  // Warum (nicht)? Die erste Wand, die hält — als ganzer Satz.
  let grund: string | null = null;
  if (global) grund = "Firmenkunde (FIAON Global) — hier ruft Aras nicht an.";
  else if (p.test) grund = "Testperson — Aras ruft sie nur im Probeanruf an.";
  else if (gesperrt) grund = "Der Kunde möchte nicht mehr angerufen werden — die Sperre gilt für alle.";
  else if (ap?.aus_am) grund = `Aras ist für diesen Kunden aus${ap.aus_grund ? ` („${String(ap.aus_grund).slice(0, 80)}“)` : ""} — unten wieder einschalten.`;
  else if (!nummer) grund = "In der Akte steht keine wählbare Telefonnummer.";
  else if (einst.notaus) grund = "Not-Aus ist an — Aras ruft gerade niemanden an.";
  else if (!kundenAn) grund = "Aras ruft noch keine Kunden an — er ist in der Testphase. Sobald Justin ihn freischaltet, geht es hier mit einem Klick.";
  else if (!einst.spielarten.auftrag) grund = "Aufträge an Aras sind gerade ausgeschaltet.";
  else if (!(await vertragsKunde(personId, lauf))) {
    // Ohne Vertrag ist jeder Anruf Werbung: nur mit seinem Ja — und nie bei Werbesperre.
    if (p.werbesperre) grund = "Werbesperre — ohne Vertrag ruft Aras hier nicht an.";
    else if (!(nummer && await einwilligungGueltig(nummerKern(nummer), personId, lauf))) grund = "Für diesen Kontakt braucht Aras ein Ja zum Anruf (Kästchen im Antrag, JA per Nachricht oder ein gebuchter Anruf) — bis dahin schreibt Mara.";
  }
  let hinweis: string | null = null;
  if (!grund) {
    const v = await versucheHeute(personId, lauf);
    if (v.woche >= einst.jePersonWoche) grund = `Diese Woche gab es schon ${v.woche} Anrufversuche (Team und Aras zusammen) — mehr sind nicht erlaubt; Aras kann ab nächster Woche.`;
    else if (v.heute >= einst.jePersonTag) hinweis = "Heute wurde er schon angerufen — Aras ruft frühestens morgen an.";
    else if (v.woche > 0) hinweis = `Diese Woche ${v.woche} von ${einst.jePersonWoche} Anrufversuchen (Team und Aras zusammen).`;
    const kosten = await arasKostenHeute(lauf).catch(() => null);
    // Der Deckel der Stufe gilt (Stufe 1: 15 €), auch wenn der Schalter mehr erlaubt.
    if (!grund && kosten && kosten.euro >= stufenGrenzen(einst).tagEuro) grund = "Aras' Tagesbudget ist für heute aufgebraucht — morgen geht es wieder.";
  }

  const geplantRoh = (await lauf`
    SELECT id, spielart, status, frueh_ab, spaet_bis, auftrag_von, auftrag_text, auftrag_offenes, versuch_nr, grund, auftrag_agent_id
      FROM fiaon_aras_plan WHERE person_id = ${personId} AND status IN ('wartet', 'verschoben', 'gewaehlt', 'laeuft')
     ORDER BY frueh_ab LIMIT 10`) as any[];
  const geplant: ArasAkteGeplant[] = geplantRoh.map((z) => ({
    id: Number(z.id), spielart: String(z.spielart), art: artText(z.spielart), status: String(z.status),
    ab: new Date(z.frueh_ab).toISOString(), bis: new Date(z.spaet_bis).toISOString(), von: z.auftrag_von ?? null, auftrag: z.auftrag_text ?? null,
    punkte: Array.isArray(z.auftrag_offenes) ? (z.auftrag_offenes as any[]).map((o) => String(typeof o === "string" ? o : o?.label ?? "")).filter(Boolean) : [],
    versuch: Number(z.versuch_nr ?? 1), grund: z.grund ?? null,
    zuruecknehmbar: z.spielart === "auftrag" && ["wartet", "verschoben"].includes(String(z.status)) && (leitung || (agentId != null && Number(z.auftrag_agent_id) === agentId)),
  }));
  if (!grund && geplant.some((g) => g.spielart === "auftrag" && (g.status === "wartet" || g.status === "verschoben"))) {
    grund = "Aras hat für diesen Kunden schon einen Anruf geplant (siehe unten) — nimm ihn zurück, wenn du etwas ändern willst.";
  }

  const verlaufRoh = (await lauf`
    SELECT aa.id, aa.call_id, aa.created_at, aa.spielart, aa.ergebnis, aa.sekunden_sitzung, aa.kosten_ki_cents, aa.kosten_telefon_cents,
           aa.zusammenfassung, aa.ki_hinweis_am, aa.aufnahme_ja_am, aa.aufnahme_nein_am, aa.transkript, aa.team_urteil, aa.team_urteil_grund,
           c.recording_url IS NOT NULL AS hat_aufnahme, c.status, pl.auftrag_von
      FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id LEFT JOIN fiaon_aras_plan pl ON pl.id = aa.plan_id
     WHERE c.person_id = ${personId} AND aa.spielart <> 'probe'
     ORDER BY aa.id DESC LIMIT 12`) as any[];
  const verlauf: ArasAkteVerlauf[] = verlaufRoh.map((z) => {
    const erg = z.ergebnis ? String(z.ergebnis) : null;
    const ergebnisText = !erg ? (["gewaehlt", "laeuft"].includes(String(z.status)) ? "läuft gerade" : "ohne Ergebnis")
      : istErgebnis(erg) ? ERGEBNIS_TEXT[erg] : erg === "uebergeben" ? "an einen Menschen übergeben" : erg === "abgebrochen" ? "abgebrochen" : erg;
    const transkript = z.aufnahme_ja_am && Array.isArray(z.transkript)
      ? (z.transkript as any[]).filter((t) => t && (t.wer === "kunde" || t.wer === "aras") && String(t.text ?? "").trim()).map((t) => ({ wer: t.wer, text: String(t.text).slice(0, 600) })).slice(0, 80)
      : null;
    return {
      arasAnrufId: Number(z.id), callId: Number(z.call_id), am: new Date(z.created_at).toISOString(), spielart: String(z.spielart),
      art: artText(z.spielart), ergebnis: erg, ergebnisText,
      dauerSek: Number(z.sekunden_sitzung ?? 0), kostenEuro: Math.round(Number(z.kosten_ki_cents ?? 0) + Number(z.kosten_telefon_cents ?? 0)) / 100,
      zusammenfassung: z.zusammenfassung ?? null, kiHinweis: !!z.ki_hinweis_am, aufnahme: z.aufnahme_ja_am ? "ja" : z.aufnahme_nein_am ? "nein" : null,
      transkript, hatAufnahme: z.hat_aufnahme === true && !!z.aufnahme_ja_am, urteil: z.team_urteil ?? null, urteilGrund: z.team_urteil_grund ?? null,
      auftragVon: z.auftrag_von ?? null, laeuft: ["gewaehlt", "laeuft"].includes(String(z.status)) && !erg,
    };
  });

  return {
    ok: true,
    aras: { kundenAn, stufe: einst.stufe, notaus: einst.notaus },
    geht: { ok: !grund, grund },
    hinweis,
    sperre: { aus: !!ap?.aus_am, grund: ap?.aus_grund ?? null, am: ap?.aus_am ? new Date(ap.aus_am).toISOString() : null, von: ap?.aus_von ?? null, telefonGesperrt: gesperrt },
    notiz: { text: ap?.notiz ?? "", am: ap?.notiz_am ? new Date(ap.notiz_am).toISOString() : null, von: ap?.notiz_von ?? null },
    offen: punkte,
    bleibtBeiDir: [...bleibt, ...BLEIBT_BEI_DIR],
    geplant, verlauf,
  };
}

/** Wer gibt den Auftrag? Nennform (nie Vorname allein) — Aras sagt „im Auftrag von Herrn Krause“. */
async function auftraggeber(agentId: number, lauf: Lauf): Promise<{ nom: string; dat: string }> {
  const [a] = (await lauf`SELECT name, first_name, last_name, anrede FROM fiaon_agents WHERE id = ${agentId}`.catch(() => [])) as any[];
  const n = nennform(a ?? null);
  return { nom: n.nom, dat: n.dat };
}

/** Zeitpunkt aus „bald“ / „heute ab HH:MM“ / „morgen“ (Berlin). */
export function auftragZeit(wann: AuftragWann, ab: string | null | undefined, jetzt = new Date()): { fruehAb: Date; spaetBis: Date } {
  const b = berlinTeile(jetzt);
  const wandzeit = (datum: string, hhmm: string): Date => {
    const [j, m, t] = datum.split("-").map(Number);
    const [h, min] = hhmm.split(":").map(Number);
    const utc = new Date(Date.UTC(j, m - 1, t, h, min, 0));
    const anzeige = berlinTeile(utc);
    const versatz = (Number(anzeige.hhmm.slice(0, 2)) * 60 + Number(anzeige.hhmm.slice(3))) - (h * 60 + min);
    return new Date(utc.getTime() - versatz * 60_000);
  };
  let fruehAb = jetzt;
  if (wann === "heute_ab" && ab && /^([01]\d|2[0-3]):[0-5]\d$/.test(ab)) {
    const z = wandzeit(b.datum, ab);
    fruehAb = z.getTime() > jetzt.getTime() ? z : jetzt;
  } else if (wann === "morgen") {
    const morgen = berlinTeile(new Date(jetzt.getTime() + 24 * 3600_000)).datum;
    fruehAb = wandzeit(morgen, "09:00");
  }
  return { fruehAb, spaetBis: new Date(fruehAb.getTime() + AUFTRAG_GUELTIG_STUNDEN * 3600_000) };
}

export interface AuftragEin {
  /** Gewählte offene Punkte (Arten) — bei „Offenes abgeben“ alle angehakten. */
  punkte?: string[] | null;
  /** Freitext „Was soll Aras sagen oder erledigen?“ (≤ 500 Zeichen, durch die Wortwand). */
  auftrag?: string | null;
  wann?: AuftragWann | null; ab?: string | null;
  benachrichtigen?: boolean;
  /** „Offenes an Aras abgeben“ (für Protokoll und Satz). */
  abgeben?: boolean;
}

/** „Aras anrufen lassen“ / „Offenes an Aras abgeben“ — EIN Eintrag in der Warteschlange, nie ein Wählen von hier. */
export async function arasAuftragGeben(personId: number, ein: AuftragEin, agentId: number, lauf: Lauf = sqlPool): Promise<{ ok: boolean; id?: number; meldung?: string; grund?: string; hinweise?: string[] }> {
  const lage = await arasAkteLage(personId, agentId, false, lauf);
  if (!lage) return { ok: false, grund: "Diesen Kunden gibt es nicht." };
  if (!lage.geht.ok) return { ok: false, grund: lage.geht.grund ?? "Aras kann diesen Kunden gerade nicht anrufen." };
  const text = auftragSaubern(ein.auftrag);
  const pruefung = auftragPruefen(text);
  if (!pruefung.ok) return { ok: false, grund: "So gibt Aras den Auftrag nicht weiter — bitte anders formulieren.", hinweise: pruefung.hinweise };
  const gewuenscht = new Set((ein.punkte ?? []).filter(istOffenArt) as OffenArt[]);
  const punkte = lage.offen.filter((p) => gewuenscht.has(p.art));
  if (!text && !punkte.length) return { ok: false, grund: ein.abgeben ? "Es ist nichts offen, was Aras übernehmen kann." : "Schreib kurz, was Aras sagen oder erledigen soll — oder wähle ein Anliegen." };
  const [p] = (await lauf`SELECT primary_phone, country FROM fiaon_persons WHERE id = ${personId}`) as any[];
  const nummer = p?.primary_phone ? waehlbareNummer([{ nummer: p.primary_phone }], p.country).waehlbar ?? null : null;
  if (!nummer) return { ok: false, grund: "In der Akte steht keine wählbare Telefonnummer." };
  const wer = await auftraggeber(agentId, lauf);
  const { fruehAb, spaetBis } = auftragZeit(ein.wann ?? "bald", ein.ab ?? null);
  const r = await planEinreihen({
    personId, nummer, spielart: "auftrag", erzeugtVon: "akte",
    grund: (ein.abgeben ? `Offenes abgegeben (${punkte.length} Punkte)` : punkte.length ? `Auftrag: ${punkte.map((x) => x.label).join(", ")}` : "Auftrag aus der Akte").slice(0, 200),
    fruehAb, spaetBis, auftragVon: wer.nom, auftragVonDat: wer.dat, auftragAgentId: agentId, auftragText: text || null,
    offenes: punkte.map((x) => ({ art: x.art, label: x.label, satz: x.satz })), benachrichtigenAgentId: ein.benachrichtigen === false ? null : agentId,
  }, lauf);
  if (!r.ok || !r.id) return { ok: false, grund: r.grund ?? "Ließ sich nicht einplanen." };
  await arasEreignis({ art: "aras_werkzeug", callId: 0, personId, spielart: "auftrag", ok: true,
    text: `${wer.nom} hat ${ein.abgeben ? "Offenes an Aras abgegeben" : "Aras einen Anruf aufgetragen"}${punkte.length ? ` (${punkte.map((x) => x.art).join(", ")})` : ""}`,
    daten: { planId: r.id, agentId, punkte: punkte.map((x) => x.art), freitext: !!text } }).catch(() => null);
  const wann = ein.wann === "morgen" ? "morgen ab 9 Uhr" : ein.wann === "heute_ab" && ein.ab ? `heute ab ${ein.ab} Uhr` : "so bald wie möglich im Anruffenster";
  return { ok: true, id: r.id, meldung: `Eingeplant: Aras ruft ${wann} an.${ein.benachrichtigen === false ? "" : " Danach bekommst du eine Nachricht im Office."}` };
}

/** Einen geplanten Auftrag zurücknehmen (wer ihn gegeben hat — oder die Leitung). */
export async function arasAuftragZuruecknehmen(personId: number, planId: number, agentId: number, leitung: boolean, lauf: Lauf = sqlPool): Promise<{ ok: boolean; grund?: string }> {
  await arasSchema(lauf);
  const [z] = (await lauf`SELECT id, status, auftrag_agent_id, spielart FROM fiaon_aras_plan WHERE id = ${planId} AND person_id = ${personId}`) as any[];
  if (!z) return { ok: false, grund: "Diesen geplanten Anruf gibt es nicht." };
  if (!["wartet", "verschoben"].includes(String(z.status))) return { ok: false, grund: "Der Anruf läuft schon oder ist vorbei." };
  if (!leitung && Number(z.auftrag_agent_id) !== agentId) return { ok: false, grund: "Nur wer den Auftrag gegeben hat (oder die Leitung) nimmt ihn zurück." };
  const wer = await auftraggeber(agentId, lauf);
  await lauf`UPDATE fiaon_aras_plan SET status = 'verfallen', verschoben_grund = ${`zurückgenommen von ${wer.nom}`.slice(0, 200)}, updated_at = NOW() WHERE id = ${planId}`;
  return { ok: true };
}

/** „Aras für diesen Kunden aus“ — wirkt sofort: Wartendes wird gesperrt, neue Aufträge gehen nicht. */
export async function arasFuerPersonSchalten(personId: number, aus: boolean, grund: string | null, agentId: number | null, von: string, lauf: Lauf = sqlPool): Promise<void> {
  await arasSchema(lauf);
  const g = String(grund ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null;
  if (aus) {
    await lauf`INSERT INTO fiaon_aras_person (person_id, aus_am, aus_grund, aus_von, updated_at) VALUES (${personId}, NOW(), ${g}, ${von.slice(0, 80)}, NOW())
               ON CONFLICT (person_id) DO UPDATE SET aus_am = NOW(), aus_grund = EXCLUDED.aus_grund, aus_von = EXCLUDED.aus_von, updated_at = NOW()`;
    await lauf`UPDATE fiaon_aras_plan SET status = 'gesperrt', verschoben_grund = 'Aras für diesen Kunden aus', updated_at = NOW()
               WHERE person_id = ${personId} AND status IN ('wartet', 'verschoben')`;
  } else {
    await lauf`UPDATE fiaon_aras_person SET aus_am = NULL, aus_grund = NULL, aus_von = ${von.slice(0, 80)}, updated_at = NOW() WHERE person_id = ${personId}`;
  }
  await arasEreignis({ art: "aras_sperre", callId: 0, personId, spielart: "auftrag", ok: true,
    text: aus ? `Aras für diesen Kunden aus (${von}${g ? `: ${g}` : ""})` : `Aras für diesen Kunden wieder an (${von})`, daten: { aus, agentId } }).catch(() => null);
}

/** „Was Aras wissen muss“ — geht als „Wichtig vom Team“ ins Briefing (durch dieselbe Wand wie der Auftrag). */
export async function arasNotizSetzen(personId: number, text: string, von: string, lauf: Lauf = sqlPool): Promise<{ ok: boolean; grund?: string; hinweise?: string[] }> {
  await arasSchema(lauf);
  const t = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, ARAS_NOTIZ_MAX_ZEICHEN);
  const pr = auftragPruefen(t);
  if (!pr.ok) return { ok: false, grund: "So gibt Aras die Notiz nicht weiter — bitte anders formulieren.", hinweise: pr.hinweise };
  await lauf`INSERT INTO fiaon_aras_person (person_id, notiz, notiz_von, notiz_am, updated_at) VALUES (${personId}, ${t || null}, ${von.slice(0, 80)}, NOW(), NOW())
             ON CONFLICT (person_id) DO UPDATE SET notiz = EXCLUDED.notiz, notiz_von = EXCLUDED.notiz_von, notiz_am = NOW(), updated_at = NOW()`;
  return { ok: true };
}

/** Der Daumen des Betreuers zu einem Kundenanruf (hoch/runter + Grund). */
export async function arasAnrufUrteil(personId: number, arasAnrufId: number, daumen: "hoch" | "runter", grund: string | null, von: string, lauf: Lauf = sqlPool): Promise<{ ok: boolean; grund?: string }> {
  await arasSchema(lauf);
  if (daumen !== "hoch" && daumen !== "runter") return { ok: false, grund: "daumen: hoch oder runter." };
  const r = (await lauf`
    UPDATE fiaon_aras_anruf aa SET team_urteil = ${daumen}, team_urteil_grund = ${String(grund ?? "").trim().slice(0, 400) || null},
           team_urteil_am = NOW(), team_urteil_von = ${von.slice(0, 80)}, updated_at = NOW()
      FROM fiaon_calls c WHERE aa.id = ${arasAnrufId} AND c.id = aa.call_id AND c.person_id = ${personId} AND aa.spielart <> 'probe'
     RETURNING aa.id`) as any[];
  return r.length ? { ok: true } : { ok: false, grund: "Diesen Anruf gibt es bei diesem Kunden nicht." };
}

/**
 * Nach einem Anruf mit Auftrag aus der Akte (aus nachbereiten, nie bei Probe):
 *   1. fehlende Unterlagen → der Upload-Link geht per Mail/WhatsApp raus (Aras hat es am Telefon angekündigt),
 *   2. nicht erreicht / Mailbox → am nächsten Tag noch ein Versuch (höchstens AUFTRAG_VERSUCHE),
 *   3. der Mitarbeiter, der den Auftrag gab, bekommt eine Nachricht im Office (fiaon_team_nachrichten, 3 Tage).
 */
export async function auftragNachbereiten(planId: number, e: { ergebnis: string; zusammenfassung: string; personId: number | null }, lauf: Lauf = sqlPool): Promise<{ upload: boolean; neuerVersuch: boolean; nachricht: boolean }> {
  const aus = { upload: false, neuerVersuch: false, nachricht: false };
  const [pl] = (await lauf`SELECT * FROM fiaon_aras_plan WHERE id = ${planId}`) as any[];
  if (!pl || !e.personId || pl.spielart === "probe") return aus;
  const erreicht = e.ergebnis.startsWith("erreicht") || e.ergebnis === "rueckruf_termin" || e.ergebnis === "uebergeben";
  const punkte: { art: string }[] = Array.isArray(pl.auftrag_offenes) ? pl.auftrag_offenes : [];

  if (erreicht && punkte.some((x) => x?.art === "unterlagen") && e.ergebnis !== "erreicht_abgelehnt") {
    try {
      const { dokumentLage } = await import("./fiaon-kundenlage");
      const { unterlagenAnfrageSenden } = await import("./fiaon-unterlagen-link");
      const { arasAusweisId } = await import("./fiaon-aras-schema");
      const fehlend = (await dokumentLage(e.personId)).fehlend.map((f) => f.art).filter((a) => a === "ausweis" || a === "kontoauszug" || a === "schufa");
      if (fehlend.length) {
        const r = await unterlagenAnfrageSenden({ personId: e.personId, arten: fehlend as any, kanaele: ["mail", "whatsapp"], quelle: "akte",
          akteur: { name: "Aras", agentId: await arasAusweisId(lauf), rolle: "ki" }, lauf });
        aus.upload = r.ok;
      }
    } catch (err) { console.error("[ARAS-AKTE] Upload-Link:", String((err as Error)?.message ?? err).slice(0, 200)); }
  }

  if (!erreicht && pl.spielart === "auftrag" && ["nicht_erreicht", "mailbox"].includes(e.ergebnis) && Number(pl.versuch_nr ?? 1) < AUFTRAG_VERSUCHE) {
    const { fruehAb, spaetBis } = auftragZeit("morgen", null);
    const r = await planEinreihen({
      personId: e.personId, nummer: String(pl.nummer), spielart: "auftrag", erzeugtVon: "akte", grund: `${String(pl.grund ?? "Auftrag")}`.slice(0, 180) + ` (Versuch ${Number(pl.versuch_nr ?? 1) + 1})`,
      fruehAb, spaetBis, auftragVon: pl.auftrag_von ?? null, auftragVonDat: pl.auftrag_von_dat ?? null, auftragAgentId: pl.auftrag_agent_id ?? null,
      auftragText: pl.auftrag_text ?? null, offenes: Array.isArray(pl.auftrag_offenes) ? pl.auftrag_offenes : null,
      benachrichtigenAgentId: pl.benachrichtigen_agent_id ?? null, versuchNr: Number(pl.versuch_nr ?? 1) + 1,
    }, lauf).catch(() => ({ ok: false }));
    aus.neuerVersuch = r.ok;
  }

  if (pl.benachrichtigen_agent_id) {
    const [p] = (await lauf`SELECT anrede, first_name, last_name FROM fiaon_persons WHERE id = ${e.personId}`.catch(() => [])) as any[];
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || "deinen Kunden";
    const ergebnisText = istErgebnis(e.ergebnis) ? ERGEBNIS_TEXT[e.ergebnis] : e.ergebnis === "uebergeben" ? "an einen Menschen übergeben" : e.ergebnis;
    const text = [
      `Aras hat ${name} angerufen: ${ergebnisText}.`,
      erreicht && e.zusammenfassung ? e.zusammenfassung.slice(0, 240) : "",
      aus.upload ? "Der Link zum Hochladen der Unterlagen ist raus." : "",
      aus.neuerVersuch ? "Aras versucht es morgen noch einmal." : (!erreicht ? "Aras versucht es nicht mehr — bitte übernimm." : ""),
    ].filter(Boolean).join(" ").slice(0, 600);
    try {
      await lauf`INSERT INTO fiaon_team_nachrichten (agent_id, text, banner_bis, created_by) VALUES (${Number(pl.benachrichtigen_agent_id)}, ${text}, NOW() + INTERVAL '3 days', 'Aras')`;
      aus.nachricht = true;
    } catch (err) { console.error("[ARAS-AKTE] Nachricht:", String((err as Error)?.message ?? err).slice(0, 200)); }
  }
  return aus;
}
