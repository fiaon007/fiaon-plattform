// ═══════════════════════════════════════════════════════════════════════════
// DER MOTOR DER EWIGEN STRECKE
//
// Die Kadenz und die Inhalte stehen in `shared/fiaon-lead-strecke.ts`. Hier
// steht, WER dran ist, WAS ihn stoppt und WIE gesendet wird.
//
// ── STOPP HEISST STOPP ─────────────────────────────────────────────────────
// Sechs Gründe beenden die Strecke endgültig:
//
//   antrag      Der Mensch hat einen Antrag gestellt → er ist Stufe B, ein
//               Agent ruft an. Weiter zu mailen wäre doppelte Ansprache.
//   kunde       Er hat bezahlt. Ein Kunde ist kein Lead mehr.
//   abgemeldet  Er hat auf den Abmelde-Link geklickt. Ein Klick, ohne Rückfrage.
//   bounce      Die Adresse existiert nicht. Weiter zu senden schadet der
//               Zustellbarkeit ALLER Mails des Hauses.
//   dsgvo       Gelöscht.
//   test        Testeintrag.
//
// Die Prüfung steht in EINER Funktion (`stoppGrund`) — nicht in der WHERE-Zeile
// des Tageslaufs. Sonst prüft der Lauf sechs Bedingungen und der Handversand
// keine.
// ═══════════════════════════════════════════════════════════════════════════

import { randomBytes } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import {
  MINDESTABSTAND_STUNDEN, faelligNachTagen, varianteFuer,
} from "../../shared/fiaon-lead-strecke";

type Lauf = typeof sqlPool;

/** Höchstens so viele Strecken-Mails am Tag. Einstellbar. */
export const STAFFEL_VORGABE = 200;

export type StoppGrund = "antrag" | "kunde" | "abgemeldet" | "bounce" | "dsgvo" | "test" | "hand";

/**
 * Warum ist dieser Lead nicht (mehr) in der Strecke? `null` = er läuft.
 *
 * Eine Funktion, sechs Gründe. Der Tageslauf ruft sie, der Handversand ruft
 * sie, der Prüfstand ruft sie.
 */
export async function stoppGrund(leadId: number, lauf: Lauf = sqlPool): Promise<{
  stopp: StoppGrund | null; klartext: string;
}> {
  const [l] = (await lauf`
    SELECT le.id, le.email, le.status, le.person_id, le.abgemeldet_am, le.bounce_am,
           le.strecke_stopp, le.dismissed_at,
           -- Hat dieser Mensch einen Antrag? Über die Person UND über die
           -- Adresse: Ein Lead ohne person_id kann trotzdem bestellt haben.
           EXISTS (
             SELECT 1 FROM fiaon_applications a
             WHERE a.merged_into IS NULL
               AND (a.person_id = le.person_id
                 OR (NULLIF(TRIM(COALESCE(le.email, '')), '') IS NOT NULL
                     AND LOWER(TRIM(COALESCE(a.email, ''))) = LOWER(TRIM(le.email))))
           ) AS hat_antrag,
           EXISTS (
             SELECT 1 FROM fiaon_applications a
             WHERE a.merged_into IS NULL AND a.payment_status = 'paid'
               AND (a.person_id = le.person_id
                 OR (NULLIF(TRIM(COALESCE(le.email, '')), '') IS NOT NULL
                     AND LOWER(TRIM(COALESCE(a.email, ''))) = LOWER(TRIM(le.email))))
           ) AS ist_kunde,
           -- DSGVO-Löschung entfernt die Personenzeile ganz: Ein Lead mit
           -- einer Personen-Kennung, zu der es keine Person mehr gibt, ist
           -- gelöscht. Die Spalte ist_test_am markiert Testeinträge.
           (le.person_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM fiaon_persons p WHERE p.id = le.person_id)) AS person_weg,
           EXISTS (
             SELECT 1 FROM fiaon_persons p
             WHERE p.id = le.person_id AND p.ist_test_am IS NOT NULL
           ) AS ist_test
    FROM fiaon_leads le WHERE le.id = ${leadId}
  `) as any[];
  if (!l) return { stopp: "hand", klartext: "Lead nicht gefunden." };

  // Ein bereits gesetzter Stopp bleibt gesetzt. Er wird nicht neu bewertet:
  // Wer sich abgemeldet hat, bleibt abgemeldet, auch wenn er später bestellt.
  if (l.strecke_stopp) {
    return { stopp: String(l.strecke_stopp) as StoppGrund, klartext: `Bereits gestoppt: ${l.strecke_stopp}` };
  }
  if (l.abgemeldet_am) return { stopp: "abgemeldet", klartext: "Der Mensch hat sich abgemeldet." };
  if (l.bounce_am) return { stopp: "bounce", klartext: "Die Adresse ist nicht erreichbar (harter Bounce)." };
  if (l.person_weg) return { stopp: "dsgvo", klartext: "Die Person wurde gelöscht (DSGVO)." };
  if (l.ist_test) return { stopp: "test", klartext: "Testeintrag." };
  if (l.ist_kunde || String(l.status) === "konvertiert") {
    return { stopp: "kunde", klartext: "Der Mensch ist Kunde geworden." };
  }
  if (l.hat_antrag) {
    return { stopp: "antrag", klartext: "Ein Antrag liegt vor — jetzt ruft ein Agent an (Stufe B)." };
  }
  if (String(l.status) === "kein_interesse") {
    return { stopp: "hand", klartext: "Als „kein Interesse\u201c markiert." };
  }
  if (!String(l.email || "").trim()) {
    return { stopp: "hand", klartext: "Keine E-Mail-Adresse." };
  }
  return { stopp: null, klartext: "Läuft." };
}

/** Setzt den Stopp — idempotent, der erste Grund gewinnt. */
export async function streckeStoppen(
  leadId: number, grund: StoppGrund, lauf: Lauf = sqlPool,
): Promise<{ gestoppt: boolean }> {
  const zeilen = (await lauf`
    UPDATE fiaon_leads
    SET strecke_stopp = ${grund}, strecke_stopp_am = NOW(),
        in_sequence = FALSE, updated_at = NOW()
    WHERE id = ${leadId} AND strecke_stopp IS NULL
    RETURNING id
  `) as any[];
  return { gestoppt: zeilen.length > 0 };
}

/**
 * Der Abmelde-Schlüssel. Einmal erzeugt, dann stabil.
 *
 * Kein Hochzählen: Wäre die Lead-Kennung im Link, könnte jemand fremde
 * Menschen abmelden, indem er die Zahl ändert.
 */
export async function abmeldeSchluessel(leadId: number, lauf: Lauf = sqlPool): Promise<string> {
  const [da] = (await lauf`
    SELECT abmelde_schluessel FROM fiaon_leads WHERE id = ${leadId}
  `) as any[];
  if (da?.abmelde_schluessel) return String(da.abmelde_schluessel);
  const neu = randomBytes(18).toString("hex");
  await lauf`
    UPDATE fiaon_leads SET abmelde_schluessel = ${neu}
    WHERE id = ${leadId} AND abmelde_schluessel IS NULL
  `;
  const [jetzt] = (await lauf`
    SELECT abmelde_schluessel FROM fiaon_leads WHERE id = ${leadId}
  `) as any[];
  return String(jetzt?.abmelde_schluessel ?? neu);
}

/** Der Abmelde-Link für eine Strecken-Mail. */
export async function abmeldeLink(leadId: number, lauf: Lauf = sqlPool): Promise<string> {
  return absoluteUrl(`/abmelden/${await abmeldeSchluessel(leadId, lauf)}`);
}

/**
 * Wer ist heute dran?
 *
 * Reihenfolge: JÜNGSTE zuerst. Ein Lead von gestern reagiert wahrscheinlicher
 * als einer von vor einem Jahr, und die Staffelung ist begrenzt — also sollen
 * die Wahrscheinlichsten zuerst dran sein.
 */
export async function faellige(
  hoechstens: number, lauf: Lauf = sqlPool,
): Promise<{ id: number; email: string; vorname: string | null; nachname: string | null;
             stufe: number; erstellt_am: any; person_id: number | null }[]> {
  // Die Fälligkeit rechnet sich aus Stufe und Einstiegsdatum. Als SQL, weil
  // sonst 2.700 Zeilen geladen und in TypeScript gefiltert werden müssten.
  //
  // `strecke_seit` ist der Einstieg. Fehlt er (Lead noch nicht eingereiht),
  // gilt `erstellt_am` — so wird ein alter Lead nicht künstlich jung.
  const zeilen = (await lauf`
    SELECT le.id, le.email, le.vorname, le.nachname, le.person_id,
           COALESCE(le.strecke_stufe, 0) AS stufe,
           COALESCE(le.strecke_seit, le.erstellt_am) AS start,
           le.erstellt_am
    FROM fiaon_leads le
    WHERE le.strecke_stopp IS NULL
      AND le.abgemeldet_am IS NULL
      AND le.bounce_am IS NULL
      AND le.status NOT IN ('konvertiert', 'kein_interesse', 'tot')
      AND NULLIF(TRIM(COALESCE(le.email, '')), '') IS NOT NULL
      -- Mindestabstand: Sicherheitsnetz gegen Doppelläufe.
      AND (le.strecke_letzte_am IS NULL
        OR le.strecke_letzte_am < NOW() - (${MINDESTABSTAND_STUNDEN} || ' hours')::interval)
      -- Kein Antrag (sonst Stufe B) und kein Kunde.
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.merged_into IS NULL
          AND (a.person_id = le.person_id
            OR LOWER(TRIM(COALESCE(a.email, ''))) = LOWER(TRIM(le.email))))
      -- Gelöschte Person (DSGVO entfernt die Zeile) und Testeinträge raus.
      AND (le.person_id IS NULL OR EXISTS (
        SELECT 1 FROM fiaon_persons p WHERE p.id = le.person_id AND p.ist_test_am IS NULL))
    ORDER BY le.erstellt_am DESC
    LIMIT 2000
  `) as any[];

  // Die Fälligkeit je Stufe in TypeScript: `faelligNachTagen` ist die eine
  // Definition, und sie steht in shared/. Sie in SQL nachzubauen wäre die
  // zweite Fassung derselben Regel.
  const jetzt = Date.now();
  const dran = zeilen.filter((l) => {
    const start = new Date(l.start).getTime();
    const tage = (jetzt - start) / 86_400_000;
    return tage >= faelligNachTagen(Number(l.stufe));
  });
  return dran.slice(0, hoechstens) as any;
}

/**
 * Eine Strecken-Mail verschicken.
 *
 * Weg: der bestehende Make-Zweig `lead_followup` (er ist eingerichtet und
 * getestet). Die Variante fährt als `variante` und `betreff`/`text` mit, damit
 * die Vorlage sie einsetzen kann. Fehlt bei Make eine Behandlung dafür, geht
 * die Mail über die direkte Brevo-Schiene mit dem FIAON-Rahmen raus — dann
 * kommt sie trotzdem an, und der Betreiber sieht es im Protokoll.
 */
export async function streckenMail(
  lead: { id: number; email: string; vorname: string | null; nachname: string | null },
  stufe: number,
  lauf: Lauf = sqlPool,
): Promise<{ status: "versandt" | "fehlgeschlagen" | "uebersprungen"; grund?: string; variante: string }> {
  const v = varianteFuer(stufe, lead.id);
  const abmelden = await abmeldeLink(lead.id, lauf);
  const antrag = absoluteUrl(`/antrag?lead=${lead.id}`);
  const anrede = lead.vorname ? `Hallo ${lead.vorname},` : "Hallo,";

  // Der volle Text — Anrede, Inhalt, Abschluss, Abmeldung. An EINER Stelle
  // zusammengesetzt, damit die Abmelde-Zeile nicht in elf Varianten fehlen kann.
  const text = `${anrede}\n\n${v.text}\n\n`
    + `Zum Antrag: ${antrag}\n\n`
    + `Viele Grüße\ndein FIAON-Team\n\n`
    + `─────\n`
    + `Du möchtest keine Nachrichten mehr? Ein Klick genügt: ${abmelden}`;

  try {
    const { sendMakeWebhookMitGrund } = await import("../make-webhook");
    const erg = await sendMakeWebhookMitGrund("lead_followup", {
      email: lead.email,
      vorname: lead.vorname,
      nachname: lead.nachname,
      lead_id: lead.id,
      followup_number: stufe,
      // Neu für die ewige Strecke — die Vorlage kann sie einsetzen.
      variante: v.key,
      variante_art: v.art,
      betreff: v.betreff,
      text,
      abmelde_url: abmelden,
      antrag_url: antrag,
    } as any);
    if (erg.ok) return { status: "versandt", variante: v.key };

    // ── DER ZWEITE WEG ──────────────────────────────────────────────────
    // Make hat abgelehnt oder ist nicht erreichbar. Die direkte Brevo-Schiene
    // mit dem FIAON-Rahmen ist der Rückfall: Besser eine schlichte Mail als
    // keine. Der Grund des ersten Versuchs bleibt im Protokoll.
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const zweit = await eigeneMailSenden({
      an: lead.email, name: lead.vorname ?? undefined,
      betreff: v.betreff, text, gruppe: true,
    });
    if (zweit.ok) {
      return { status: "versandt", grund: `über Brevo (Make: ${erg.grund})`, variante: v.key };
    }
    return { status: "fehlgeschlagen", grund: `Make: ${erg.grund} · Brevo: ${zweit.grund}`, variante: v.key };
  } catch (err) {
    return {
      status: "fehlgeschlagen",
      grund: err instanceof Error ? err.message : String(err),
      variante: v.key,
    };
  }
}

/**
 * Der Tageslauf der ewigen Strecke.
 *
 * Idempotent über den Mindestabstand: Zwei Läufe in derselben Stunde schicken
 * niemandem zwei Mails.
 */
export async function streckeTageslauf(opts: {
  hoechstens?: number; lauf?: Lauf;
} = {}): Promise<{ versandt: number; fehlgeschlagen: number; gestoppt: number; hinweis: string }> {
  const lauf = opts.lauf ?? sqlPool;

  // Ohne Kanal läuft nichts — und es wird protokolliert, nicht verschluckt.
  const { versandErlaubtOderProtokoll } = await import("./fiaon-versandkanal");
  if (!(await versandErlaubtOderProtokoll("Lead-Strecke", lauf))) {
    return { versandt: 0, fehlgeschlagen: 0, gestoppt: 0,
             hinweis: "Kein Versandkanal — übersprungen, nichts verbraucht." };
  }

  const [einst] = (await lauf`
    SELECT value FROM fiaon_settings WHERE key = 'lead_strecke_pro_tag'
  `.catch(() => [] as any[])) as any[];
  const grenzeRoh = Math.round(Number(einst?.value));
  const grenze = opts.hoechstens
    ?? (Number.isFinite(grenzeRoh) && grenzeRoh > 0 && grenzeRoh <= 2000 ? grenzeRoh : STAFFEL_VORGABE);

  // ── ERST DIE STOPPS NACHZIEHEN ─────────────────────────────────────────
  // Wer inzwischen bestellt hat oder Kunde geworden ist, fliegt raus, BEVOR
  // eine Mail rausgeht. Sonst bekommt ein frischer Kunde noch eine
  // Lead-Ansprache — der peinlichste Fall überhaupt.
  const gestoppt = (await lauf`
    UPDATE fiaon_leads le
    SET strecke_stopp = CASE
          WHEN EXISTS (SELECT 1 FROM fiaon_applications a
                        WHERE a.merged_into IS NULL AND a.payment_status = 'paid'
                          AND (a.person_id = le.person_id
                            OR LOWER(TRIM(COALESCE(a.email,''))) = LOWER(TRIM(le.email))))
            THEN 'kunde'
          ELSE 'antrag' END,
        strecke_stopp_am = NOW(), in_sequence = FALSE, updated_at = NOW()
    WHERE le.strecke_stopp IS NULL
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.merged_into IS NULL
          AND (a.person_id = le.person_id
            OR LOWER(TRIM(COALESCE(a.email,''))) = LOWER(TRIM(le.email))))
    RETURNING le.id
  `) as any[];

  const dran = await faellige(grenze, lauf);
  let versandt = 0;
  let fehlgeschlagen = 0;

  for (const l of dran) {
    // Die Einzelprüfung noch einmal: Zwischen Auswahl und Versand kann eine
    // Abmeldung eingegangen sein.
    const pruefung = await stoppGrund(Number(l.id), lauf);
    if (pruefung.stopp) {
      await streckeStoppen(Number(l.id), pruefung.stopp, lauf);
      continue;
    }

    const stufe = Number(l.stufe) + 1;
    const erg = await streckenMail(l as any, stufe, lauf);

    // ── DIE STUFE STEIGT NUR BEI ERFOLG ──────────────────────────────────
    // Dieselbe Lehre wie bei den Termin-Erinnerungen (17.08.2026): Wer die
    // Marke vor dem Versand setzt, verbraucht sie auch, wenn nichts rausging.
    if (erg.status === "versandt") {
      await lauf`
        UPDATE fiaon_leads
        SET strecke_stufe = ${stufe},
            strecke_letzte_am = NOW(),
            strecke_letzte_variante = ${erg.variante},
            strecke_seit = COALESCE(strecke_seit, erstellt_am),
            letzter_kontakt_am = NOW(),
            status = CASE WHEN status = 'neu' THEN 'kontaktiert' ELSE status END,
            updated_at = NOW()
        WHERE id = ${l.id}
      `;
      versandt++;
    } else {
      fehlgeschlagen++;
      // Nur den Zeitpunkt setzen, NICHT die Stufe: So versucht der nächste
      // Lauf dieselbe Stufe erneut, aber nicht in derselben Stunde.
      await lauf`
        UPDATE fiaon_leads SET strecke_letzte_am = NOW(), updated_at = NOW() WHERE id = ${l.id}
      `;
    }

    await lauf`
      INSERT INTO fiaon_lead_strecke_log (lead_id, stufe, variante, empfaenger, status, grund)
      VALUES (${l.id}, ${stufe}, ${erg.variante}, ${l.email}, ${erg.status}, ${erg.grund ?? null})
    `.catch(() => {});
  }

  const hinweis = `${versandt} Strecken-Mail(s) versandt`
    + (fehlgeschlagen ? `, ${fehlgeschlagen} fehlgeschlagen` : "")
    + (gestoppt.length ? `, ${gestoppt.length} Strecke(n) beendet (Antrag/Kunde)` : "")
    + `. Grenze: ${grenze}/Tag.`;
  if (versandt || fehlgeschlagen || gestoppt.length) console.log(`[LEAD-STRECKE] ${hinweis}`);
  return { versandt, fehlgeschlagen, gestoppt: gestoppt.length, hinweis };
}

/**
 * Die Kennzahlen der Strecke — für die Lead-Automatik.
 *
 * „Konvertiert nach Mail-Nummer" ist DIE Zahl, die zeigt, ob „manche kommen
 * erst bei Mail 20" wahr ist. Ohne sie ist die ewige Strecke ein Glaube.
 */
export async function streckeZahlen(lauf: Lauf = sqlPool): Promise<{
  aktiv: number;
  gestopptNachGrund: { grund: string; n: number }[];
  konvertiertNachStufe: { stufe: number; n: number }[];
  heuteVersandt: number;
  hoechsteStufe: number;
}> {
  const [a] = (await lauf`
    SELECT COUNT(*)::int AS aktiv,
           COALESCE(MAX(strecke_stufe), 0)::int AS hoechste
    FROM fiaon_leads
    WHERE strecke_stopp IS NULL AND abgemeldet_am IS NULL AND bounce_am IS NULL
      AND status NOT IN ('konvertiert', 'kein_interesse', 'tot')
      AND NULLIF(TRIM(COALESCE(email, '')), '') IS NOT NULL
  `) as any[];
  const stopps = (await lauf`
    SELECT strecke_stopp AS grund, COUNT(*)::int AS n FROM fiaon_leads
    WHERE strecke_stopp IS NOT NULL GROUP BY 1 ORDER BY 2 DESC
  `) as any[];
  // Konvertiert nach der Stufe, die zum Zeitpunkt des Antrags erreicht war.
  const konv = (await lauf`
    SELECT COALESCE(strecke_stufe, 0)::int AS stufe, COUNT(*)::int AS n
    FROM fiaon_leads
    WHERE strecke_stopp IN ('antrag', 'kunde') OR status = 'konvertiert'
    GROUP BY 1 ORDER BY 1
  `) as any[];
  const [heute] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_lead_strecke_log
    WHERE status = 'versandt'
      AND (gesendet_am AT TIME ZONE 'Europe/Berlin')::date
        = (NOW() AT TIME ZONE 'Europe/Berlin')::date
  `) as any[];
  return {
    aktiv: Number(a.aktiv),
    hoechsteStufe: Number(a.hoechste),
    gestopptNachGrund: stopps.map((s) => ({ grund: String(s.grund), n: Number(s.n) })),
    konvertiertNachStufe: konv.map((k) => ({ stufe: Number(k.stufe), n: Number(k.n) })),
    heuteVersandt: Number(heute.n),
  };
}
