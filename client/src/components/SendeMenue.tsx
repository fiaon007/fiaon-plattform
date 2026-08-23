import { useCallback, useEffect, useMemo, useState } from "react";
import { FiaonEbene } from "./FiaonEbene";

// ═══════════════════════════════════════════════════════════════════════════
// „E-MAIL SENDEN" — ein Menü, zwei Geräte
//
// Auf dem Bildschirm eine schwebende Glas-Ebene, auf dem Telefon ein Blatt von
// unten. Nicht aus Geschmack: Ein zentriertes Fenster auf 380 px lässt für den
// Inhalt 300 px übrig, und das Sende-Menü hat je Ereignis drei Zeilen Text.
//
// Was hier steht, kommt vollständig vom Server (Registry + Zustandsprüfung).
// Die Seite entscheidet nichts selbst — sonst gäbe es zwei Wahrheiten darüber,
// ob eine Mail rausgehen darf, und die im Browser wäre die falsche.
// ═══════════════════════════════════════════════════════════════════════════

interface EventZeile {
  type: string;
  label: string;
  gruppe: string;
  klartext: string;
  verifikation: "bestaetigt" | "nicht_bestaetigt" | "ungeprueft";
  verifikationsText: string;
  hatVorlage: boolean;
  erlaubt: boolean;
  grund: string | null;
  heute: number;
}

interface HistorieZeile {
  id: number; event: string; titel: string; status: string; grund: string | null;
  am: string; ausgeloestVon: string; zustellung?: string | null;
}

const GRUPPEN: { schluessel: string; titel: string }[] = [
  { schluessel: "zahlung", titel: "Zahlung" },
  { schluessel: "termin", titel: "Termin" },
  { schluessel: "konto", titel: "Konto" },
  { schluessel: "dokumente", titel: "Dokumente" },
  { schluessel: "lead", titel: "Lead" },
];

/** Briefumschlag — 20×20, 1,5 px, currentColor. Wie alle Zeichen im Haus. */
export function MarkeBrief({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="m3 6 6.3 4.6c.4.3 1 .3 1.4 0L17 6" />
    </svg>
  );
}

// E-052: VORHER eine Farbwahl für alle — NACHHER trägt die dunkle Fassung
// (ton="dunkel") kräftigere Chips: sendbar grün, gesperrt GELB (im dunklen
// Glas ist Grau nicht mehr von „aus“ zu unterscheiden). Hell bleibt wie es war.
function Ampel({ e, dunkel }: { e: EventZeile; dunkel?: boolean }) {
  const farbe = e.erlaubt ? (dunkel ? "#34d399" : "#059669") : (dunkel ? "#fcd34d" : "#94a3b8");
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0" title={e.erlaubt ? "sendbar" : (e.grund || "")}
          style={dunkel ? { padding: "4px 9px", borderRadius: 999, background: e.erlaubt ? "rgba(16,185,129,.14)" : "rgba(217,119,6,.14)" } : undefined}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: farbe }} />
      <span className="text-[11px] font-semibold" style={{ color: farbe }}>
        {e.erlaubt ? "sendbar" : "gesperrt"}
      </span>
    </span>
  );
}

// E-052 (Justin 24.08., Screenshot Akte → E-Mails → „E-Mail senden“): VORHER
// öffnete sich im dunklen Office das alte HELLE Versandzentrum — NACHHER wählt
// `ton="dunkel"` die Office-Glas-Fassung (FiaonEbene ton="dunkel", dunkle
// Karten über die --fi-Variablen, Status-Chips in Dunkel-Farben). Die gesamte
// Logik (Zweige, Sperrgründe, GET/POST über `basis`, Bestätigung, Vorschau)
// ist unverändert; helle Alt-Nutzungen (Admin, kunden-neu, collections)
// bleiben ohne den Prop exakt wie vorher.
export function SendeMenue({
  personId, basis = "/api/fiaon/agent/mail", offen, onSchliessen, onGesendet, ton = "hell",
}: {
  personId: number;
  basis?: string;
  offen: boolean;
  onSchliessen: () => void;
  onGesendet?: () => void;
  ton?: "hell" | "dunkel";
}) {
  const dunkel = ton === "dunkel";
  const [daten, setDaten] = useState<{ events: EventZeile[]; historie: HistorieZeile[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  // ══════════════════════════════════════════════════════════════════════════
  // EIN FEHLER MUSS SICHTBAR WERDEN
  //
  // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────────
  // Der Vorgesetzte: „Wenn der Inkasso-Mitarbeiter auf ‚senden' klickt, öffnet
  // sich das E-Mail-PopUp … und es geht nicht!"
  //
  // Es stand ewig „Wird geladen …". Der Server hatte längst geantwortet — mit
  // HTTP 403, weil `rolleVon` in fiaon-mail.ts die Rolle „inkasso" zu „agent"
  // umdeutete.
  //
  // Hier stand nur `if (j?.ok) setDaten(…)`. Ohne `else` blieb `daten` auf
  // null, und das Fenster zeigte für immer den Ladehinweis.
  //
  // Ein verschluckter Fehler ist schlimmer als ein sichtbarer: Der Mensch
  // wartet, versucht es nochmal, wartet wieder — und meldet am Ende „geht
  // nicht", ohne dass jemand weiß, woran es lag.
  // ══════════════════════════════════════════════════════════════════════════
  const laden = useCallback(async () => {
    setLadeFehler(null);
    const r = await fetch(`${basis}/${personId}`, { credentials: "include" }).catch(() => null);
    if (!r) { setLadeFehler("Keine Verbindung zum Server. Bitte noch einmal versuchen."); return; }
    const j = await r.json().catch(() => null);
    if (j?.ok) { setDaten({ events: j.events || [], historie: j.historie || [] }); return; }
    setLadeFehler(
      j?.error
        ? `${j.error} (Antwort ${r.status})`
        : `Der Server antwortete mit ${r.status}. Bitte den Vorgesetzten informieren.`,
    );
  }, [basis, personId]);

  useEffect(() => { if (offen) void laden(); }, [offen, laden]);

  // Esc schließt. Ein Menü, das nur über einen kleinen Knopf zu schließen ist,
  // fühlt sich auf dem Bildschirm wie eine Falle an.
  useEffect(() => {
    if (!offen) return;
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") onSchliessen(); };
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [offen, onSchliessen]);

  const nachGruppe = useMemo(() => {
    const m = new Map<string, EventZeile[]>();
    for (const e of daten?.events || []) m.set(e.gruppe, [...(m.get(e.gruppe) || []), e]);
    return m;
  }, [daten]);

  const senden = async (e: EventZeile) => {
    if (!confirm(`„${e.label}" jetzt an den Kunden schicken?`)) return;
    setBusy(e.type);
    const r = await fetch(`${basis}/${personId}/${e.type}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: "{}",
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Unbekannter Fehler." });
    void laden();
    onGesendet?.();
  };

  if (!offen) return null;

  const inhalt = (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          KEIN EIGENER KOPF MEHR

          ── DER BEFUND (11.08.2026) ────────────────────────────────────────
          Der Vorgesetzte: „Wenn man E-Mail senden drückt, sieht man das Menü,
          das sich öffnet, nicht richtig!"

          Im Schnappschuss stand „AN DIESEN KUNDEN / E-Mail senden" ZWEIMAL,
          versetzt übereinander — mit zwei Schließen-Kreuzen.

          Der Grund: Hier stand ein eigener Kopfbereich mit Überschrift, Titel
          und Schließen-Knopf. Gleichzeitig bekommt `FiaonEbene` `titel` und
          `ueberschrift` übergeben und zeichnet daraus IHREN Kopf. Zwei Köpfe
          in einem Fenster.

          Der Fehler entstand, als die Ebene später einen eigenen Kopf
          bekam — und niemand den alten entfernte. Ein Bauteil, das seine
          Aufgabe übernimmt, muss die alte Stelle mitnehmen; sonst sieht man
          beides.
          ══════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════
          KEIN ZWEITER SCROLL-KASTEN

          ── DER BEFUND (11.08.2026) ────────────────────────────────────────
          Der Vorgesetzte: „Es sieht schrecklich aus vom Design, es schneidet
          oben und unten alles ab."

          Hier stand `flex-1 overflow-y-auto`. Der Elternknoten der Ebene
          (.fi-ebene-koerper) hat aber bereits `flex: 1 1 auto; min-height: 0;
          overflow-y: auto` — und ER ist der Kasten mit Höhenbegrenzung.

          Ein zweiter Scroll-Container darin hat keine eigene Höhe: `flex-1`
          wirkt nur in einem Flex-Elternteil, den es hier nicht gibt. Also
          wuchs er ungebremst, und der Inhalt lief unten aus dem Fenster
          heraus — im Schnappschuss schwebte ein „Senden"-Knopf über der
          Kundenliste.

          Das eigene Innenmaß bleibt: Die Ebene bringt ihres mit, aber die
          Kacheln brauchen etwas mehr Luft an den Seiten.
          ══════════════════════════════════════════════════════════════════ */}
      <div className="px-0.5 sm:px-1.5">
        {/* E-052: Meldungs- und Fehlerflächen in der Dunkel-Fassung mit
            lesbaren Dunkel-Farben — hell unverändert. */}
        {meldung && (
          <p className="mb-3 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold"
             style={meldung.art === "gut"
               ? (dunkel ? { background: "rgba(16,185,129,.14)", color: "#a7f3d0" } : { background: "rgba(5,150,105,.08)", color: "#047857" })
               : (dunkel ? { background: "rgba(217,119,6,.16)", color: "#fde68a" } : { background: "rgba(217,119,6,.08)", color: "#b45309" })}>
            {meldung.text}
          </p>
        )}

        {ladeFehler && (
          <div className="px-3.5 py-3 rounded-xl mb-3"
               style={dunkel ? { background: "rgba(217,119,6,.16)", color: "#fde68a" } : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            <p className="text-[12.5px] font-semibold leading-relaxed">{ladeFehler}</p>
            <button type="button" onClick={() => void laden()}
                    className="mt-2 text-[12px] font-bold underline">
              Noch einmal versuchen
            </button>
          </div>
        )}
        {!daten && !ladeFehler && (
          <p className="text-[13px]" style={{ color: "var(--fi-text-still)" }}>Wird geladen …</p>
        )}

        {daten && GRUPPEN.filter((g) => nachGruppe.has(g.schluessel)).map((g) => (
          <div key={g.schluessel} className="mb-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] mb-2"
               style={{ color: "var(--fi-text-still)" }}>{g.titel}</p>
            <div className="space-y-2">
              {(nachGruppe.get(g.schluessel) || []).map((e) => (
                <div key={e.type} className="fi-karte p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold leading-tight">{e.label}</p>
                      <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                        {e.klartext}
                      </p>
                    </div>
                    <Ampel e={e} />
                  </div>

                  {/* Der Grund im Klartext — nicht als Wolke am Mauszeiger,
                      die auf dem Telefon niemand sieht. */}
                  {!e.erlaubt && e.grund && (
                    <p className="mt-2 text-[11.5px] leading-snug" style={{ color: "var(--fi-text-still)" }}>
                      {e.grund}
                    </p>
                  )}

                  <div className="mt-2.5 pt-2.5 flex flex-wrap items-center gap-2"
                       style={{ borderTop: "1px solid var(--fi-linie)" }}>
                    <span className="text-[10.5px] font-semibold" title={e.verifikationsText}
                          style={{ color: e.verifikation === "bestaetigt" ? "#059669" : "var(--fi-text-still)" }}>
                      {e.verifikation === "bestaetigt" ? "Zweig bestätigt"
                        : e.verifikation === "nicht_bestaetigt" ? "Zweig nicht bestätigt"
                        : "Zweig ungeprüft"}
                    </span>
                    {e.hatVorlage && (
                      <button type="button" onClick={() => setVorschau(e.type)}
                              className="text-[11.5px] font-semibold" style={{ color: "var(--fi-primaer)" }}>
                        Vorschau
                      </button>
                    )}
                    <button type="button" onClick={() => void senden(e)} disabled={!e.erlaubt || busy === e.type}
                            className="fi-primaerknopf ml-auto px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-40">
                      {busy === e.type ? "…" : "Senden"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {daten && daten.historie.length > 0 && (
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] mb-2"
               style={{ color: "var(--fi-text-still)" }}>Was schon rausging</p>
            {daten.historie.slice(0, 10).map((h) => (
              <div key={h.id} className="py-1.5 text-[12px] flex flex-wrap items-baseline gap-x-2"
                   style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                <span className="font-semibold">{h.titel}</span>
                <span style={{ color: h.status === "versandt" ? "#059669" : "#b45309" }}>
                  {h.zustellung
                    ? h.zustellung
                    : h.status === "versandt" ? "angenommen" : h.status === "uebersprungen" ? "übersprungen" : "fehlgeschlagen"}
                </span>
                <span style={{ color: "var(--fi-text-still)" }}>
                  {new Date(h.am).toLocaleString("de-DE", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
                  })} · {h.ausgeloestVon}
                </span>
                {h.grund && <span className="block w-full text-[11px]" style={{ color: "var(--fi-text-still)" }}>{h.grund}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Auf der FiaonEbene: Glas-Schleier statt schwarzem Vorhang, Eintritt
          aus der Tiefe, Glas nur auf Kopf und Fuß. Vorher ein weißer Kasten
          auf `rgba(7,11,22,.5)` — der Standardlook, den der Vorgesetzte zu
          Recht abgelehnt hat. */}
      <FiaonEbene
        offen={offen} onZu={onSchliessen}
        titel="E-Mail senden"
        ueberschrift="An diesen Kunden"
        marke={<MarkeBrief size={17} />}
        breite={580}
        kinder={inhalt}
      />
      {vorschau && <MailVorschau event={vorschau} onZu={() => setVorschau(null)} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE-VORSCHAU — „wie sieht die Mail aus?"
//
// Das echte Vorlagen-HTML aus Brevo, mit den Beispielwerten der Registry
// gefüllt. In einem abgeschotteten iframe: Vorlagen enthalten fremdes HTML,
// und das hat im Seitenkontext nichts verloren.
//
// Der Geräterahmen ist kein schmaler Kasten, sondern ein Rahmen mit Radius,
// Rand und Kerbe. Wer beurteilen soll, ob eine Mail auf dem Telefon gut
// aussieht, braucht den Eindruck eines Telefons.
// ═══════════════════════════════════════════════════════════════════════════
export function MailVorschau({ event, onZu }: { event: string; onZu: () => void }) {
  const [daten, setDaten] = useState<{ html: string | null; betreff?: string; grund?: string } | null>(null);
  const [geraet, setGeraet] = useState<"desktop" | "handy">("desktop");

  useEffect(() => {
    fetch(`/api/fiaon/admin/mail/vorschau/${encodeURIComponent(event)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setDaten(j?.ok ? j : { html: null, grund: j?.error || "Vorschau nicht ladbar." }))
      .catch(() => setDaten({ html: null, grund: "Vorschau nicht ladbar." }));
  }, [event]);

  return (
    <FiaonEbene
      offen onZu={onZu}
      titel={daten?.betreff || event}
      ueberschrift="So sieht der Kunde sie"
      breite={800}
      kopf={
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="fi-ebene-ueberschrift">So sieht der Kunde sie</p>
            <h2 className="fi-ebene-titel" style={{ overflowWrap: "anywhere" }}>
              {daten?.betreff || event}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(["desktop", "handy"] as const).map((g) => (
              <button key={g} type="button" onClick={() => setGeraet(g)}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-semibold"
                      style={geraet === g
                        ? { background: "var(--fi-primaer)", color: "#fff" }
                        : { background: "rgba(15,23,42,.05)", color: "var(--fi-text-leise)" }}>
                {g === "desktop" ? "Bildschirm" : "Telefon"}
              </button>
            ))}
            <button type="button" onClick={onZu} aria-label="Schließen" className="fi-ebene-kreuz">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                   strokeWidth={1.6} strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </button>
          </div>
        </div>
      }
      kinder={<VorschauInhalt daten={daten} geraet={geraet} />}
    />
  );
}

/**
 * Der Inhalt der Vorschau: das echte Vorlagen-HTML in einem abgeschotteten
 * iframe. Vorlagen enthalten fremdes HTML — ohne `sandbox` könnte darin
 * Skriptcode laufen, der die Verwaltung mitliest.
 */
function VorschauInhalt({ daten, geraet }: { daten: any; geraet: "desktop" | "handy" }) {
  if (!daten) {
    return <p className="text-[13px]" style={{ color: "var(--fi-text-still)" }}>Wird geladen …</p>;
  }
  if (!daten.html) {
    return (
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
        {daten.grund || "Für dieses Ereignis liegt keine Vorlage vor."}
      </p>
    );
  }
  return (
    <div style={{
      margin: "0 auto",
      maxWidth: geraet === "handy" ? 390 : "100%",
      // Die Telefonansicht bekommt eine angedeutete Gerätekante — sonst sieht
      // eine schmale Spalte einfach nach kaputtem Layout aus.
      borderRadius: geraet === "handy" ? 20 : 14,
      overflow: "hidden",
      boxShadow: geraet === "handy"
        ? "0 22px 50px -24px rgba(11,18,38,.5), inset 0 0 0 1px rgba(15,23,42,.09)"
        : "inset 0 0 0 1px rgba(15,23,42,.07)",
      transition: "max-width 320ms cubic-bezier(.32,.72,0,1)",
    }}>
      <iframe
        title="Mail-Vorschau"
        srcDoc={daten.html}
        sandbox=""
        style={{ width: "100%", height: geraet === "handy" ? 620 : 560, border: 0, background: "#fff" }}
      />
    </div>
  );
}
