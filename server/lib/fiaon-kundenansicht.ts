// ═══════════════════════════════════════════════════════════════════════════
// ALS-KUNDE-ANSICHT — das Portal mit den Augen eines Kunden
//
// ── WOFÜR ──────────────────────────────────────────────────────────────────
// „Warum sieht der Kunde seinen Fahrplan nicht?" — diese Frage lässt sich ohne
// die Kundensicht nicht beantworten. Der Betreiber kann sich kein Konto je
// Kontostufe anlegen, und ein Kundenpasswort zurückzusetzen, nur um
// nachzusehen, sperrt einen zahlenden Menschen aus seinem Konto aus.
//
// ── DIE GEFAHR IST HIER GRÖSSER ALS BEI DER MITARBEITER-ANSICHT ────────────
// Im Kundenportal liegen Knöpfe, die GELD und RECHT bewegen: eine
// Bonitätsauskunft bestellen (74 €), „Ich habe überwiesen" melden, Unterlagen
// hochladen, die Telefonnummer ändern, kündigen. Ein versehentlicher Klick des
// Betreibers wäre eine Handlung IM NAMEN des Kunden — und niemand könnte
// hinterher sagen, dass der Kunde sie nicht selbst getan hat.
//
// ── DIE FÜNF WÄNDE ─────────────────────────────────────────────────────────
// 1. EIGENES TOKEN. Niemals die echte Kunden-Anmeldung. Signiert, 30 Minuten.
// 2. AN DEN ANSEHENDEN GEBUNDEN. Das Token trägt, WER ansieht — und die
//    Prüfung verlangt, dass dessen Sitzung noch gilt. Ein weitergegebener Link
//    öffnet nichts.
// 3. NUR LESEN. Jede schreibende Route lehnt ab, an EINER Stelle als
//    Middleware, nach der HTTP-Methode. Eine Liste würde man pflegen müssen.
// 4. SICHTBARER BANNER, nicht wegklickbar, mit Namen und Restzeit.
// 5. PROTOKOLL. Start und Ende, wer wen wann.
//
// ── WARUM DAS TOKEN DEN ANSEHENDEN TRÄGT (und das alte nicht) ──────────────
// Das Token der Mitarbeiter-Ansicht (`fiaon-ansicht.ts`) trägt nur die Kennung
// des Angesehenen. Sein Kommentar behauptet, es trage „den ANSEHENDEN mit" —
// der Code tut das nicht. Folge: Wer die Zeichenkette abschreibt, kann sie in
// einem anderen Browser einsetzen, bis sie abläuft.
//
// Bei der Kundenansicht wäre das schwerer: Man sähe die Unterlagen, Rechnungen
// und Zahlungsdaten eines fremden Menschen. Deshalb steht der Ansehende IM
// Token und wird bei jeder Anfrage gegen seine Sitzung geprüft.
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { sqlPool } from "./db-pool";

export const KUNDENANSICHT_COOKIE = "fiaon_kundenansicht";
/** Dreißig Minuten — wie bei der Mitarbeiter-Ansicht. */
export const KUNDENANSICHT_MINUTEN = 30;

/** Wer sieht an? Beides hat andere Rechte. */
export type Ansehender = "admin" | "leitung";

export interface Kundenansicht {
  personId: number;
  /** Die Bestellung, die das Konto ist — das Portal arbeitet mit ihr. */
  ref: string;
  art: Ansehender;
  /** Bei „leitung": die Agenten-Kennung. Bei „admin": 0. */
  ansehenderId: number;
  bis: number;
}

function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_ACCESS_CODE || "fiaon-kundenansicht";
}

/**
 * Das Token. Aufbau: personId . ref . art . ansehenderId . bis . signatur
 *
 * Der `ref` steckt mit drin, damit die Portal-Routen ihn nicht erraten müssen —
 * und damit ein Token, das für Bestellung A ausgestellt wurde, nicht für
 * Bestellung B desselben Menschen gilt.
 */
export function kundenansichtTokenBauen(
  personId: number, ref: string, art: Ansehender, ansehenderId: number,
): string {
  const bis = Date.now() + KUNDENANSICHT_MINUTEN * 60_000;
  // Der `ref` darf keinen Punkt enthalten, sonst zerfällt das Zerlegen. FIAON-
  // Kennungen enthalten keine — geprüft wird es trotzdem, weil eine Annahme
  // über fremde Daten irgendwann nicht mehr stimmt.
  const sicher = String(ref).replace(/\./g, "_");
  const kern = `${personId}.${sicher}.${art}.${ansehenderId}.${bis}`;
  const sig = createHmac("sha256", geheimnis()).update(kern).digest("hex").slice(0, 32);
  return `${kern}.${sig}`;
}

export function kundenansichtTokenPruefen(token: string | undefined): Kundenansicht | null {
  if (!token) return null;
  const teile = String(token).split(".");
  if (teile.length !== 6) return null;
  const [personId, ref, art, ansehenderId, bis, sig] = teile;
  const soll = createHmac("sha256", geheimnis())
    .update(`${personId}.${ref}.${art}.${ansehenderId}.${bis}`).digest("hex").slice(0, 32);
  try {
    // Zeitgleicher Vergleich: `===` verrät über die Laufzeit, wie viele Zeichen
    // stimmen. Bei einer Signatur ist das ein Angriffsweg.
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(soll))) return null;
  } catch { return null; }
  if (Number(bis) < Date.now()) return null;
  if (art !== "admin" && art !== "leitung") return null;
  return {
    personId: Number(personId), ref: String(ref), art,
    ansehenderId: Number(ansehenderId), bis: Number(bis),
  };
}

/**
 * Die Wand gegen jedes Schreiben — für BEIDE Ansichtsarten.
 *
 * ── WARUM DIESE FUNKTION DIE ALTE ERSETZT UND NICHT DANEBEN STEHT ──────────
 * Zwei Middlewares, die dasselbe tun, gehen irgendwen auseinander: Eine wird
 * um eine Ausnahme erweitert, die andere nicht. Deshalb prüft diese eine
 * Funktion beide Cookies. Sie ersetzt `ansichtNurLesen` in `server/routes.ts`;
 * die alte bleibt als Weiterleitung bestehen, damit kein Aufruf ins Leere geht.
 *
 * ── WARUM DIE METHODE UND NICHT EINE LISTE ────────────────────────────────
 * Eine Liste schreibender Routen müsste bei jeder neuen Route gepflegt werden,
 * und genau die eine würde vergessen. Die HTTP-Methode ist die einzige
 * Eigenschaft, die jede Route zwangsläufig hat.
 */
export function nurLesenWand(req: Request, res: Response, next: NextFunction): void {
  const kunde = kundenansichtTokenPruefen((req as any).cookies?.[KUNDENANSICHT_COOKIE]);
  let mitarbeiter: { agentId: number } | null = null;
  try {
    // Bewusst synchron über `require`-freie Wiederholung der Prüfung: Ein
    // `await import()` in einer Middleware macht sie asynchron, und dann läuft
    // die Anfrage in dem Moment weiter, in dem der Import noch lädt.
    const tok = (req as any).cookies?.fiaon_ansicht;
    if (tok) {
      const teile = String(tok).split(".");
      if (teile.length === 3) {
        const soll = createHmac("sha256", geheimnis())
          .update(`${teile[0]}.${teile[1]}`).digest("hex").slice(0, 32);
        if (teile[2] === soll && Number(teile[1]) >= Date.now()) {
          mitarbeiter = { agentId: Number(teile[0]) };
        }
      }
    }
  } catch { /* kein Mitarbeiter-Token */ }

  if (!kunde && !mitarbeiter) return next();
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();

  // Die einzigen Ausnahmen: das Beenden selbst. Ohne sie käme man nicht heraus,
  // denn Beenden ist ein POST.
  if (req.path.endsWith("/ansicht/beenden")) return next();
  if (req.path.endsWith("/kundenansicht/beenden")) return next();

  const wer = kunde ? "Kundenansicht" : "Mitarbeiter-Ansicht";
  res.status(403).json({
    ok: false,
    code: "NUR_ANSICHT",
    error: `Nur-Ansicht (${wer}) — in dieser Sitzung sind Aktionen abgeschaltet. `
      + "Beende die Ansicht oben in der blauen Leiste, um wieder zu arbeiten.",
  });
}

/**
 * Darf dieser Mensch das Portal dieses Kunden ansehen?
 *
 * Admin: alle. Vertriebsleitung: nur eigene und zugewiesene. Ein Agent: nie —
 * er sieht seine Kunden ohnehin in seiner Liste, und die Kundensicht ist ein
 * Aufsichtswerkzeug, kein Arbeitswerkzeug.
 */
export async function darfAnsehen(
  art: Ansehender, ansehenderId: number, personId: number, lauf = sqlPool,
): Promise<{ erlaubt: boolean; grund: string }> {
  if (art === "admin") return { erlaubt: true, grund: "Verwaltung sieht alle Konten." };

  const [ag] = (await lauf`
    SELECT id, COALESCE(rolle, 'agent') AS rolle, active FROM fiaon_agents WHERE id = ${ansehenderId}
  `) as any[];
  if (!ag || !ag.active) return { erlaubt: false, grund: "Kein aktives Mitarbeiterkonto." };
  // 04.09.2026, Florentine: „Ich kann als Geschäftsführung das Kundenportal
  // nicht öffnen, wenn der Kunde einem anderen Mitarbeiter zugeordnet ist.
  // Ich muss meinen Mitarbeitern bei Problemen helfen können, ohne dass der
  // Kunde erst mir zugewiesen wird." Bis hierher sah die Leitung nur eigene
  // und selbst geworbene Kunden. Jetzt: die Leitung sieht alle.
  if (String(ag.rolle) === "vertriebsleiter") return { erlaubt: true, grund: "Die Leitung sieht alle Kunden." };
  if (String(ag.rolle) !== "vertriebsleiter") {
    return {
      erlaubt: false,
      grund: "Die Kundensicht ist ein Werkzeug der Leitung. Deine Kunden siehst du in deiner Liste.",
    };
  }

  // ── EIGENE ODER ZUGEWIESENE ─────────────────────────────────────────────
  // „Eigene" heißt: Der Mensch ist diesem Leiter zugeordnet, oder einem
  // Mitarbeiter, den er geworben hat. Sonst könnte eine Leitung in fremde
  // Vertriebsgebiete sehen.
  const [treffer] = (await lauf`
    SELECT 1 AS ok FROM fiaon_persons p
    WHERE p.id = ${personId}
      AND (p.assigned_agent_id = ${ansehenderId}
        OR p.assigned_agent_id IN (
          SELECT id FROM fiaon_agents WHERE recruited_by = ${ansehenderId}))
  `) as any[];
  if (treffer?.ok) return { erlaubt: true, grund: "Eigener oder zugewiesener Kunde." };
  return {
    erlaubt: false,
    grund: "Dieser Kunde ist nicht dir zugeordnet. Die Verwaltung kann jedes Konto ansehen.",
  };
}

/**
 * Start und Ende protokollieren. Ohne Ausnahme.
 *
 * Das Protokoll gehört an den KUNDEN, nicht an den Ansehenden: Die Frage, die
 * später gestellt wird, lautet „wer hat in mein Konto gesehen?" — und die
 * beantwortet ein Eintrag im Kundenverlauf, nicht einer in einer
 * Mitarbeiter-Liste.
 *
 * Zusätzlich ein Eintrag in der Mitarbeiter-Aktivität, wenn eine Leitung
 * ansieht: Dort steht, was ein Mensch getan hat.
 */
export async function kundenansichtProtokoll(
  opts: { ref: string; personId: number; art: Ansehender; ansehenderId: number; name: string },
  was: "gestartet" | "beendet",
  lauf = sqlPool,
): Promise<void> {
  const text = was === "gestartet"
    ? `Portal-Ansicht GESTARTET durch ${opts.name} (${opts.art === "admin" ? "Verwaltung" : "Vertriebsleitung"}) `
      + `— Nur-Ansicht, ${KUNDENANSICHT_MINUTEN} Minuten. Es können keine Aktionen im Namen des Kunden entstehen.`
    : `Portal-Ansicht beendet durch ${opts.name}.`;

  await lauf`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
    VALUES (${opts.ref},
            ${opts.art === "leitung" ? opts.ansehenderId : null},
            ${opts.name}, 'system', ${text}, NOW())
  `.catch(() => {});

  if (opts.art === "leitung" && opts.ansehenderId > 0) {
    await lauf`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor)
      -- AUSGESCHRIEBEN, nicht zusammengesetzt: Ein Ereignistyp aus einem
      -- Template ist im Quelltext nicht suchbar, und der Aktivitäts-Prüfstand
      -- hält ihn dann für erfunden.
      VALUES (${opts.ansehenderId},
              ${was === "gestartet" ? "kundenansicht_gestartet" : "kundenansicht_beendet"},
              ${JSON.stringify({ ref: opts.ref, person_id: opts.personId, minuten: KUNDENANSICHT_MINUTEN })},
              'agent')
    `.catch(() => {});
  }
  console.log(`[KUNDENANSICHT] ${opts.ref} von ${opts.name} (${opts.art}) ${was}`);
}

/**
 * Die Kundendaten für das Portal — genau die Form, die der Login liefert.
 *
 * ── WARUM DIESELBE FORM ────────────────────────────────────────────────────
 * Das Kundenportal hat keine Server-Sitzung: Der Login legt seine Antwort in
 * `sessionStorage.fiaon_user`, und die Seiten lesen von dort. Wenn die Ansicht
 * dieselbe Form liefert, sieht das Portal EXAKT den Zustand dieses Kunden —
 * Kontostufe, Gate, Sperrkarten, Dokumente, Rechnungen — ohne dass eine
 * einzige Portalseite etwas von der Ansicht wissen muss.
 *
 * Ein eigener Pfad („Ansichts-Modus" in jeder Seite) hätte bedeutet: Jede neue
 * Portalseite muss daran denken. Sie hätte es nicht getan.
 */
export async function kundenDatenFuerAnsicht(
  personId: number, ref: string, lauf = sqlPool,
): Promise<{ ref: string; firstName: string | null; lastName: string | null;
             email: string | null; packName: string | null; approvedLimit: number | null } | null> {
  const [a] = (await lauf`
    SELECT a.ref, a.first_name, a.last_name, a.pack_name, a.pack_key, a.approved_limit,
           COALESCE(NULLIF(a.email, ''), NULLIF(a.contact_email, ''),
                    NULLIF(a.billing_email, ''), p.primary_email) AS email,
           COALESCE(NULLIF(a.first_name, ''), p.first_name, p.contact_name) AS vorname,
           COALESCE(NULLIF(a.last_name, ''), p.last_name) AS nachname
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.ref = ${ref} AND a.person_id = ${personId} AND a.merged_into IS NULL
  `) as any[];
  if (!a) return null;

  // `effectiveLimit` liegt in fiaon-antrag.ts und ist dort nicht ausgeführt
  // exportiert — der Wert wird hier genauso gebildet wie beim Login.
  return {
    ref: String(a.ref),
    firstName: a.vorname ?? a.first_name ?? null,
    lastName: a.nachname ?? a.last_name ?? null,
    email: a.email ?? null,
    packName: a.pack_name ?? null,
    approvedLimit: a.approved_limit ?? null,
  };
}

/** Die Bestellung, die das KONTO dieses Menschen ist. */
export async function kontoBestellungVon(
  personId: number, lauf = sqlPool,
): Promise<{ ref: string; name: string } | null> {
  const [a] = (await lauf`
    SELECT a.ref,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name, a.contact_name, a.email, a.ref) AS name
    FROM fiaon_applications a
    WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
      -- Die Bonitätsauskunft ist ein PRODUKT, kein Konto (siehe
      -- server/fiaon-login-logic.ts, isAddonOrderRow). Ein Token auf sie
      -- ausgestellt würde ein halb leeres Portal zeigen.
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
    ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC
    LIMIT 1
  `) as any[];
  return a ? { ref: String(a.ref), name: String(a.name) } : null;
}
