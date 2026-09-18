// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — EINEN AUFTRAG STORNIEREN (17.09.2026, E-188)
//
// ── DIE LÜCKE ─────────────────────────────────────────────────────────────
// „storniert" war für einen Firmenauftrag bis heute nur ABGELEITET: aus einer
// Bestellung, die jemand an anderer Stelle storniert oder archiviert hatte. Einen
// eigenen Weg gab es nicht — und damit keinen Ort für den Grund, keinen Namen
// dazu, keine Nachricht an die zuständige Person und keinen Auslöser für die
// Geld-zurück-Zusage aus Ziffer 6 des Auftrags.
//
// ── DER WEG (nur Leitung: POST /admin/global/auftraege/:ref/storno) ───────
//   1. prüfen: Auftrag da, nicht schon storniert, Grund vorhanden (bezahlt:
//      mindestens zehn Zeichen — ein Storno über 2.499 € und mehr braucht einen
//      Satz, den man in einem Jahr noch versteht),
//   2. die BESTELLUNG stornieren — über bestellungStornieren (fiaon-antrag.ts),
//      denselben Weg wie der Storno-Knopf der Zahlungsliste: Status cancelled,
//      Provisionen über onCustomerRefunded zurück. NICHT bei „bezahlt, ohne
//      Erstattung" (der Kunde beendet, das Geld für erbrachte Leistung bleibt):
//      Dann bleibt die Zahlung gebucht und die Provision stehen — nur die Akte
//      wird storniert,
//   3. die AKTE auf „storniert" setzen: Grund, wer, wann, ob erstattet wird,
//   4. Aufgabe an die zuständige Person: Der Auftrag ist storniert, offene
//      Schritte ruhen,
//   5. bei `erstattung: true` eine DRINGENDE Aufgabe an Justin: „Erstattung
//      veranlassen: <Betrag> an <Firma>".
//
// ── WAS BEWUSST NICHT PASSIERT ────────────────────────────────────────────
//   · KEIN Geld bewegt sich. Hausregel: Geld bewegt nur Justin, von Hand. Diese
//     Datei schreibt keine Buchung, keine Gutschrift, keine Rate.
//   · Keine Mail an den Kunden. Ein Storno wird besprochen, nicht automatisch
//     verschickt — die zuständige Person hat die Aufgabe dazu.
//   · Nichts wird gelöscht: Vertrag, Rechnung und Verlauf bleiben in der Akte.
//     Eine Stornorechnung bzw. Gutschrift zur Rechnung klärt die Buchhaltung —
//     der Hinweis steht in Justins Aufgabe.
//   · Die Mails des Zahlungstakts hören von selbst auf: Er arbeitet nur an
//     offenen Aufträgen (fiaon-global-zahlungstakt.ts).
//
// Die Prüfung der Eingabe ist eine reine Funktion (globalStornoPruefen) und
// wird von scripts/pruef-global-querschnitt.ts durchgespielt.
// ═══════════════════════════════════════════════════════════════════════════

export const STORNO_GRUND_MIN = 3;
export const STORNO_GRUND_MIN_BEZAHLT = 10;

export interface StornoEingabe { grund: string; erstattung: boolean }
export type StornoPruefung = { ok: true; daten: StornoEingabe } | { ok: false; error: string };

/**
 * Darf so storniert werden? Rein — kennt nur den Stand und die Eingabe.
 * `status` ist der Stand, wie ihn die Liste der Leitung zeigt.
 */
export function globalStornoPruefen(
  lage: { status: string; bezahlt: boolean; ohneAuftrag?: boolean },
  ein: { grund?: unknown; erstattung?: unknown },
): StornoPruefung {
  if (lage.status === "storniert") return { ok: false, error: "Dieser Auftrag ist bereits storniert." };
  if (lage.status === "abgeschlossen") return { ok: false, error: "Dieser Auftrag ist abgeschlossen — ein abgeschlossener Auftrag wird nicht storniert." };
  const grund = String(ein.grund ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
  const erstattung = ein.erstattung === true;
  if (lage.bezahlt && grund.length < STORNO_GRUND_MIN_BEZAHLT) {
    return { ok: false, error: `Der Auftrag ist bezahlt — bitte den Grund in einem Satz festhalten (mindestens ${STORNO_GRUND_MIN_BEZAHLT} Zeichen). In einem Jahr soll noch jemand verstehen, warum.` };
  }
  if (grund.length < STORNO_GRUND_MIN) return { ok: false, error: "Bitte einen Grund angeben." };
  if (erstattung && !lage.bezahlt) return { ok: false, error: "Zu diesem Auftrag ist keine Zahlung gebucht — es gibt nichts zu erstatten." };
  return { ok: true, daten: { grund, erstattung } };
}

// ── Schema: Grund, wer, wann — an der Auftragsakte ───────────────────────────
let spaltenBereit: Promise<void> | null = null;
export async function ensureStornoSpalten(): Promise<void> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      const { sqlPool } = await import("./db-pool");
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx.unsafe(`
          ALTER TABLE fiaon_global_auftraege
            ADD COLUMN IF NOT EXISTS storniert_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS storniert_von TEXT,
            ADD COLUMN IF NOT EXISTS storno_grund TEXT,
            ADD COLUMN IF NOT EXISTS storno_erstattung BOOLEAN`);
      });
    })().catch((e) => { spaltenBereit = null; throw e; });
  }
  return spaltenBereit;
}

export async function globalAuftragStornieren(
  ref: string, ein: { grund?: unknown; erstattung?: unknown }, wer: string,
): Promise<{ ok: boolean; status?: number; error?: string; meldung?: string }> {
  const { sqlPool } = await import("./db-pool");
  const { ensureGlobalTabelle, globalAkteLesen, globalBestellungLesen, globalVerlauf, globalEur, globalEinstellungen } = await import("./fiaon-global-auftrag");
  const { istGlobalPaket, paket: katalogPaket } = await import("@shared/fiaon-pakete");
  await ensureGlobalTabelle();
  await ensureStornoSpalten();

  const b = await globalBestellungLesen(ref);
  if (!b || !istGlobalPaket(b.pack_key)) return { ok: false, status: 404, error: "Zu dieser Nummer gibt es keinen Auftrag über FIAON Global." };
  const akte = await globalAkteLesen(ref);
  const bezahlt = String(b.payment_status) === "paid";
  const schonStorniert = String(akte?.status) === "storniert" || !!b.cancelled_at || !!b.archived_at
    || ["cancelled", "superseded"].includes(String(b.payment_status));
  const p = globalStornoPruefen({ status: schonStorniert ? "storniert" : String(akte?.status || "offen"), bezahlt, ohneAuftrag: !akte }, ein);
  if (!p.ok) return { ok: false, status: schonStorniert ? 409 : 400, error: p.error };
  const { grund, erstattung } = p.daten;

  const firma = String(akte?.firma_name || b.company_name || b.contact_name || ref);
  const kat = katalogPaket(b.pack_key);
  const paketName = kat?.label ?? String(b.pack_name || b.pack_key);
  const betragCents = Math.round(Number(b.amount_due || 0) * 100);

  // ── 2. Die Bestellung — über den einen Storno-Weg des Hauses ───────────────
  // Bezahlt OHNE Erstattung: Die Zahlung bleibt gebucht (das Geld ist da und bleibt da), die Provision
  // bleibt stehen. Alles andere geht auf „cancelled", mit Rücknahme der Provisionen.
  let provisionSatz = "";
  if (!bezahlt || erstattung) {
    const { bestellungStornieren } = await import("../routes/fiaon-antrag");
    const erg = await bestellungStornieren({ ref }, wer);
    if (!erg) return { ok: false, status: 409, error: "Die Bestellung ließ sich nicht stornieren — sie ist bereits storniert oder in einem Stand, den der Storno nicht kennt." };
    provisionSatz = erg.commissions.cancelled + erg.commissions.clawback > 0
      ? ` Provisionen: ${erg.commissions.cancelled} storniert, ${erg.commissions.clawback} mit künftigen verrechnet.` : "";
  }

  // ── 3. Die Akte ────────────────────────────────────────────────────────────
  if (akte) {
    await sqlPool`
      UPDATE fiaon_global_auftraege
         SET status = 'storniert', storniert_am = NOW(), storniert_von = ${wer}, storno_grund = ${grund},
             storno_erstattung = ${erstattung}, updated_at = NOW()
       WHERE ref = ${ref}`;
  }
  await globalVerlauf(ref, `FIAON Global: Auftrag storniert von ${wer}. Grund: ${grund}.${bezahlt ? (erstattung ? ` Erstattung über ${globalEur(betragCents)} ist bei Justin beauftragt — überwiesen wird von Hand.` : " Keine Erstattung — die Zahlung bleibt gebucht.") : " Es war keine Zahlung gebucht."}${provisionSatz}`);

  // ── 4. Die zuständige Person erfährt es als Aufgabe ────────────────────────
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const zustaendig = akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : (await globalEinstellungen()).zustaendigAgentId;
  await auftragFuerKunden({
    personId: b.person_id != null ? Number(b.person_id) : null, ref,
    titel: `FIAON Global: Auftrag storniert — ${firma}, ${paketName}`,
    text: [
      `${wer} hat den Auftrag von ${firma} (${paketName}, ${globalEur(betragCents)}) storniert.`,
      `Grund: ${grund}`,
      bezahlt
        ? (erstattung ? "Die Erstattung veranlasst Justin von Hand — bitte dem Kunden KEINEN Termin dafür nennen." : "Es wird nichts erstattet; die Zahlung bleibt gebucht.")
        : "Es war keine Zahlung gebucht; Erinnerungen gehen keine mehr raus.",
      "Bitte offene Schritte zu diesem Auftrag ruhen lassen und die übrigen Aufgaben dazu schließen. Hat der Kunde den Storno noch nicht von dir gehört: bitte kurz anrufen.",
    ].join("\n"),
    schluessel: `global:${ref}:storno`, bereich: "konten", quelle: "global", autorName: wer, agentId: zustaendig,
    anlageText: "Auftrag in /chef/s/global-auftraege storniert.",
  }).catch((e) => console.error(`[FIAON-GLOBAL] ${ref}: Aufgabe zum Storno nicht angelegt:`, e));

  // ── 5. Erstattung: NUR eine Aufgabe für Justin — Geld bewegt nur er, von Hand ──
  let erstattungSatz = "";
  if (erstattung) {
    const erg = await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref,
      titel: `Erstattung veranlassen: ${globalEur(betragCents)} an ${firma}`,
      text: [
        `FIAON Global, Auftrag ${ref} (${paketName}) wurde von ${wer} storniert — mit Erstattung.`,
        `Grund: ${grund}`,
        `Zu erstatten: ${globalEur(betragCents)} an ${firma}. Eingegangen unter dem Verwendungszweck ${b.payment_reference ?? "—"}${b.invoice_number ? `, Rechnung ${b.invoice_number}` : ""}. Bitte auf das Konto zurücküberweisen, von dem die Zahlung kam (Bankbuch).`,
        "Das System hat KEIN Geld bewegt und keine Buchung geschrieben. Die Bestellung steht auf storniert; gebuchte Provisionen sind über den Storno-Weg zurückgenommen.",
        "Zur Rechnung gehört eine Stornorechnung bzw. Gutschrift — bitte mit der Buchhaltung klären.",
      ].join("\n"),
      dringend: true, anBetreiber: true, schluessel: `global:${ref}:erstattung`, bereich: "konten", quelle: "global", autorName: wer,
      link: "/chef/s/global-auftraege",
      anlageText: "Storno mit Erstattung in /chef/s/global-auftraege.",
    }).catch((e) => { console.error(`[FIAON-GLOBAL] ${ref}: Aufgabe „Erstattung veranlassen" nicht angelegt:`, e); return null; });
    erstattungSatz = erg?.id
      ? " Die dringende Aufgabe „Erstattung veranlassen“ liegt bei Justin — überwiesen wird von Hand."
      : " ACHTUNG: Die Aufgabe „Erstattung veranlassen“ ließ sich NICHT anlegen — bitte Justin direkt Bescheid geben.";
  }
  return { ok: true, meldung: `Auftrag storniert.${erstattungSatz}` };
}
