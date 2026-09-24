import { useCallback, useEffect, useMemo, useState } from "react";
import { anrufHinweis, anrufHinweisKurz, anrufHinweisSie, ABSAGE_HINWEIS } from "@shared/fiaon-termin-text";
import { useRoute } from "wouter";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

// ═══════════════════════════════════════════════════════════════════════════
// /termin/:token — der Kunde sucht sich selbst eine Uhrzeit
//
// KEIN LOGIN. Der Link trägt ein signiertes Token (Muster der Rechnungs-Links),
// mehr braucht es nicht: Ein Kunde, der erst ein Konto anlegen muss, um einen
// Rückruf zu vereinbaren, vereinbart keinen Rückruf.
//
// WORTWAHL
// „Gespräch mit deinem persönlichen Ansprechpartner" — nirgends „Beratung",
// „Berater" oder „Finanzberatung". Das ist keine Kosmetik: Diese Begriffe sind
// erlaubnispflichtig belegt, und eine Terminseite ist der letzte Ort, an dem
// man sie versehentlich verwenden sollte.
//
// MOBIL ZUERST
// Der Link kommt per Mail oder WhatsApp, also wird er auf dem Telefon
// geöffnet. Die Zeitknöpfe sind deshalb mindestens 44 px hoch und liegen in
// einem Raster, das bei 380 px Breite noch drei Spalten trägt.
// ═══════════════════════════════════════════════════════════════════════════

interface Slot {
  beginn: string;
  datum: string;
  uhrzeit: string;
  agentId: number;
  agentVorname: string;
}

interface Auskunft {
  vorname: string | null;
  /**
   * Der geprüfte Weg, über den dieser Link kam (24.08.2026) — der Server hat
   * ihn schon auf die erlaubten Werte gebracht. Die Seite zeigt ihn nicht an,
   * sie gibt ihn beim Buchen zurück.
   */
  herkunft?: string;
  betreuer: { id: number; vorname: string } | null;
  slots: Slot[];
  slotMinuten: number;
  horizontTage: number;
  termin: {
    beginn: string; datumText: string; uhrzeit: string;
    agentVorname: string; stornoToken: string;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DU ODER SIE — DIE ANREDE KOMMT AUS DER ADRESSE (24.09.2026, E-236)
//
// ── DER ANLASS ─────────────────────────────────────────────────────────────
// Mara schreibt auf WhatsApp in der Sie-Form und schickt persönliche
// Terminlinks (`?von=mara_whatsapp_link&anrede=sie`). Die Seite duzte — der
// Kunde las nach „Wann passt es Ihnen?" auf WhatsApp ein „Wann passt es dir?"
// auf der Seite. Das wirkt wie zwei verschiedene Absender.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// `?anrede=sie` schaltet JEDEN sichtbaren Satz der Seite in die Sie-Form —
// Überschriften, Hinweise, Fehlermeldungen und die Bestätigung. Ohne den
// Parameter bleibt alles wortgleich wie vorher (Du): Die Mail-Wege der
// Privatkunden ändern sich nicht.
//
// Zweites Netz: Ein Link mit `?von=mara_…` spricht ebenfalls Sie, auch wenn
// `anrede` unterwegs verloren ging (abgeschnittener Link, weitergeleitet).
// Mara siezt immer; ihre Links sollen es auch tun.
//
// Die Anrede geht beim Laden, Buchen und Absagen an den Server mit, damit
// auch SEINE Sätze (Fehler, „Dieser Termin wurde gerade vergeben …") in der
// passenden Form zurückkommen. Sie steuert dort nichts außer der Wortwahl —
// Zeiten, Buchungsweg und `?von=` bleiben unberührt.
// ═══════════════════════════════════════════════════════════════════════════
function anredeAusAdresse(): "du" | "sie" {
  if (typeof window === "undefined") return "du";
  const q = new URLSearchParams(window.location.search);
  if (String(q.get("anrede") || "").toLowerCase() === "sie") return "sie";
  if (String(q.get("von") || "").startsWith("mara_")) return "sie";
  return "du";
}

/**
 * Der Absage-Zusatz für die SEITE in Sie-Form.
 *
 * shared/fiaon-termin-text.ts hat nur die Mail-Fassung (ABSAGE_HINWEIS_SIE:
 * „Über den Link in DIESER E-Mail …") — auf einer Webseite wäre „dieser
 * E-Mail" falsch. Gehört langfristig als eigene Konstante dorthin.
 */
const ABSAGE_HINWEIS_SIE_SEITE =
  "Passt es doch nicht? Über den Link in der Bestätigungs-E-Mail können Sie "
  + "jederzeit absagen oder eine andere Zeit wählen.";

/** Kurzfassung des Anruf-Satzes in Sie-Form (Gegenstück zu anrufHinweisKurz). */
function anrufHinweisKurzSie(vorname?: string | null): string {
  const wer = String(vorname || "").trim() || "Ihr Ansprechpartner";
  return `${wer} ruft Sie an`;
}

/**
 * Alle festen Sätze der Buchungsseite in beiden Formen. Die Du-Fassung ist
 * WORTGLEICH mit dem Stand vor dem 24.09. — sie wurde nur hierher gezogen.
 */
const TEXTE = {
  du: {
    buchenFehler: "Der Termin konnte nicht gebucht werden. Bitte versuch es erneut.",
    andereZeit: "Wähl unten einfach eine andere Zeit — die Liste ist gerade neu geladen.",
    bestaetigung: "Du bekommst gleich eine Bestätigung per E-Mail.",
    anruf: anrufHinweis,
    anrufKurz: anrufHinweisKurz,
    absageHinweis: ABSAGE_HINWEIS,
    bestehendTitel: "Dein Termin",
    bestehendNeu: "Passt die Zeit nicht mehr? Sag ab und wähl direkt eine neue.",
    keineZeiten: "Dein Ansprechpartner meldet sich in den nächsten Tagen bei dir.",
  },
  sie: {
    buchenFehler: "Der Termin konnte nicht gebucht werden. Bitte versuchen Sie es erneut.",
    andereZeit: "Wählen Sie unten einfach eine andere Zeit — die Liste ist gerade neu geladen.",
    bestaetigung: "Sie bekommen gleich eine Bestätigung per E-Mail.",
    anruf: anrufHinweisSie,
    anrufKurz: anrufHinweisKurzSie,
    absageHinweis: ABSAGE_HINWEIS_SIE_SEITE,
    bestehendTitel: "Ihr Termin",
    bestehendNeu: "Passt die Zeit nicht mehr? Sagen Sie ab und wählen Sie direkt eine neue.",
    keineZeiten: "Ihr Ansprechpartner meldet sich in den nächsten Tagen bei Ihnen.",
  },
} as const;

/** „Nikita" aus „Nikita" oder „Nikita Petrov" — für die kurze Überschrift. */
function rufname(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

/** Sichtbarer Tastatur-Fokus für alle Knöpfe der Seite (nur bei Tastatur, nie beim Klick). */
const FOKUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2";

const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** „Montag, 12. August" — ausgeschrieben, weil die Seite Ruhe ausstrahlen soll. */
function tagUeberschrift(datumISO: string): string {
  const [y, m, d] = datumISO.split("-").map(Number);
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const morgen = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" })
    .format(new Date(Date.now() + 86_400_000));
  if (datumISO === heute) return "Heute";
  if (datumISO === morgen) return "Morgen";
  const datum = new Date(Date.UTC(y, m - 1, d));
  return `${WOCHENTAG[datum.getUTCDay()]}, ${d}. ${datum.toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" })}`;
}

export default function TerminPage() {
  const [, params] = useRoute("/termin/:token");
  const token = params?.token || "";

  const [daten, setDaten] = useState<Auskunft | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [gewaehlt, setGewaehlt] = useState<Slot | null>(null);
  const [bucht, setBucht] = useState(false);
  const [fertig, setFertig] = useState<{ datumText: string; uhrzeit: string; agentVorname: string } | null>(null);
  /**
   * Wie viele Tage auf einmal. Vierzehn Tage à 27 Zeiten sind fast 400 Knöpfe —
   * auf dem Telefon scrollt daran niemand vorbei. Die ersten drei Tage
   * beantworten die Frage „geht es diese Woche?" fast immer.
   */
  const [tageOffen, setTageOffen] = useState(3);

  // ══════════════════════════════════════════════════════════════════════════
  // DIE TERMINART AUS DER ADRESSE — SIE WURDE IGNORIERT (19.08.2026)
  //
  // ── DER BEFUND ────────────────────────────────────────────────────────────
  // Der Startgespräch-Banner verlinkt auf `/termin/<token>?art=start`. Diese
  // Seite hat den Anhang NIE gelesen: Sie lud die Zeiten ohne ihn und buchte
  // ohne ihn. Der Server fällt dann auf „nichterreicht_mail" zurück.
  //
  // GEMESSEN im Browser: Ein Kunde, der auf den Startgespräch-Link klickt,
  // bekommt „Wähl eine Zeit für ein 20-minütiges Gespräch mit Nikita" — einen
  // Vertriebsrückruf statt seines 15-minütigen Startgesprächs, und Zeiten von
  // Menschen, die keine Startgespräche führen.
  //
  // Der Link verspricht das eine und liefert das andere. Ein Kunde, der ein
  // Startgespräch erwartet und einen Verkäufer zugewiesen bekommt, hat keinen
  // Grund, das zu verstehen — er ruft an.
  // ══════════════════════════════════════════════════════════════════════════
  const art = new URLSearchParams(window.location.search).get("art") === "start"
    ? "start" : null;
  // ── DIE HERKUNFT REIST MIT (24.08.2026) ───────────────────────────────────
  // VORHER trug der Link keinen Hinweis darauf, welcher WEG den Kunden
  // hergebracht hat — „vor der Zahlung aus dem Antrag" und „nach vergeblichen
  // Anrufen" waren im Bestand nicht zu unterscheiden. NACHHER hängt
  // `terminLink` ein `?von=` an; diese Seite reicht es beim Laden UND beim
  // Buchen zurück, der Server prüft es und legt es in `fiaon_termine.herkunft`
  // ab. Es ändert nichts an den angebotenen Zeiten — reine Buchführung.
  const von = new URLSearchParams(window.location.search).get("von");
  // Die Anrede (24.09.2026, E-236) — siehe den Block über `anredeAusAdresse`.
  // Sie reist zum Server mit, damit dessen Sätze in derselben Form kommen.
  const anrede = anredeAusAdresse();
  const sie = anrede === "sie";
  const T = TEXTE[anrede];
  const anhang = [
    art ? "art=start" : "", von ? `von=${encodeURIComponent(von)}` : "", sie ? "anrede=sie" : "",
  ].filter(Boolean).join("&");
  const frage = anhang ? `?${anhang}` : "";

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await fetch(`/api/fiaon/termin/${encodeURIComponent(token)}${frage}`)
      .catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!res?.ok || !json?.ok) {
      setFehler(json?.hinweis || json?.error || "Dieser Link ist leider nicht mehr gültig.");
      setLaedt(false);
      return;
    }
    setDaten(json);
    setLaedt(false);
  }, [token, frage]);

  useEffect(() => { void laden(); }, [laden]);

  /** Slots nach Tag gruppieren — eine flache Liste mit 300 Knöpfen ist unlesbar. */
  const tage = useMemo(() => {
    if (!daten) return [];
    const map = new Map<string, Slot[]>();
    for (const s of daten.slots) {
      const liste = map.get(s.datum) || [];
      liste.push(s);
      map.set(s.datum, liste);
    }
    return Array.from(map.entries()).map(([datum, slots]) => ({ datum, slots }));
  }, [daten]);

  // ══════════════════════════════════════════════════════════════════════════
  // DIE LÜCKEN BENENNEN — NIE EINE FLÄCHE OHNE ERKLÄRUNG (19.08.2026)
  //
  // Tage ohne Zeiten wurden bisher einfach nicht gezeichnet. Das ist keine
  // leere Fläche, aber auch keine Auskunft: Wer heute und morgen sieht und dann
  // den Freitag, fragt sich, was mit Mittwoch und Donnerstag ist — und ob die
  // Seite kaputt ist.
  //
  // Ein Satz beantwortet das: „Am Mittwoch und Donnerstag ist nichts mehr frei."
  const luecken = useMemo(() => {
    if (!daten || tage.length === 0) return null;
    const vorhanden = new Set(tage.map((t) => t.datum));
    const fehlend: string[] = [];
    const heute = new Date();
    const letzter = tage[tage.length - 1].datum;
    for (let i = 0; i < 14; i++) {
      const d = new Date(heute.getTime() + i * 86_400_000);
      const tag = d.toISOString().slice(0, 10);
      if (tag > letzter) break;
      if (!vorhanden.has(tag)) fehlend.push(tag);
    }
    if (fehlend.length === 0) return null;
    const name = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE",
      { weekday: "long", day: "numeric", month: "long" });
    return {
      anzahl: fehlend.length,
      text: fehlend.length <= 3
        ? fehlend.map(name).join(", ")
        : `${fehlend.length} Tage dazwischen`,
      naechster: tage[0] ? name(tage[0].datum) : null,
    };
  }, [daten, tage]);

  const buchen = async () => {
    if (!gewaehlt) return;
    setBucht(true);
    const res = await fetch(`/api/fiaon/termin/${encodeURIComponent(token)}/buchen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // ── OHNE `quelle` (24.08.2026) ────────────────────────────────────────
      // VORHER schickte die Seite bei `?art=start` ein `quelle:
      // "onboarding_call"` mit. Das war schon folgenlos — der Server leitet die
      // Gesprächsart seit dem 21.08. aus dem Kundenzustand ab — und seit heute
      // verwirft die öffentliche Route jeden mitgeschickten Wert (er liess sich
      // von aussen zu „agent_manuell" fälschen). NACHHER geht nur noch die
      // HERKUNFT mit: Sie beschreibt den Weg und steuert nichts.
      body: JSON.stringify({
        beginn: gewaehlt.beginn, agentId: gewaehlt.agentId,
        ...(daten?.herkunft ? { herkunft: daten.herkunft } : von ? { herkunft: von } : {}),
        // Nur die Wortwahl der Antwort — die Buchung selbst liest es nicht.
        ...(sie ? { anrede: "sie" } : {}),
      }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBucht(false);
    if (!json?.ok) {
      setFehler(json?.error || T.buchenFehler);
      setGewaehlt(null);
      void laden();
      return;
    }
    setFertig(json.termin);
  };

  const absagen = async (stornoToken: string) => {
    const res = await fetch(`/api/fiaon/termin/absagen/${encodeURIComponent(stornoToken)}${sie ? "?anrede=sie" : ""}`,
      { method: "POST" })
      .catch(() => null);
    const json = await res?.json().catch(() => null);
    if (json?.ok) { setFertig(null); setGewaehlt(null); void laden(); }
    else setFehler(json?.error || "Die Absage hat nicht geklappt.");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <GlassNav />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">

        {/* ══════════════════════════════════════════════════════════════════
            DER GRUND ÜBERLEBT DAS NACHLADEN (19.08.2026)

            ── DER BEFUND (Browsertest aus Kundensicht) ────────────────────
            Nach einem abgelehnten Termin rief die Seite `laden()`. Das setzt
            `laedt = true`, und der Ladehinweis ersetzte die GANZE Seite —
            samt der eben gesetzten Fehlermeldung. Der Kunde sah für einen
            Wimpernschlag „Dieser Termin wurde gerade vergeben", dann „Freie
            Zeiten werden geladen …", dann eine frische Liste. Ohne jede
            Erklärung, warum sein Klick nichts bewirkt hat.

            Wer zweimal klickt und zweimal nichts erfährt, ruft an. Genau das
            hat Herr Hertel getan.

            Der Fehler steht deshalb ÜBER dem Ladehinweis und bleibt stehen,
            bis eine neue Zeit gewählt wird.
            ══════════════════════════════════════════════════════════════════ */}
        {fehler && !fertig && (
          <div className="mb-5 px-4 py-3.5 rounded-2xl"
               style={{ background: "rgba(180,83,9,.07)", border: "1px solid rgba(180,83,9,.3)" }}
               role="alert">
            <p className="text-[13.5px] leading-relaxed" style={{ color: "#92400e" }}>{fehler}</p>
            <p className="text-[12.5px] mt-1.5 text-slate-600">
              {T.andereZeit}
            </p>
          </div>
        )}

        {laedt && (
          <div className="text-center py-16" role="status" aria-live="polite">
            <p className="text-[14px] text-slate-500">Freie Zeiten werden geladen …</p>
          </div>
        )}

        {/* ── Nach der Buchung ─────────────────────────────────────────────── */}
        {!laedt && fertig && (
          <div className="text-center py-12" role="status" aria-live="polite">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Termin steht</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">
              <b className="text-slate-900">{fertig.datumText} um {fertig.uhrzeit} Uhr</b>.
              {" "}{T.bestaetigung}
            </p>
            {/* ── DER ANRUF-SATZ, HERVORGEHOBEN ────────────────────────────
                Er stand vorher mitten im Absatz („… ruft dich an. Du bekommst
                gleich …") — dort liest ihn niemand, der die Seite überfliegt.
                Wer einen Link erwartet, sucht nach einem Link und übersieht
                Fließtext. Deshalb steht der Satz jetzt allein, in einem Rahmen,
                mit dem Telefon-Zeichen davor. */}
            <div className="mt-4 mx-auto max-w-md flex items-start gap-2.5 text-left px-4 py-3 rounded-xl"
                 style={{ background: "rgba(29,78,216,.05)", boxShadow: "inset 0 0 0 1px rgba(29,78,216,.16)" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#1d4ed8" strokeWidth={1.5}
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                   style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M6.2 3.6c.7 0 1.3.5 1.5 1.2l.5 2a1.6 1.6 0 0 1-.5 1.6l-.9.8a9 9 0 0 0 4 4l.8-.9a1.6 1.6 0 0 1 1.6-.5l2 .5c.7.2 1.2.8 1.2 1.5v1.7c0 .9-.8 1.6-1.7 1.5C8.3 16.7 3.3 11.7 2.7 5.3c-.1-.9.6-1.7 1.5-1.7h2Z" />
              </svg>
              <span className="text-[13.5px] leading-relaxed" style={{ color: "#1e3a8a" }}>
                <b>{T.anruf(fertig.agentVorname)}</b>
                <br />
                <span style={{ color: "rgba(30,58,138,.72)" }}>{T.absageHinweis}</span>
              </span>
            </div>
          </div>
        )}

        {/* ── Es gibt schon einen Termin ───────────────────────────────────── */}
        {!laedt && !fertig && daten?.termin && (
          <div className="py-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">{T.bestehendTitel}</h1>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                <b className="text-slate-900">{daten.termin.datumText} um {daten.termin.uhrzeit} Uhr</b> mit {daten.termin.agentVorname}.
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 text-center">
              <p className="text-[13px] text-slate-600 mb-3">
                {T.bestehendNeu}
              </p>
              <button type="button" onClick={() => void absagen(daten.termin!.stornoToken)}
                      className={`px-4 py-2.5 rounded-xl text-[13px] font-bold border border-slate-300 bg-white hover:bg-slate-50 ${FOKUS}`}
                      style={{ minHeight: 44 }}>
                Termin absagen und neu wählen
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DER GROSSE FEHLERBLOCK — NUR NOCH, WENN ES KEINE LISTE GIBT

            Er stand vorher IMMER da, wenn ein Fehler gesetzt war. Zusammen mit
            dem Streifen oben stand der Grund damit ZWEIMAL auf einer Seite
            (gesehen im Screenshot der Abnahme). Zweimal derselbe Satz liest
            sich wie zwei Fehler.

            Jetzt: Gibt es Zeiten zur Auswahl, genügt der Streifen — der Kunde
            soll weiterklicken, nicht erschrecken. Gibt es KEINE (abgelaufener
            Link, kein Angebot), ist der große Block richtig: Dann ist der
            Fehler die ganze Nachricht.
            ══════════════════════════════════════════════════════════════════ */}
        {!laedt && fehler && !daten?.termin && !fertig && !(daten?.slots?.length) && (
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold tracking-tight mb-3">Das hat nicht geklappt</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">{fehler}</p>
          </div>
        )}

        {/* ── Die Auswahl ──────────────────────────────────────────────────── */}
        {!laedt && daten && !daten.termin && !fertig && (
          <>
            <div className="text-center mb-8">
              {/* ── SIE-FASSUNG: DER NAME DES BETREUERS FÜHRT (24.09.2026) ──
                  „Anna, wann passt es Ihnen?" mischt Vornamen und Sie — das
                  liest sich wie ein Serienbrief. In der Sie-Fassung steht
                  deshalb der Mensch vorn, der anrufen wird: „Ihr Rückruf mit
                  Nikita". Gibt es keinen festen Betreuer (Zeiten aus dem
                  Team), bleibt die Frage ohne Namen. */}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 leading-tight">
                {sie
                  ? (daten.betreuer && rufname(daten.betreuer.vorname)
                      ? `Ihr Rückruf mit ${rufname(daten.betreuer.vorname)}`
                      : "Wann passt es Ihnen?")
                  : (daten.vorname ? `${daten.vorname}, wann passt es dir?` : "Wann passt es dir?")}
              </h1>
              {sie ? (
                <p className="text-[14px] text-slate-500 leading-relaxed">
                  Wählen Sie eine Zeit für ein {daten.slotMinuten}-minütiges Gespräch mit
                  {" "}{daten.betreuer
                    ? <b className="text-slate-900">{daten.betreuer.vorname}, Ihrem persönlichen Ansprechpartner</b>
                    : <b className="text-slate-900">Ihrem persönlichen Ansprechpartner</b>}.
                </p>
              ) : (
                <p className="text-[14px] text-slate-500 leading-relaxed">
                  Wähl eine Zeit für ein {daten.slotMinuten}-minütiges Gespräch mit
                  {" "}{daten.betreuer
                    ? <b className="text-slate-900">{daten.betreuer.vorname}, deinem persönlichen Ansprechpartner</b>
                    : <b className="text-slate-900">deinem persönlichen Ansprechpartner</b>}.
                </p>
              )}
              {/* ── DER ANRUF-SATZ, VOR DER WAHL ─────────────────────────────
                  Hier stand „Wir rufen dich zur gewählten Zeit an." am Ende des
                  Absatzes. Richtig, aber zu leise: Wer einen Link erwartet,
                  liest den Absatz nicht bis zum Punkt, sondern sucht nach einer
                  Adresse. Der Satz steht jetzt in einer eigenen Zeile, mit dem
                  Telefon-Zeichen — und er nennt ausdrücklich „halte dein
                  Telefon bereit", weil das die Handlung ist, die zählt. */}
              <p className="mt-3 flex items-start justify-center gap-2 text-[13px] font-semibold"
                 style={{ color: "#1e3a8a" }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                     strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                     style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M6.2 3.6c.7 0 1.3.5 1.5 1.2l.5 2a1.6 1.6 0 0 1-.5 1.6l-.9.8a9 9 0 0 0 4 4l.8-.9a1.6 1.6 0 0 1 1.6-.5l2 .5c.7.2 1.2.8 1.2 1.5v1.7c0 .9-.8 1.6-1.7 1.5C8.3 16.7 3.3 11.7 2.7 5.3c-.1-.9.6-1.7 1.5-1.7h2Z" />
                </svg>
                <span>{T.anruf(daten.betreuer?.vorname)}</span>
              </p>
            </div>

            {tage.length === 0 && (
              <div className="p-6 rounded-2xl border border-slate-200 text-center">
                <p className="text-[14px] font-semibold text-slate-900">Gerade sind keine Zeiten frei.</p>
                <p className="text-[13px] text-slate-500 mt-1.5">
                  {T.keineZeiten}
                </p>
              </div>
            )}

            {/* ── DIE LÜCKEN, IM KLARTEXT ────────────────────────────────
                „Nie eine leere Fläche ohne Erklärung." Tage ohne Zeiten werden
                nicht gezeichnet — dieser Satz sagt, dass das Absicht ist. */}
            {luecken && (
              <p className="text-[12.5px] text-slate-500 mb-4 text-center leading-relaxed">
                An diesen Tagen ist nichts mehr frei: {luecken.text}.
                {luecken.naechster && <> Der nächste freie Tag ist <b>{luecken.naechster}</b>.</>}
              </p>
            )}

            <div className="space-y-6">
              {tage.slice(0, tageOffen).map(({ datum, slots }) => (
                <div key={datum}>
                  <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    {tagUeberschrift(datum)}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((s) => {
                      const an = gewaehlt?.beginn === s.beginn && gewaehlt?.agentId === s.agentId;
                      return (
                        <button key={`${s.agentId}-${s.beginn}`} type="button"
                                onClick={() => { setFehler(null); setGewaehlt(an ? null : s); }}
                                aria-pressed={an}
                                aria-label={`${tagUeberschrift(datum)}, ${s.uhrzeit} Uhr`}
                                className={`rounded-xl text-[14px] font-semibold transition-all ${FOKUS} ${
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
            </div>

            {tage.length > tageOffen && (
              <button type="button" onClick={() => setTageOffen((n) => n + 4)}
                      className={`w-full mt-5 rounded-xl text-[13.5px] font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 ${FOKUS}`}
                      style={{ minHeight: 46 }}>
                Weitere Tage anzeigen ({tage.length - tageOffen} noch)
              </button>
            )}

            {gewaehlt && (
              <div className="sticky bottom-4 mt-8">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <p className="text-[13px] text-slate-600 mb-3">
                    <b className="text-slate-900">{tagUeberschrift(gewaehlt.datum)}, {gewaehlt.uhrzeit} Uhr</b>
                    {" "}— {T.anrufKurz(gewaehlt.agentVorname)}
                  </p>
                  <button type="button" onClick={() => void buchen()} disabled={bucht}
                          className={`w-full rounded-xl text-[15px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-60 ${FOKUS}`}
                          style={{ minHeight: 50 }}>
                    {bucht ? "Wird gebucht …" : "Termin verbindlich wählen"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <PremiumFooter />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// /termin/absagen/:stornoToken — der Link aus der Bestätigungsmail
//
// 17.09.2026 (E-188): Die Seite duzt — sie wurde für Privatkunden gebaut. Die
// Bestätigung des Erstgesprächs zu FIAON Global hängt deshalb ?anrede=sie an
// den Storno-Link: Ein Unternehmen liest hier die Sie-Fassung. Wohin „neu
// wählen" führt, sagt weiter der Server (bei FIAON Global: /business#gespraech).
// ═══════════════════════════════════════════════════════════════════════════
export function TerminAbsagenPage() {
  const [, params] = useRoute("/termin/absagen/:stornoToken");
  const token = params?.stornoToken || "";
  const sie = anredeAusAdresse() === "sie";
  const [stand, setStand] = useState<"frage" | "laeuft" | "weg" | "fehler">("frage");
  const [neuBuchen, setNeuBuchen] = useState<string | null>(null);
  const [fehler, setFehler] = useState("");

  const absagen = async () => {
    setStand("laeuft");
    // 24.09.2026 (E-236): Die Anrede geht mit — der Server hängt sie dann an
    // den Link „Neuen Termin wählen", und wer gesiezt absagt, wählt gesiezt neu.
    const res = await fetch(`/api/fiaon/termin/absagen/${encodeURIComponent(token)}${sie ? "?anrede=sie" : ""}`,
      { method: "POST" })
      .catch(() => null);
    const json = await res?.json().catch(() => null);
    if (json?.ok) { setNeuBuchen(json.neuBuchen || null); setStand("weg"); }
    else { setFehler(json?.error || "Die Absage hat nicht geklappt."); setStand("fehler"); }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <GlassNav />
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16 text-center">
        {stand === "weg" ? (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Termin abgesagt</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed">
              {sie ? "Die Zeit ist wieder frei. Wenn Sie möchten, wählen Sie gleich eine neue."
                   : "Die Zeit ist wieder frei. Wenn du möchtest, wähl gleich eine neue."}
            </p>
            {neuBuchen && (
              <a href={neuBuchen}
                 className={`inline-block mt-6 px-5 py-3 rounded-xl text-[14px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af] ${FOKUS}`}
                 style={{ minHeight: 46 }}>
                Neuen Termin wählen
              </a>
            )}
          </>
        ) : stand === "fehler" ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-3">Das hat nicht geklappt</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed">{fehler}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Termin absagen?</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed mb-6">
              {sie ? "Das Gespräch findet dann nicht statt. Sie können danach jederzeit eine neue Zeit wählen."
                   : "Dein Ansprechpartner ruft dich dann nicht an. Du kannst danach jederzeit eine neue Zeit wählen."}
            </p>
            <button type="button" onClick={() => void absagen()} disabled={stand === "laeuft"}
                    className={`px-5 py-3 rounded-xl text-[14px] font-bold border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 ${FOKUS}`}
                    style={{ minHeight: 46 }}>
              {stand === "laeuft" ? "Wird abgesagt …" : "Ja, Termin absagen"}
            </button>
          </>
        )}
      </div>
      <PremiumFooter />
    </div>
  );
}
