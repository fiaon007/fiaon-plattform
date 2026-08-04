import { useCallback, useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════════════
// Admin-Zugang — die Tür vor dem Verwaltungsbereich.
//
// Kein zweiter Login, sondern ein achtstelliger Zahlencode: eine Eingabe, ein
// Handgriff, auch einhändig am Telefon. Nach erfolgreicher Eingabe setzt der
// Server ein signiertes Cookie (30 Tage) — danach ist JEDE /admin-Seite offen,
// ohne erneute Frage. Ausloggen geht über „Sperren“ in der Seitenleiste.
//
// Die Sperre hier ist nur die Anzeige. Die Wahrheit liegt im Server-Gate
// (server/routes/fiaon-admin-zugang.ts): ohne Cookie antwortet jeder Admin-
// Endpoint mit 401, auch wenn jemand diese Oberfläche umgeht.
//
// Gestaltung: dunkle Bühne, EIN Glaskörper, EIN Blau (CI --fi-primaer). Die
// Zifferntasten sind Glas auf Dunkel — der einzige Ort im System, an dem Glas
// die Hauptrolle spielen darf, weil hier nichts anderes auf der Fläche ist.
// ═══════════════════════════════════════════════════════════════════

const LAENGE = 8;

export default function AdminCodeGate({ onOffen }: { onOffen: () => void }) {
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [zittern, setZittern] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wartenSek, setWartenSek] = useState(0);
  const busyRef = useRef(false);

  // Sperrzeit nach zu vielen Fehlversuchen sichtbar herunterzählen: eine
  // wartende Taste ohne Erklärung fühlt sich wie ein Defekt an.
  useEffect(() => {
    if (wartenSek <= 0) return;
    const t = setInterval(() => setWartenSek((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [wartenSek > 0]);

  const pruefen = useCallback(async (eingabe: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFehler(null);
    try {
      const res = await fetch("/api/fiaon/zugang/oeffnen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: eingabe }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        onOffen();
        return;
      }
      setFehler(json?.error || "Falscher Code.");
      setWartenSek(Math.ceil((json?.wartezeitMs || 0) / 1000));
      setZittern(true);
      setTimeout(() => setZittern(false), 420);
      setCode("");
    } catch {
      setFehler("Keine Verbindung. Bitte erneut versuchen.");
      setCode("");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [onOffen]);

  const ziffer = useCallback((z: string) => {
    if (busyRef.current || wartenSek > 0) return;
    setFehler(null);
    setCode((alt) => {
      if (alt.length >= LAENGE) return alt;
      const neu = alt + z;
      // Die achte Ziffer schickt ab — ein extra „OK“ wäre ein Handgriff zu viel.
      if (neu.length === LAENGE) void pruefen(neu);
      return neu;
    });
  }, [pruefen, wartenSek]);

  const loeschen = useCallback(() => {
    if (busyRef.current) return;
    setFehler(null);
    setCode((alt) => alt.slice(0, -1));
  }, []);

  // Physische Tastatur: am Schreibtisch tippt niemand acht Ziffern mit der Maus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") { e.preventDefault(); ziffer(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); loeschen(); }
      else if (e.key === "Enter" && code.length === LAENGE) { e.preventDefault(); void pruefen(code); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ziffer, loeschen, pruefen, code]);

  const tasten = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="az-buehne">
      <style>{`
        .az-buehne{
          position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center;
          padding:24px; overflow:hidden;
          background:
            radial-gradient(1000px 620px at 50% -12%, rgba(37,99,235,.34), transparent 62%),
            radial-gradient(760px 520px at 108% 108%, rgba(29,78,216,.20), transparent 60%),
            #070b16;
        }
        /* Zwei sehr langsam wandernde Lichter. Bewegung darf man nicht sehen,
           nur spüren — sichtbare Animation auf einem Sperrbildschirm wirkt billig. */
        .az-licht{
          position:absolute; border-radius:9999px; filter:blur(90px); pointer-events:none;
          background:radial-gradient(circle, rgba(37,99,235,.42), transparent 70%);
          animation:az-schweben 22s var(--fi-kurve, ease-in-out) infinite alternate;
        }
        .az-licht.a{ width:520px; height:520px; top:-140px; left:-120px; }
        .az-licht.b{ width:420px; height:420px; bottom:-160px; right:-100px; animation-duration:28s; animation-delay:-9s; }
        @keyframes az-schweben{ from{transform:translate3d(0,0,0) scale(1)} to{transform:translate3d(60px,40px,0) scale(1.14)} }

        .az-karte{
          position:relative; width:100%; max-width:392px; padding:34px 26px 26px;
          border-radius:26px; text-align:center;
          background:linear-gradient(180deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.06) 100%);
          -webkit-backdrop-filter:blur(26px) saturate(180%); backdrop-filter:blur(26px) saturate(180%);
          border:1px solid rgba(255,255,255,.16);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.28), 0 30px 80px rgba(3,7,18,.62);
          animation:az-auf 460ms var(--fi-kurve, cubic-bezier(.32,.72,0,1)) both;
        }
        @keyframes az-auf{ from{opacity:0; transform:translateY(14px) scale(.985)} to{opacity:1; transform:none} }
        .az-karte.zittern{ animation:az-zittern 420ms var(--fi-kurve, cubic-bezier(.32,.72,0,1)); }
        @keyframes az-zittern{ 0%,100%{transform:none} 18%{transform:translateX(-9px)} 38%{transform:translateX(8px)} 62%{transform:translateX(-5px)} 82%{transform:translateX(3px)} }

        .az-marke{ font-size:22px; font-weight:800; letter-spacing:-.02em; color:#fff; }
        .az-unter{ margin-top:4px; font-size:10px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:rgba(255,255,255,.44); }
        .az-frage{ margin-top:18px; font-size:13px; color:rgba(255,255,255,.62); }

        .az-punkte{ margin:18px 0 6px; display:flex; gap:9px; justify-content:center; }
        .az-punkt{
          width:11px; height:11px; border-radius:9999px;
          background:rgba(255,255,255,.13); box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);
          transition:transform 200ms var(--fi-kurve, ease), background 200ms ease, box-shadow 200ms ease;
        }
        .az-punkt.voll{
          background:linear-gradient(180deg,#60a5fa,#2563eb); transform:scale(1.32);
          box-shadow:0 0 0 1px rgba(255,255,255,.24), 0 6px 16px rgba(37,99,235,.55);
        }

        .az-fehler{ min-height:18px; margin-top:8px; font-size:12px; font-weight:600; color:#fca5a5; }

        .az-feld{ margin-top:14px; display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        .az-taste{
          height:62px; border-radius:18px; font-size:23px; font-weight:600; color:#fff;
          background:linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.05));
          border:1px solid rgba(255,255,255,.13);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.22), 0 8px 20px rgba(3,7,18,.30);
          -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
          transition:transform 120ms var(--fi-kurve, ease), background 160ms ease, border-color 160ms ease;
          -webkit-tap-highlight-color:transparent; user-select:none; cursor:pointer;
        }
        .az-taste:hover{ background:linear-gradient(180deg, rgba(255,255,255,.19), rgba(255,255,255,.08)); border-color:rgba(255,255,255,.24); }
        .az-taste:active{ transform:scale(.94); }
        .az-taste:disabled{ opacity:.4; cursor:not-allowed; }
        .az-taste.still{ font-size:12px; font-weight:700; letter-spacing:.06em; color:rgba(255,255,255,.66); background:transparent; border-color:rgba(255,255,255,.10); box-shadow:none; }

        .az-fuss{ margin-top:18px; font-size:11px; color:rgba(255,255,255,.36); }
        .az-fuss a{ color:rgba(255,255,255,.62); text-decoration:none; }
        .az-fuss a:hover{ color:#fff; }

        @media (prefers-reduced-motion: reduce){
          .az-licht, .az-karte, .az-karte.zittern{ animation:none !important; }
        }
        @media (max-width:380px){
          .az-karte{ padding:28px 18px 20px; }
          .az-taste{ height:56px; font-size:21px; }
        }
      `}</style>

      <span className="az-licht a" aria-hidden />
      <span className="az-licht b" aria-hidden />

      <div className={`az-karte${zittern ? " zittern" : ""}`} role="dialog" aria-label="Zugangscode Verwaltung">
        <p className="az-marke">FIAON</p>
        <p className="az-unter">Verwaltung</p>
        <p className="az-frage">
          {wartenSek > 0
            ? `Gesperrt — noch ${wartenSek} Sekunden`
            : busy ? "Prüfe Code …" : "Zugangscode eingeben"}
        </p>

        <div className="az-punkte" aria-hidden>
          {Array.from({ length: LAENGE }).map((_, i) => (
            <span key={i} className={`az-punkt${i < code.length ? " voll" : ""}`} />
          ))}
        </div>

        <p className="az-fehler" role="alert">{fehler}</p>

        <div className="az-feld">
          {tasten.map((z) => (
            <button key={z} type="button" className="az-taste" disabled={busy || wartenSek > 0} onClick={() => ziffer(z)}>
              {z}
            </button>
          ))}
          <button type="button" className="az-taste still" disabled={busy || code.length === 0} onClick={() => setCode("")}>
            Leeren
          </button>
          <button type="button" className="az-taste" disabled={busy || wartenSek > 0} onClick={() => ziffer("0")}>
            0
          </button>
          <button type="button" className="az-taste still" disabled={busy || code.length === 0} onClick={loeschen}>
            Löschen
          </button>
        </div>

        <p className="az-fuss">
          Kein Zugang? <a href="/">Zur Website</a> · <a href="/agent">Mitarbeiter-Portal</a>
        </p>
      </div>
    </div>
  );
}
