import { useCallback, useEffect, useMemo, useState } from "react";
import { anrufHinweis, ABSAGE_HINWEIS } from "@shared/fiaon-termin-text";

// ═══════════════════════════════════════════════════════════════════════════
// STARTGESPRÄCH — die Tafel beim ersten Login
//
// Ein Mensch hat bezahlt und sieht sein Konto zum ersten Mal. Genau hier ist
// der Moment, ihm fünfzehn Minuten mit einem Menschen anzubieten — später
// öffnet er das Konto seltener, und irgendwann gar nicht mehr.
//
// ── ZWEI HÄRTEN, UND WARUM (16.08.2026) ────────────────────────────────────
// Hier stand: „KEIN HARTES GATE. Später buchen bleibt immer möglich." Für den
// BESTAND gilt das weiter, und zwar mit einer Zahl: GEMESSEN hatten 349
// bezahlte Kunden **null** Startgespräche. Eine harte Pflicht für alle hätte
// am Tag des Deploys 349 zahlende Menschen vor eine verschlossene Tür
// gestellt — das ist Support-Feuer, kein Onboarding.
//
// Für NEU aktivierte Kunden ist das Startgespräch dagegen PFLICHT: Der Account
// wird erst danach voll freigeschaltet, also ist der Termin kein Angebot,
// sondern der nächste Schritt. Dann gibt es kein „Später" — buchen oder
// ausloggen. Der Server verweigert das „Später" ebenfalls (HTTP 403); die
// Wand steht nicht in dieser Datei.
//
// Ausgesperrt ist deshalb niemand: Wer wartet, sieht sein Konto, seine
// Rechnungen, seine Unterlagen und die Bonitätsauskunft. Nur Fahrplan und
// Inhalte warten mit ihm.
//
// Der Auftritt ist derselbe wie bei der Verpflichtungserklärung im
// Mitarbeiterportal: Glas nur auf der schwebenden Ebene, Haarlinien statt
// Balken, Eintritt aus der Tiefe. Dieselbe Klasse von Moment, also dieselbe
// Sprache.
// ═══════════════════════════════════════════════════════════════════════════

interface Slot { beginn: string; datum: string; uhrzeit: string; agentId: number; agentVorname: string }

interface Lage {
  faellig: boolean;
  banner: boolean;
  /** Harte Pflicht: kein „Später", buchen oder ausloggen. */
  pflicht?: boolean;
  vorname: string | null;
  /** Für die Bonitäts-Bestellung auf derselben Bühne — sonst müsste der
      Kunde seine Adresse noch einmal eintippen, die wir schon haben. */
  nachname?: string | null;
  email?: string | null;
  termin: { datumText: string; uhrzeit: string; agentVorname: string } | null;
  token: string | null;
  /** Die abgeleitete Stufe und der Stand des Ablaufs (20.08.2026). */
  stufe?: "kein_zugang" | "wartet_auf_onboarding" | "voll_aktiv" | null;
  ablauf?: {
    antrag: boolean; zahlung: boolean; startgespraech: boolean;
    auskunft: boolean; vollAktiv: boolean; aboLaeuft: boolean;
  } | null;
  auskunftBezahlt?: boolean;
}

const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function tagText(datumISO: string): string {
  const [y, m, d] = datumISO.split("-").map(Number);
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const morgen = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(Date.now() + 86_400_000));
  if (datumISO === heute) return "Heute";
  if (datumISO === morgen) return "Morgen";
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WOCHENTAG[dt.getUTCDay()]}, ${d}. ${dt.toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" })}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER SCHUFA-MOMENT — die zweite Karte auf derselben Bühne (18.08.2026)
//
// ── DER AUFTRAG DES BETREIBERS ──────────────────────────────────────────────
// „Beim ersten Login sieht der bezahlte, wartende Kunde eine kuratierte Bühne:
// Startgespräch buchen UND die Bonitätsauskunft (74 €, einmalig)."
//
// ── WARUM AUF DERSELBEN BÜHNE UND NICHT AUF EINER ZWEITEN ──────────────────
// Zwei Vollbild-Tafeln beim ersten Login wären ein Kampf: Die zweite käme,
// wenn der Kunde die erste gerade geschafft hat, und würde als Nachforderung
// gelesen. GEMESSEN: 287 bezahlte Paketkunden haben keine Auskunft — der Markt
// ist da, aber er wird nicht durch Bedrängen erschlossen.
//
// ── WARUM ERST NACH DER BUCHUNG ────────────────────────────────────────────
// Vorher steht sie in Konkurrenz zum Termin, und der Termin ist der Pflicht-
// schritt. Nachher steht sie im richtigen Licht: „Termin steht. Und solange du
// darauf wartest, kannst du schon den Grundstein legen."
//
// ── DIE KOPIERKNÖPFE ───────────────────────────────────────────────────────
// IBAN und Verwendungszweck zum Antippen. Wer eine IBAN von Hand abschreibt,
// vertippt sich — und eine Zahlung ohne passenden Verwendungszweck ist genau
// die Arbeit, die das Haus danach von Hand aufräumt.
// ═══════════════════════════════════════════════════════════════════════════

interface BonitaetLage {
  zustand: "offen" | "zahlung_offen" | "bezahlt" | "geliefert";
  preisEuro: number;
  bestellung: { paymentReference: string | null } | null;
}

/** Kopieren mit Rückmeldung — ohne Rückmeldung weiß niemand, ob es klappte. */
function KopierKnopf({ wert, was }: { wert: string; was: string }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <button type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(wert);
                setKopiert(true);
                setTimeout(() => setKopiert(false), 1800);
              } catch {
                // Ohne Clipboard-Recht (alte Browser, kein HTTPS): markieren,
                // damit der Mensch selbst kopieren kann. Ein Knopf, der nichts
                // tut und nichts sagt, ist schlimmer als kein Knopf.
                const el = document.createElement("textarea");
                el.value = wert; document.body.appendChild(el);
                el.select(); document.execCommand("copy"); el.remove();
                setKopiert(true);
                setTimeout(() => setKopiert(false), 1800);
              }
            }}
            aria-label={`${was} kopieren`}
            className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors"
            style={{
              borderColor: kopiert ? "rgba(21,128,61,.4)" : "rgba(15,23,42,.14)",
              color: kopiert ? "#15803d" : "#475569",
              background: kopiert ? "rgba(21,128,61,.06)" : "#fff",
            }}>
      {kopiert ? "Kopiert" : "Kopieren"}
    </button>
  );
}

function BonitaetsKarte({ kundenRef, email, vorname, nachname }: {
  kundenRef: string; email: string; vorname: string; nachname: string;
}) {
  const [lage, setLage] = useState<BonitaetLage | null>(null);
  const [busy, setBusy] = useState(false);
  const [bank, setBank] = useState<{ iban: string; empfaenger: string; zweck: string; betrag: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let weg = false;
    void fetch(`/api/fiaon/bonitaet-status/${kundenRef}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (!weg && j?.ok) setLage(j); })
      .catch(() => {});
    return () => { weg = true; };
  }, [kundenRef]);

  /** Zeigt die Bankdaten einer bestehenden oder neu angelegten Bestellung. */
  const zahlwegOeffnen = useCallback(async (zweck: string) => {
    const r = await fetch(`/api/fiaon/payment-order/${zweck}`).then((x) => x.json()).catch(() => null);
    if (r?.ok) {
      setBank({
        iban: r.bank?.ibanDisplay ?? r.bank?.iban ?? "",
        empfaenger: r.bank?.recipient ?? "Fiaon Ltd",
        zweck,
        betrag: `${Number(r.order?.amountDue ?? 74).toFixed(2).replace(".", ",")} €`,
      });
    } else {
      setFehler("Die Bankdaten konnten nicht geladen werden. Du findest sie auch in deinem Konto unter „Bonitätsauskunft“.");
    }
  }, []);

  const bestellen = useCallback(async () => {
    setBusy(true); setFehler(null);
    try {
      const r = await fetch("/api/fiaon/payment-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "schufa", email, firstName: vorname, lastName: nachname }),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok && j.paymentReference) await zahlwegOeffnen(String(j.paymentReference));
      else setFehler(j?.error ?? "Die Bestellung hat nicht funktioniert.");
    } catch {
      setFehler("Verbindung fehlgeschlagen.");
    } finally { setBusy(false); }
  }, [email, vorname, nachname, zahlwegOeffnen]);

  // Wer sie schon hat, sieht kein Angebot. Ein Angebot für etwas, das man
  // besitzt, sagt dem Kunden: Die kennen mich nicht.
  if (!lage || lage.zustand === "bezahlt" || lage.zustand === "geliefert") return null;

  const zweckDa = lage.bestellung?.paymentReference ?? null;

  return (
    // `mt-6` ist weg: In der zweiten Spalte soll die Karte oben mit dem
    // Gesprächsblock abschließen, nicht darunter hängen. Auf 380 px sorgt der
    // Gitter-Abstand (`gap-5`) für die Trennung.
    <div className="rounded-2xl p-5" style={{ border: "1px solid rgba(15,23,42,.09)", background: "linear-gradient(180deg,rgba(29,78,216,.03),transparent)" }}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[.2em] text-slate-400">
        Der Grundstein
      </p>
      <h3 className="mt-1.5 text-[16px] font-bold text-slate-900 leading-snug">
        Deine Bonitätsauskunft — {lage.preisEuro} € einmalig
      </h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
        Bevor irgendetwas anderes Sinn hat, braucht es einen Überblick: Was steht
        eigentlich über dich in den Auskunfteien? Du bekommst eine tagesaktuelle
        Auskunft plus einen Handlungsplan. Der Abruf ist{" "}
        <b className="text-slate-900">neutral</b> — er verändert deinen Score nicht.
      </p>
      <p className="mt-2 text-[12px] text-slate-500">
        Einmalig, kein Abo. Getrennt von deinem Paket.
      </p>

      {fehler && <p className="mt-3 text-[12.5px] font-semibold text-amber-700">{fehler}</p>}

      {bank ? (
        // ── DIE ZAHLKARTE ────────────────────────────────────────────────
        // Sie steht HIER und nicht auf einer Folgeseite: Wer weitergeleitet
        // wird, verliert den Moment. Und der Verwendungszweck ist der Grund,
        // warum Zahlungen zugeordnet werden können — er steht deshalb zuerst.
        <div className="mt-4 rounded-xl p-4 bg-white" style={{ border: "1px solid rgba(15,23,42,.1)" }}>
          <p className="text-[12px] font-semibold text-slate-900 mb-3">
            Überweise {bank.betrag} — mit diesem Verwendungszweck:
          </p>
          {[
            { was: "Verwendungszweck", wert: bank.zweck, wichtig: true },
            { was: "IBAN", wert: bank.iban },
            { was: "Empfänger", wert: bank.empfaenger },
            { was: "Betrag", wert: bank.betrag },
          ].map((z) => (
            <div key={z.was} className="flex items-center gap-2 py-1.5"
                 style={{ borderTop: "1px solid rgba(15,23,42,.05)" }}>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 w-[104px] shrink-0">
                {z.was}
              </span>
              <span className={`flex-1 text-[13px] tabular-nums ${z.wichtig ? "font-bold text-slate-900" : "text-slate-700"}`}
                    style={{ wordBreak: "break-all" }}>
                {z.wert}
              </span>
              <KopierKnopf wert={z.wert} was={z.was} />
            </div>
          ))}
          <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
            Ohne den Verwendungszweck können wir die Zahlung nicht zuordnen —
            dann dauert es unnötig lange. Sobald das Geld da ist, geht es los.
          </p>
        </div>
      ) : (
        <button type="button"
                onClick={() => (zweckDa ? void zahlwegOeffnen(zweckDa) : void bestellen())}
                disabled={busy}
                className="mt-4 w-full rounded-xl text-[14px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 transition-colors"
                style={{ minHeight: 46 }}>
          {busy ? "Einen Moment …"
            : zweckDa ? "Zahlungsdaten anzeigen"
            : `Auskunft bestellen — ${lage.preisEuro} €`}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE FORTSCHRITTSLEISTE — vier Stationen, eine Zeile
//
// ── WOZU (20.08.2026) ──────────────────────────────────────────────────────
// Der Kunde hat bezahlt und sieht eine Pflichtaufgabe. Ohne Einordnung fühlt
// sich das an wie eine Hürde: „Ich habe gezahlt, und jetzt noch das?"
//
// Mit der Leiste sieht er, WO er steht und wie viel noch kommt: Zahlung ist
// erledigt (Haken), zwei Dinge stehen an, dann ist er durch. Vier Punkte, kein
// Fortschrittsbalken in Prozent — Prozente bei vier Schritten sind eine
// Genauigkeit, die es nicht gibt.
//
// ── WARUM DIE AUSKUNFT MIT DRINSTEHT, OBWOHL SIE FREIWILLIG IST ────────────
// Weil sie zum Weg gehört und der Kunde sie sonst für eine Nebenbemerkung
// hält. Sie ist NICHT Bedingung für die Freischaltung — das steht darunter in
// Worten, damit niemand glaubt, er müsse 74 € zahlen, um sein Konto zu öffnen.
// ═══════════════════════════════════════════════════════════════════════════

function Fortschritt({ zahlung, gespraech, auskunft, vollAktiv }: {
  zahlung: boolean; gespraech: boolean; auskunft: boolean; vollAktiv: boolean;
}) {
  const stationen = [
    { text: "Zahlung", fertig: zahlung },
    { text: "Startgespräch", fertig: gespraech },
    { text: "Auskunft", fertig: auskunft, freiwillig: true },
    { text: "Freischaltung", fertig: vollAktiv },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="list"
         aria-label="Dein Weg bei FIAON">
      {stationen.map((st, i) => (
        <div key={st.text} className="flex items-center gap-1.5" role="listitem">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
                style={{
                  background: st.fertig ? "rgba(4,120,87,.09)" : "rgba(15,23,42,.045)",
                  color: st.fertig ? "#047857" : "#64748b",
                  boxShadow: st.fertig
                    ? "inset 0 0 0 1px rgba(4,120,87,.22)"
                    : "inset 0 0 0 1px rgba(15,23,42,.08)",
                }}>
            {st.fertig ? (
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                   strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m4.5 10.5 3.6 3.6L15.5 6.5" />
              </svg>
            ) : (
              <span aria-hidden="true" style={{
                width: 9, height: 9, borderRadius: 999,
                boxShadow: "inset 0 0 0 1.5px currentColor", opacity: .45,
              }} />
            )}
            {st.text}
            {st.freiwillig && !st.fertig && (
              <span style={{ fontSize: 10, opacity: .7 }}>freiwillig</span>
            )}
          </span>
          {i < stationen.length - 1 && (
            <span aria-hidden="true" style={{
              width: 10, height: 1,
              background: st.fertig ? "rgba(4,120,87,.3)" : "rgba(15,23,42,.12)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function StartgespraechGate({ kundenRef }: { kundenRef: string }) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Slot | null>(null);
  const [tageOffen, setTageOffen] = useState(2);
  const [bucht, setBucht] = useState(false);
  const [fertig, setFertig] = useState<{ datumText: string; uhrzeit: string; agentVorname: string } | null>(null);
  const [zu, setZu] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await fetch(`/api/fiaon/kunde/${encodeURIComponent(kundenRef)}/startgespraech`).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!json?.ok) return;
    setLage(json);
    if (json.token) {
      const s = await fetch(`/api/fiaon/termin/${encodeURIComponent(json.token)}?art=start`).catch(() => null);
      const sj = await s?.json().catch(() => null);
      if (sj?.ok) setSlots(sj.slots || []);
    }
  }, [kundenRef]);

  useEffect(() => { void laden(); }, [laden]);

  const tage = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const l = map.get(s.datum) || [];
      l.push(s);
      map.set(s.datum, l);
    }
    return Array.from(map.entries());
  }, [slots]);

  const buchen = async () => {
    if (!gewaehlt || !lage?.token) return;
    setBucht(true);
    const res = await fetch(`/api/fiaon/termin/${encodeURIComponent(lage.token)}/buchen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beginn: gewaehlt.beginn, agentId: gewaehlt.agentId, quelle: "onboarding_call" }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBucht(false);
    if (!json?.ok) {
      setFehler(json?.error || "Der Termin konnte nicht gebucht werden. Bitte wähl eine andere Zeit.");
      void laden();
      return;
    }
    setFertig(json.termin);
  };

  const spaeter = async () => {
    setZu(true);
    await fetch(`/api/fiaon/kunde/${encodeURIComponent(kundenRef)}/startgespraech/spaeter`, { method: "POST" })
      .catch(() => null);
  };

  if (!lage) return null;

  // ── Der dezente Dauerbanner ──────────────────────────────────────────────
  if ((lage.banner || zu) && !fertig && !lage.termin) {
    return (
      <div className="mb-4 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
           style={{ background: "rgba(29,78,216,.05)", border: "1px solid rgba(29,78,216,.18)" }}>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-slate-900">Dein Startgespräch steht noch aus</p>
          <p className="text-[12.5px] text-slate-600 mt-0.5">
            15 Minuten, in denen dir jemand FIAON persönlich erklärt. Du wählst die Uhrzeit.
          </p>
        </div>
        {lage.token && (
          <a href={`/termin/${lage.token}?art=start`}
             className="shrink-0 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af]"
             style={{ minHeight: 42 }}>
            Termin wählen
          </a>
        )}
      </div>
    );
  }

  if (!lage.faellig || zu) return null;

  // ── EINE TAFEL, DIE NICHTS ANBIETEN KANN, ERSCHEINT NICHT ────────────────
  // Gibt es (noch) niemanden mit der Onboarding-Rolle, sind auch keine Zeiten
  // frei. Ein Vollbild-Gate mit dem Satz „Gerade sind keine Zeiten frei" ist
  // für einen Menschen, der gerade bezahlt hat, eine Zumutung: Es hält ihn
  // auf und bietet ihm nichts. Gesehen im Screenshot vom 08.08.2026, bevor
  // die Rolle vergeben war.
  //
  // `slots.length === 0` ist dabei kein Rateschluss — der Server hat schon
  // geantwortet, sonst wäre `lage` null.
  if (slots.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200]"
           style={{ background: "rgba(7,11,22,.62)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
           aria-hidden="true" />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-3 sm:p-6 fi-buehne">
        <div role="dialog" aria-modal="true" aria-labelledby="start-titel"
             className="w-full flex flex-col overflow-hidden"
             style={{
               // 640 px reichten für eine Spalte. Seit beide Karten
               // gleichzeitig stehen (20.08.2026), braucht die Bühne Platz —
               // sonst quetschen sich Slot-Raster und Zahlkarte gegenseitig.
               // Auf schmalen Geräten greift `maxWidth: 100%` der Umgebung.
               maxWidth: 980, maxHeight: "92vh", background: "#fff", borderRadius: 24,
               boxShadow: "0 40px 120px -24px rgba(13,26,63,.55), inset 0 1px 0 rgba(255,255,255,.7)",
               animation: "zusageAuf 620ms cubic-bezier(.32,.72,0,1) both",
               transformStyle: "preserve-3d",
             }}>

          <div className="fi-glas px-6 sm:px-9 pt-6 pb-5 shrink-0" style={{ transform: "translateZ(24px)" }}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.22em] text-slate-400">
              {fertig ? "Termin steht" : "Dein Start"}
            </p>
            <h1 id="start-titel" className="mt-2 text-[22px] sm:text-[30px] font-bold tracking-tight leading-[1.1]">
              <span className="fi-gradient-text">
                {fertig
                  ? "Wir sprechen uns."
                  : `Willkommen bei FIAON${lage.vorname ? `, ${lage.vorname.trim()}` : ""}.`}
              </span>
            </h1>
            {/* ── DIE FORTSCHRITTSLEISTE ────────────────────────────────
                Sie steht im Kopf, weil sie die Einordnung ist: Wer sie erst
                unter den Karten sieht, hat die Aufgabe schon als Hürde
                gelesen. */}
            <div className="mt-3.5">
              <Fortschritt
                zahlung={lage.ablauf?.zahlung ?? true}
                gespraech={lage.ablauf?.startgespraech ?? !!fertig}
                auskunft={lage.ablauf?.auskunft ?? false}
                vollAktiv={lage.ablauf?.vollAktiv ?? false} />
            </div>
            <div className="mt-4" style={{ height: 1, background: "linear-gradient(90deg, rgba(29,78,216,.28), rgba(15,23,42,.06) 40%, transparent)" }} />
          </div>

          <div className="flex-1 overflow-y-auto px-6 sm:px-9 py-6">
            {/* ══════════════════════════════════════════════════════════════
                BEIDE KARTEN GLEICHZEITIG (20.08.2026)

                ── DER AUFTRAG ─────────────────────────────────────────────
                „Erster Login zeigt ZWEI Dinge gleichzeitig: Startgespräch
                buchen (Pflicht) und Bonitätsauskunft kaufen (74 €)."

                ── WAS VORHER WAR ─────────────────────────────────────────
                Die Auskunft erschien erst NACH der Buchung. Die Begründung
                damals: „vorher stünde sie in Konkurrenz zum Pflichtschritt."
                Der Betreiber entscheidet anders — und er hat den besseren
                Grund: Wer nach dem Buchen die Tafel schließt, hat die Auskunft
                nie gesehen. GEMESSEN: 287 bezahlte Kunden ohne Auskunft.

                ── WIE DIE KONKURRENZ VERMIEDEN WIRD ──────────────────────
                Nicht durch Verstecken, sondern durch GEWICHT: Links, zuerst
                und breiter steht das Gespräch (Pflicht). Rechts, schmaler und
                ruhiger die Auskunft (freiwillig). Auf 380 px stehen sie
                untereinander — das Gespräch oben.

                Beide sind unabhängig bedienbar. Die Freischaltung hängt NUR am
                Gespräch; das steht in der Fortschrittsleiste als „freiwillig".
                ══════════════════════════════════════════════════════════════ */}
            <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] items-start">
            <div className="min-w-0">
            {fertig ? (
              <>
                <p className="text-[15px] text-slate-700 leading-relaxed">
                  <b className="text-slate-900">{fertig.datumText} um {fertig.uhrzeit} Uhr</b>.
                  {" "}Du bekommst gleich eine Bestätigung per E-Mail.
                </p>
                {/* ── DER ANRUF-SATZ ────────────────────────────────────────
                    Eigene Zeile, Telefon-Zeichen, hervorgehoben: Wer einen Link
                    erwartet, überliest ihn im Fließtext — und wartet dann vor
                    dem Rechner, während sein Telefon klingelt. */}
                <div className="mt-3.5 flex items-start gap-2.5 px-4 py-3 rounded-xl"
                     style={{ background: "rgba(29,78,216,.05)", boxShadow: "inset 0 0 0 1px rgba(29,78,216,.16)" }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#1d4ed8" strokeWidth={1.5}
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                       style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M6.2 3.6c.7 0 1.3.5 1.5 1.2l.5 2a1.6 1.6 0 0 1-.5 1.6l-.9.8a9 9 0 0 0 4 4l.8-.9a1.6 1.6 0 0 1 1.6-.5l2 .5c.7.2 1.2.8 1.2 1.5v1.7c0 .9-.8 1.6-1.7 1.5C8.3 16.7 3.3 11.7 2.7 5.3c-.1-.9.6-1.7 1.5-1.7h2Z" />
                  </svg>
                  <span className="text-[13.5px] leading-relaxed" style={{ color: "#1e3a8a" }}>
                    <b>{anrufHinweis(fertig.agentVorname)}</b>
                    <br />
                    <span style={{ color: "rgba(30,58,138,.72)" }}>{ABSAGE_HINWEIS}</span>
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-[15px] text-slate-700 leading-relaxed">
                  Buch dein persönliches Startgespräch — <b className="text-slate-900">15 Minuten</b>, in denen
                  dir jemand zeigt, wie du FIAON nutzt und worauf es bei deinen Unterlagen ankommt.
                  Du wählst die Uhrzeit.
                </p>
                {/* Der Anruf-Satz VOR der Wahl — dieselbe Begründung wie oben. */}
                <p className="mt-3 flex items-start gap-2 text-[13px] font-semibold"
                   style={{ color: "#1e3a8a" }}>
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                       strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                       style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M6.2 3.6c.7 0 1.3.5 1.5 1.2l.5 2a1.6 1.6 0 0 1-.5 1.6l-.9.8a9 9 0 0 0 4 4l.8-.9a1.6 1.6 0 0 1 1.6-.5l2 .5c.7.2 1.2.8 1.2 1.5v1.7c0 .9-.8 1.6-1.7 1.5C8.3 16.7 3.3 11.7 2.7 5.3c-.1-.9.6-1.7 1.5-1.7h2Z" />
                  </svg>
                  <span>{anrufHinweis(lage.termin?.agentVorname)}</span>
                </p>

                {fehler && (
                  <p className="mt-4 text-[13px] font-semibold text-amber-700">{fehler}</p>
                )}

                <div className="mt-5 space-y-5">
                    {tage.slice(0, tageOffen).map(([datum, liste]) => (
                      <div key={datum}>
                        <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          {tagText(datum)}
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {liste.map((s) => {
                            const an = gewaehlt?.beginn === s.beginn;
                            return (
                              <button key={`${s.agentId}-${s.beginn}`} type="button"
                                      onClick={() => setGewaehlt(an ? null : s)}
                                      className={`rounded-xl text-[14px] font-semibold transition-all ${
                                        an ? "bg-[#1d4ed8] text-white border border-[#1d4ed8]"
                                           : "bg-white text-slate-900 border border-slate-200 hover:border-slate-400"
                                      }`}
                                      style={{ minHeight: 46 }}>
                                {s.uhrzeit}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  {tage.length > tageOffen && (
                    <button type="button" onClick={() => setTageOffen((n) => n + 3)}
                            className="w-full rounded-xl text-[13px] font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50"
                            style={{ minHeight: 44 }}>
                      Weitere Tage anzeigen
                    </button>
                  )}
                </div>
              </>
            )}
            </div>

            {/* ── ZWEITE SPALTE: DIE AUSKUNFT ───────────────────────────────
                Immer sichtbar, unabhängig davon, ob schon gebucht wurde. Sie
                zeigt sich selbst nicht, wenn der Kunde sie bereits hat. */}
            <div className="min-w-0">
              <BonitaetsKarte kundenRef={kundenRef}
                              email={lage.email ?? ""}
                              vorname={lage.vorname ?? ""}
                              nachname={lage.nachname ?? ""} />
            </div>
            </div>
          </div>

          <div className="px-6 sm:px-9 py-5 shrink-0 flex flex-wrap items-center gap-3"
               style={{ borderTop: "1px solid rgba(15,23,42,.07)", background: "#fff" }}>
            {fertig ? (
              <button type="button" onClick={() => setZu(true)}
                      className="w-full rounded-xl text-[15px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af]"
                      style={{ minHeight: 48 }}>
                Weiter zu meinem Konto
              </button>
            ) : (
              <>
                {lage?.pflicht ? (
                  /* ── PFLICHT: BUCHEN ODER AUSLOGGEN ───────────────────────
                     Kein „Später". Der Kunde ist bezahlt und eingelassen —
                     aber der Fahrplan öffnet sich erst nach dem Gespräch.
                     Abmelden bleibt immer möglich: Eine Tafel, aus der man
                     nicht herauskommt, ist eine Falle. */
                  <button type="button"
                          onClick={() => {
                            // Derselbe Weg wie der Abmelden-Knopf im Portal —
                            // nicht ein zweiter, der die Sitzung anders räumt.
                            sessionStorage.removeItem("fiaon_user");
                            window.location.href = "/login";
                          }}
                          className="text-[13px] font-semibold text-slate-400 hover:text-slate-700">
                    Abmelden
                  </button>
                ) : (
                  <button type="button" onClick={() => void spaeter()}
                          className="text-[13px] font-semibold text-slate-500 hover:text-slate-800">
                    Später buchen
                  </button>
                )}
                <button type="button" onClick={() => void buchen()} disabled={!gewaehlt || bucht}
                        className="ml-auto px-5 rounded-xl text-[15px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-40"
                        style={{ minHeight: 48 }}>
                  {bucht ? "Wird gebucht …" : gewaehlt ? `${tagText(gewaehlt.datum)}, ${gewaehlt.uhrzeit} Uhr buchen` : "Zeit wählen"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
