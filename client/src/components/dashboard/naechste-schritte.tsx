import { useEffect, useState } from "react";

/**
 * ============================================================================
 * KUNDEN-DASHBOARD — Bonitäts-Check · Ihr Weg · Noch zu erledigen · Vorschau
 * ============================================================================
 * Ersetzt die alte Liste „Freischaltung / Ihre nächsten Schritte", in der das
 * Herzstück des Angebots (die Bonitätsauskunft samt Auswertung) als vierte
 * Zeile zwischen Verwaltungsaufgaben stand — und deshalb kaum wahrgenommen
 * wurde.
 *
 * Aufbau, bewusst in dieser Reihenfolge:
 *   1. BonitaetsCheck   — das stärkste Element der Seite. Wert zuerst, Aufgabe
 *                         zweitens, genau EINE Handlung, Zustand statt Verkauf,
 *                         sobald gekauft wurde.
 *   2. IhrWeg           — die Produktreise (Check → Analyse → Fahrplan →
 *                         Umsetzung → Ziel) als Fortschritt, nicht als Pflicht.
 *   3. NochZuErledigen  — Verwaltung, kompakt und sachlich. Getrennt vom
 *                         Produkt, damit sich beides nicht mehr vermischt.
 *   4. FahrplanVorschau — zeigt vor dem Kauf, was danach entsteht.
 *
 * SPRACHE — verbindlich (Zielgruppe hat schlechte Erfahrungen mit unseriösen
 * Anbietern; Ehrlichkeit ist hier das Verkaufsargument):
 *   - Keine Zusage auf Score-Verbesserung, kein „Einträge löschen", kein
 *     „SCHUFA-frei", kein Kreditversprechen.
 *   - Die Karte bleibt ein erarbeitetes Ziel über einen künftigen lizenzierten
 *     Partner — nie eine Zusage.
 *   - Sie-Form, keine Emojis, eine Akzentfarbe (#2563eb).
 *
 * KEINE Zahlungs- oder Freischaltungslogik in dieser Datei: Der Kauf läuft
 * unverändert über den bestehenden Bestellweg des Dashboards, die Zustände
 * kommen nur lesend aus GET /api/fiaon/bonitaet-status/:ref.
 * ============================================================================
 */

const ACCENT = "#2563eb";

export type BonitaetZustand = "offen" | "zahlung_offen" | "bezahlt" | "geliefert";

export interface BonitaetStatus {
  zustand: BonitaetZustand;
  preisEuro: number;
  bestellung: {
    paymentReference: string | null;
    status: string;
    betrag: string | null;
    faelligAm: string | null;
    bestelltAm: string | null;
  } | null;
  analyse: "keine" | "laeuft" | "fertig";
  fahrplanSchritte: number;
}

/** Lädt den Bonitäts-Zustand. Nur lesend; Fehler führen zu `null` (Bereich zeigt dann den Kauf). */
export function useBonitaetStatus(userRef: string | undefined) {
  const [status, setStatus] = useState<BonitaetStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userRef) { setLoading(false); return; }
    let abgebrochen = false;
    fetch(`/api/fiaon/bonitaet-status/${userRef}`)
      .then((r) => r.json())
      .then((d) => {
        if (abgebrochen || !d?.ok) return;
        setStatus({
          zustand: d.zustand,
          preisEuro: Number(d.preisEuro ?? 74),
          bestellung: d.bestellung ?? null,
          analyse: d.analyse ?? "keine",
          fahrplanSchritte: Number(d.fahrplanSchritte ?? 0),
        });
      })
      .catch(() => { /* Anzeige fällt auf den Kauf-Zustand zurück */ })
      .finally(() => { if (!abgebrochen) setLoading(false); });
    return () => { abgebrochen = true; };
  }, [userRef]);

  return { status, loading };
}

const euro = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

/** Datum in deutscher Zeit — der Kunde liest ein deutsches Datum, egal wo er sitzt. */
function datumDe(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "long", year: "numeric" }).format(t);
  } catch {
    return null;
  }
}

/* ── Kleine, wiederverwendete Bausteine ─────────────────────────────────── */

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: ACCENT }}>
      {children}
    </p>
  );
}

function Haken({ size = 13, color = ACCENT }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}

function Pfeil({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function Schloss({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" className="shrink-0">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/**
 * Was der Kunde für sein Geld bekommt — in der Reihenfolge, in der es passiert.
 * Absichtlich vier kurze Punkte: mehr liest niemand, weniger erklärt nichts.
 */
const LEISTUNGEN = [
  { titel: "Auskunft beschaffen", text: "Wir holen deine vollständige Bonitätsauskunft ein." },
  { titel: "Analyse durch FIAON", text: "Wir gehen jeden Eintrag durch und erklären, was er bedeutet." },
  { titel: "Dein persönlicher Fahrplan", text: "Konkrete Schritte, in sinnvoller Reihenfolge, auf deine Lage bezogen." },
  { titel: "Begleitete Umsetzung", text: "Du arbeitest die Schritte ab, wir bleiben ansprechbar." },
];

/* ════════════════ 1. Der Bonitäts-Check — Held der Seite ════════════════ */

export function BonitaetsCheck({
  status, loading, onKaufen, onFahrplan,
}: {
  status: BonitaetStatus | null;
  loading: boolean;
  onKaufen: () => void;
  onFahrplan: () => void;
}) {
  if (loading) {
    return <div className="db-panel rounded-3xl" style={{ minHeight: 300 }} aria-hidden="true" />;
  }

  const zustand: BonitaetZustand = status?.zustand ?? "offen";
  const preis = status?.preisEuro ?? 74;
  const analyseFertig = status?.analyse === "fertig";
  const zahlungsLink = status?.bestellung?.paymentReference
    ? `/zahlung/${status.bestellung.paymentReference}`
    : null;

  return (
    <section className="db-hero db-rise rounded-3xl px-5 py-6 sm:px-7 sm:py-7" style={{ animationDelay: "60ms" }}>
      <span className="db-light" aria-hidden="true" />

      <div className="relative">
        {/* ── Zustand: noch nicht gekauft — hier wird der Wert erklärt ── */}
        {zustand === "offen" && (
          <>
            <Kicker>Herzstück deiner Mitgliedschaft</Kicker>
            <h2 className="text-[23px] sm:text-[29px] font-black tracking-tight text-slate-900 leading-[1.14] mt-2">
              Dein Bonitäts-Check
            </h2>
            <p className="text-[13.5px] sm:text-[14.5px] text-slate-600 leading-relaxed mt-2.5 max-w-[52ch]">
              Wir beschaffen deine vollständige Bonitätsauskunft, gehen jeden einzelnen Eintrag mit
              dir durch und leiten daraus deine nächsten Schritte ab — verständlich erklärt,
              in der richtigen Reihenfolge.
            </p>

            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {LEISTUNGEN.map((l) => (
                <li key={l.titel} className="flex items-start gap-2.5">
                  <span className="mt-0.5"><Haken /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-slate-800 leading-tight">{l.titel}</span>
                    <span className="block text-[12px] text-slate-500 leading-snug mt-0.5">{l.text}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={onKaufen}
                className="db-act inline-flex items-center justify-center gap-2.5 rounded-2xl px-6 text-white text-[15px] sm:text-[16px] font-bold tracking-tight"
                style={{ minHeight: 54 }}
              >
                Bonitäts-Check starten
                <Pfeil size={16} />
              </button>
              <p className="text-[12.5px] text-slate-500 leading-snug">
                <span className="font-bold text-slate-800">{euro(preis)}</span> einmalig · kein Abo ·
                Deine Daten sind bereits hinterlegt
              </p>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                DER ZWEITE WEG: WER SEINE AUSKUNFT HAT, MUSS NICHTS KAUFEN
                (22.08.2026)

                ── DER BEFUND ──────────────────────────────────────────────
                Diese Karte kannte nur einen Weg: kaufen. GEMESSEN im Bestand:
                31 Menschen hatten ihre Auskunft SELBST hochgeladen und sahen
                trotzdem „Bonitäts-Check starten" — ein Angebot für etwas, das
                sie schon hatten. Weitere 30 hatten BEZAHLT und sahen dasselbe.

                Die beiden Gruppen sind jetzt versorgt: Die Ableitung
                (server/lib/fiaon-bonitaet-status.ts) schickt sie in einen
                anderen Zustand, und diese Karte erscheint bei ihnen nicht mehr.

                ── UND FÜR ALLE ÜBRIGEN ───────────────────────────────────
                Wer seine Auskunft schon zu Hause liegen hat, soll sie
                hochladen können, ohne 74 € auszugeben. Das ist ehrlicher — und
                die Auskunft ist ausdrücklich freiwillig (Gate, 20.08.2026).
                Deshalb steht der Weg hier, ruhig und ohne Knopffarbe, damit er
                den Pflichtschritt nicht überstrahlt.
                ══════════════════════════════════════════════════════════════ */}
            <div className="mt-4 px-4 py-3 rounded-2xl"
                 style={{ background: "rgba(15,23,42,.035)" }}>
              <p className="text-[12.5px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">Du hast deine Auskunft schon?</span>{" "}
                Dann lade sie einfach hoch — du musst nichts kaufen. Wir gehen sie
                genauso mit dir durch.
              </p>
              <a href="#dokumente"
                 className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold no-underline"
                 style={{ color: ACCENT }}>
                Auskunft hochladen
                <Pfeil size={13} />
              </a>
            </div>

            {/* Ehrlichkeit als Unterscheidungsmerkmal — bewusst NICHT kleingedruckt. */}
            <p className="text-[12px] text-slate-500 leading-relaxed mt-5 pt-4 border-t border-slate-200/80 max-w-[58ch]">
              <span className="font-semibold text-slate-700">Was wir nicht tun:</span> Wir löschen keine
              Einträge und versprechen keinen bestimmten Score. Was sich verbessert, entsteht durch die
              Umsetzung deiner Schritte — dafür geben wir dir die Grundlage und bleiben an deiner Seite.
            </p>
          </>
        )}

        {/* ── Zustand: gekauft, Zahlung noch offen ── */}
        {zustand === "zahlung_offen" && (
          <>
            <Kicker>Bestellung liegt bereit</Kicker>
            <h2 className="text-[22px] sm:text-[27px] font-black tracking-tight text-slate-900 leading-[1.15] mt-2">
              Nur die Zahlung fehlt noch
            </h2>
            <p className="text-[13.5px] text-slate-600 leading-relaxed mt-2.5 max-w-[52ch]">
              Sobald deine Zahlung bei uns eingeht, beschaffen wir deine Bonitätsauskunft und beginnen
              mit der Auswertung.
              {status?.bestellung?.betrag && (
                <> Offener Betrag: <span className="font-bold text-slate-900">{euro(Number(status.bestellung.betrag))}</span>.</>
              )}
            </p>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              {zahlungsLink && (
                <a
                  href={zahlungsLink}
                  className="db-act inline-flex items-center justify-center gap-2.5 rounded-2xl px-6 text-white text-[15px] font-bold tracking-tight"
                  style={{ minHeight: 52 }}
                >
                  Zahlung abschließen
                  <Pfeil size={15} />
                </a>
              )}
              {datumDe(status?.bestellung?.faelligAm) && (
                <p className="text-[12.5px] text-slate-500">
                  Zahlbar bis <span className="font-semibold text-slate-700">{datumDe(status!.bestellung!.faelligAm)}</span>
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Zustand: bezahlt — Auskunft wird beschafft ── */}
        {zustand === "bezahlt" && (
          <>
            <Kicker>Zahlung erhalten</Kicker>
            <h2 className="text-[22px] sm:text-[27px] font-black tracking-tight text-slate-900 leading-[1.15] mt-2">
              Wir beschaffen deine Auskunft
            </h2>
            <p className="text-[13.5px] text-slate-600 leading-relaxed mt-2.5 max-w-[52ch]">
              Deine Bestellung ist bezahlt — vielen Dank. Wir holen deine Bonitätsauskunft ein und werten
              sie aus. Du erhältst sie per E-Mail, sobald sie vorliegt. Du musst dafür nichts weiter tun.
            </p>
            <div className="mt-5 grid gap-2">
              {[
                { text: "Zahlung eingegangen", fertig: true },
                { text: "Auskunft wird beschafft", fertig: false, aktiv: true },
                { text: "Auswertung und Fahrplan", fertig: false },
              ].map((z) => (
                <div key={z.text} className="flex items-center gap-2.5">
                  {z.fertig
                    ? <Haken size={14} color="#16a34a" />
                    : <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ border: `2px solid ${z.aktiv ? ACCENT : "#cbd5e1"}` }} />}
                  <span className={`text-[13px] leading-tight ${z.fertig ? "text-slate-500" : z.aktiv ? "font-bold text-slate-800" : "text-slate-400"}`}>
                    {z.text}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Zustand: Auskunft liegt vor (Analyse läuft oder ist fertig) ── */}
        {zustand === "geliefert" && (
          <>
            <Kicker>{analyseFertig ? "Auswertung abgeschlossen" : "Auskunft liegt vor"}</Kicker>
            <h2 className="text-[22px] sm:text-[27px] font-black tracking-tight text-slate-900 leading-[1.15] mt-2">
              {analyseFertig ? "Dein Fahrplan steht bereit" : "Wir werten deine Auskunft aus"}
            </h2>
            <p className="text-[13.5px] text-slate-600 leading-relaxed mt-2.5 max-w-[52ch]">
              {analyseFertig
                ? "Deine Auswertung ist fertig. Im Fahrplan stehen deine Schritte in der Reihenfolge, in der sie am meisten bringen — Du kannst sofort anfangen."
                : "Deine Auskunft ist bei uns eingegangen. Wir gehen die Einträge durch und leiten daraus deine Schritte ab. Du hörst von uns, sobald die Auswertung vorliegt."}
            </p>
            {(analyseFertig || (status?.fahrplanSchritte ?? 0) > 0) && (
              <button
                type="button"
                onClick={onFahrplan}
                className="db-act inline-flex items-center justify-center gap-2.5 rounded-2xl px-6 text-white text-[15px] font-bold tracking-tight mt-5"
                style={{ minHeight: 52 }}
              >
                Zum Fahrplan
                <Pfeil size={15} />
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ════════════════ 2. Ihr Weg — die Produktreise ════════════════ */

type EtappenStand = "fertig" | "aktiv" | "kommt";

/**
 * Fortschritt als Weg, nicht als Pflichtquote: Es steht nie „1 von 5" da
 * (das liest sich wie vier Versäumnisse), sondern wo der Kunde gerade ist.
 */
function etappen(status: BonitaetStatus | null): { kurz: string; lang: string; stand: EtappenStand }[] {
  const z = status?.zustand ?? "offen";
  const analyseFertig = status?.analyse === "fertig";
  const hatSchritte = (status?.fahrplanSchritte ?? 0) > 0;
  const auskunftDa = z === "geliefert";
  const gekauft = z === "zahlung_offen" || z === "bezahlt";

  return [
    {
      kurz: "Check", lang: "Bonitäts-Check",
      stand: auskunftDa ? "fertig" : "aktiv",
    },
    {
      kurz: "Analyse", lang: "Analyse durch FIAON",
      stand: analyseFertig ? "fertig" : auskunftDa ? "aktiv" : gekauft ? "kommt" : "kommt",
    },
    {
      kurz: "Fahrplan", lang: "Dein persönlicher Fahrplan",
      stand: hatSchritte ? "aktiv" : analyseFertig ? "aktiv" : "kommt",
    },
    {
      kurz: "Umsetzung", lang: "Umsetzung mit Begleitung",
      stand: hatSchritte ? "aktiv" : "kommt",
    },
    {
      kurz: "Ziel", lang: "Ziel: Karte über einen Partner",
      stand: "kommt",
    },
  ];
}

export function IhrWeg({ status }: { status: BonitaetStatus | null }) {
  const liste = etappen(status);
  const aktiv = liste.find((e) => e.stand === "aktiv") ?? liste[0];

  return (
    <section className="db-panel db-rise rounded-3xl px-5 py-5 sm:px-6 sm:py-6" style={{ animationDelay: "140ms" }}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Dein Weg</h3>
        <p className="text-[11.5px] text-slate-400">Du bist hier: <span className="font-bold text-slate-600">{aktiv.lang}</span></p>
      </div>

      {/* Reise: Punkte auf einer Linie. Die Linie ist ein Hintergrund-Verlauf,
          kein Element pro Abschnitt — spart Knoten und bleibt ruhig. */}
      <div className="mt-4 flex items-start">
        {liste.map((e, i) => {
          const fertig = e.stand === "fertig";
          const istAktiv = e.stand === "aktiv";
          return (
            <div key={e.kurz} className="flex-1 min-w-0 flex flex-col items-center relative">
              {i > 0 && (
                <span
                  className="absolute h-[2px] rounded-full"
                  style={{ left: 0, right: "50%", top: 11, transform: "translateX(-50%)", width: "100%", background: fertig || istAktiv ? "rgba(37,99,235,.35)" : "#e9eef5" }}
                  aria-hidden="true"
                />
              )}
              <span
                className="relative w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: fertig ? ACCENT : istAktiv ? "#fff" : "#f1f5f9",
                  border: istAktiv ? `2.5px solid ${ACCENT}` : fertig ? `2.5px solid ${ACCENT}` : "2px solid #e2e8f0",
                }}
              >
                {fertig && <Haken size={11} color="#fff" />}
              </span>
              <span className={`mt-1.5 text-[10.5px] leading-tight text-center px-0.5 ${istAktiv ? "font-bold text-slate-800" : fertig ? "font-semibold text-slate-500" : "text-slate-400"}`}>
                {e.kurz}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-slate-500 leading-relaxed mt-4">
        Die Karte am Ende ist ein <span className="font-semibold text-slate-700">erarbeitetes Ziel</span> über
        einen künftigen lizenzierten Partner — keine Zusage und kein Kreditangebot von FIAON.
      </p>
    </section>
  );
}

/* ════════════════ 3. Noch zu erledigen — Verwaltung ════════════════ */

export interface VerwaltungsStand {
  docsOk: boolean;
  kycStatus: string;
  accountStatus: string;
  profileCompletedAt: string | null;
  profileChangesRequested: boolean;
  adminNote: string | null;
  adminProfileNote: string | null;
}

interface Aufgabe {
  titel: string;
  wofuer: string;
  cta: string | null;
  dringend: boolean;
  aktion: (() => void) | null;
}

/**
 * Nur echte Verwaltung — bewusst OHNE die Bonitätsauskunft: die hat ihren
 * eigenen Bereich oben. Dadurch erscheint keine Aufgabe zweimal.
 */
function offeneAufgaben(v: VerwaltungsStand, gehe: { unterlagen: () => void; konto: () => void }): Aufgabe[] {
  const liste: Aufgabe[] = [];
  const profilFertig = !!v.profileCompletedAt && !v.profileChangesRequested;

  if (v.kycStatus === "changes_requested") {
    liste.push({
      titel: "Dokumente erneut einreichen",
      wofuer: v.adminNote ? `Rückfrage von FIAON: „${v.adminNote}“` : "FIAON hat neue Dokumente angefordert.",
      cta: "Jetzt hochladen", dringend: true, aktion: gehe.unterlagen,
    });
  } else if (!v.docsOk) {
    liste.push({
      titel: "Kontoauszug und Ausweis hochladen",
      wofuer: "Gesetzlich vorgeschrieben für die Prüfung deiner Identität.",
      cta: "Zu den Unterlagen", dringend: false, aktion: gehe.unterlagen,
    });
  }

  if (v.profileChangesRequested) {
    liste.push({
      titel: "Rückfrage zum Profil beantworten",
      wofuer: v.adminProfileNote ? `Rückfrage von FIAON: „${v.adminProfileNote}“` : "FIAON hat eine Rückfrage zu deinen Angaben.",
      cta: "Jetzt beantworten", dringend: true, aktion: gehe.konto,
    });
  } else if (!profilFertig) {
    liste.push({
      titel: "Profil vervollständigen",
      wofuer: "Reisepass-Daten und monatliche Ausgaben — Grundlage für deine Prüfung.",
      cta: "Profil ausfüllen", dringend: false, aktion: gehe.konto,
    });
  }

  return liste;
}

export function NochZuErledigen({
  stand, onUnterlagen, onKonto,
}: {
  stand: VerwaltungsStand;
  onUnterlagen: () => void;
  onKonto: () => void;
}) {
  const aufgaben = offeneAufgaben(stand, { unterlagen: onUnterlagen, konto: onKonto });
  const inPruefung = aufgaben.length === 0 && stand.accountStatus !== "active";
  const freigeschaltet = stand.accountStatus === "active";

  return (
    <section className="db-panel db-rise rounded-3xl overflow-hidden" style={{ animationDelay: "200ms" }}>
      <div className="px-5 py-4 sm:px-6 flex items-baseline justify-between gap-3 border-b border-slate-100">
        <h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">
          {aufgaben.length > 0 ? "Noch zu erledigen" : "Deine Unterlagen"}
        </h3>
        {aufgaben.length > 0 && (
          <p className="text-[11.5px] text-slate-400">
            {aufgaben.length === 1 ? "1 Punkt" : `${aufgaben.length} Punkte`}
          </p>
        )}
      </div>

      {aufgaben.length === 0 ? (
        <div className="px-5 py-4 sm:px-6 flex items-start gap-3">
          <span className="mt-0.5"><Haken size={15} color="#16a34a" /></span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-slate-800 leading-tight">
              {freigeschaltet ? "Alles erledigt — Dein Zugang ist freigeschaltet." : "Alles eingereicht — vielen Dank."}
            </p>
            {inPruefung && (
              <p className="text-[12px] text-slate-500 leading-relaxed mt-1">
                FIAON prüft deine Unterlagen. Du musst nichts weiter tun; wir melden uns.
              </p>
            )}
          </div>
        </div>
      ) : (
        <ul>
          {aufgaben.map((a, i) => (
            <li key={a.titel} className={i > 0 ? "border-t border-slate-100" : ""}>
              <button
                type="button"
                onClick={a.aktion ?? undefined}
                className="db-tile-c w-full text-left px-5 py-4 sm:px-6 flex items-start gap-3.5"
                style={{ background: a.dringend ? "rgba(255,251,235,.85)" : undefined, border: "none" }}
              >
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold"
                  style={a.dringend
                    ? { background: "rgba(217,119,6,.12)", color: "#b45309" }
                    : { background: "rgba(37,99,235,.09)", color: ACCENT }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13px] font-bold leading-tight ${a.dringend ? "text-amber-900" : "text-slate-800"}`}>
                    {a.titel}
                  </span>
                  <span className={`block text-[12px] leading-relaxed mt-0.5 ${a.dringend ? "text-amber-700" : "text-slate-500"}`}>
                    {a.wofuer}
                  </span>
                  {a.cta && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-bold mt-1.5" style={{ color: a.dringend ? "#b45309" : ACCENT }}>
                      {a.cta}<Pfeil size={12} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ════════════════ 4. Was Sie erwartet — Fahrplan-Vorschau ════════════════ */

/**
 * Beispiel-Etappen, damit vor dem Kauf sichtbar ist, was danach entsteht.
 * Es werden KEINE echten Kundendaten und keine erfundenen Zahlen gezeigt —
 * verschlossene Etappen erscheinen als graue Platzhalter (wie in der
 * Agenten-Kartei), nicht als weichgezeichneter Fantasietext.
 */
const VORSCHAU = [
  { titel: "Deine Einträge im Klartext", text: "Was steht in deiner Auskunft — und was davon ist erledigt, offen oder strittig." },
  { titel: "Deine größten Hebel zuerst", text: "Welche Schritte bei deiner Lage erfahrungsgemäß am meisten bewegen." },
  { titel: "Reihenfolge und Zeitplan", text: "Was du diese Woche tust, was später sinnvoll ist." },
];

export function FahrplanVorschau({ status, onFahrplan }: { status: BonitaetStatus | null; onFahrplan: () => void }) {
  const offen = status?.analyse === "fertig" || (status?.fahrplanSchritte ?? 0) > 0;

  return (
    <section className="db-panel db-rise rounded-3xl px-5 py-5 sm:px-6 sm:py-6" style={{ animationDelay: "260ms" }}>
      <div className="flex items-center gap-2">
        {!offen && <Schloss size={12} />}
        <h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">
          {offen ? "In deinem Fahrplan" : "Was Sie danach erwartet"}
        </h3>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {VORSCHAU.map((v) => (
          <div key={v.titel} className="rounded-2xl px-4 py-3.5" style={{ background: "rgba(248,250,252,.9)", border: "1px solid rgba(226,232,240,.85)" }}>
            <p className="text-[12.5px] font-bold text-slate-800 leading-tight">{v.titel}</p>
            <p className="text-[11.5px] text-slate-500 leading-relaxed mt-1">{v.text}</p>
            {!offen && (
              <div className="mt-3 space-y-1.5" aria-label="Noch nicht freigeschaltet">
                <div className="db-bar" style={{ width: "78%" }} />
                <div className="db-bar" style={{ width: "54%" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-[12px] text-slate-500 leading-relaxed max-w-[62ch]">
          {offen
            ? "Deine Schritte stehen im Fahrplan — Du kannst sie dort abhaken und deinen Fortschritt sehen."
            : "Die Auswertung und der Fahrplan sind im Preis der Auskunft enthalten — es kommt nichts hinzu."}
        </p>
        {offen && (
          <button type="button" onClick={onFahrplan} className="text-[12.5px] font-bold inline-flex items-center gap-1.5 shrink-0" style={{ color: ACCENT }}>
            Fahrplan öffnen<Pfeil size={13} />
          </button>
        )}
      </div>
    </section>
  );
}
