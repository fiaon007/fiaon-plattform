// ═══════════════════════════════════════════════════════════════════════════
// /app/unterschrift/:token — lesen und mit dem Finger unterschreiben, OHNE Login
// (Bauvorlage 3.8, Scheibe 5, 05.09.2026). Eigene Seite: keine Schale, keine
// Bottom-Bar. Der Link ist signiert (Modul B), 30 Tage gültig, einmalig.
//
// Ablauf: GET /api/fiaon/app/unterschrift/:token → Dokument (HTML vom eigenen
// Server), Name vorbelegt, bei der Vollmacht der Umfang als Kästchen. Der Kunde
// zeichnet auf dem Canvas, setzt das Kästchen „gelesen“, tippt „Unterschreiben
// und absenden“. POST liefert den Bestätigungssatz — und `weiterToken`, wenn
// nach der Vollmacht noch der Antrag folgt („1 von 2“ → „2 von 2“).
//
// Kein automatischer Versand: Ein Mitarbeiter versendet und quittiert. Der Text
// dazu kommt vom Server, hier steht nur die Oberfläche.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { api } from "./Bausteine";
import { artKlartext } from "./Vollmacht";
import "@/styles/app.css";
import "@/styles/app-antraege.css";

type Zustand = "offen" | "unterschrieben" | "abgelaufen" | "widerrufen" | "ungueltig";
interface UmfangOption { wert: string; text: string }
interface Dokument {
  art: string;
  titel: string;
  empfaenger: string | null;
  aktenzeichen: string | null;
  html: string;
  name: string;
  umfangOptionen: UmfangOption[];
  /** Vom Server vorbelegte Schlüssel (fehlt es, sind alle Kästchen an). */
  umfangVorbelegt: string[] | null;
  gueltigBis: string | null;
  zustand: Zustand;
  schritt: { nr: number; von: number } | null;
  vorgangId: number | null;
  weiterToken: string | null;
}

const MAX_PNG_BYTES = 400 * 1024;

/** Der Server liefert den Umfang „mit Klartext“ — die Form kann Objekt oder Schlüssel sein; beides wird gelesen. */
function umfangLesen(roh: unknown): UmfangOption[] {
  if (!Array.isArray(roh)) return [];
  const aus: UmfangOption[] = [];
  for (let i = 0; i < roh.length; i++) {
    const o: any = roh[i];
    if (typeof o === "string") { aus.push({ wert: o, text: artKlartext(o) || o }); continue; }
    if (o && typeof o === "object") {
      const wert = String(o.wert ?? o.art ?? o.schluessel ?? o.key ?? "");
      if (!wert) continue;
      aus.push({ wert, text: String(o.text ?? o.titel ?? o.klartext ?? artKlartext(wert) ?? wert) });
    }
  }
  return aus;
}

function dokumentLesen(j: any): Dokument {
  return {
    art: String(j.art ?? "antrag"),
    titel: String(j.titel ?? ""),
    empfaenger: j.empfaenger ? String(typeof j.empfaenger === "object" ? j.empfaenger.name ?? "" : j.empfaenger) : null,
    aktenzeichen: j.aktenzeichen ? String(j.aktenzeichen) : null,
    html: String(j.html ?? ""),
    name: String(j.name ?? ""),
    umfangOptionen: umfangLesen(j.umfangOptionen),
    umfangVorbelegt: Array.isArray(j.umfangVorbelegt) ? (j.umfangVorbelegt as unknown[]).map(String) : null,
    gueltigBis: j.gueltigBis ? String(j.gueltigBis) : null,
    zustand: (["offen", "unterschrieben", "abgelaufen", "widerrufen", "ungueltig"].indexOf(j.zustand) !== -1 ? j.zustand : "ungueltig") as Zustand,
    schritt: j.schritt && Number(j.schritt.von) > 1 ? { nr: Number(j.schritt.nr), von: Number(j.schritt.von) } : null,
    vorgangId: j.vorgangId ? Number(j.vorgangId) : j.vorgang?.id ? Number(j.vorgang.id) : null,
    weiterToken: j.weiterToken ? String(j.weiterToken) : null,
  };
}

/** Größe eines data:-PNG in Bytes (Base64 → Bytes), ohne den Server zu fragen. */
const pngBytes = (dataUrl: string): number => { const b64 = dataUrl.split(",")[1] ?? ""; return Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0); };

// ── Unterschriftfläche: Canvas, Pointer Events, Linie 2,5 px ───────────────
function UnterschriftFlaeche({ onAenderung, geleertAb }: { onAenderung: (hatStriche: boolean, png: () => string | null) => void; geleertAb: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const letzte = useRef<{ x: number; y: number } | null>(null);
  const striche = useRef(0);
  const [aktiv, setAktiv] = useState(false);
  const [leer, setLeer] = useState(true);

  const breite = useRef(0);
  // Canvas in Gerätepixeln (höchstens 2-fach), CSS-Größe volle Breite × 160 px. Neu aufgezogen wird nur bei
  // ECHTER Breitenänderung (Drehen des Handys) — die Bildschirmtastatur feuert auf Android ebenfalls „resize“,
  // und die darf die Unterschrift nicht löschen. Beim Drehen gehen die Striche verloren; das ist ehrlicher als ein verzerrtes Bild.
  const aufziehen = (erzwingen = false) => {
    const c = canvas.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    if (!erzwingen && Math.round(r.width) === breite.current) return;
    breite.current = Math.round(r.width);
    c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0f172a";
    striche.current = 0; setLeer(true); onAenderung(false, () => null);
  };
  useEffect(() => { aufziehen(true); const h = () => aufziehen(); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  useEffect(() => { if (geleertAb > 0) aufziehen(true); }, [geleertAb]);

  const punkt = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const png = (): string | null => {
    const c = canvas.current; if (!c || striche.current === 0) return null;
    let url = c.toDataURL("image/png");
    if (pngBytes(url) > MAX_PNG_BYTES) {
      // Zur Sicherheit verkleinern — bei 2-fach und 160 px Höhe kommt das praktisch nie vor.
      const k = document.createElement("canvas"); k.width = Math.round(c.width / 2); k.height = Math.round(c.height / 2);
      k.getContext("2d")?.drawImage(c, 0, 0, k.width, k.height);
      url = k.toDataURL("image/png");
    }
    return url;
  };

  const runter = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    zeichnet.current = true; letzte.current = punkt(e); setAktiv(true);
    // Ein Tipp ohne Bewegung hinterlässt einen Punkt — sonst wirkt die Fläche tot.
    const ctx = e.currentTarget.getContext("2d"); if (ctx && letzte.current) { ctx.beginPath(); ctx.arc(letzte.current.x, letzte.current.y, 1.25, 0, Math.PI * 2); ctx.fillStyle = "#0f172a"; ctx.fill(); }
    striche.current += 1; setLeer(false); onAenderung(true, png);
  };
  const bewegen = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!zeichnet.current || !letzte.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext("2d"); if (!ctx) return;
    const p = punkt(e);
    ctx.beginPath(); ctx.moveTo(letzte.current.x, letzte.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    letzte.current = p;
  };
  const hoch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!zeichnet.current) return;
    zeichnet.current = false; letzte.current = null; setAktiv(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* schon losgelassen */ }
    onAenderung(striche.current > 0, png);
  };

  return (
    <div className="ap-unterschrift">
      <div className={`ap-unterschrift-flaeche${aktiv ? " aktiv" : ""}`}>
        <canvas ref={canvas} aria-label="Unterschriftfläche – mit dem Finger unterschreiben" role="img"
          onPointerDown={runter} onPointerMove={bewegen} onPointerUp={hoch} onPointerCancel={hoch} onPointerLeave={hoch} onContextMenu={(e) => e.preventDefault()} />
        <div className="ap-unterschrift-linie" />
        {leer && <div className="ap-unterschrift-hinweis">Mit dem Finger unterschreiben.</div>}
      </div>
      <div className="ap-unterschrift-zeile">
        <span>{leer ? "Die Fläche ist noch leer." : "Ihre Unterschrift ist gesetzt."}</span>
        <button type="button" className="ap-textknopf still" onClick={() => aufziehen(true)} disabled={leer}>Löschen</button>
      </div>
    </div>
  );
}

// ── Die Seite ──────────────────────────────────────────────────────────────
export default function AppUnterschrift() {
  const [ort, navigiere] = useLocation();
  // Token aus der Adresse: /app/unterschrift/<token> — unabhängig davon, wie die Route eingehängt ist.
  const token = (() => { const m = ort.match(/\/app\/unterschrift\/([^/?#]+)/); try { return m ? decodeURIComponent(m[1]) : ""; } catch { return m ? m[1] : ""; } })();

  const [d, setD] = useState<Dokument | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [umfang, setUmfang] = useState<string[]>([]);
  const [gelesen, setGelesen] = useState(false);
  const [hatStriche, setHatStriche] = useState(false);
  const pngHolen = useRef<() => string | null>(() => null);
  const [geleertAb, setGeleertAb] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ text: string; weiterToken: string | null } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("ap-scroll");
    return () => document.documentElement.classList.remove("ap-scroll");
  }, []);

  useEffect(() => {
    document.title = "Unterschreiben · FIAON";
    setD(null); setLadeFehler(null); setErgebnis(null); setFehler(null); setGelesen(false); setHatStriche(false); setGeleertAb((n) => n + 1);
    window.scrollTo({ top: 0 });
    if (!token) { setD({ ...dokumentLesen({}), zustand: "ungueltig" }); return; }
    let aktiv = true;
    api(`/app/unterschrift/${encodeURIComponent(token)}`).then((r) => {
      if (!aktiv) return;
      if (r.json && (r.json.ok || r.json.zustand)) {
        const dok = dokumentLesen(r.json);
        setD(dok); setName(dok.name);
        setUmfang(dok.umfangVorbelegt ? dok.umfangOptionen.map((o) => o.wert).filter((w) => dok.umfangVorbelegt!.indexOf(w) !== -1) : dok.umfangOptionen.map((o) => o.wert));
        return;
      }
      if (r.status === 404 || r.status === 410 || r.status === 400 || r.status === 403) { setD({ ...dokumentLesen(r.json ?? {}), zustand: r.status === 410 ? "abgelaufen" : "ungueltig" }); return; }
      setLadeFehler(r.json?.error || "Dieses Dokument lässt sich gerade nicht öffnen. Bitte versuchen Sie es in einem Moment noch einmal.");
    }).catch(() => { if (aktiv) setLadeFehler("Dieses Dokument lässt sich gerade nicht öffnen. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es noch einmal."); });
    return () => { aktiv = false; };
  }, [token]);

  const istVollmacht = d?.art === "vollmacht";
  const bereit = !!d && d.zustand === "offen" && hatStriche && name.trim().length >= 3 && gelesen && (!istVollmacht || umfang.length > 0);

  const absenden = async () => {
    if (!d || !bereit || laeuft) return;
    const png = pngHolen.current();
    if (!png) { setFehler("Bitte unterschreiben Sie zuerst auf der Fläche."); return; }
    setLaeuft(true); setFehler(null);
    try {
      const r = await api(`/app/unterschrift/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signaturePng: png, name: name.trim(), umfang: istVollmacht ? umfang : undefined, gelesen: true }),
      });
      if (r.ok && r.json?.ok) {
        setErgebnis({ text: r.json.text || "Unterschrieben. Ein Mitarbeiter versendet den Antrag und bestätigt den Versand unter Vorgänge.", weiterToken: r.json.weiterToken ? String(r.json.weiterToken) : null });
        if (r.json.vorgangId && d) setD({ ...d, vorgangId: Number(r.json.vorgangId) });
        window.scrollTo({ top: 0 });
      } else if (r.json?.zustand === "offen" && r.json?.weiterToken) {
        // 409 vom Server: Für diesen Antrag fehlt noch die Vollmacht — zuerst dorthin (Schritt 1 von 2).
        setFehler(null);
        navigiere(`/app/unterschrift/${encodeURIComponent(String(r.json.weiterToken))}`);
      } else if (r.json?.zustand && r.json.zustand !== "offen") {
        // 409 (schon unterschrieben / zurückgezogen) oder 410 (abgelaufen): die Seite zeigt den Zustand.
        setD({ ...d, zustand: r.json.zustand as Zustand });
        window.scrollTo({ top: 0 });
      } else {
        setFehler(r.json?.error || "Ihre Unterschrift konnte nicht gespeichert werden. Bitte versuchen Sie es noch einmal – nichts ist verloren gegangen.");
      }
    } catch {
      setFehler("Ihre Unterschrift konnte nicht gespeichert werden. Bitte versuchen Sie es noch einmal – nichts ist verloren gegangen.");
    }
    setLaeuft(false);
  };

  const zielBereich = d?.vorgangId ? `/app/vorgaenge/${d.vorgangId}` : "/app/vorgaenge";
  const titel = d ? (istVollmacht ? "Ihre Vollmacht" : `Ihr Antrag: ${d.titel || artKlartext(d.art)}`) : "";

  return (
    <div className="ap-root ap-solo">
      <header className="ap-kopf">
        <div className="ap-kopf-innen">
          <a className="ap-marke" href="/app" aria-label="Mein FIAON">
            <span className="ap-marke-zeichen">F</span>
            <span className="ap-marke-wort">FIAON</span>
          </a>
          {d?.schritt && !ergebnis && <span className="ap-status" style={{ marginLeft: "auto" }}>Schritt {d.schritt.nr} von {d.schritt.von}</span>}
        </div>
      </header>

      <main className="ap-inhalt">
        {ladeFehler && (
          <div className="ap-karte ap-leer ap-auf">
            <b>{ladeFehler}</b>
            <button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Noch einmal</button>
          </div>
        )}
        {!d && !ladeFehler && (
          <>
            <div className="ap-skelett" style={{ height: 30, width: "60%" }} />
            <div className="ap-skelett" style={{ height: 22, width: "80%" }} />
            <div className="ap-skelett" style={{ height: 320, borderRadius: 14 }} />
          </>
        )}

        {/* Bestätigung */}
        {d && ergebnis && (
          <div className="ap-karte ap-auf" style={{ textAlign: "center", padding: 24 }}>
            <svg className="ap-haken" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" /><path d="M20 33l8 8 16-18" /></svg>
            <h1 className="ap-gruss" style={{ marginTop: 12 }}>{istVollmacht ? "Ihre Vollmacht ist unterschrieben." : "Ihr Antrag ist unterschrieben."}{d.aktenzeichen && <small>Aktenzeichen <span className="ap-mono">{d.aktenzeichen}</span></small>}</h1>
            <p style={{ color: "var(--fi-text-leise)", fontSize: 16, lineHeight: 1.5, marginTop: 12 }}>{ergebnis.text}</p>
            {ergebnis.weiterToken ? (
              <>
                <p style={{ color: "var(--fi-text-leise)", fontSize: 15, marginTop: 8 }}>Jetzt folgt der Antrag selbst – Schritt {d.schritt ? d.schritt.von : 2} von {d.schritt ? d.schritt.von : 2}.</p>
                <button type="button" className="ap-knopf" style={{ marginTop: 18 }} onClick={() => navigiere(`/app/unterschrift/${encodeURIComponent(ergebnis.weiterToken!)}`)}>Weiter zum Antrag</button>
              </>
            ) : (
              <a className="ap-knopf" style={{ marginTop: 18 }} href={zielBereich}>Zu meinem Bereich</a>
            )}
          </div>
        )}

        {/* Abgelaufen · widerrufen · ungültig */}
        {d && !ergebnis && d.zustand === "abgelaufen" && (
          <div className="ap-karte ap-leer ap-auf">
            <b>Dieser Link ist abgelaufen.</b>
            Öffnen Sie den Vorgang in Ihrem Bereich – dort liegt ein neuer.
            <a className="ap-knopf still" style={{ marginTop: 14 }} href={zielBereich}>Zu meinem Bereich</a>
          </div>
        )}
        {d && !ergebnis && d.zustand === "widerrufen" && istVollmacht && (
          <div className="ap-karte ap-leer ap-auf">
            <b>Diese Vollmacht ist widerrufen.</b>
            Sie haben die Vollmacht zurückgenommen. Für einen neuen Antrag entsteht in Ihrem Bereich ein neuer Link.
            <a className="ap-knopf still" style={{ marginTop: 14 }} href="/app/mehr/vollmachten">Zu meinen Vollmachten</a>
          </div>
        )}
        {d && !ergebnis && d.zustand === "widerrufen" && !istVollmacht && (
          <div className="ap-karte ap-leer ap-auf">
            <b>Diesen Antrag haben Sie zurückgezogen.</b>
            Er wird nicht versendet. Der Punkt steht wieder offen auf Ihrer Liste – Sie können ihn dort neu vorbereiten.
            <a className="ap-knopf still" style={{ marginTop: 14 }} href={zielBereich}>Zu meinem Bereich</a>
          </div>
        )}
        {d && !ergebnis && d.zustand === "ungueltig" && (
          <div className="ap-karte ap-leer ap-auf">
            <b>Dieser Link ist nicht gültig.</b>
            Bitte öffnen Sie den Vorgang in Ihrem Bereich – dort liegt der aktuelle Link.
            <a className="ap-knopf still" style={{ marginTop: 14 }} href="/app">Zu meinem Bereich</a>
          </div>
        )}

        {/* Offen oder bereits unterschrieben: Dokument sichtbar */}
        {d && !ergebnis && (d.zustand === "offen" || d.zustand === "unterschrieben") && (
          <>
            <h1 className="ap-gruss ap-auf">
              {titel}
              <small>
                {d.empfaenger ? <>An {d.empfaenger}. </> : null}
                {d.aktenzeichen ? <>Aktenzeichen <span className="ap-mono">{d.aktenzeichen}</span></> : null}
              </small>
            </h1>

            {d.zustand === "unterschrieben" && (
              <div className="ap-meldung gut ap-auf" role="status" style={{ marginTop: 0 }}>
                {istVollmacht ? "Diese Vollmacht ist bereits unterschrieben." : "Dieser Antrag ist bereits unterschrieben."} Das Dokument sehen Sie hier weiterhin; den Stand finden Sie in Ihrem Bereich unter Vorgänge.
              </div>
            )}
            {d.schritt && d.zustand === "offen" && (
              <p className="ap-ruhe ap-auf" style={{ fontSize: 15 }}>
                {d.schritt.nr < d.schritt.von ? "Zuerst die Vollmacht, danach der Antrag selbst – beides mit Ihrer Unterschrift." : "Die Vollmacht ist da. Jetzt folgt der Antrag selbst."}
              </p>
            )}

            <article className="ap-dokument ap-auf v1" aria-label={titel} dangerouslySetInnerHTML={{ __html: d.html }} />

            {istVollmacht && (
              <div className="ap-karte ap-auf v2">
                <h3>Umfang der Vollmacht</h3>
                <p>Für welche Erklärungen FIAON die Übermittlung übernehmen darf. Wählen Sie ab, was nicht dazugehören soll.</p>
                {d.umfangOptionen.length > 0 ? (
                  <div className="ap-umfang" style={{ marginTop: 10 }}>
                    {d.umfangOptionen.map((o) => (
                      <label key={o.wert} className="ap-check">
                        <input type="checkbox" checked={umfang.indexOf(o.wert) !== -1} disabled={d.zustand !== "offen"} onChange={(e) => setUmfang(e.target.checked ? [...umfang.filter((u) => u !== o.wert), o.wert] : umfang.filter((u) => u !== o.wert))} />
                        <span>{o.text}</span>
                      </label>
                    ))}
                  </div>
                ) : <p className="ap-fuss">Der Umfang steht im Dokument oben.</p>}
                {d.gueltigBis && <p className="ap-fuss" style={{ marginTop: 10 }}>Gültig bis {d.gueltigBis}.</p>}
                <p className="ap-fuss">Sie können die Vollmacht jederzeit unter Mehr › Vollmachten widerrufen.</p>
              </div>
            )}

            {d.zustand === "offen" && (
              <>
                <div className="ap-karte ap-auf v2" style={{ display: "grid", gap: 14 }}>
                  <label className="ap-feld">
                    <span>Ihr Name in Druckschrift</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} inputMode="text" />
                  </label>
                  <div>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--fi-text-leise)", marginBottom: 6 }}>Ihre Unterschrift</span>
                    <UnterschriftFlaeche geleertAb={geleertAb} onAenderung={(hat, png) => { setHatStriche(hat); pngHolen.current = png; }} />
                  </div>
                  <label className="ap-check">
                    <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} />
                    <span>{istVollmacht ? "Ich habe die Vollmacht gelesen." : "Ich habe das Schreiben gelesen."}</span>
                  </label>
                </div>

                {fehler && <div className="ap-problem ap-auf" role="alert"><b>{fehler}</b></div>}

                <button type="button" className="ap-knopf ap-auf v3" disabled={!bereit || laeuft} onClick={absenden}>{laeuft ? "Wird gespeichert …" : "Unterschreiben und absenden"}</button>
                <p className="ap-fuss ap-auf v3">
                  {!hatStriche ? "Unterschreiben Sie auf der Fläche. " : ""}
                  {name.trim().length < 3 ? "Tragen Sie Ihren Namen ein. " : ""}
                  {!gelesen ? (istVollmacht ? "Bestätigen Sie, dass Sie die Vollmacht gelesen haben. " : "Bestätigen Sie, dass Sie das Schreiben gelesen haben. ") : ""}
                  {istVollmacht && umfang.length === 0 ? "Wählen Sie mindestens einen Punkt für den Umfang. " : ""}
                  {bereit ? (istVollmacht
                    ? "Mit dem Antippen wird Ihre Unterschrift mit Datum und Uhrzeit gespeichert. Die Vollmacht liegt dann in Ihrer Akte; danach folgt Ihr Antrag."
                    : "Mit dem Antippen wird Ihre Unterschrift mit Datum und Uhrzeit gespeichert. Ein Mitarbeiter versendet danach und bestätigt den Versand unter Vorgänge.") : ""}
                </p>
              </>
            )}
            {d.zustand === "unterschrieben" && <a className="ap-knopf still ap-auf v3" href={zielBereich}>Zu meinem Bereich</a>}
          </>
        )}
      </main>
      <p className="ap-solo-fuss">FIAON LTD · <a href="/datenschutz" style={{ color: "inherit" }}>Datenschutz</a> · <a href="/impressum" style={{ color: "inherit" }}>Impressum</a></p>
    </div>
  );
}
