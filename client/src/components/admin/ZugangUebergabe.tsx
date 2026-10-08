// ═══════════════════════════════════════════════════════════════════════════
// ZUGANG ÜBERGEBEN — die Tafel der Leitung (08.10.2026)
//
// Justin: „Bau dafür eine Seite, alles soll sich auf der Plattform abspielen …
// das temporäre Passwort muss angezeigt werden, sonst kann sie sich nicht
// einloggen." Bisher: Übergabe-PDF mit einem Handfeld für das Start-Passwort.
//
// Keine neue Chef-Seite (Hausregel): Die Tafel ist ein Reiter der Team-Zentrale
// („Zugang übergeben", ?tab=zugang) — im Chefbüro unter Team › Zugang übergeben
// und unter /admin/team. Die Chef-Hülle übersetzt die hellen Klassen ins Dunkle.
//
// Ablauf: Die Leitung trägt Name, Rolle, Zugang, Anmeldeadresse und das
// Start-Passwort ein → der Server gibt Link und Code GENAU EINMAL zurück (hier
// mit QR-Code) → die Liste zeigt danach nur noch den Stand: übergeben,
// angesehen, bestätigt — oder abgelaufen/gesperrt mit „Neu ausstellen".
// Das Passwort sieht hier niemand wieder; es steht nur verschlüsselt im System.
// Server: server/routes/fiaon-zugang-uebergabe.ts. Regeln: shared/fiaon-zugang-uebergabe.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  uebergabeEingabePruefen, uebergabeLebt, uebergabeNeuAusstellbar,
  type UebergabeEingabe, type UebergabeFeld, type UebergabeStand,
} from "@shared/fiaon-zugang-uebergabe";

const API = "/api/fiaon";

interface Zeile {
  id: number; name: string; rolle: string | null; zugang: string; anmeldeadresse: string;
  ansprechName: string | null; ansprechFunktion: string | null; ansprechEmail: string | null; ansprechTelefon: string | null;
  fehlversuche: number; gueltigBis: string; ausgestelltAm: string; ausgestelltVon: string | null;
  angesehenAm: string | null; angesehenZuletztAm: string | null; ansichten: number;
  bestaetigtAm: string | null; gesperrtAm: string | null; geloeschtAm: string | null; geloeschtGrund: string | null;
  zurueckgezogenVon: string | null; ersetztDurch: number | null; passwortLiegt: boolean; stand: UebergabeStand;
}
interface Daten {
  schluessel: { da: boolean; grund?: string };
  gueltigStunden: number; maxFehlversuche: number;
  ich: { name: string; email: string | null; funktion: string; telefon: string | null };
  liste: Zeile[];
}
interface Ergebnis { id: number; name: string; link: string; code: string; gueltigBis: string; ersetzt: number[] }

const STAND: Record<UebergabeStand, { text: string; farbe: string; grund: string }> = {
  offen:          { text: "Übergeben",           farbe: "#1d4ed8", grund: "rgba(37,99,235,.10)" },
  angesehen:      { text: "Angesehen",           farbe: "#b45309", grund: "rgba(217,119,6,.12)" },
  bestaetigt:     { text: "Bestätigt",           farbe: "#047857", grund: "rgba(5,150,105,.12)" },
  abgelaufen:     { text: "Abgelaufen",          farbe: "#475569", grund: "rgba(71,85,105,.12)" },
  gesperrt:       { text: "Gesperrt",            farbe: "#b91c1c", grund: "rgba(220,38,38,.10)" },
  zurueckgezogen: { text: "Zurückgezogen",       farbe: "#475569", grund: "rgba(71,85,105,.12)" },
  ersetzt:        { text: "Ersetzt",             farbe: "#475569", grund: "rgba(71,85,105,.12)" },
};

const zeit = (s: string | null) => (s
  ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })
  : "—");

async function api(pfad: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; json: any }> {
  const r = await fetch(`${API}${pfad}`, {
    credentials: "include", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  }).catch(() => null);
  const json = await r?.json().catch(() => null);
  return { ok: !!r?.ok && json?.ok !== false, status: r?.status ?? 0, json };
}

const LEER: UebergabeEingabe = {
  name: "", rolle: "", zugang: "", anmeldeadresse: "mail.google.com", passwort: "",
  ansprechName: "", ansprechFunktion: "", ansprechEmail: "", ansprechTelefon: "",
};

const feldKlasse = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-blue-500";

function Feld({ label, hinweis, fehler, children }: { label: string; hinweis?: string; fehler?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11.5px] font-semibold mb-1" style={{ color: fehler ? "#b91c1c" : "#475569" }}>{label}</span>
      {children}
      {hinweis && <span className="block text-[11px] text-slate-400 mt-1">{hinweis}</span>}
    </label>
  );
}

/** Ein Wort aus der Liste: was mit dieser Übergabe gerade ist — in einem Satz. */
function standSatz(z: Zeile): string {
  switch (z.stand) {
    case "offen": return `Übergeben am ${zeit(z.ausgestelltAm)} · noch nicht angesehen · gültig bis ${zeit(z.gueltigBis)}`;
    case "angesehen": return `Angesehen am ${zeit(z.angesehenAm)}${z.ansichten > 1 ? ` (${z.ansichten}×)` : ""} · Bestätigung steht aus · gültig bis ${zeit(z.gueltigBis)}`;
    case "bestaetigt": return `Bestätigt am ${zeit(z.bestaetigtAm)} — das Start-Passwort ist gelöscht`;
    case "abgelaufen": return `Abgelaufen am ${zeit(z.geloeschtAm ?? z.gueltigBis)}${z.angesehenAm ? " (angesehen, nicht bestätigt)" : " (nie angesehen)"} — neu ausstellen`;
    case "gesperrt": return `Gesperrt am ${zeit(z.gesperrtAm)} nach ${z.fehlversuche} falschen Codes — neu ausstellen`;
    case "zurueckgezogen": return `Zurückgezogen am ${zeit(z.geloeschtAm)}${z.zurueckgezogenVon ? ` von ${z.zurueckgezogenVon}` : ""}`;
    case "ersetzt": return `Ersetzt am ${zeit(z.geloeschtAm)} durch eine neue Übergabe`;
  }
}

export default function ZugangUebergabe() {
  // AGENTS.md: alle Haken oben, vor dem ersten return.
  const [d, setD] = useState<Daten | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [form, setForm] = useState<UebergabeEingabe>(LEER);
  const [ersetzt, setErsetzt] = useState<number | null>(null);
  const [zeigen, setZeigen] = useState(false);
  const [fehler, setFehler] = useState<{ feld: UebergabeFeld | null; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [frage, setFrage] = useState<number | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const passwortRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true); setLadeFehler(null);
    const r = await api("/chef/zugang-uebergabe");
    if (r.ok) setD(r.json);
    else setLadeFehler(r.status === 401 ? "Bitte im Chefbüro anmelden." : r.status === 403 ? "Dafür reicht deine Stufe nicht." : (r.json?.error || "Die Übergaben ließen sich nicht laden."));
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  // Die Ansprechperson ist zuerst, wer ausstellt — änderbar.
  useEffect(() => {
    if (!d) return;
    setForm((f) => (f.ansprechName ? f : {
      ...f, ansprechName: d.ich.name, ansprechFunktion: d.ich.funktion, ansprechEmail: d.ich.email ?? "", ansprechTelefon: d.ich.telefon ?? "",
    }));
  }, [d]);

  const setzen = (k: UebergabeFeld) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (fehler?.feld === k) setFehler(null);
  };

  const ausstellen = async () => {
    setFehler(null); setMeldung(null);
    // Dieselbe Prüfung wie der Server — die Meldung kommt sofort, nicht erst nach dem Senden.
    const p = uebergabeEingabePruefen(form);
    if (!p.ok) { setFehler({ feld: p.feld, text: p.fehler }); return; }
    setBusy("ausstellen");
    const r = await api("/chef/zugang-uebergabe", { method: "POST", body: JSON.stringify({ ...form, ersetzt }) });
    setBusy(null);
    if (!r.ok) {
      setFehler({ feld: r.json?.feld ?? null, text: r.json?.error || (r.status === 0 ? "Keine Verbindung — es wurde nichts ausgestellt." : "Die Übergabe ließ sich nicht ausstellen.") });
      return;
    }
    // Das Passwort verlässt sofort den Speicher dieser Seite.
    setForm((f) => ({ ...LEER, ansprechName: f.ansprechName, ansprechFunktion: f.ansprechFunktion, ansprechEmail: f.ansprechEmail, ansprechTelefon: f.ansprechTelefon }));
    setZeigen(false); setErsetzt(null);
    setErgebnis({ id: r.json.id, name: p.wert.name, link: r.json.link, code: r.json.code, gueltigBis: r.json.gueltigBis, ersetzt: r.json.ersetzt ?? [] });
    void laden();
  };

  const zurueckziehen = async (id: number) => {
    setBusy(`zz-${id}`); setMeldung(null);
    const r = await api(`/chef/zugang-uebergabe/${id}/zurueckziehen`, { method: "POST", body: "{}" });
    setBusy(null); setFrage(null);
    if (r.ok) { setMeldung({ art: "gut", text: "Zurückgezogen — das Start-Passwort ist gelöscht, der Link zeigt nichts mehr." }); if (ergebnis?.id === id) setErgebnis(null); }
    else setMeldung({ art: "schlecht", text: r.json?.error || "Das Zurückziehen hat nicht geklappt." });
    void laden();
  };

  const neuAusstellen = (z: Zeile) => {
    setErgebnis(null); setFehler(null);
    setForm((f) => ({
      ...f, name: z.name, rolle: z.rolle ?? "", zugang: z.zugang, anmeldeadresse: z.anmeldeadresse, passwort: "",
      ansprechName: z.ansprechName ?? f.ansprechName, ansprechFunktion: z.ansprechFunktion ?? "",
      ansprechEmail: z.ansprechEmail ?? "", ansprechTelefon: z.ansprechTelefon ?? "",
    }));
    setErsetzt(uebergabeLebt(z.stand) ? z.id : null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => passwortRef.current?.focus(), 350);
  };

  const kopieren = async (text: string, was: string) => {
    try { await navigator.clipboard.writeText(text); setKopiert(was); window.setTimeout(() => setKopiert(null), 2200); }
    catch { setKopiert(`${was}-geht-nicht`); }
  };

  if (laedt && !d) return <p className="py-10 text-center text-[13px] text-slate-400">Übergaben werden geladen …</p>;
  if (ladeFehler && !d) return <p className="py-10 text-center text-[13px]" style={{ color: "#b45309" }}>{ladeFehler}</p>;
  if (!d) return null;

  const gesperrt = !d.schluessel.da;
  const rot = (k: UebergabeFeld) => fehler?.feld === k;

  return (
    <div className="zu-tafel max-w-6xl mx-auto">
      {/* ── Kopf ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
        <h2 className="text-[17px] font-bold text-slate-900 m-0">Zugang übergeben</h2>
        <p className="text-[12.5px] text-slate-500 mt-1 mb-0 max-w-3xl leading-relaxed">
          Du trägst Zugang und Start-Passwort ein, das System erzeugt einen Link ({d.gueltigStunden} Stunden gültig) und einen
          sechsstelligen Code. Gib beides <b className="text-slate-700">getrennt</b> weiter: den Link als QR-Code oder Nachricht, den Code
          mündlich. Die Empfängerin oder der Empfänger sieht das Passwort erst nach dem Code. Nach der Bestätigung, nach {d.gueltigStunden} Stunden
          oder nach {d.maxFehlversuche} falschen Codes ist es gelöscht — es steht bis dahin nur verschlüsselt im System, auch hier sieht es niemand wieder.
        </p>
      </div>

      {gesperrt && (
        <div className="mb-3 px-4 py-3 rounded-2xl text-[12.5px] leading-relaxed" role="alert"
             style={{ background: "rgba(217,119,6,.10)", color: "#92400e", border: "1px solid rgba(217,119,6,.35)" }}>
          <b>Ausstellen ist gesperrt.</b> {d.schluessel.grund}
        </div>
      )}
      {meldung && (
        <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold" role="status"
           style={meldung.art === "gut" ? { background: "rgba(5,150,105,.08)", color: "#047857" } : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
          {meldung.text}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start">
        {/* ── Eingabe ────────────────────────────────────────────────────── */}
        <div ref={formRef} className="zu-form bg-white rounded-2xl border border-slate-200 p-4" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
          <p className="text-[13.5px] font-bold text-slate-900 m-0 mb-3">
            {ersetzt ? "Neu ausstellen — der alte Link wird dabei gelöscht" : "Neuer Zugang"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Feld label="Name *" fehler={rot("name")}>
              <input className={feldKlasse} value={form.name} onChange={setzen("name")} autoComplete="off" placeholder="Vorname Nachname" />
            </Feld>
            <Feld label="Rolle" fehler={rot("rolle")} hinweis="z. B. Praktikum Buchhaltung">
              <input className={feldKlasse} value={form.rolle} onChange={setzen("rolle")} autoComplete="off" />
            </Feld>
            <Feld label="Zugang (E-Mail-Adresse) *" fehler={rot("zugang")}>
              <input className={feldKlasse} value={form.zugang} onChange={setzen("zugang")} autoComplete="off" inputMode="email" placeholder="name@fiaon.com" />
            </Feld>
            <Feld label="Anmeldeadresse *" fehler={rot("anmeldeadresse")}>
              <input className={feldKlasse} value={form.anmeldeadresse} onChange={setzen("anmeldeadresse")} autoComplete="off" />
            </Feld>
          </div>
          <div className="mt-3">
            <Feld label="Start-Passwort *" fehler={rot("passwort")}
                  hinweis="Tippst du selbst ein. Es wird verschlüsselt gespeichert, nie angezeigt und nie verschickt — nur die Empfängerseite zeigt es nach dem Code.">
              <span className="flex gap-2">
                {/* Kein <form>, kein „password"-Name: Der Passwort-Speicher des Browsers soll das Start-Passwort nicht übernehmen. */}
                <input ref={passwortRef} className={`${feldKlasse} font-mono`} type={zeigen ? "text" : "password"}
                       value={form.passwort} onChange={setzen("passwort")} name="uebergabe-startwert"
                       autoComplete="off" spellCheck={false} data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
                <button type="button" onClick={() => setZeigen((v) => !v)}
                        className="px-3 rounded-xl text-[12px] font-semibold bg-white border border-slate-200 text-slate-600 shrink-0">
                  {zeigen ? "Verbergen" : "Anzeigen"}
                </button>
              </span>
            </Feld>
          </div>
          <p className="text-[11.5px] font-semibold text-slate-500 mt-4 mb-2">Ansprechperson auf der Empfängerseite</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Feld label="Name *" fehler={rot("ansprechName")}>
              <input className={feldKlasse} value={form.ansprechName} onChange={setzen("ansprechName")} autoComplete="off" />
            </Feld>
            <Feld label="Funktion" fehler={rot("ansprechFunktion")}>
              <input className={feldKlasse} value={form.ansprechFunktion} onChange={setzen("ansprechFunktion")} autoComplete="off" />
            </Feld>
            <Feld label="E-Mail" fehler={rot("ansprechEmail")}>
              <input className={feldKlasse} value={form.ansprechEmail} onChange={setzen("ansprechEmail")} autoComplete="off" inputMode="email" />
            </Feld>
            <Feld label="Telefon" fehler={rot("ansprechTelefon")}>
              <input className={feldKlasse} value={form.ansprechTelefon} onChange={setzen("ansprechTelefon")} autoComplete="off" inputMode="tel" />
            </Feld>
          </div>

          {fehler && (
            <p className="mt-3 mb-0 text-[12.5px] font-semibold" role="alert" style={{ color: "#b91c1c" }}>{fehler.text}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void ausstellen()} disabled={gesperrt || busy === "ausstellen"}
                    title={gesperrt ? "Gesperrt: Der Server-Schlüssel ZUGANG_SCHLUESSEL fehlt (siehe oben)." : undefined}
                    className="zu-ausstellen px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-[#1d4ed8] disabled:opacity-50">
              {busy === "ausstellen" ? "Wird ausgestellt …" : "Link und Code erzeugen"}
            </button>
            {ersetzt && (
              <button type="button" onClick={() => { setErsetzt(null); setForm((f) => ({ ...LEER, ansprechName: f.ansprechName, ansprechFunktion: f.ansprechFunktion, ansprechEmail: f.ansprechEmail, ansprechTelefon: f.ansprechTelefon })); }}
                      className="px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-white border border-slate-200 text-slate-600">
                Abbrechen
              </button>
            )}
            {gesperrt && <span className="text-[11.5px]" style={{ color: "#b45309" }}>Gesperrt, bis ZUGANG_SCHLUESSEL gesetzt ist.</span>}
          </div>
        </div>

        {/* ── Ergebnis: Link und Code, genau einmal ─────────────────────── */}
        <div className="grid gap-3">
          {ergebnis ? (
            <div className="zu-ergebnis bg-white rounded-2xl border border-slate-200 p-4" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
              <p className="text-[13.5px] font-bold text-slate-900 m-0">Für {ergebnis.name} ausgestellt</p>
              <p className="text-[12px] text-slate-500 mt-1 mb-3">
                Gültig bis {zeit(ergebnis.gueltigBis)}.
                {ergebnis.ersetzt.length > 0 && ` Die vorige Übergabe an dieselbe Adresse ist gelöscht.`}
              </p>
              <div className="flex flex-wrap gap-4 items-start">
                <div className="hell-lassen rounded-xl overflow-hidden shrink-0" style={{ lineHeight: 0 }}>
                  <QRCodeSVG value={ergebnis.link} size={168} level="M" marginSize={3} bgColor="#ffffff" fgColor="#0c1a2e" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Übergabe-Code — mündlich</span>
                  <span className="zu-code block font-mono text-[30px] font-bold tracking-[.18em] text-slate-900 mt-0.5">
                    {ergebnis.code.slice(0, 3)} {ergebnis.code.slice(3)}
                  </span>
                  <span className="block text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                    Nicht in dieselbe Nachricht wie den Link schreiben. Der Code steht nur jetzt hier.
                  </span>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-3">Link</span>
                  <span className="block font-mono text-[11px] text-slate-600 break-all mt-0.5">{ergebnis.link}</span>
                  <span className="flex flex-wrap gap-2 mt-2">
                    <button type="button" onClick={() => void kopieren(ergebnis.link, "link")}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-slate-200 text-slate-700">
                      {kopiert === "link" ? "Link kopiert" : "Link kopieren"}
                    </button>
                  </span>
                  {kopiert?.endsWith("-geht-nicht") && (
                    <span className="block text-[11.5px] mt-1" style={{ color: "#b45309" }}>Kopieren geht hier nicht — bitte den Link markieren und kopieren.</span>
                  )}
                </div>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-3 mb-0 leading-relaxed">
                Den QR-Code kann die Empfängerin oder der Empfänger direkt hier vom Bildschirm mit dem Handy scannen.
                Sobald du diese Karte schließt, sind Link und Code nicht mehr abrufbar — ist etwas verloren, stell neu aus.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setErgebnis(null)}
                        className="px-4 py-2 rounded-xl text-[12.5px] font-bold text-white bg-[#047857]">
                  Weitergegeben — Karte schließen
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-[12.5px] text-slate-500 leading-relaxed" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
              <b className="text-slate-700">So geht es</b>
              <ol className="mt-2 mb-0 pl-5 list-decimal space-y-1">
                <li>Eintragen und „Link und Code erzeugen“ drücken.</li>
                <li>Den QR-Code scannen lassen oder den Link schicken — den Code persönlich sagen.</li>
                <li>Die Seite zeigt Zugang, Passwort und die drei ersten Schritte. Mit „Ich habe meinen Zugang erhalten …“ ist das Passwort gelöscht; hier steht dann „bestätigt am …“.</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* ── Liste ──────────────────────────────────────────────────────────── */}
      <div className="zu-liste bg-white rounded-2xl border border-slate-200 p-4 mt-3" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[13.5px] font-bold text-slate-900 m-0">Übergaben</p>
          <button type="button" onClick={() => void laden()} disabled={laedt}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-slate-200 text-slate-600 disabled:opacity-50">
            {laedt ? "Lädt …" : "Neu laden"}
          </button>
        </div>
        {ladeFehler && <p className="text-[12.5px] mb-2" style={{ color: "#b45309" }}>{ladeFehler}</p>}
        {d.liste.length === 0 ? (
          <p className="text-[12.5px] text-slate-400 py-4 m-0">Noch keine Übergabe ausgestellt.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {d.liste.map((z) => {
              const s = STAND[z.stand];
              const lebt = uebergabeLebt(z.stand);
              return (
                <div key={z.id} className="zu-zeile py-3 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-slate-900 m-0">
                      {z.name}
                      {z.rolle && <span className="font-normal text-slate-500"> · {z.rolle}</span>}
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold align-middle" style={{ color: s.farbe, background: s.grund }}>{s.text}</span>
                    </p>
                    <p className="text-[12px] text-slate-500 m-0 mt-0.5">{z.zugang} · Anmeldung {z.anmeldeadresse}</p>
                    <p className="text-[12px] m-0 mt-1" style={{ color: s.farbe }}>{standSatz(z)}</p>
                    <p className="text-[11.5px] text-slate-400 m-0 mt-0.5">
                      Ausgestellt am {zeit(z.ausgestelltAm)}{z.ausgestelltVon ? ` von ${z.ausgestelltVon}` : ""}
                      {z.fehlversuche > 0 && z.stand !== "gesperrt" && ` · ${z.fehlversuche} falsche${z.fehlversuche === 1 ? "r" : ""} Code${z.fehlversuche === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {lebt && frage !== z.id && (
                      <button type="button" onClick={() => setFrage(z.id)} disabled={busy != null}
                              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-slate-200 text-slate-600 disabled:opacity-50">
                        Zurückziehen
                      </button>
                    )}
                    {frage === z.id && (
                      <span className="flex items-center gap-2 text-[12px] text-slate-600">
                        Passwort löschen, Link tot?
                        <button type="button" onClick={() => void zurueckziehen(z.id)} disabled={busy != null}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-[#b91c1c] disabled:opacity-50">
                          {busy === `zz-${z.id}` ? "…" : "Ja, zurückziehen"}
                        </button>
                        <button type="button" onClick={() => setFrage(null)}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-slate-200 text-slate-600">
                          Nein
                        </button>
                      </span>
                    )}
                    {uebergabeNeuAusstellbar(z.stand) && frage !== z.id && (
                      <button type="button" onClick={() => neuAusstellen(z)} disabled={gesperrt}
                              title={gesperrt ? "Gesperrt: ZUGANG_SCHLUESSEL fehlt." : "Formular mit diesen Angaben füllen — das Start-Passwort trägst du neu ein."}
                              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-[#1d4ed8] disabled:opacity-50">
                        Neu ausstellen
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
