// ═══════════════════════════════════════════════════════════════════════════
// DER AGENT ALS VOLLPFLEGER — ANLEGEN, PRODUKT, STAMMDATEN
//
// ── DER AUFTRAG DES BETREIBERS ─────────────────────────────────────────────
// „JEDER Agent kann einen Kunden komplett anlegen und pflegen — bis zu dem
// Punkt, an dem der Kunde zahlen kann."
//
// ── WARUM DAS EIN NEUBAU IST UND KEIN FREISCHALTEN ─────────────────────────
// GEMESSEN am 23.08.2026 (reports/mess-agentenrechte.csv, 145 Routen):
//   Neukunde anlegen           → KEINE Route, nur GET /agent/customers
//   Produkt an bestehende Akte → KEINE Route
//   Stammdaten ändern          → nur das EIGENE Profil (/agent/profile/*)
//
// Es gab also nichts zu öffnen. Der Auftrag las sich wie „gib Rechte", die
// Messung sagte „baue die Funktion" — diese Unterscheidung war der Grund,
// zuerst zu messen.
//
// ── WAS HIER NICHT NEU GEBAUT WIRD ─────────────────────────────────────────
// Fast alles gibt es schon, an der richtigen Stelle:
//   shared/fiaon-pakete.ts          der Preiskatalog (eine Quelle)
//   server/fiaon-person-model.ts    `bindePersonAnAntrag` legt/findet die Person
//   fiaon-dubletten-kandidaten.ts   die Dublettensuche mit vier Stufen
//   fiaon-agent.ts                  `updateCustomerContact` (Audit + Person)
//   fiaon-antrag.ts                 `supersedeSisterOrders` (Paket-Hygiene)
//   fiaon-aktivitaet.ts             das Aktivitätsprotokoll
//
// Diese Datei verbindet sie. Jede eigene Fassung einer dieser Regeln wäre ein
// zweites Modell — und genau das ist in diesem Repo mehrfach teuer geworden.
//
// ── DIE VIER WÄNDE ─────────────────────────────────────────────────────────
//   1. Bezahlte Bestellungen sind unantastbar.
//   2. Preise kommen NUR aus dem Katalog — ein mitgeschickter Betrag wird
//      ignoriert, nicht übernommen.
//   3. Die Provisions-Wand bleibt, wie sie ist: Eine Anlage ist ein
//      dokumentierter Kontakt, aber die Provision entscheidet weiter
//      `onCustomerPaid` nach der bestehenden Regel.
//   4. Jede Aktion steht im Kundenverlauf UND im Aktivitätsprotokoll.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { PAKETE, paket, paketPreisEuro } from "../../shared/fiaon-pakete";
import { requireAgent, type AgentRequest } from "./fiaon-agent";

const router = Router();

/** Wer darf anlegen und pflegen? */
// ── ONBOARDING DARF STAMMDATEN ERGAENZEN (20.08.2026) ──────────────────────
// Florentine Lombardi: „Wo kann man das ergaenzen?" — Angaben fehlen, und
// bemerkt wird das fast immer IM GESPRAECH. Onboarding fuehrt die
// Startgespraeche und ist damit die Stelle, an der eine falsche Nummer oder eine
// fehlende Strasse auffaellt. Die Rolle stand nicht in dieser Liste; der Server
// antwortete mit 403, und niemand konnte etwas nachtragen.
//
// Die Besitzgrenze steht dahinter unveraendert: `darfAnKunde` erlaubt einem
// Onboarder nur Menschen, mit denen er einen Termin hat (fiaon-kundenzugriff.ts,
// quelle = 'onboarding_call'). Die Rolle oeffnet also keinen fremden Bestand.
// `inkasso` dazu (22.08.2026): Das Forderungsmanagement meldete seit dem
// 13.08. doppelte Vorwahlen („+49 +49"), die es nicht korrigieren durfte —
// jede Korrektur lief über die Vertriebsleitung. Die Besitzgrenze bleibt:
// `darfAnKunde` lässt Inkasso nur an Menschen mit offener Rate.
const ERLAUBTE_ROLLEN = new Set(["agent", "vertriebsleiter", "admin", "onboarding", "inkasso"]);

/**
 * Eine Referenz im FIAON-Format.
 *
 * Dieselbe Bauform wie die Antragsstrecke (`FIAON-<zeit36>-<zufall>`), damit
 * eine von Hand angelegte Bestellung in Listen und Suchen nicht auffällt — sie
 * ist ja keine andere Art von Bestellung.
 */
function neueRef(): string {
  const zeit = Date.now().toString(36).toUpperCase();
  const zufall = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FIAON-${zeit}-${zufall}`;
}

/** Der kurze Verwendungszweck, den der Kunde überweist. */
function neueZahlungsreferenz(ref: string): string {
  // Die Antragsstrecke nimmt die ersten sechs Zeichen des Zeitanteils.
  const kern = ref.replace(/^FIAON-/, "").split("-")[0] ?? "";
  return `FIAON${kern.slice(0, 6)}`;
}

function normMail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
}

/** Nur Ziffern und ein führendes Plus — der Rest ist Zierde. */
function normNummer(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const ziffern = s.replace(/[^\d]/g, "");
  if (ziffern.length < 6) return null;
  if (s.startsWith("+")) return `+${ziffern}`;
  // 0176… → +49176…: Ohne Landesvorwahl ist die Nummer nicht wählbar, und
  // genau daran ist der Versand schon einmal gescheitert.
  if (ziffern.startsWith("0")) return `+49${ziffern.slice(1)}`;
  return `+${ziffern}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER KATALOG FÜR DIE OBERFLÄCHE
// ═══════════════════════════════════════════════════════════════════════════
// Damit das Formular keine eigene Preisliste braucht. Eine Preisliste in der
// Oberfläche ist die zweite Wahrheit, die irgendwann von der ersten abweicht —
// genau so entstand der Fall „Ultra kauft für 79,99, wird 99,99 berechnet".
router.get("/agent/katalog", requireAgent, async (_req: AgentRequest, res: Response) => {
  res.json({
    ok: true,
    pakete: PAKETE.map((p) => ({
      key: p.key, label: p.label,
      preisEuro: p.preisCents / 100,
      art: p.art, abo: p.abo,
    })),
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DER DUBLETTEN-CHECK — VOR DEM SPEICHERN
// ═══════════════════════════════════════════════════════════════════════════
//
// ── WARUM VORHER UND NICHT NACHHER ────────────────────────────────────────
// Ein Merge ist unumkehrbar: Er zieht Bestellungen, Termine und Provisionen
// mit. Eine Dublette, die nie entsteht, muss nie zusammengeführt werden.
//
// Gesucht wird über E-Mail und Rufnummer — inklusive ALIASE, denn genau dafür
// gibt es sie: Wer früher eine andere Adresse hatte, ist derselbe Mensch.
//
// Rückgabe:
//   []            niemand da → anlegen
//   [einer]       eindeutig  → NICHT anlegen, Akte anbieten
//   [mehrere]     mehrdeutig → NICHT anlegen, Auswahl anbieten
async function findeBestehende(
  mail: string | null, nummer: string | null,
): Promise<Array<{
  personId: number; name: string; ref: string | null; email: string | null;
  phone: string | null; treffer: string; bezahlt: boolean; agentName: string | null;
}>> {
  if (!mail && !nummer) return [];
  const nummerKey = nummer ? nummer.replace(/[^\d]/g, "").slice(-9) : null;

  const zeilen = (await sqlPool`
    SELECT p.id AS person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name) AS name,
           p.primary_email, p.primary_phone,
           -- Worüber wurde getroffen? Das gehört in die Rückfrage: „Dieser
           -- Mensch existiert" ohne Grund klingt wie eine Behauptung.
           CASE
             WHEN ${mail}::text IS NOT NULL
               AND fiaon_mail_norm(p.primary_email) = ${mail} THEN 'E-Mail'
             WHEN ${nummerKey}::text IS NOT NULL
               AND RIGHT(fiaon_nummer_norm(p.primary_phone), 9) = ${nummerKey} THEN 'Rufnummer'
             WHEN EXISTS (SELECT 1 FROM fiaon_person_aliases al
               WHERE al.person_id = p.id AND al.kind = 'email' AND al.value_norm = ${mail})
               THEN 'frühere E-Mail'
             ELSE 'frühere Rufnummer'
           END AS treffer,
           (SELECT a.ref FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS ref,
           EXISTS (SELECT 1 FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL
               AND a.payment_status = 'paid') AS bezahlt,
           (SELECT ag.name FROM fiaon_agents ag WHERE ag.id = p.assigned_agent_id) AS agent_name
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND (
        (${mail}::text IS NOT NULL AND fiaon_mail_norm(p.primary_email) = ${mail})
        OR (${nummerKey}::text IS NOT NULL
            AND RIGHT(fiaon_nummer_norm(p.primary_phone), 9) = ${nummerKey})
        -- Die Aliase: eine frühere Adresse gehört demselben Menschen.
        OR (${mail}::text IS NOT NULL AND EXISTS (
              SELECT 1 FROM fiaon_person_aliases al
              WHERE al.person_id = p.id AND al.kind = 'email' AND al.value_norm = ${mail}))
        OR (${nummerKey}::text IS NOT NULL AND EXISTS (
              SELECT 1 FROM fiaon_person_aliases al
              WHERE al.person_id = p.id AND al.kind = 'phone'
                AND RIGHT(al.value_norm, 9) = ${nummerKey}))
      )
    ORDER BY p.created_at ASC
    LIMIT 6
  `) as any[];

  return zeilen.map((z) => ({
    personId: Number(z.person_id),
    name: String(z.name ?? `Person ${z.person_id}`),
    ref: z.ref ?? null,
    email: z.primary_email ?? null,
    phone: z.primary_phone ?? null,
    treffer: String(z.treffer),
    bezahlt: z.bezahlt === true,
    agentName: z.agent_name ?? null,
  }));
}

/** Nur suchen — für die Vorprüfung im Formular, während getippt wird. */
router.post("/agent/kunden/pruefen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const treffer = await findeBestehende(normMail(req.body?.email), normNummer(req.body?.phone));
    res.json({ ok: true, treffer, eindeutig: treffer.length === 1 });
  } catch (err) {
    console.error("[AGENT-ANLAGE] pruefen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEUKUNDE ANLEGEN
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/kunden/neu", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!ERLAUBTE_ROLLEN.has(String(rolle))) {
      return res.status(403).json({ ok: false, error: "Diese Rolle darf keine Kunden anlegen." });
    }

    const b = req.body || {};
    const vorname = String(b.firstName ?? "").trim().slice(0, 80);
    const nachname = String(b.lastName ?? "").trim().slice(0, 80);
    const mail = normMail(b.email);
    const nummer = normNummer(b.phone);

    if (!vorname || !nachname) {
      return res.status(400).json({ ok: false, error: "Vor- und Nachname sind nötig." });
    }
    // ── MINDESTENS EINE ERREICHBARKEIT ─────────────────────────────────────
    // Ohne E-Mail oder Nummer entsteht keine Person (personFuerZeile gibt
    // `null` zurück) — und damit ein Datensatz, den niemand anrufen und dem
    // niemand schreiben kann. Genau solche Zeilen gibt es 3.235-mal im
    // Bestand; sie sind Formularabbrecher, nicht Kunden.
    if (!mail && !nummer) {
      return res.status(400).json({
        ok: false,
        error: "E-Mail oder Telefonnummer — mindestens eines von beiden. "
          + "Ohne Erreichbarkeit entsteht ein Datensatz, den niemand erreichen kann.",
      });
    }

    // ── DER PREIS KOMMT AUS DEM KATALOG ────────────────────────────────────
    // Ein mitgeschickter Betrag wird IGNORIERT, nicht übernommen. Ein frei
    // getippter Preis landet in Rechnung, Abo-Rate und Provisionsrechnung —
    // und niemand kann hinterher sagen, ob er stimmt.
    const paketKey = String(b.packKey ?? "").trim().toLowerCase();
    const p = paket(paketKey);
    if (paketKey && !p) {
      return res.status(400).json({
        ok: false,
        error: `Unbekanntes Paket „${paketKey}". Preise kommen nur aus dem Katalog.`,
      });
    }
    if (b.amountDue != null || b.preis != null) {
      // Kein stiller Fehlschlag: Wer einen Betrag mitschickt, soll wissen,
      // dass er nicht gilt.
      return res.status(400).json({
        ok: false,
        error: "Beträge werden nicht übernommen — der Preis kommt aus dem Katalog. "
          + "Bitte nur `packKey` schicken.",
      });
    }

    // ── DER DUBLETTEN-CHECK, VOR DEM SPEICHERN ─────────────────────────────
    const bestehende = await findeBestehende(mail, nummer);
    if (bestehende.length === 1 && b.trotzdemNeu !== true) {
      const t = bestehende[0];
      return res.status(409).json({
        ok: false, grund: "existiert",
        error: `${t.name} ist schon im System (Treffer über ${t.treffer}).`
          + (t.agentName ? ` Betreut von ${t.agentName}.` : ""),
        vorschlag: t,
        // Der Weg, den der Agent wirklich will: die Akte öffnen und dort ein
        // Produkt anlegen.
        weiter: t.ref ? { akte: `/agent/kunden?ref=${encodeURIComponent(t.ref)}`, ref: t.ref } : null,
      });
    }
    if (bestehende.length > 1) {
      return res.status(409).json({
        ok: false, grund: "mehrdeutig",
        error: `${bestehende.length} Menschen tragen diese Daten. Bitte auswählen — `
          + "eine neue Anlage würde einen Doppelgänger erzeugen.",
        kandidaten: bestehende,
      });
    }

    // ── ANLEGEN ────────────────────────────────────────────────────────────
    const ref = neueRef();
    const zahlungsreferenz = neueZahlungsreferenz(ref);
    const geburt = String(b.birthdate ?? "").trim().slice(0, 10) || null;

    await sqlPool`
      INSERT INTO fiaon_applications (
        ref, type, status, payment_status, current_step,
        pack_key, pack_name, amount_due, currency, payment_reference,
        -- ── OHNE phone_country_code (28.08.2026) ─────────────────────────
        -- Diese Spalte ist eine Abschrift: Migration 059 schreibt jeden
        -- Kontaktwert per Trigger an die Person durch, und die Landesvorwahl
        -- steckt seit dem 25.08. ohnehin in der Spalte phone (+49…). Sie hier
        -- mit einer leeren Zeichenkette zu füllen war eine leere Zeile in einer
        -- Spalte, die verschwinden soll — die Wand hat sie gefunden.
        -- (Und: KEINE Backticks in SQL-Kommentaren. Zwölfter Fall.)
        first_name, last_name, email, phone,
        street, zip, city, birthdate,
        assigned_agent_id, created_at, updated_at
      ) VALUES (
        ${ref},
        ${p?.art === "business" ? "business" : "private"},
        -- Ein von Hand angelegter Kunde steht sofort auf „Zahlung offen":
        -- Das ist der Punkt, an dem der Kunde zahlen kann, und genau dort
        -- endet der Auftrag.
        ${paketKey ? "payment_pending" : "started"},
        ${paketKey ? "pending_payment" : null},
        ${paketKey ? 5 : 1},
        ${paketKey || null}, ${p?.label ?? null},
        -- Der Betrag kommt aus dem Katalog, nicht aus der Anfrage.
        ${p ? paketPreisEuro(paketKey) : null}, 'EUR',
        ${paketKey ? zahlungsreferenz : null},
        ${vorname}, ${nachname}, ${mail}, ${nummer},
        ${String(b.street ?? "").trim().slice(0, 120) || null},
        ${String(b.zip ?? "").trim().slice(0, 12) || null},
        ${String(b.city ?? "").trim().slice(0, 80) || null},
        ${geburt},
        -- ── BESITZSCHUTZ AB JETZT ────────────────────────────────────────
        -- Wer anlegt, betreut. Sonst landet der Kunde in der allgemeinen
        -- Verteilung, und der Agent, der ihn am Telefon hat, verliert ihn.
        ${req.agent!.id}, NOW(), NOW()
      )
    `;

    // ── DIE PERSON ─────────────────────────────────────────────────────────
    // Über die bestehende Funktion: Sie legt an oder findet, setzt Aliase und
    // hängt die Bestellung an. Eine eigene Fassung hier wäre ein zweites
    // Personenmodell.
    const { bindePersonAnAntrag } = await import("../fiaon-person-model");
    const person = await bindePersonAnAntrag(ref).catch((e) => {
      console.error("[AGENT-ANLAGE] Person binden:", e);
      return null;
    });

    // Der Kunde gehört auch an der PERSON dem Agenten — Listen und
    // Zuständigkeitsprüfungen lesen sie.
    if (person?.personId) {
      await sqlPool`
        UPDATE fiaon_persons
        SET assigned_agent_id = COALESCE(assigned_agent_id, ${req.agent!.id}), updated_at = NOW()
        WHERE id = ${person.personId}
      `.catch(() => {});
    }

    // ── DIE SPUR ───────────────────────────────────────────────────────────
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Kunde von ${req.agent!.name} angelegt (Telefon-Anlage). `
                + `${vorname} ${nachname}, ${mail ?? "keine E-Mail"}, ${nummer ?? "keine Nummer"}. `
                + (p ? `Paket ${p.label} (${paketPreisEuro(paketKey).toFixed(2)} € aus dem Katalog), `
                     + `Verwendungszweck ${zahlungsreferenz}.`
                   : "Noch kein Paket gewählt.")})
    `.catch(() => {});

    // Das Aktivitätsprotokoll — die Aufsicht über Mitarbeiter liest es.
    // Signatur: { typ, wer, agentId, referenz, grund, meta } — NICHT
    // { agentName, beschreibung }. Ein erster Entwurf riet sie, und die
    // Einträge wären mit `undefined` in der Datenbank gelandet.
    const { aktivitaetSchreiben } = await import("../lib/fiaon-aktivitaet");
    await aktivitaetSchreiben({
      typ: "kunde_angelegt",
      wer: req.agent!.name,
      agentId: req.agent!.id,
      referenz: ref,
      grund: p ? `Paket ${p.label}` : "ohne Paket",
      meta: { name: `${vorname} ${nachname}`, packKey: paketKey || null, mail, nummer },
    }).catch(() => {});

    res.json({
      ok: true, ref,
      personId: person?.personId ?? null,
      name: `${vorname} ${nachname}`,
      paket: p ? { key: p.key, label: p.label, preisEuro: paketPreisEuro(paketKey) } : null,
      zahlungsreferenz: paketKey ? zahlungsreferenz : null,
      // Was der Agent als nächstes tun kann — in der Reihenfolge des Gesprächs.
      weiter: {
        zahlungsdatenSenden: paketKey ? `/agent/customers/${encodeURIComponent(ref)}/send-payment-email` : null,
        rechnung: paketKey ? `/api/fiaon/invoice/${encodeURIComponent(ref)}` : null,
        akte: `/agent/kunden?ref=${encodeURIComponent(ref)}`,
      },
    });
  } catch (err) {
    console.error("[AGENT-ANLAGE] neu:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Anlegen" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PRODUKT AN EINE BESTEHENDE AKTE
// ═══════════════════════════════════════════════════════════════════════════
//
// ── DIE PAKET-HYGIENE ─────────────────────────────────────────────────────
// Ein Konto hat GENAU EINE Stufe. Legt der Agent ein zweites Stufenpaket an
// (Upgrade im Gespräch: „Pro reicht mir nicht"), wird die alte OFFENE
// Bestellung stillgelegt — sonst bekommt der Kunde zwei Zahlungsaufforderungen
// und überweist zweimal.
//
// Die Bonitätsauskunft ist KEIN Stufenpaket: Sie ist ein Einmalkauf neben dem
// Konto (`type='schufa'`, 74 €). Sie darf nie ein Paket stilllegen und wird
// von keinem Paket stillgelegt. Diese Kategoriegrenze fehlte einmal ganz — sie
// kostete 583,98 € offenen Umsatz bei den kaufwilligsten Bestandskunden
// (siehe supersedeSisterOrders in fiaon-antrag.ts, 03.08.2026).
//
// Aber: Auch die Auskunft gibt es nur EINMAL lebend. Zwei offene 74-€-Zeilen
// sind zwei Zahlungsaufforderungen für dieselbe Auskunft.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/customers/:ref/produkt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const quellRef = String(req.params.ref);
    const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!ERLAUBTE_ROLLEN.has(String(rolle))) {
      return res.status(403).json({ ok: false, error: "Diese Rolle darf keine Produkte anlegen." });
    }

    const [quelle] = (await sqlPool`
      SELECT ref, person_id, first_name, last_name, company_name, email, phone,
             street, zip, city, birthdate, type,
             assigned_agent_id
      FROM fiaon_applications WHERE ref = ${quellRef} AND merged_into IS NULL
    `) as any[];
    if (!quelle) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    // Besitzschutz — dieselbe Prüfung wie überall im Agentenbereich.
    const eigen = Number(quelle.assigned_agent_id) === req.agent!.id;
    const darf = eigen || (quelle.person_id != null
      && await darfAnKunde(req.agent!.id, rolle, Number(quelle.person_id)));
    // 404 statt 403: Ein 403 bestätigt, dass die Referenz existiert.
    if (!darf) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const paketKey = String(req.body?.packKey ?? "").trim().toLowerCase();
    const p = paket(paketKey);
    if (!p) {
      return res.status(400).json({
        ok: false,
        error: `Unbekanntes Paket „${paketKey}". Preise kommen nur aus dem Katalog.`,
      });
    }
    if (req.body?.amountDue != null || req.body?.preis != null) {
      return res.status(400).json({
        ok: false,
        error: "Beträge werden nicht übernommen — der Preis kommt aus dem Katalog.",
      });
    }

    const istAuskunft = p.key === "schufa";

    // ── WAND 1: BEZAHLTES IST UNANTASTBAR ──────────────────────────────────
    // Gibt es dieses Produkt schon BEZAHLT, wird nichts angelegt. Ein zweites
    // Mal kassieren wäre ein Fehler, den kein Verlaufseintrag heilt.
    const [schonBezahlt] = (await sqlPool`
      SELECT ref, pack_name, paid_at FROM fiaon_applications
      WHERE person_id = ${quelle.person_id} AND merged_into IS NULL
        AND payment_status = 'paid'
        AND ${istAuskunft}::boolean = (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (schonBezahlt && istAuskunft) {
      return res.status(409).json({
        ok: false, grund: "bezahlt",
        error: `Die Bonitätsauskunft ist schon bezahlt (${schonBezahlt.ref}). `
          + "Ein zweites Mal kassieren wäre falsch.",
        vorhanden: { ref: schonBezahlt.ref, paket: schonBezahlt.pack_name },
      });
    }

    // ── DIE OFFENEN DERSELBEN KATEGORIE ────────────────────────────────────
    const offene = (await sqlPool`
      SELECT ref, pack_name, amount_due, payment_status FROM fiaon_applications
      WHERE person_id = ${quelle.person_id} AND merged_into IS NULL
        AND payment_status IN ('pending_payment', 'claimed_paid')
        AND ${istAuskunft}::boolean = (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')
      ORDER BY created_at DESC
    `) as any[];

    // Die Auskunft nur EINMAL lebend: Zwei offene 74-€-Zeilen sind zwei
    // Zahlungsaufforderungen für dieselbe Auskunft.
    if (istAuskunft && offene.length > 0) {
      return res.status(409).json({
        ok: false, grund: "schon_offen",
        error: `Es gibt schon eine offene Bonitätsauskunft (${offene[0].ref}). `
          + "Zwei offene Bestellungen wären zwei Zahlungsaufforderungen für dieselbe Auskunft.",
        vorhanden: { ref: offene[0].ref, paket: offene[0].pack_name },
      });
    }

    // ── ANLEGEN ────────────────────────────────────────────────────────────
    const ref = istAuskunft
      // Die Auskunft trägt ihr eigenes Präfix — daran erkennen alle Abfragen
      // die Kategorie, auch die alten, die `type` nicht lesen.
      ? `FIAON-SCHUFA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      : neueRef();
    const zahlungsreferenz = neueZahlungsreferenz(ref.replace("SCHUFA-", ""));

    await sqlPool`
      INSERT INTO fiaon_applications (
        ref, type, status, payment_status, current_step,
        pack_key, pack_name, amount_due, currency, payment_reference,
        -- Ohne phone_country_code — dieselbe Begründung wie oben.
        first_name, last_name, company_name, email, phone,
        street, zip, city, birthdate,
        person_id, assigned_agent_id, created_at, updated_at
      ) VALUES (
        ${ref},
        ${istAuskunft ? "schufa" : (p.art === "business" ? "business" : "private")},
        'payment_pending', 'pending_payment', 5,
        ${p.key}, ${p.label}, ${paketPreisEuro(p.key)}, 'EUR', ${zahlungsreferenz},
        ${quelle.first_name}, ${quelle.last_name}, ${quelle.company_name},
        ${quelle.email}, ${quelle.phone},
        ${quelle.street}, ${quelle.zip}, ${quelle.city}, ${quelle.birthdate},
        -- Dieselbe Person: Das Produkt gehört demselben Menschen, es entsteht
        -- KEIN zweiter Kunde. Genau daran ist der SCHUFA-Kauf einmal
        -- gescheitert (er erzeugte eine eigene Kundenzeile).
        ${quelle.person_id},
        ${quelle.assigned_agent_id ?? req.agent!.id}, NOW(), NOW()
      )
    `;

    // ── PAKET-HYGIENE: DIE ALTE OFFENE STUFE STILLLEGEN ────────────────────
    const ersetzt: string[] = [];
    if (!istAuskunft) {
      for (const alt of offene) {
        await sqlPool`
          UPDATE fiaon_applications
          SET merged_into = ${ref}, updated_at = NOW()
          WHERE ref = ${alt.ref} AND merged_into IS NULL
            -- Sicherheitsnetz: Nur wirklich Offene. Zwischen Lesen und
            -- Schreiben kann eine Zahlung eingegangen sein.
            AND payment_status IN ('pending_payment', 'claimed_paid')
        `;
        ersetzt.push(String(alt.ref));
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
          VALUES (${alt.ref}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                  ${`Stillgelegt: ersetzt durch ${ref} (${p.label}). `
                    + `Ein Konto hat genau eine Stufe — zwei offene Bestellungen wären `
                    + `zwei Zahlungsaufforderungen.`})
        `.catch(() => {});
      }
    }

    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Produkt von ${req.agent!.name} angelegt: ${p.label} `
                + `(${paketPreisEuro(p.key).toFixed(2)} € aus dem Katalog), `
                + `Verwendungszweck ${zahlungsreferenz}.`
                + (ersetzt.length ? ` Ersetzt: ${ersetzt.join(", ")}.` : "")})
    `.catch(() => {});

    const { aktivitaetSchreiben } = await import("../lib/fiaon-aktivitaet");
    await aktivitaetSchreiben({
      typ: "produkt_angelegt", wer: req.agent!.name, agentId: req.agent!.id,
      referenz: ref, grund: p.label,
      meta: { packKey: p.key, preisEuro: paketPreisEuro(p.key), ersetzt, quelle: quellRef },
    }).catch(() => {});

    res.json({
      ok: true, ref,
      paket: { key: p.key, label: p.label, preisEuro: paketPreisEuro(p.key) },
      zahlungsreferenz,
      ersetzt,
      hinweis: ersetzt.length
        ? `Die alte offene Bestellung (${ersetzt.join(", ")}) wurde stillgelegt — `
          + "der Kunde bekommt nur eine Zahlungsaufforderung."
        : null,
    });
  } catch (err) {
    console.error("[AGENT-ANLAGE] produkt:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Anlegen des Produkts" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DER ABSCHLUSS: TERMIN ANBIETEN
// ═══════════════════════════════════════════════════════════════════════════
//
// ── WARUM DER FLUSS HIER ENDET ────────────────────────────────────────────
// Anlage → Produkt → Zahlungsdaten → TERMIN. Der letzte Schritt ist der, der
// aus einer Bestellung einen Kunden macht: GEMESSEN am 24.08.2026 stammen ALLE
// 120 gebuchten Termine aus einem verschickten Link — der Hebel funktioniert,
// er wurde nur am Telefon nicht angeboten.
//
// Zwei Wege, weil zwei Gespräche:
//   senden   — der Kunde bekommt eine Mail mit dem Link (Registry-Ereignis,
//              bestehend)
//   kopieren — der Agent hat ihn am Telefon oder auf WhatsApp und schickt ihn
//              selbst. Ohne diesen Weg tippt er die Adresse ab.
router.post("/agent/customers/:ref/termin-anbieten", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const ref = String(req.params.ref);
    const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!ERLAUBTE_ROLLEN.has(String(rolle))) {
      return res.status(403).json({ ok: false, error: "Diese Rolle darf keine Termine anbieten." });
    }

    const [a] = (await sqlPool`
      SELECT assigned_agent_id, person_id, email,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), company_name) AS name
      FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const eigen = Number(a.assigned_agent_id) === req.agent!.id;
    if (!eigen && !(a.person_id != null
        && await darfAnKunde(req.agent!.id, rolle, Number(a.person_id)))) {
      return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    }
    if (a.person_id == null) {
      // Ohne Person kein Terminlink: Das Token wird über die Person gebildet,
      // und ein Termin ohne Menschen dahinter ist nicht zuzuordnen.
      return res.status(400).json({
        ok: false,
        error: "Dieser Bestellung fehlt eine Person — ohne sie gibt es keinen Terminlink. "
          + "Bitte zuerst E-Mail oder Telefonnummer nachtragen.",
      });
    }

    const { terminLink } = await import("../lib/fiaon-termine");
    const link = terminLink(Number(a.person_id));
    const senden = req.body?.senden === true;

    if (!senden) {
      // Nur den Link zurückgeben — der Agent kopiert ihn. Kein Versand, kein
      // Verlaufseintrag: Es ist nichts passiert, was den Kunden erreicht hat.
      return res.json({ ok: true, link, gesendet: false });
    }

    // ── VERSAND ÜBER DAS BESTEHENDE EREIGNIS ───────────────────────────────
    // `nicht_erreicht_termin` trägt den Terminlink schon (fiaon-mail-senden.ts
    // setzt ihn ein). Ein eigenes Ereignis dafür wäre ein zweiter Weg, der
    // beim nächsten Umbau vergessen wird.
    const { mailSenden } = await import("../lib/fiaon-mail-senden");
    const v = await mailSenden({
      event: "nicht_erreicht_termin",
      ref,
      personId: Number(a.person_id),
      akteur: { name: req.agent!.name, agentId: req.agent!.id, rolle: rolle as any },
    }).catch((e) => ({ ok: false, grund: e instanceof Error ? e.message : String(e) }));

    if (!(v as any).ok) {
      return res.status(400).json({
        ok: false, link,
        error: `Die Mail ging nicht raus: ${(v as any).grund ?? "unbekannt"}. `
          + "Der Link steht trotzdem hier — du kannst ihn dem Kunden direkt schicken.",
      });
    }

    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Terminlink an ${a.email ?? "den Kunden"} geschickt (${req.agent!.name}).`})
    `.catch(() => {});

    res.json({ ok: true, link, gesendet: true, an: a.email ?? null });
  } catch (err) {
    console.error("[AGENT-ANLAGE] termin-anbieten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STAMMDATEN PFLEGEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Delegiert an `updateCustomerContact` — die bestehende Funktion mit Audit
// (ein Verlaufseintrag je geändertem Feld, alt → neu) und
// `personDurchschreiben` (der alte Wert wandert als ALIAS an die Person, damit
// ein Anruf von der alten Nummer weiter erkannt wird).
//
// Eine eigene Fassung hier wäre die zweite Wahrheit über die Rufnummer eines
// Menschen — und genau daran ist es schon einmal gescheitert: 89 Bestellungen
// trugen eine andere Nummer als ihre Person.
router.post("/agent/customers/:ref/stammdaten", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const ref = String(req.params.ref);
    const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!ERLAUBTE_ROLLEN.has(String(rolle))) {
      return res.status(403).json({ ok: false, error: "Diese Rolle darf keine Stammdaten ändern." });
    }

    const [a] = (await sqlPool`
      SELECT assigned_agent_id, person_id, payment_status FROM fiaon_applications
      WHERE ref = ${ref} AND merged_into IS NULL
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const eigen = Number(a.assigned_agent_id) === req.agent!.id;
    if (!eigen && !(a.person_id != null
        && await darfAnKunde(req.agent!.id, rolle, Number(a.person_id)))) {
      return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    }

    // ── WAS EIN AGENT NICHT ÄNDERN DARF ────────────────────────────────────
    // Kontakt- und Adressdaten ja — das ist der Sinn der Sache. Aber KEINE
    // Beträge, keine Zahlungszustände, kein Paket über diesen Weg. Wer den
    // Preis ändern will, legt ein Produkt aus dem Katalog an.
    // ── WARUM `country` HIER (NOCH) NICHT STEHT (20.08.2026) ─────────────
    // Der Auftrag nennt Land und Geburtsdatum. `updateCustomerContact`
    // (fiaon-agent.ts) verarbeitet aber nur firstName, lastName, email, phone,
    // street, zip, city — `country` und `birthdate` werden dort stillschweigend
    // verworfen. Sie hier zu erlauben haette ein Feld angeboten, das „ok"
    // meldet und nichts tut. Das ist die Fehlerklasse, die dieses Repo an sechs
    // Stellen beseitigt hat; sie wird nicht an einer siebten eingebaut.
    //
    // `birthdate` steht in der Liste, weil es dort schon stand — auch es wird
    // von der Schreibfunktion nicht verarbeitet und ist im Report benannt.
    const erlaubt = ["firstName", "lastName", "email", "phone", "street", "zip", "city", "birthdate"];
    const koerper: any = {};
    const abgelehnt: string[] = [];
    for (const [k, v] of Object.entries(req.body || {})) {
      if (erlaubt.includes(k)) koerper[k] = v;
      else abgelehnt.push(k);
    }
    if (Object.keys(koerper).length === 0) {
      return res.status(400).json({
        ok: false,
        error: `Keine änderbaren Felder. Erlaubt: ${erlaubt.join(", ")}.`
          + (abgelehnt.length ? ` Abgelehnt: ${abgelehnt.join(", ")}.` : ""),
      });
    }

    const { updateCustomerContact } = await import("./fiaon-agent");
    const erg = await updateCustomerContact(ref, koerper,
      { id: req.agent!.id, name: req.agent!.name });

    res.json({
      ok: true,
      geaendert: erg?.changes ?? [],
      // Wenn dabei eine Dublette auffällt, sagt es die bestehende Funktion.
      dublette: erg?.duplicate ?? null,
      abgelehnt: abgelehnt.length ? abgelehnt : undefined,
    });
  } catch (err) {
    console.error("[AGENT-ANLAGE] stammdaten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
