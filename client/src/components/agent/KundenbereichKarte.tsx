// ═══════════════════════════════════════════════════════════════════════════
// DIE KARTE „WAS DEIN KUNDE SIEHT“ (Scheibe 7, Modul C, 06.09.2026)
//
// ── WOFÜR ──────────────────────────────────────────────────────────────────
// Am Telefon fragte der Betreuer bisher den Kunden, was auf dessen Bildschirm
// steht. Diese Karte dreht das um: Sie zeigt dieselbe Lage, die der Kunde in
// /app sieht — sein Weg, seine Vorgänge, seine Ansprüche, seine Vollmacht,
// sein letzter Monatsbericht, und wann er zuletzt drin war.
//
// ── ZWEI SPRACHEN AUF EINER FLÄCHE ─────────────────────────────────────────
// Der Mitarbeiter wird geduzt. Alles, was in Anführungszeichen steht, ist der
// SATZ DES KUNDEN in Sie-Form — er kommt wörtlich vom Server (stand_text,
// grosse_zahl_text) und wird hier nicht umformuliert. Wer ihn ändern will,
// ändert ihn im Vorgang, nicht in der Anzeige.
//
// ── LEERZUSTÄNDE SIND EHRLICH ──────────────────────────────────────────────
// „Noch kein Vorgang“ heisst noch kein Vorgang. Kein Platzhalter, keine
// beruhigende Formel — der leere Zustand ist die Information.
//
// Die Karte lädt selbst (GET /agent/app/kunde/:personId/uebersicht) und
// braucht ausser `personId` nichts. Stil: dunkle Bühne, Glas — Präfix .kbk-.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { api, fmtCents } from "@/pages/agent/shared";
import "@/styles/office-kundenbereich.css";

interface Vorgang {
  id: number; art: string; artTitel: string; stand: string; standText: string;
  aktenzeichen: string | null; fristAm: string | null; versandtAm: string | null;
  empfaenger: string | null; angelegtAm: string | null; offen: boolean;
}
interface Anspruch {
  regelSchluessel: string; titel: string; stand: string;
  betragCents: number | null; monatlich: boolean; fristAm: string | null;
}
interface Uebersicht {
  personId: number;
  kundeRef: string | null;
  weg: {
    erledigt: number; gesamt: number;
    jetzt: { key: string; titel: string; kurz: string; wer: "kunde" | "fiaon" | null } | null;
    lage: "kunde_dran" | "fiaon_dran" | "nichts_offen";
    raten: { gesamt: number; bezahlt: number; puenktlich: number };
  };
  vorgaenge: Vorgang[];
  ansprueche: Anspruch[];
  vollmacht: { aktiv: boolean; gueltigBis: string | null; umfang: string[]; unterschriebenAm: string | null; widerrufenAm: string | null } | null;
  bericht: { monat: string; monatText: string; grosseZahlCents: number; grosseZahlText: string; gelesenAm: string | null } | null;
  check: { beantwortet: number; gesamt: number };
  konto: { eroeffnet: boolean; am: string | null; gemeldetVon: string | null };
  bereichBesucht: { zuletzt: string | null; bildschirme: number };
}

/** Der Stand eines Anspruchs, wie der Mitarbeiter ihn liest. */
const ANSPRUCH_STAND: Record<string, string> = {
  offen: "offen", verworfen: "verworfen", beantragt: "beantragt", bewilligt: "bewilligt",
  abgelehnt: "abgelehnt", nicht_zutreffend: "trifft nicht mehr zu",
};

/**
 * Heute als JJJJ-MM-TT — Vorbelegung und Obergrenze des Datumsfelds.
 *
 * BERLIN, nicht die Uhr des Rechners: Der Server weist ein Datum in der Zukunft
 * ab und rechnet dabei in Berlin. Ein Browser, der voraus steht, bekäme sonst
 * ein Feld vorbelegt, das der Server nicht annimmt.
 * Und nur formatToParts — Number(Intl.format()) ergibt NaN (Zeit-Falle 01.09.).
 */
function heuteFeld(): string {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const w = (art: string) => teile.find((p) => p.type === art)?.value ?? "";
  return `${w("year")}-${w("month")}-${w("day")}`;
}

export function KundenbereichKarte({ personId, kundeRef }: { personId: number; kundeRef?: string }) {
  const [u, setU] = useState<Uebersicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [frage, setFrage] = useState(false);
  const [am, setAm] = useState(heuteFeld());

  const laden = useCallback(() => {
    if (!Number.isFinite(personId) || personId <= 0) { setLaedt(false); setFehler("Zu diesem Eintrag gibt es noch keinen Menschen in der Datenbank."); return; }
    setLaedt(true);
    api(`/agent/app/kunde/${personId}/uebersicht`)
      .then((r) => {
        if (r.ok && r.json?.ok) { setU(r.json as Uebersicht); setFehler(null); }
        else setFehler(r.json?.error || "Der Kundenbereich lässt sich gerade nicht lesen.");
      })
      .catch(() => setFehler("Keine Verbindung."))
      .finally(() => setLaedt(false));
  }, [personId]);
  useEffect(laden, [laden]);

  const kontoMelden = async () => {
    setBusy(true); setMeldung(null); setFehler(null);
    const r = await api(`/agent/app/kunde/${personId}/konto-eroeffnet`, { method: "POST", body: JSON.stringify({ am }) });
    setBusy(false); setFrage(false);
    if (r.ok && r.json?.ok) { setMeldung(r.json.meldung || "Eingetragen."); laden(); }
    else setFehler(r.json?.error || "Das hat gerade nicht geklappt. Bitte noch einmal.");
  };

  if (laedt && !u) return <div className="kbk"><p className="kbk-lade">Lädt …</p></div>;
  if (!u) return <div className="kbk"><p className="kbk-fehler">{fehler ?? "Der Kundenbereich lässt sich gerade nicht lesen."}</p></div>;

  const ref = u.kundeRef || kundeRef || null;
  const anteil = u.weg.gesamt > 0 ? Math.round((u.weg.erledigt / u.weg.gesamt) * 100) : 0;
  const lageText = u.weg.lage === "kunde_dran" ? "Dein Kunde ist am Zug."
    : u.weg.lage === "fiaon_dran" ? "Wir sind am Zug." : "Nichts offen.";
  const checkFertig = u.check.beantwortet >= u.check.gesamt && u.check.gesamt > 0;

  return (
    <div className="kbk">
      <div className="kbk-kopf">
        <span className="kbk-pille">Was dein Kunde sieht</span>
        {ref && <span className="kbk-mono kbk-ref">{ref}</span>}
      </div>

      {meldung && <p className="kbk-meldung">{meldung}</p>}
      {fehler && <p className="kbk-fehler">{fehler}</p>}

      {/* ── Sein Weg ─────────────────────────────────────────────────────── */}
      <section className="kbk-block">
        <small>Sein Weg</small>
        <div className="kbk-gross">
          <b>{u.weg.erledigt} von {u.weg.gesamt}</b>
          <span>{lageText}</span>
        </div>
        <div className="kbk-balken" role="presentation"><i style={{ width: `${anteil}%` }} /></div>
        <p className="kbk-satz">
          {u.weg.jetzt
            ? <>Jetzt: <b>{u.weg.jetzt.kurz}</b> — {u.weg.jetzt.wer === "kunde" ? "er ist dran" : u.weg.jetzt.wer === "fiaon" ? "wir sind dran" : "niemand wartet"}.</>
            : <>Alle Schritte seines Weges sind erledigt.</>}
        </p>
        <div className="kbk-zeile">
          <span>Raten</span>
          <b>{u.weg.raten.bezahlt} von {u.weg.raten.gesamt} bezahlt{u.weg.raten.bezahlt > 0 ? `, davon ${u.weg.raten.puenktlich} pünktlich` : ""}</b>
        </div>
        <div className="kbk-zeile">
          <span>Anspruchs-Check</span>
          <b>{checkFertig ? `${u.check.beantwortet} von ${u.check.gesamt} beantwortet` : `noch nicht geführt: ${u.check.beantwortet} von ${u.check.gesamt}`}</b>
        </div>
        <div className="kbk-zeile">
          <span>Zuletzt in seinem Bereich</span>
          <b>{u.bereichBesucht.zuletzt ? `${u.bereichBesucht.zuletzt} · ${u.bereichBesucht.bildschirme} ${u.bereichBesucht.bildschirme === 1 ? "Bildschirm" : "Bildschirme"}` : "war noch nie drin"}</b>
        </div>
      </section>

      {/* ── Vorgänge ─────────────────────────────────────────────────────── */}
      <section className="kbk-block">
        <small>Seine Vorgänge</small>
        {u.vorgaenge.length === 0
          ? <p className="kbk-leer">Noch kein Vorgang.</p>
          : (
            <ul className="kbk-liste">
              {u.vorgaenge.map((v) => (
                <li key={v.id}>
                  <Link href={`/agent/app-vorgaenge/${v.id}`} className="kbk-reihe">
                    <span className="kbk-titel">{v.artTitel}{v.aktenzeichen ? <span className="kbk-mono kbk-az"> · {v.aktenzeichen}</span> : null}</span>
                    <span className="kbk-kunde">„{v.standText}“</span>
                    <span className="kbk-fuss">
                      <em className={v.offen ? "kbk-marke offen" : "kbk-marke"}>{v.offen ? "offen" : "abgeschlossen"}</em>
                      {v.versandtAm ? <> · versandt {v.versandtAm}{v.empfaenger ? ` an ${v.empfaenger}` : ""}</> : null}
                      {v.fristAm ? <> · Nachfrage {v.fristAm}</> : null}
                      {!v.versandtAm && !v.fristAm && v.angelegtAm ? <> · angelegt {v.angelegtAm}</> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>

      {/* ── Ansprüche ────────────────────────────────────────────────────── */}
      <section className="kbk-block">
        <small>Seine Ansprüche</small>
        {u.ansprueche.length === 0
          ? <p className="kbk-leer">{checkFertig ? "Der Check ergab keinen Befund." : `Anspruchs-Check noch nicht geführt: ${u.check.beantwortet} von ${u.check.gesamt}.`}</p>
          : (
            <ul className="kbk-liste">
              {u.ansprueche.map((a) => (
                <li key={a.regelSchluessel} className="kbk-reihe">
                  <span className="kbk-titel">{a.titel}</span>
                  <span className="kbk-fuss">
                    <em className={a.stand === "bewilligt" ? "kbk-marke offen" : "kbk-marke"}>{ANSPRUCH_STAND[a.stand] ?? a.stand}</em>
                    {a.betragCents != null ? <> · <b className="kbk-mono">{fmtCents(a.betragCents)}</b>{a.monatlich ? " im Monat" : " einmalig"}</> : null}
                    {a.fristAm ? <> · Frist {a.fristAm}</> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </section>

      {/* ── Vollmacht ────────────────────────────────────────────────────── */}
      <section className="kbk-block">
        <small>Seine Vollmacht</small>
        {!u.vollmacht
          ? <p className="kbk-leer">Kein Eintrag — ohne Vollmacht geht kein Antrag hinaus.</p>
          : u.vollmacht.widerrufenAm
            ? <p className="kbk-leer">Widerrufen am {u.vollmacht.widerrufenAm}. Ohne Vollmacht geht kein Antrag hinaus.</p>
            : u.vollmacht.aktiv
              ? (
                <>
                  <p className="kbk-satz">Gültig bis <b>{u.vollmacht.gueltigBis ?? "—"}</b>{u.vollmacht.unterschriebenAm ? <> · unterschrieben am {u.vollmacht.unterschriebenAm}</> : null}.</p>
                  {u.vollmacht.umfang.length > 0 && (
                    <p className="kbk-fuss">Umfang: {u.vollmacht.umfang.map((x) => <em key={x} className="kbk-marke">{x}</em>)}</p>
                  )}
                </>
              )
              : <p className="kbk-leer">Angelegt, aber nicht gültig{u.vollmacht.gueltigBis ? ` (bis ${u.vollmacht.gueltigBis})` : ""} — sie deckt gerade keine Übermittlung.</p>}
      </section>

      {/* ── Monatsbericht ────────────────────────────────────────────────── */}
      <section className="kbk-block">
        <small>Sein letzter Monatsbericht</small>
        {!u.bericht
          ? <p className="kbk-leer">Noch kein Bericht — der erste entsteht nach dem ersten vollen Monat.</p>
          : (
            <>
              <div className="kbk-zeile"><span>{u.bericht.monatText}</span><b className="kbk-mono">{fmtCents(u.bericht.grosseZahlCents)}</b></div>
              <p className="kbk-kunde">„{u.bericht.grosseZahlText}“</p>
              <p className="kbk-fuss">{u.bericht.gelesenAm ? `Gelesen am ${u.bericht.gelesenAm}.` : "Noch nicht geöffnet."}</p>
            </>
          )}
      </section>

      {/* ── Girokonto: der eine Handgriff ────────────────────────────────── */}
      <section className="kbk-block">
        <small>Girokonto</small>
        {u.konto.eroeffnet
          ? <p className="kbk-satz">Eröffnung gemeldet{u.konto.am ? ` für den ${u.konto.am}` : ""}{u.konto.gemeldetVon ? ` von ${u.konto.gemeldetVon}` : ""}. Der Schritt steht in seinem Weg.</p>
          : !frage
            ? (
              <>
                <p className="kbk-fuss">Sagt er im Gespräch, dass das Konto steht? Trag es hier ein — sonst erreicht sein Weg nie den letzten Schritt.</p>
                <div className="kbk-knoepfe"><button type="button" className="kbk-knopf" onClick={() => setFrage(true)}>Kontoeröffnung gemeldet</button></div>
              </>
            )
            : (
              <>
                <p className="kbk-fuss">Nur eintragen, wenn er es dir gesagt hat. Die Meldung steht danach in seiner Akte und in seinem Weg.</p>
                <label className="kbk-feldzeile">Eröffnet am
                  <input className="kbk-feld" type="date" value={am} max={heuteFeld()} onChange={(e) => setAm(e.target.value)} />
                </label>
                <div className="kbk-knoepfe">
                  <button type="button" className="kbk-knopf haupt" disabled={busy || !am} onClick={() => void kontoMelden()}>{busy ? "…" : "Ja, eintragen"}</button>
                  <button type="button" className="kbk-knopf" disabled={busy} onClick={() => setFrage(false)}>Abbrechen</button>
                </div>
              </>
            )}
      </section>
    </div>
  );
}

export default KundenbereichKarte;
