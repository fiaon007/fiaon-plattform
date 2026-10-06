// ═══════════════════════════════════════════════════════════════════════════
// DER HANDY-RAHMEN DES SOCIAL-STUDIOS (06.10.2026, E-294)
//
// Konzept §2.3: „Links: Handy-Rahmen mit der echten Vorschau — Karussell zum
// Wischen mit Zähler, Reel spielt mit Ton, Titelbild umschaltbar, Story 9:16 mit
// eingezeichneter Sticker-Zone." Und §7: „Die Vorschauen müssen aussehen wie die
// echten Apps … sonst prüft man das Falsche."
//
// Alles wird aus denselben Daten gerendert (Dateien des Posts per
// GET /api/fiaon/chef/social/datei/:id, Range-fähig für Safari) — keine
// Bildschirmfotos, kein Instagram-embed (Fremd-Cookies).
//   · <Handy>          der Rahmen (Titan, Kantenlicht, Display, Glanz) — im Fluss,
//                      nie fixed. Darin die App, hell wie in echt.
//   · <InstaKarussell> CSS scroll-snap: am Handy wischt der Finger nativ, mit der
//                      Maus zieht man (Zeiger-Ereignisse), Pfeile und Pfeiltasten
//                      gehen auch. Zähler „2/7" oben rechts, Punkte darunter.
//   · <InstaReel>      9:16 randlos: Tippen spielt mit Ton bzw. hält an, Knopf für
//                      Ton aus/an, Laufbalken. `titelbild` zeigt statt des Videos
//                      das gewählte Titelbild (so erscheint es im Raster).
//   · <InstaStory>     9:16 mit den Freiräumen oben/unten und der Sticker-Zone.
// Keine Dauer-Animation; „weniger Bewegung" springt ohne Gleiten.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState, type ReactNode, type KeyboardEvent, type PointerEvent } from "react";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import { ruhig } from "../chef-teile";
import type { SocialDatei, SocialFormat } from "@shared/fiaon-social";

// ── Kleine Zeichen wie in der App (1,5-px-Linien) ─────────────────────────
const linie = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const Herz = () => <svg viewBox="0 0 24 24" {...linie}><path d="M12 20.3s-7.6-4.6-9.2-9.4C1.6 7.3 3.9 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4c3.4 0 5.7 3.3 4.5 6.9-1.6 4.8-9.2 9.4-9.2 9.4z" /></svg>;
const Sprechblase = () => <svg viewBox="0 0 24 24" {...linie}><path d="M20.7 16.5A9 9 0 1 0 17 20l3.9 1-.2-4.5z" /></svg>;
const Senden = () => <svg viewBox="0 0 24 24" {...linie}><path d="M21.5 3 10.2 14.3M21.5 3l-6.8 18-4.5-6.7L3 9.8z" /></svg>;
const Merken = () => <svg viewBox="0 0 24 24" {...linie}><path d="M19 21l-7-5.4L5 21V4h14z" /></svg>;
const Zurueck = () => <svg viewBox="0 0 24 24" {...linie}><path d="M15 5l-7 7 7 7" /></svg>;
const Punkte = () => <svg viewBox="0 0 24 24" className="punkte" aria-hidden="true"><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></svg>;
const Pfeil = ({ rechts }: { rechts?: boolean }) => <svg viewBox="0 0 12 12" {...linie} strokeWidth={2}><path d={rechts ? "M4 2l4 4-4 4" : "M8 2 4 6l4 4"} /></svg>;
const Spielen = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>;
const TonAn = () => <svg viewBox="0 0 24 24" {...linie}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>;
const TonAus = () => <svg viewBox="0 0 24 24" {...linie}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16.5 9.5l5 5M21.5 9.5l-5 5" /></svg>;
const KiZeichen = () => <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.3}><path d="M8 1.8l1.5 3.7 3.7 1.5-3.7 1.5L8 12.2 6.5 8.5 2.8 7l3.7-1.5z" /></svg>;

/** Das Profilbild: das F der Wortmarke auf Navy (bis Scheibe 2 die Profile aus der Tabelle kommen). */
export function Avatar({ gross = false }: { gross?: boolean }) {
  return <span className={`so-avatar${gross ? " gross" : ""}`} aria-hidden="true"><FiaonWortmarke variante="f" hoehe={null} farbe="#fff" dekorativ /></span>;
}

// ── Der Rahmen ─────────────────────────────────────────────────────────────
export function Handy({ children, dunkel = false, beschriftung }: { children: ReactNode; dunkel?: boolean; beschriftung: string }) {
  return (
    <div className="so-handy" role="group" aria-label={beschriftung}>
      <div className={`so-bildschirm${dunkel ? " dunkel" : ""}`}>
        <span className="so-insel" aria-hidden="true" />
        <div className="so-statusleiste" aria-hidden="true">
          <span>9:41</span>
          <svg viewBox="0 0 64 12"><path d="M1 9h3v2H1zM6 7h3v4H6zM11 4.5h3V11h-3zM16 2h3v9h-3z" fill="currentColor" /><path d="M28 4.2a8 8 0 0 1 10 0M30 6.6a4.6 4.6 0 0 1 6 0" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /><circle cx="33" cy="9.2" r="1.2" fill="currentColor" /><rect x="44" y="1.5" width="17" height="9" rx="2.5" stroke="currentColor" strokeWidth="1" fill="none" opacity=".5" /><rect x="45.6" y="3" width="12" height="6" rx="1.4" fill="currentColor" /><path d="M62.5 4.5v3" stroke="currentColor" strokeWidth="1.2" opacity=".5" /></svg>
        </div>
        {children}
        <div className="so-heimbalken" aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}

// ── Karussell ──────────────────────────────────────────────────────────────
export function InstaKarussell({ bilder, alt, beiWechsel }: { bilder: SocialDatei[]; alt: (i: number) => string; beiWechsel?: (i: number) => void }) {
  const spur = useRef<HTMLDivElement | null>(null);
  const [i, setI] = useState(0);
  const zug = useRef<{ x: number; links: number; id: number } | null>(null);
  const n = bilder.length;

  const gehe = useCallback((ziel: number, sanft = true) => {
    const el = spur.current;
    if (!el) return;
    const z = Math.max(0, Math.min(n - 1, ziel));
    el.scrollTo({ left: z * el.clientWidth, behavior: sanft && !ruhig() ? "smooth" : "auto" });
    setI(z);
  }, [n]);

  // Der Zähler folgt der Rolle — auch beim nativen Wischen am Handy.
  const gerollt = () => {
    const el = spur.current;
    if (!el || !el.clientWidth) return;
    const neu = Math.round(el.scrollLeft / el.clientWidth);
    if (neu !== i) setI(Math.max(0, Math.min(n - 1, neu)));
  };
  useEffect(() => { beiWechsel?.(i); }, [i, beiWechsel]);
  // Neue Bilder (anderer Post) → zurück auf Folie 1.
  useEffect(() => { gehe(0, false); }, [bilder.map((b) => b.id).join(","), gehe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mit der Maus ziehen wie mit dem Finger. Touch und Stift wischt der Browser selbst.
  const runter = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !spur.current) return;
    zug.current = { x: e.clientX, links: spur.current.scrollLeft, id: e.pointerId };
    spur.current.setPointerCapture(e.pointerId);
    spur.current.classList.add("zieht");
  };
  const ziehen = (e: PointerEvent<HTMLDivElement>) => {
    if (!zug.current || !spur.current) return;
    spur.current.scrollLeft = zug.current.links - (e.clientX - zug.current.x);
  };
  const los = (e: PointerEvent<HTMLDivElement>) => {
    const z = zug.current;
    const el = spur.current;
    if (!z || !el) return;
    zug.current = null;
    try { el.releasePointerCapture(z.id); } catch { /* schon frei */ }
    el.classList.remove("zieht");
    const dx = e.clientX - z.x;
    const start = Math.round(z.links / el.clientWidth);
    gehe(Math.abs(dx) > 40 ? start + (dx < 0 ? 1 : -1) : start);
  };
  const taste = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); gehe(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); gehe(i - 1); }
  };

  if (!n) return <div className="so-karussell" aria-label="Keine Bilder" />;
  return (
    <div className="so-karussell" aria-roledescription="Karussell" aria-label={`Karussell mit ${n} ${n === 1 ? "Bild" : "Bildern"}`}>
      <div ref={spur} className="spur" tabIndex={0} onScroll={gerollt} onKeyDown={taste}
        onPointerDown={runter} onPointerMove={ziehen} onPointerUp={los} onPointerCancel={los}
        aria-label="Wischen oder Pfeiltasten für die nächste Folie">
        {bilder.map((b, k) => (
          <div key={b.id} className="folie" role="group" aria-roledescription="Folie" aria-label={`${k + 1} von ${n}`} aria-hidden={k !== i}>
            <img src={b.url} alt={alt(k)} loading={k <= 1 ? "eager" : "lazy"} decoding="async" draggable={false}
              width={b.breite ?? undefined} height={b.hoehe ?? undefined} />
          </div>
        ))}
      </div>
      {n > 1 && <span className="zaehler" aria-live="polite">{i + 1}/{n}</span>}
      {n > 1 && i > 0 && <button type="button" className="pfeil links" aria-label="Vorige Folie" onClick={() => gehe(i - 1)}><Pfeil /></button>}
      {n > 1 && i < n - 1 && <button type="button" className="pfeil rechts" aria-label="Nächste Folie" onClick={() => gehe(i + 1)}><Pfeil rechts /></button>}
    </div>
  );
}

// ── Beitragstext mit „… mehr" wie in der App ──────────────────────────────
function Beitragstext({ handle, text, wann }: { handle: string; text: string; wann: string }) {
  const [auf, setAuf] = useState(false);
  // Wie die App: höchstens zwei Zeilen, dann „… mehr" in derselben Zeile.
  const zeilen = text.split("\n");
  const anfang = zeilen.slice(0, 2).join("\n").trimEnd();
  const kurz = anfang.length > 95 ? `${anfang.slice(0, 92).replace(/\s+\S*$/, "")}` : anfang;
  const lang = kurz.length < text.trimEnd().length;
  return (
    <div className="so-ig-text">
      <span className="rumpf"><b>{handle}</b>{auf || !lang ? text : kurz}</span>
      {lang && !auf && <>… <button type="button" className="mehr" onClick={() => setAuf(true)}>mehr</button></>}
      {wann && <span className="wann">{wann}</span>}
    </div>
  );
}

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
/** „6. Oktober" — so steht das Datum unter einem Beitrag. */
export const datumWieApp = (iso: string | null | undefined) => (iso && iso.length >= 10 ? `${Number(iso.slice(8, 10))}. ${MONATE[Number(iso.slice(5, 7)) - 1] ?? ""}` : "");

// ── Reel ───────────────────────────────────────────────────────────────────
export function InstaReel({ video, cover, handle, text, ki, titelbild }: {
  video: SocialDatei | null; cover: SocialDatei | null; handle: string; text: string; ki: boolean; titelbild: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [stumm, setStumm] = useState(false);
  const [anteil, setAnteil] = useState(0);
  const [fehler, setFehler] = useState(false);

  // Beim Umschalten auf das Titelbild hält das Video an.
  useEffect(() => { if (titelbild && ref.current) { ref.current.pause(); setLaeuft(false); } }, [titelbild]);

  const umschalten = async () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.muted = stumm;
      try { await v.play(); setLaeuft(true); setFehler(false); }
      catch {
        // Manche Browser lassen Ton erst nach einer Geste zu — dann stumm starten.
        try { v.muted = true; setStumm(true); await v.play(); setLaeuft(true); } catch { setFehler(true); }
      }
    } else { v.pause(); setLaeuft(false); }
  };
  const tonUm = () => {
    const v = ref.current;
    const neu = !stumm;
    setStumm(neu);
    if (v) v.muted = neu;
  };

  return (
    <div className="so-reel">
      {titelbild || !video ? (
        cover ? <img src={cover.url} alt="Titelbild des Reels" /> : null
      ) : (
        <video ref={ref} src={video.url} poster={cover?.url} playsInline loop preload="metadata"
          onTimeUpdate={(e) => { const v = e.currentTarget; setAnteil(v.duration ? v.currentTime / v.duration : 0); }}
          onPause={() => setLaeuft(false)} onPlay={() => setLaeuft(true)} onError={() => setFehler(true)} />
      )}
      {titelbild && <span className="titelbild-marke">Titelbild</span>}
      {!titelbild && video && (
        <>
          <button type="button" className="tippen" aria-label={laeuft ? "Anhalten" : "Abspielen mit Ton"} aria-pressed={laeuft} onClick={() => void umschalten()} />
          {!laeuft && <span className="spielen" aria-hidden="true"><Spielen /></span>}
          <button type="button" className="ton" aria-label={stumm ? "Ton an" : "Ton aus"} onClick={tonUm}>{stumm ? <TonAus /> : <TonAn />}</button>
          <span className="lauf" aria-hidden="true"><i style={{ width: `${Math.round(anteil * 1000) / 10}%` }} /></span>
        </>
      )}
      <div className="seite" aria-hidden="true"><Herz /><Sprechblase /><Senden /><Punkte /></div>
      <div className="unten">
        <div className="wer"><Avatar />{handle}</div>
        <p>{text}</p>
        {ki && <span className="so-ig-ki"><KiZeichen />KI-Info</span>}
        {fehler && <p role="alert">Das Video ließ sich hier nicht abspielen — der Download unten hat die Originaldatei.</p>}
      </div>
    </div>
  );
}

// ── Story ──────────────────────────────────────────────────────────────────
export function InstaStory({ bild }: { bild: SocialDatei | null }) {
  return (
    <div className="so-story">
      {bild && <img src={bild.url} alt="Story" />}
      <span className="frei oben">frei halten: Profil und Fortschritt</span>
      <span className="sticker">Sticker-Zone</span>
      <span className="frei unten">frei halten: Antworten-Feld</span>
    </div>
  );
}

// ── Der ganze Beitrag im Handy ─────────────────────────────────────────────
export interface HandyPost {
  format: SocialFormat;
  titel: string;
  caption: string;
  ki_noetig: boolean;
  dateien: SocialDatei[];
  plan_datum: string;
  alt_text: string | null;
  bildtexte: string[];
}

/** Die echte Vorschau eines Posts so, wie Instagram ihn zeigt. `titelbild` gilt für Reels. */
export function HandyRahmen({ post, handle, titelbild = false, beiFolie }: { post: HandyPost; handle: string; titelbild?: boolean; beiFolie?: (i: number) => void }) {
  const nach = (r: string) => post.dateien.filter((d) => d.rolle === r).sort((a, b) => a.pos - b.pos);
  const name = handle.replace(/^@/, "");
  // Die Punkte unter dem Bild folgen der Folie (wie in der App).
  const [folie, setFolie] = useState(0);
  const wechsel = useCallback((i: number) => { setFolie(i); beiFolie?.(i); }, [beiFolie]);

  if (post.format === "reel") {
    const video = nach("video")[0] ?? null;
    const cover = nach("cover")[0] ?? null;
    return (
      <Handy dunkel beschriftung={`Vorschau: Reel „${post.titel}“ auf Instagram`}>
        <InstaReel video={video} cover={cover} handle={name} text={post.caption} ki={post.ki_noetig} titelbild={titelbild} />
      </Handy>
    );
  }
  if (post.format === "story") {
    const bild = nach("story")[0] ?? nach("bild")[0] ?? null;
    return <Handy dunkel beschriftung={`Vorschau: Story „${post.titel}“`}><InstaStory bild={bild} /></Handy>;
  }

  const bilder = nach("bild");
  const altFuer = (i: number) => {
    const t = post.bildtexte[i];
    if (t) return `Folie ${i + 1}: ${t}`;
    return post.alt_text ? `${post.alt_text} (Folie ${i + 1})` : `Folie ${i + 1} von „${post.titel}“`;
  };
  return (
    <Handy beschriftung={`Vorschau: ${post.format === "karussell" ? "Karussell" : "Beitrag"} „${post.titel}“ auf Instagram`}>
      <div className="so-ig-leiste" aria-hidden="true"><Zurueck /><span><small>{name.toUpperCase()}</small>Beiträge</span></div>
      <div className="so-ig-rolle">
        <div className="so-ig-kopf">
          <Avatar />
          <span className="wer"><b>{name}</b>{post.ki_noetig ? <small className="so-ig-ki"><KiZeichen />KI-Info</small> : null}</span>
          <Punkte />
        </div>
        {post.format === "dokument" || post.format === "text" || !bilder.length ? (
          <p className="so-ohne">
            {post.format === "dokument"
              ? "LinkedIn-Dokument: die blätterbare Vorschau folgt in der nächsten Scheibe. Die PDF liegt rechts unter „Dateien“."
              : "Dieser Post hat kein Bild für Instagram — die Texte rechts sind für die Kanäle ohne Bild."}
          </p>
        ) : (
          <InstaKarussell bilder={bilder} alt={altFuer} beiWechsel={wechsel} />
        )}
        <div className="so-ig-aktionen" aria-hidden="true">
          <span className="links"><Herz /><Sprechblase /><Senden /></span>
          <span className="so-ig-punkte">{bilder.length > 1 ? bilder.map((b, k) => <i key={b.id} className={k === folie ? "an" : undefined} />) : null}</span>
          <span className="rechts"><Merken /></span>
        </div>
        <Beitragstext handle={name} text={post.caption} wann={datumWieApp(post.plan_datum)} />
      </div>
    </Handy>
  );
}
