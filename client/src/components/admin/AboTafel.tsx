import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Send, Check, ChevronRight } from "lucide-react";
import { ACCENT } from "./AdminShell";
import { Tip } from "./PageHelp";
import BuchenDialog from "./BuchenDialog";

// ═══════════════════════════════════════════════════════════════════════════
// Abo-Tafel — die monatliche Paketrate in der Zahlungszentrale
//
// Warum eigene Tafel: Die Erstzahlung und die Monatsrate sind zwei
// verschiedene Vorgänge. Die Erstzahlung schaltet den Zugang frei, die
// Monatsrate hält ihn am Leben. Beides in eine Liste zu mischen hieße, dass
// man beim Freischalten nicht mehr sieht, was neu und was laufend ist.
//
// Fälligkeit: 30 Tage nach der Buchung, danach alle 30 Tage. Referenz je Rate
// mit angehängter Ratennummer (FIAON-A1B2C3-2) — nur so ist eine Überweisung
// eindeutig zuzuordnen.
// ═══════════════════════════════════════════════════════════════════════════

interface AboRate {
  id: number; ref: string; rateNr: number; zahlungsreferenz: string;
  betragCents: number; faelligAm: string; status: string;
  mahnstufe: number; erinnerungen: number; letzteErinnerung: string | null;
  bezahltAm: string | null; tageUeberfaellig: number;
  name: string; email: string | null; telefon: string | null;
  paket: string | null; agent: string | null; notiz: string | null; akte: string;
  /** Gesetzt, wenn der Versand der Erinnerung fehlgeschlagen ist — dann steht
   *  die Mahnstufe bewusst still, der Kunde hat KEINE Mail bekommen. */
  letzterFehler: string | null;
  letzterFehlerAt: string | null;
  fehlversuche: number;
}

interface AboUebersicht {
  heute: { anzahl: number; cents: number };
  woche: { anzahl: number; cents: number };
  ueberfaellig: { anzahl: number; cents: number };
  entscheidung: number;
  zustellfehler: number;
  monatBezahlt: { anzahl: number; cents: number };
  laufend: { abos: number; cents: number };
  ohneKette: number;
  motorAktiv: boolean;
  fenster?: { start: number; ende: number };
  imFenster?: boolean;
  stichtag: string | null;
  zyklusTage: number;
}

const eur = (c: number) =>
  `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const eurGlatt = (c: number) => `${Math.round(c / 100).toLocaleString("de-DE")} €`;

function tag(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

type Art = "heute" | "woche" | "ueberfaellig" | "offen" | "bezahlt" | "entscheidung" | "zustellfehler";

const REITER: { art: Art; label: string }[] = [
  { art: "heute", label: "Heute fällig" },
  { art: "woche", label: "Nächste 7 Tage" },
  { art: "ueberfaellig", label: "Überfällig" },
  { art: "entscheidung", label: "Entscheidung nötig" },
  { art: "zustellfehler", label: "Nicht zugestellt" },
  { art: "offen", label: "Alle offenen" },
  { art: "bezahlt", label: "Bezahlt" },
];

export default function AboTafel({ onMeldung }: { onMeldung: (text: string) => void }) {
  const [u, setU] = useState<AboUebersicht | null>(null);
  const [art, setArt] = useState<Art>("woche");
  const [raten, setRaten] = useState<AboRate[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [offen, setOffen] = useState(true);
  const [filter, setFilter] = useState("");
  /** Rate, für die der Buchen-Dialog offen ist. */
  const [buchen, setBuchen] = useState<AboRate | null>(null);

  const ladeUebersicht = useCallback(async () => {
    const r = await fetch("/api/fiaon/admin/abo/uebersicht", { credentials: "include" })
      .then((x) => x.json()).catch(() => null);
    if (r?.ok) setU(r);
  }, []);

  const ladeRaten = useCallback(async (a: Art) => {
    setLaedt(true);
    try {
      const r = await fetch(`/api/fiaon/admin/abo/raten?art=${a}`, { credentials: "include" })
        .then((x) => x.json()).catch(() => null);
      setRaten(r?.ok ? r.raten : []);
    } finally { setLaedt(false); }
  }, []);

  useEffect(() => { void ladeUebersicht(); }, [ladeUebersicht]);
  useEffect(() => { if (offen) void ladeRaten(art); }, [art, offen, ladeRaten]);

  const liste = useMemo(() => {
    const s = filter.trim().toLowerCase();
    if (!s) return raten;
    return raten.filter((r) =>
      r.name.toLowerCase().includes(s) || (r.email || "").toLowerCase().includes(s) ||
      r.zahlungsreferenz.toLowerCase().includes(s) || (r.agent || "").toLowerCase().includes(s));
  }, [raten, filter]);

  /** Buchen läuft über den Dialog — dort steht das Zahlungsdatum. */
  const bezahltBuchen = async (r: AboRate, zahlungsdatum: string) => {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/fiaon/admin/abo/raten/${r.id}/bezahlt`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ zahlungsdatum }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        onMeldung(
          `Rate ${r.rateNr} von ${r.name} gebucht (Eingang ${zahlungsdatum})` +
          (j.naechsteFaelligkeit ? ` — nächste Rate fällig am ${tag(j.naechsteFaelligkeit)}.` : "."),
        );
        setBuchen(null);
        await Promise.all([ladeUebersicht(), ladeRaten(art)]);
      } else onMeldung(`Fehler: ${j?.error || res.status}`);
    } finally { setBusy(null); }
  };

  const erinnern = async (r: AboRate) => {
    if (!confirm(
      `Zahlungserinnerung an ${r.name} senden?\n\n` +
      `E-Mail an ${r.email}\nRate ${r.rateNr} · ${eur(r.betragCents)} · fällig ${tag(r.faelligAm)}\n\n` +
      `Es geht das Event abo_payment_reminder raus (Mahnstufe ${Math.min(3, r.mahnstufe + 1)}).`,
    )) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/fiaon/admin/abo/raten/${r.id}/erinnern`, { method: "POST", credentials: "include" });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        onMeldung(`Erinnerung an ${r.name} versendet (Mahnstufe ${Math.min(3, r.mahnstufe + 1)}).`);
        await Promise.all([ladeUebersicht(), ladeRaten(art)]);
      } else {
        // Ehrlich bleiben: Bei einem Fehlschlag ging NICHTS raus, und die
        // Mahnstufe bleibt absichtlich stehen.
        onMeldung(j?.error || `Fehler: ${res.status}`);
        await Promise.all([ladeUebersicht(), ladeRaten(art)]);
      }
    } finally { setBusy(null); }
  };

  /**
   * Erinnerungs-Lauf für GENAU die geöffnete Ansicht.
   *
   * Vorher hing der Knopf am Motor: der schaut nur auf „heute oder früher
   * fällig" und respektiert zusätzlich den Einführungsstichtag. Stand an dem Tag
   * nichts an, meldete er „0 gesendet" — für den Betreiber sah das wie ein
   * kaputter Knopf aus. Ein Knopf über einer Liste muss auf DIESE Liste wirken.
   *
   * Zuerst wird gezählt, dann gefragt. Eine Mailwelle ohne vorherige Zahl wäre
   * unverantwortlich.
   */
  const [laufLaeuft, setLaufLaeuft] = useState(false);
  const erinnerungsLauf = async () => {
    setLaufLaeuft(true);
    try {
      const v = await fetch(`/api/fiaon/admin/abo/lauf/vorschau?art=${art}`, { credentials: "include" })
        .then((x) => x.json()).catch(() => null);
      if (!v?.ok) { onMeldung("Vorschau fehlgeschlagen."); return; }
      if (!v.imFenster) {
        onMeldung("Versand nur zwischen 08 und 20 Uhr Berliner Zeit — Kundenmails gehen nachts nicht raus.");
        return;
      }
      if (v.sendbar === 0) {
        // Ehrlich sagen, WARUM nichts rausgeht, statt „0 gesendet".
        const grund = v.gefunden === 0
          ? `In der Ansicht „${v.artText}" steht keine Rate.`
          : v.uebersprungen.gesperrt > 0
            ? `Alle ${v.gefunden} Raten wurden vor weniger als 20 Stunden schon erinnert.`
            : `Von ${v.gefunden} Raten hat keine eine E-Mail-Adresse.`;
        onMeldung(grund);
        return;
      }
      if (!confirm(
        `Erinnerung an ${v.sendbar} Kunden senden?\n\n` +
        `Ansicht: ${v.artText}\n` +
        `Betroffen: ${v.sendbar} Rate(n) über ${eur(v.summeCents)}\n` +
        (v.uebersprungen.gesperrt ? `Übersprungen: ${v.uebersprungen.gesperrt} (vor unter 20 Stunden schon erinnert)\n` : "") +
        (v.uebersprungen.ohneMail ? `Übersprungen: ${v.uebersprungen.ohneMail} ohne E-Mail\n` : "") +
        `\n${v.alsVorabinfo
          ? "Diese Raten sind noch NICHT fällig — es geht eine Vorabinfo raus, die Mahnstufe bleibt unverändert."
          : "Die Mahnstufe steigt um eine Stufe (höchstens bis 3)."}\n\n` +
        `Event: abo_payment_reminder`,
      )) return;

      const res = await fetch("/api/fiaon/admin/abo/lauf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ art }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        onMeldung(j.meldung + (j.fehlerGruende?.length ? ` Grund: ${j.fehlerGruende[0]}` : ""));
        await Promise.all([ladeUebersicht(), ladeRaten(art)]);
      } else onMeldung(j?.error || `Fehler: ${res.status}`);
    } finally { setLaufLaeuft(false); }
  };

  const kacheln = u ? [
    { label: "Laufender Monatsumsatz", wert: eur(u.laufend.cents), unter: `${u.laufend.abos} aktive Abos`, ton: "geld" as const,
      hilfe: "Summe der monatlichen Paketraten aller laufenden Abos — das ist der Umsatz, der bei gleichbleibendem Bestand jeden Monat wiederkommt." },
    { label: "Heute fällig", wert: String(u.heute.anzahl), unter: eurGlatt(u.heute.cents), ton: undefined,
      hilfe: "Raten mit Fälligkeitsdatum heute. Am Fälligkeitstag geht Mahnstufe 1 raus." },
    { label: "Nächste 7 Tage", wert: String(u.woche.anzahl), unter: eurGlatt(u.woche.cents), ton: undefined,
      hilfe: "Was in dieser Woche noch reinkommen sollte." },
    { label: "Überfällig", wert: String(u.ueberfaellig.anzahl), unter: eurGlatt(u.ueberfaellig.cents),
      ton: u.ueberfaellig.anzahl > 0 ? ("warnung" as const) : undefined,
      hilfe: "Fälligkeitstag verstrichen, Zahlung nicht gebucht. Nach Stufe 3 (14 Tage) endet der automatische Versand und der Fall wartet auf deine Entscheidung." },
    { label: "Diesen Monat bezahlt", wert: eurGlatt(u.monatBezahlt.cents), unter: `${u.monatBezahlt.anzahl} Raten`, ton: "geld" as const,
      hilfe: "Bereits gebuchte Monatsraten im laufenden Kalendermonat (ohne Erstzahlungen)." },
  ] : [];

  return (
    <section className="a3-tafel mb-4">
      <header className="a3-tafel-kopf">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
          <RefreshCw size={14} />
        </span>
        <button type="button" onClick={() => setOffen((v) => !v)} className="flex items-center gap-2 text-left min-w-0">
          <h2 className="text-[14px] font-bold text-slate-900">Abo — monatliche Paketrate</h2>
          <ChevronRight size={14} className={`text-slate-400 transition-transform ${offen ? "rotate-90" : ""}`} />
        </button>
        <Tip text={`Jeder Kunde zahlt sein Paket monatlich. Fällig ist er ${u?.zyklusTage || 30} Tage nach dem Tag, an dem seine Zahlung als bezahlt gebucht wurde, danach im gleichen Abstand. Der Bonitäts-Check (74 €) ist ein Einmalkauf und erzeugt keine Rate. Jede Rate hat ihre eigene Referenz (Bestellreferenz + „-Ratennummer“) — nur damit lässt sich eine Überweisung eindeutig zuordnen.`} />
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {u && !u.motorAktiv && (
            <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold" style={{ background: "rgba(217,119,6,.1)", color: "#b45309" }}>
              Motor aus
            </span>
          )}
          {u && u.zustellfehler > 0 && (
            <button type="button" onClick={() => { setOffen(true); setArt("zustellfehler"); }}
              className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold"
              style={{ background: "rgba(220,38,38,.1)", color: "#b91c1c" }}>
              {u.zustellfehler}× nicht zugestellt
            </button>
          )}
          {u && u.entscheidung > 0 && (
            <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold" style={{ background: "rgba(220,38,38,.08)", color: "#dc2626" }}>
              {u.entscheidung} Entscheidung
            </span>
          )}
        </span>
      </header>

      {offen && (
        <>
          {/* Kennzahlen */}
          <div className="p-3.5 sm:p-4 grid grid-cols-2 lg:grid-cols-5 gap-2.5">
            {kacheln.map((k, i) => (
              <div key={k.label} className="a3-kachel a3-auf p-3.5 pl-[16px]" data-ton={k.ton} style={{ ["--i" as any]: i }}>
                <span className="flex items-start gap-1">
                  <span className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500 leading-tight">{k.label}</span>
                  <Tip text={k.hilfe} />
                </span>
                <span className="block mt-1.5 text-[19px] font-bold text-slate-900 a3-zahl leading-none">{k.wert}</span>
                <span className="block mt-1 text-[11.5px] text-slate-500">{k.unter}</span>
              </div>
            ))}
            {!u && <p className="text-[13px] text-slate-400 col-span-full">Wird geladen …</p>}
          </div>

          {/* Kein „Ketten anlegen"-Knopf mehr: Wer ein Paket kauft, HAT ein Abo —
              das ist die Regel des Geschäfts und keine Einzelfallentscheidung.
              Fehlt einer bezahlten Bestellung die Ratenkette, entsteht sie jetzt
              beim Öffnen dieser Tafel und beim Erinnerungs-Lauf von selbst
              (ketteSicherstellen). Ein Knopf, der um Zustimmung zu etwas bittet,
              das ohnehin gilt, hielt bis zum Klick Umsatz unsichtbar. */}

          {/* Reiter + Werkzeuge */}
          <div className="px-3.5 sm:px-4 pb-3 flex flex-wrap items-center gap-2"
            style={{ boxShadow: "inset 0 -1px 0 rgba(226,232,240,.8)" }}>
            <span className="a3-reiter">
              {REITER.map((r) => (
                <button key={r.art} type="button" onClick={() => setArt(r.art)} data-an={art === r.art ? "1" : undefined}>
                  {r.label}
                </button>
              ))}
            </span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Name, Referenz, Agent …"
              className="h-[30px] px-2.5 rounded-lg border bg-white text-[12px] outline-none w-[150px] sm:w-[190px]"
              style={{ borderColor: "var(--a3-linie,#e4e9f2)" }} />
            <span className="ml-auto flex items-center gap-2">
              {/* Der Knopf nennt die Ansicht, auf die er wirkt. „Erinnerungs-Lauf"
                  allein ließ offen, WER eine Mail bekommt — die häufigste Ursache
                  für Zögern vor einem Knopf, der Kunden anschreibt. */}
              <button type="button" onClick={() => void erinnerungsLauf()} disabled={laufLaeuft}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-white text-[11.5px] font-semibold text-slate-600 disabled:opacity-50"
                style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}
                title={`Verschickt abo_payment_reminder an die Raten der Ansicht „${REITER.find((r) => r.art === art)?.label}"`}>
                <Send size={12} /> {laufLaeuft ? "Läuft …" : `Erinnern: ${REITER.find((r) => r.art === art)?.label}`}
              </button>
            </span>
          </div>

          {/* Ratenliste */}
          <div className="max-h-[520px] overflow-y-auto">
            {laedt && <p className="px-4 py-6 text-[13px] text-slate-400">Wird geladen …</p>}
            {!laedt && liste.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-slate-400">
                {filter ? `Kein Treffer für „${filter}“.` : "Keine Raten in dieser Ansicht."}
              </p>
            )}
            {liste.map((r) => {
              const ueberfaellig = r.status === "offen" && r.tageUeberfaellig > 0;
              return (
                <div key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3"
                  style={{
                    boxShadow: "inset 0 -1px 0 rgba(226,232,240,.8)",
                    borderLeft: `3px solid ${ueberfaellig ? "#dc2626" : r.status === "bezahlt" ? "#059669" : "transparent"}`,
                  }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-slate-900 truncate">
                      {r.name}
                      <span className="ml-2 text-[11px] font-semibold text-slate-400">Rate {r.rateNr}</span>
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      {r.status === "bezahlt"
                        ? `bezahlt am ${r.bezahltAm ? new Date(r.bezahltAm).toLocaleDateString("de-DE") : "—"}`
                        : <>fällig {tag(r.faelligAm)}{ueberfaellig && <span className="text-red-600 font-semibold"> · {r.tageUeberfaellig} Tage überfällig</span>}</>}
                      {r.mahnstufe > 0 && ` · Mahnstufe ${r.mahnstufe}`}
                      {r.agent ? ` · ${r.agent}` : ""}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {r.zahlungsreferenz}{r.paket ? ` · ${r.paket}` : ""}
                    </p>
                    {/* Fehlgeschlagene Zustellung: Der Kunde hat KEINE Mail
                        bekommen, und die Mahnstufe steht deshalb still. Das muss
                        man sehen — sonst wartet man auf eine Reaktion, die
                        niemand auslösen konnte. */}
                    {r.letzterFehler && (
                      <p className="mt-1.5 text-[11.5px] leading-snug px-2 py-1.5 rounded-lg"
                        style={{ background: "rgba(220,38,38,.06)", color: "#b91c1c" }}>
                        <b>Erinnerung konnte nicht zugestellt werden</b> ({r.fehlversuche}× versucht,
                        {" "}{r.letzterFehlerAt ? new Date(r.letzterFehlerAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}):
                        {" "}{r.letzterFehler} — Mahnstufe bleibt bei {r.mahnstufe}.
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[14px] font-bold text-slate-900 a3-zahl">{eur(r.betragCents)}</span>
                  <span className="shrink-0 flex items-center gap-1.5">
                    <a href={r.akte} className="a3-knopf inline-flex" data-haupt="1">Akte <ChevronRight size={12} /></a>
                    {r.status === "offen" && (
                      <>
                        <button type="button" className="a3-knopf inline-flex" disabled={busy === r.id}
                          onClick={() => setBuchen(r)}>
                          <Check size={12} /> bezahlt
                        </button>
                        {r.email && (
                          <button type="button" className="a3-knopf inline-flex" disabled={busy === r.id}
                            onClick={() => void erinnern(r)}>
                            <Send size={12} /> erinnern
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Fuß: Erklärung der Regeln, damit niemand rätselt */}
          <div className="px-4 py-2.5 text-[11px] text-slate-400 leading-relaxed" style={{ background: "#fbfcfe" }}>
            Fälligkeit = Buchungstag + {u?.zyklusTage || 30} Tage, danach im gleichen Abstand · Erinnerung am Fälligkeitstag
            (Stufe 1), nach 7 Tagen (Stufe 2), nach 14 Tagen (Stufe 3) · danach keine automatische Mail mehr, sondern
            „Entscheidung nötig“ · Versand nur zwischen {u?.fenster?.start ?? 8} und {u?.fenster?.ende ?? 20} Uhr
            {u && u.imFenster === false ? " (gerade außerhalb — der Lauf sagt es dir)" : ""}, höchstens eine Mail je Rate pro 20 Stunden
            {u?.stichtag ? ` · Einführungsstichtag ${tag(u.stichtag)}: Raten, die vorher fällig waren, werden nicht automatisch angemahnt` : ""}
            {" "}· Mahnstufe steigt NUR, wenn die Mail wirklich zugestellt wurde
          </div>
        </>
      )}

      {/* Buchen mit tatsächlichem Zahlungsdatum */}
      {buchen && (
        <BuchenDialog
          busy={busy === buchen.id}
          ziel={{
            titel: `Abo-Rate ${buchen.rateNr} buchen`,
            name: buchen.name,
            referenz: buchen.zahlungsreferenz,
            betragText: eur(buchen.betragCents),
            zeilen: [
              { label: "Bisherige Fälligkeit", wert: tag(buchen.faelligAm) },
              ...(buchen.paket ? [{ label: "Paket", wert: buchen.paket }] : []),
              ...(buchen.mahnstufe > 0 ? [{ label: "Mahnstufe", wert: String(buchen.mahnstufe) }] : []),
            ],
            folgen: [
              "Die Rate gilt als bezahlt und verschwindet aus den Fälligkeiten.",
              `Die nächste Rate (Nr. ${buchen.rateNr + 1}) wird 30 Tage nach dem Zahlungseingang angelegt.`,
              "Der Vorgang wird im Kundenverlauf dokumentiert. Es geht keine E-Mail raus.",
            ],
          }}
          onAbbrechen={() => setBuchen(null)}
          onBuchen={(datum) => void bezahltBuchen(buchen, datum)}
        />
      )}
    </section>
  );
}
