// ═══════════════════════════════════════════════════════════════════════════
// KUNDEN ANLEGEN UND ABSCHLIESSEN — IN EINEM ZUG
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// „JEDER Agent kann einen Kunden komplett anlegen und pflegen — bis zu dem
// Punkt, an dem der Kunde zahlen kann." Und der Fluss endet mit dem Termin.
//
// ── WARUM EIN FLUSS UND KEIN FORMULAR ──────────────────────────────────────
// Der Agent hat den Menschen am TELEFON. Er kann nicht sagen „einen Moment, ich
// wechsle die Seite" — viermal. Deshalb: ein Feld nach dem anderen, und nach
// dem Anlegen bleibt derselbe Dialog offen und zeigt die drei nächsten
// Schritte:
//
//   1. Zahlungsdaten senden   (Mail mit Verwendungszweck und Rechnung)
//   2. Zahlungsdaten kopieren (für WhatsApp — der Agent liest sie oft vor)
//   3. Termin anbieten        (Link senden oder kopieren)
//
// GEMESSEN am 24.08.2026: Alle 120 gebuchten Termine stammen aus einem
// verschickten Link. Der Hebel funktioniert — er wurde am Telefon nur nie
// angeboten.
//
// ── DER DUBLETTEN-CHECK LÄUFT WÄHREND DES TIPPENS ──────────────────────────
// Nicht erst beim Speichern: Wer den Namen schon eingetippt hat und dann hört
// „gibt es bereits", hat umsonst gearbeitet. Der Hinweis erscheint, sobald
// E-Mail oder Nummer vollständig sind.
//
// ── PREISE ─────────────────────────────────────────────────────────────────
// Kommen aus `/agent/katalog`, also aus `shared/fiaon-pakete.ts`. Diese Datei
// hat KEINE eigene Preisliste — eine zweite Liste war der Grund, warum
// Ultra-Kunden für 79,99 kauften und 99,99 in Rechnung bekamen.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { LABEL_VERTRIEB } from "@shared/fiaon-zustaendigkeit-text";

interface Paket {
  key: string; label: string; preisEuro: number;
  art: "privat" | "business"; abo: boolean;
}

interface Treffer {
  personId: number; name: string; ref: string | null;
  email: string | null; phone: string | null; treffer: string;
  bezahlt: boolean; agentName: string | null;
}

const euro = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

async function ruf(pfad: string, koerper?: unknown): Promise<any> {
  const r = await fetch(`/api/fiaon${pfad}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(koerper ?? {}),
  }).catch(() => null);
  return (await r?.json().catch(() => null)) ?? { ok: false, error: "Nicht erreichbar." };
}

export function KundeAnlegen({ offen, aufKlappen, fertig }: {
  offen: boolean;
  aufKlappen: (v: boolean) => void;
  /** Wird nach erfolgreicher Anlage gerufen, damit die Liste neu lädt. */
  fertig?: (ref: string) => void;
}) {
  const [pakete, setPakete] = useState<Paket[]>([]);
  const [f, setF] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    street: "", zip: "", city: "", birthdate: "", packKey: "",
  });
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  /** Nach dem Anlegen: der Abschluss-Bereich. */
  const [erfolg, setErfolg] = useState<any>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [terminLink, setTerminLink] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  // ── DER KATALOG ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!offen || pakete.length > 0) return;
    void fetch("/api/fiaon/agent/katalog", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setPakete(j.pakete ?? []); })
      .catch(() => {});
  }, [offen, pakete.length]);

  // ── DER DUBLETTEN-CHECK WÄHREND DES TIPPENS ─────────────────────────────
  // Mit Verzögerung: Ohne sie schickt jeder Tastendruck eine Abfrage, und bei
  // „max@muster.de" wären das 13.
  useEffect(() => {
    const mailFertig = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim());
    const nummerFertig = f.phone.replace(/[^\d]/g, "").length >= 9;
    if (!mailFertig && !nummerFertig) { setTreffer([]); return; }
    const t = setTimeout(() => {
      void ruf("/agent/kunden/pruefen", { email: f.email, phone: f.phone })
        .then((j) => setTreffer(j?.ok ? (j.treffer ?? []) : []));
    }, 450);
    return () => clearTimeout(t);
  }, [f.email, f.phone]);

  const anlegen = async () => {
    setLaeuft(true);
    setFehler(null);
    const j = await ruf("/agent/kunden/neu", f);
    setLaeuft(false);
    if (!j?.ok) {
      setFehler(String(j?.error ?? "Unbekannter Fehler"));
      // Bei 409 kommen Kandidaten mit — sie gehören in die Anzeige.
      if (j?.vorschlag) setTreffer([j.vorschlag]);
      if (Array.isArray(j?.kandidaten)) setTreffer(j.kandidaten);
      return;
    }
    setErfolg(j);
    fertig?.(String(j.ref));
  };

  const kopieren = async (text: string, was: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setKopiert(was);
    setTimeout(() => setKopiert((k) => (k === was ? null : k)), 1600);
  };

  const zuruecksetzen = () => {
    setF({ firstName: "", lastName: "", email: "", phone: "",
           street: "", zip: "", city: "", birthdate: "", packKey: "" });
    setTreffer([]); setFehler(null); setErfolg(null);
    setTerminLink(null); setMeldung(null);
  };

  if (!offen) {
    return (
      <button type="button" onClick={() => aufKlappen(true)}
              className="px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold"
              style={{ background: "#1d4ed8", minHeight: 44 }}>
        + Kunde anlegen
      </button>
    );
  }

  const feld = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] "
    + "focus:outline-none focus:ring-2 focus:ring-blue-100";
  const gewaehlt = pakete.find((p) => p.key === f.packKey);
  const kannAnlegen = f.firstName.trim() && f.lastName.trim()
    && (f.email.trim() || f.phone.trim()) && !laeuft;

  return (
    /* `data-fiaon="kunde-anlegen"`: Der Browsertest muss IN diesem Bauteil
       suchen können. Ohne Kennzeichen traf `locator("select").first()` die
       Sortier-Auswahl der Seite und `getByPlaceholder("E-Mail")` zusätzlich das
       Suchfeld — zwei Fehlalarme, die wie Fehler aussahen. (Dieselbe Lehre wie
       am 20.08.2026: Wer eine Tafel prüft, misst IN der Tafel.) */
    <div data-fiaon="kunde-anlegen"
         className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[14px] font-bold text-slate-900">
            {erfolg ? "Kunde angelegt — und jetzt?" : "Kunde anlegen"}
          </h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {erfolg
              ? "Der Kunde steht auf „Zahlung offen“. Diese drei Schritte schließen das Gespräch ab."
              : "Vor- und Nachname, dazu E-Mail oder Telefon. Das Paket kannst du auch später wählen."}
          </p>
        </div>
        <button type="button" onClick={() => { zuruecksetzen(); aufKlappen(false); }}
                className="text-[12px] font-semibold text-slate-400 shrink-0"
                style={{ minHeight: 44, minWidth: 44 }}>
          Schließen
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          NACH DEM ANLEGEN: DIE DREI SCHRITTE
          ══════════════════════════════════════════════════════════════════ */}
      {erfolg ? (
        <div className="space-y-3">
          <div className="px-3.5 py-3 rounded-xl"
               style={{ background: "rgba(5,150,105,.08)", boxShadow: "inset 0 0 0 1px rgba(5,150,105,.22)" }}>
            <p className="text-[13px] font-bold" style={{ color: "#047857" }}>
              {erfolg.name} ist angelegt
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "#065f46" }}>
              {erfolg.paket
                ? `${erfolg.paket.label} · ${euro(erfolg.paket.preisEuro)} · Verwendungszweck ${erfolg.zahlungsreferenz}`
                : "Noch kein Paket — du kannst es in der Akte hinzufügen."}
            </p>
          </div>

          {meldung && (
            <p className="px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
               style={{ background: "rgba(29,78,216,.08)", color: "#1e40af" }}>
              {meldung}
            </p>
          )}

          {/* ── 1. ZAHLUNGSDATEN ──────────────────────────────────────────── */}
          {erfolg.zahlungsreferenz && (
            <div className="px-3.5 py-3 rounded-xl" style={{ background: "rgba(15,23,42,.035)" }}>
              <p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">
                1 · Zahlungsdaten
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={laeuft}
                        onClick={async () => {
                          setLaeuft(true);
                          const j = await ruf(`/agent/customers/${encodeURIComponent(erfolg.ref)}/send-payment-email`);
                          setLaeuft(false);
                          setMeldung(j?.ok
                            ? "Zahlungsdaten sind unterwegs."
                            : `Die Mail ging nicht raus: ${j?.error ?? "unbekannt"}`);
                        }}
                        className="px-4 py-2.5 rounded-xl text-white text-[12.5px] font-semibold"
                        style={{ background: "#1d4ed8", minHeight: 44 }}>
                  Zahlungsdaten senden
                </button>
                {/* ── DER WHATSAPP-WEG ────────────────────────────────────
                    Viele Kunden bekommen die Daten über WhatsApp, weil sie am
                    Telefon mitschreiben wollen. Ohne diesen Knopf tippt der
                    Agent den Verwendungszweck ab — und vertippt sich. */}
                <button type="button"
                        onClick={() => kopieren(
                          `FIAON — Zahlungsdaten\n`
                          + `Verwendungszweck: ${erfolg.zahlungsreferenz}\n`
                          + (erfolg.paket ? `Betrag: ${euro(erfolg.paket.preisEuro)}\n` : "")
                          + `Rechnung: ${window.location.origin}${erfolg.weiter?.rechnung ?? ""}`,
                          "zahlung")}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-[12.5px] font-semibold text-slate-700"
                        style={{ minHeight: 44 }}>
                  {kopiert === "zahlung" ? "Kopiert" : "Zahlungsdaten kopieren"}
                </button>
                {erfolg.weiter?.rechnung && (
                  <a href={erfolg.weiter.rechnung} target="_blank" rel="noreferrer"
                     className="px-4 py-2.5 rounded-xl border border-slate-200 text-[12.5px] font-semibold text-slate-700 no-underline inline-flex items-center"
                     style={{ minHeight: 44 }}>
                    Rechnung (PDF)
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── 2. TERMIN ─────────────────────────────────────────────────── */}
          <div className="px-3.5 py-3 rounded-xl" style={{ background: "rgba(15,23,42,.035)" }}>
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">
              2 · Termin anbieten
            </p>
            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
              Alle 120 gebuchten Termine kamen aus einem verschickten Link. Wer
              jetzt einen bekommt, bucht — später erreicht ihn niemand mehr.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={laeuft}
                      onClick={async () => {
                        setLaeuft(true);
                        const j = await ruf(`/agent/customers/${encodeURIComponent(erfolg.ref)}/termin-anbieten`,
                          { senden: true });
                        setLaeuft(false);
                        if (j?.link) setTerminLink(String(j.link));
                        setMeldung(j?.ok
                          ? `Terminlink ist unterwegs${j.an ? ` an ${j.an}` : ""}.`
                          : `${j?.error ?? "Der Versand ging nicht."}`);
                      }}
                      className="px-4 py-2.5 rounded-xl text-white text-[12.5px] font-semibold"
                      style={{ background: "#1d4ed8", minHeight: 44 }}>
                Terminlink senden
              </button>
              <button type="button" disabled={laeuft}
                      onClick={async () => {
                        const j = await ruf(`/agent/customers/${encodeURIComponent(erfolg.ref)}/termin-anbieten`,
                          { senden: false });
                        if (j?.link) {
                          setTerminLink(String(j.link));
                          await kopieren(String(j.link), "termin");
                        } else {
                          setMeldung(String(j?.error ?? "Kein Link verfügbar."));
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-[12.5px] font-semibold text-slate-700"
                      style={{ minHeight: 44 }}>
                {kopiert === "termin" ? "Kopiert" : "Terminlink kopieren"}
              </button>
            </div>
            {terminLink && (
              <p className="mt-2 text-[11px] font-mono text-slate-400 break-all">{terminLink}</p>
            )}
          </div>

          {/* ── 3. WEITER ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={erfolg.weiter?.akte ?? "#"}
               className="px-4 py-2.5 rounded-xl border border-slate-200 text-[12.5px] font-semibold text-slate-700 no-underline inline-flex items-center"
               style={{ minHeight: 44 }}>
              Zur Akte
            </a>
            <button type="button" onClick={zuruecksetzen}
                    className="px-4 py-2.5 rounded-xl text-[12.5px] font-semibold"
                    style={{ color: "#1d4ed8", minHeight: 44 }}>
              Nächsten Kunden anlegen
            </button>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           DAS FORMULAR
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-3">
          {/* 380 px: eine Spalte. Ab sm zwei — Vor- und Nachname gehören
              nebeneinander, weil sie zusammen gelesen werden. */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })}
                   placeholder="Vorname" className={feld} style={{ minHeight: 44 }} autoFocus />
            <input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })}
                   placeholder="Nachname" className={feld} style={{ minHeight: 44 }} />
            <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })}
                   placeholder="E-Mail" type="email" inputMode="email"
                   className={feld} style={{ minHeight: 44 }} />
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })}
                   placeholder="Telefon" type="tel" inputMode="tel"
                   className={feld} style={{ minHeight: 44 }} />
          </div>
          <p className="text-[11.5px] text-slate-400">
            E-Mail <b>oder</b> Telefon genügt — aber eines von beiden muss da sein.
            Ohne Erreichbarkeit entsteht ein Datensatz, den niemand erreichen kann.
          </p>

          {/* ── DER DUBLETTEN-HINWEIS ──────────────────────────────────────
              Er erscheint WÄHREND des Tippens, nicht erst beim Speichern. Wer
              alles eingetippt hat und dann hört „gibt es bereits“, hat umsonst
              gearbeitet. */}
          {treffer.length > 0 && (
            <div className="px-3.5 py-3 rounded-xl"
                 style={{ background: "rgba(217,119,6,.09)", boxShadow: "inset 0 0 0 1px rgba(217,119,6,.25)" }}>
              <p className="text-[12.5px] font-bold" style={{ color: "#92400e" }}>
                {treffer.length === 1
                  ? "Diesen Menschen gibt es schon"
                  : `${treffer.length} Menschen tragen diese Daten`}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {treffer.map((t) => (
                  <li key={t.personId} className="text-[12px]" style={{ color: "#92400e" }}>
                    <b>{t.name}</b> — Treffer über {t.treffer}
                    {/* Beschriftet statt „betreut von" (30.08.2026) — siehe
                        shared/fiaon-zustaendigkeit-text.ts. */}
                    {t.agentName ? ` · ${LABEL_VERTRIEB}: ${t.agentName}` : ""}
                    {t.bezahlt ? " · zahlender Kunde" : ""}
                    {t.ref && (
                      <a href={`/agent/kunden?ref=${encodeURIComponent(t.ref)}`}
                         className="ml-2 font-semibold no-underline" style={{ color: "#b45309" }}>
                        Akte öffnen →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-[11.5px] mt-2 leading-relaxed" style={{ color: "#92400e" }}>
                Ein zweiter Datensatz für denselben Menschen lässt sich nur mit
                Aufwand zusammenführen. Wenn es derselbe ist: Akte öffnen und
                dort ein Produkt hinzufügen.
              </p>
            </div>
          )}

          {/* ── DAS PAKET AUS DEM KATALOG ──────────────────────────────── */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.1em] text-slate-500 mb-1.5">
              Paket (optional)
            </label>
            <select value={f.packKey} onChange={(e) => setF({ ...f, packKey: e.target.value })}
                    className={feld} style={{ minHeight: 44 }}>
              <option value="">— noch kein Paket —</option>
              {pakete.filter((p) => p.key !== "schufa").map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label} — {euro(p.preisEuro)}{p.abo ? " / Monat" : ""}
                </option>
              ))}
              {/* Die Auskunft steht getrennt: Sie ist ein Einmalkauf, kein Konto. */}
              {pakete.filter((p) => p.key === "schufa").map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label} — {euro(p.preisEuro)} einmalig
                </option>
              ))}
            </select>
            {gewaehlt && (
              <p className="text-[11.5px] text-slate-500 mt-1.5">
                {euro(gewaehlt.preisEuro)}{gewaehlt.abo ? " monatlich" : " einmalig"} —
                der Preis kommt aus dem Katalog und ist nicht änderbar.
              </p>
            )}
          </div>

          {/* Adresse: eingeklappt, weil sie am Telefon selten sofort kommt. */}
          <details>
            <summary className="text-[12px] font-semibold text-slate-500 cursor-pointer"
                     style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
              Adresse und Geburtsdatum (optional)
            </summary>
            <div className="grid gap-2.5 sm:grid-cols-2 mt-2">
              <input value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })}
                     placeholder="Straße und Hausnummer" className={feld} style={{ minHeight: 44 }} />
              <input value={f.zip} onChange={(e) => setF({ ...f, zip: e.target.value })}
                     placeholder="PLZ" inputMode="numeric" className={feld} style={{ minHeight: 44 }} />
              <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}
                     placeholder="Ort" className={feld} style={{ minHeight: 44 }} />
              <input value={f.birthdate} onChange={(e) => setF({ ...f, birthdate: e.target.value })}
                     type="date" className={feld} style={{ minHeight: 44 }} />
            </div>
          </details>

          {fehler && (
            <p className="px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
               style={{ background: "rgba(220,38,38,.07)", color: "#b91c1c" }}>
              {fehler}
            </p>
          )}

          <button type="button" onClick={() => void anlegen()} disabled={!kannAnlegen}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl text-white text-[13.5px] font-semibold disabled:opacity-40"
                  style={{ background: "#1d4ed8", minHeight: 48 }}>
            {laeuft ? "Legt an …" : "Kunde anlegen"}
          </button>
        </div>
      )}
    </div>
  );
}
