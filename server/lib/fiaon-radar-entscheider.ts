// ═══════════════════════════════════════════════════════════════════════════
// FIRMEN-RADAR — DEN ENTSCHEIDER FINDEN (12.10.2026, E-337)
//
// Justin: „Mara muss viel qualitativer recherchieren — keine info, office, welcome Emails oder so.“
//
// Die erste Mail geht nur noch an einen MENSCHEN aus Geschäftsführung, Inhaberschaft oder Vorstand, und nur an
// eine Adresse, die WÖRTLICH irgendwo öffentlich steht. Drei Stufen, die billigste zuerst:
//   1. Website: Impressum, Kontakt, Team, Über uns — Namen der Vertreter aus dem Impressum, persönliche Adressen
//      der eigenen Domäne, die zu einem dieser Namen passen (radarAdressePersoenlich).
//   2. Websuche (KI): Pressemitteilungen, Verbands-, Kammer- und Messeverzeichnisse. Die KI nennt Adresse + Seite;
//      der Server liest die Seite und findet die Adresse dort selbst — sonst zählt sie nicht.
//   3. Nichts gefunden: keine erste Mail. Die Firma bleibt im Vorrat, die Sammeladresse bleibt nur zur Ansicht.
// E-458 (29.10.2026, Punkt 5): Zwischen 1 und 2 die Ableitung (kostenlos): Stehen auf den gelesenen Seiten persönliche
// Adressen ANDERER Menschen derselben Domäne mit Namen, die alle genau einem Muster folgen (a.schmidt@ → {v}.{nachname}),
// und nimmt die Domäne Post an (MX), wird die Adresse der Geschäftsführung nach diesem Muster gebildet — mit Beleg
// (Beispieladresse, Name, Seite). Ohne Beispiel, bei Widerspruch, ohne MX oder bei Doppel-/Partikelnamen: nie. Kommt
// eine abgeleitete Adresse als unzustellbar zurück, ist das Muster widerlegt (muster_widerlegt) — keine zweite
// Ableitung, die Firma geht in den Brief-Vorrat. Die Websuche fragt zusätzlich nach solchen Beispielen.
// „Herr“/„Frau“ steht in der Anrede nur, wenn es auf der Quelle wörtlich vor dem Nachnamen steht — geraten wird
// das Geschlecht nie.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  ensureRadarTabellen, radarKi, zeileLesen, robotsWaechter, seiteHolen, kontaktVerweise, adressenAusSeite, radarMotorEinstellung, RadarFehler,
} from "./fiaon-radar";
import {
  radarAdressePersoenlich, radarAdressePruefen, radarNamensteile, radarMusterVon, radarAdressMusterLernen, radarAdresseAbleiten,
  type RadarAdressBeispiel, type RadarAdressMuster,
} from "@shared/fiaon-radar";
import { mailDomain } from "./fiaon-mx";

export interface Entscheider {
  name: string;
  rolle: string | null;
  email: string;
  anrede: "Herr" | "Frau" | null;
  quelle: string;
  weg: "website" | "web" | "abgeleitet";
  am: string;
  /** E-458: nur bei weg = abgeleitet — das belegte Muster, das Beispiel (Adresse, Name, Seite) und der MX-Befund. */
  muster?: RadarAdressMuster;
  beleg?: { adresse: string; name: string; url: string | null };
  mx?: "mx";
  /** Die abgeleitete Adresse kam unzustellbar zurück — nie wieder ableiten, Brief statt Mail. */
  muster_widerlegt?: boolean;
}

const NAME_IM_TEXT = /([A-ZÄÖÜ][a-zäöüßéè]+(?:-[A-ZÄÖÜ][a-zäöüßéè]+)?)\s+((?:(?:von|van|vom|zu|zur|zum|de|der|den)\s+)?[A-ZÄÖÜ][a-zäöüßéè]+(?:-[A-ZÄÖÜ][a-zäöüßéè]+)?)/g;

/**
 * E-458 (Befund Ableitung): Im Deutschen ist JEDES Paar großgeschriebener Wörter ein „Name“ für NAME_IM_TEXT — „Abteilung
 * Export · export@“, „Niederlassung Hamburg · hamburg@“, „Messe Frankfurt · messe@“. Solche Wörter sind nie Vor- oder
 * Nachname eines Menschen, und ein Name aus dem Text zählt nur mit Personenkontext (Herr/Frau/Dr. davor oder eine Rolle in
 * der Nähe). Namen aus dem Impressum (Vertreter) gelten ohne Kontext.
 */
const KEIN_NAME = /^(abteilung|abt|niederlassung|filiale|zweigstelle|standort|standorte|werk|lager|halle|zentrale|hauptsitz|sitz|firmensitz|büro|buero|office|messe|messen|team|kontakt|service|kundenservice|kundendienst|vertrieb|verkauf|export|import|einkauf|empfang|rezeption|technik|support|marketing|presse|personal|buchhaltung|verwaltung|geschäftsleitung|geschaeftsleitung|geschäftsführung|geschaeftsfuehrung|leitung|logistik|produktion|qualität|qualitaet|montage|planung|projekt|projekte|region|gebiet|bereich|showroom|shop|store|online|kanzlei|sekretariat|redaktion|labor|praxis|akademie|schulung|karriere|jobs|bewerbung|bewerbungen|datenschutz|impressum|telefon|fax|mobil|adresse|anschrift|öffnungszeiten|oeffnungszeiten|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|deutschland|österreich|schweiz|europa|international|gmbh|ag|kg|holding|gruppe|group|ihre|ihr|unser|unsere|bitte|allgemein|allgemeine|zentral|weitere|neue|neuer|aktuelle|news|blog|home|startseite|über|ueber|uns|wir|sie|mehr|alle|unternehmen)$/i;
const PERSON_KONTEXT = /\b(herr|herrn|frau|dr\.?|prof\.?|geschäftsführ\w*|geschaeftsfuehr\w*|inhaber\w*|leiter\w*|leitung|ansprechpartner\w*|prokurist\w*|assistenz|assistent\w*|referent\w*|berater\w*|manager\w*|head of|director|partner\w*|gesellschafter\w*|vorstand|mitarbeiter\w*|sachbearbeiter\w*|projektleiter\w*|teamleiter\w*|rechtsanwalt|rechtsanwältin|steuerberater\w*|key account)\b/i;
/** Ein Name aus dem Text rund um die Adresse: zwei echte Namenswörter (kein Abteilungs-, Orts- oder Füllwort) mit Personenkontext. Rein. */
export function nameImTextTaugt(name: string, fenster: string): boolean {
  const teile = String(name ?? "").split(/\s+/).filter((t) => !/^(von|van|vom|zu|zur|zum|de|der|den)$/i.test(t));
  if (teile.length < 2 || teile.some((t) => KEIN_NAME.test(t.split("-")[0]))) return false;
  return PERSON_KONTEXT.test(String(fenster ?? ""));
}

/**
 * Beispiele für das Adress-Muster: persönliche Adressen der eigenen Domäne auf den gelesenen Seiten, je mit dem Namen, zu
 * dem sie passen (Vertreter aus dem Impressum oder ein Name MIT Personenkontext im Text rund um die Adresse, ±200 Zeichen). Rein.
 */
export function adressBeispiele(seiten: { url: string; text: string; html: string }[], domain: string, namen: string[]): RadarAdressBeispiel[] {
  const aus: RadarAdressBeispiel[] = [];
  const gesehen = new Set<string>();
  for (const s of seiten) {
    for (const adresse of adressenAusSeite(s, domain)) {
      const a = adresse.toLowerCase();
      const lokal = a.split("@")[0] ?? "";
      if (gesehen.has(a) || a.split("@")[1] !== domain.toLowerCase()) continue;
      const i = s.text.toLowerCase().indexOf(a);
      const fenster = i >= 0 ? s.text.slice(Math.max(0, i - 200), i + a.length + 200)
        : (() => { const j = s.html.toLowerCase().indexOf(a); return j >= 0 ? s.html.slice(Math.max(0, j - 400), j + a.length + 400).replace(/<[^>]+>/g, " ") : ""; })();
      const ausText = Array.from(fenster.matchAll(NAME_IM_TEXT)).map((m) => `${m[1]} ${m[2]}`).filter((n) => nameImTextTaugt(n, fenster));
      const kandidaten = [...namen, ...ausText];
      const name = kandidaten.find((n) => radarMusterVon(lokal, n).length === 1);
      if (!name) continue;
      gesehen.add(a);
      aus.push({ adresse: a, name, url: s.url });
    }
  }
  return aus;
}

const ROLLE_CHEF = /geschäftsführ|geschaeftsfuehr|inhaber|ceo|vorstand|director|gründer|gruender|founder|präsident|praesident|managing|partner|gesellschafter/i;

/** Steht „Herr X“ / „Frau X“ wörtlich im Text? Dann (und nur dann) diese Anrede. Rein. */
export function anredeAusText(text: string, nachname: string): "Herr" | "Frau" | null {
  const n = String(nachname ?? "").trim();
  if (n.length < 2) return null;
  const sicher = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = String(text ?? "").match(new RegExp(`\\b(Herr|Herrn|Frau)\\s+(?:(?:Dr|Prof|Dipl|Mag)\\.?[\\s-]*(?:[A-Za-zäöüÄÖÜ.-]+\\s+)?)?(?:[A-ZÄÖÜ][\\wäöüß-]+\\s+)?${sicher}\\b`));
  if (!m) return null;
  return m[1] === "Frau" ? "Frau" : "Herr";
}

function nachnameVon(name: string): string {
  const teile = String(name ?? "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  // „Claudius zur Linden“ → „zur Linden“ (Partikel bleiben am Nachnamen)
  const idx = teile.findIndex((t, i) => i > 0 && /^(von|van|vom|zu|zur|zum|de|del|di|da|le|la)$/i.test(t));
  return idx > 0 ? teile.slice(idx).join(" ") : (teile[teile.length - 1] ?? "");
}

const SCHEMA_SUCHE = {
  type: "object", additionalProperties: false,
  properties: {
    personen: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { name: { type: "string" }, rolle: { type: "string" }, email: { type: "string" }, url: { type: "string" } },
        required: ["name", "rolle", "email", "url"],
      },
    },
    // E-458: andere Menschen derselben Firma mit persönlicher Adresse — nur als Beispiel für das Adress-Muster.
    beispiele: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { name: { type: "string" }, email: { type: "string" }, url: { type: "string" } },
        required: ["name", "email", "url"],
      },
    },
  },
  required: ["personen", "beispiele"],
};

/** Sucht den Entscheider einer Firma und speichert ihn (oder „nichts gefunden“). websuche=false: nur die Website. */
export async function entscheiderFinden(id: number, opts: { websuche?: boolean } = {}): Promise<Entscheider | null> {
  await ensureRadarTabellen();
  const f: any = zeileLesen(((await sqlPool`SELECT * FROM fiaon_radar_firmen WHERE id = ${id}`) as any[])[0]);
  if (!f) throw new RadarFehler("Firma nicht gefunden.", 404);
  const imp = f.impressum ?? {};
  const vertreter: { name: string; rolle: string | null }[] = (Array.isArray(imp.vertreter) ? imp.vertreter : [])
    .map((v: any) => ({ name: String(v?.name || [v?.vorname, v?.nachname].filter(Boolean).join(" ")).trim(), rolle: v?.funktion ? String(v.funktion) : null }))
    .filter((v: any) => v.name.split(/\s+/).length >= 2);
  const chefs = vertreter.filter((v) => !v.rolle || ROLLE_CHEF.test(v.rolle));
  const namen = (chefs.length ? chefs : vertreter).map((v) => v.name);
  const ungueltig = String(f.email_ungueltig ?? "").split(",").map((x: string) => x.trim()).filter(Boolean);

  // E-458: War eine abgeleitete Adresse schon unzustellbar, bleibt das so vermerkt — und es wird nie wieder abgeleitet.
  const widerlegt = f.entscheider?.muster_widerlegt === true;
  const motor = await radarMotorEinstellung();
  const merken = async (eRoh: Entscheider | null) => {
    const e = eRoh && widerlegt ? { ...eRoh, muster_widerlegt: true } : eRoh;
    if (!e && widerlegt) {
      await sqlPool`UPDATE fiaon_radar_firmen SET entscheider_am = NOW(), updated_at = NOW() WHERE id = ${id}`;
      return null;
    }
    if (e) {
      await sqlPool`UPDATE fiaon_radar_firmen SET entscheider = ${sqlPool.json(e as any)}, entscheider_am = NOW(), email = ${e.email},
                      ansprechpartner = ${`${e.name}${e.rolle ? ` (${e.rolle})` : ""}`.slice(0, 200)},
                      status = CASE WHEN status = 'ohne_kontakt' THEN 'neu' ELSE status END, updated_at = NOW() WHERE id = ${id}`;
    } else {
      await sqlPool`UPDATE fiaon_radar_firmen SET entscheider = NULL, entscheider_am = NOW(), updated_at = NOW() WHERE id = ${id}`;
    }
    return e;
  };

  // ── 1. Die Website ──
  const waechter = robotsWaechter();
  const start = await seiteHolen(f.website, waechter);
  const seiten: { url: string; text: string; html: string }[] = start ? [start] : [];
  if (start) {
    const basis = new URL(start.url);
    const ziele = kontaktVerweise(start.html, basis).slice(0, 4);
    for (const pfad of ["/impressum", "/kontakt", "/team", "/ueber-uns", "/about", "/unternehmen", "/about-us", "/management"]) {
      if (ziele.length >= 8) break;
      const u = new URL(pfad, basis);
      if (!ziele.some((z) => z.pathname === u.pathname)) ziele.push(u);
    }
    if (imp.seite) { try { const u = new URL(String(imp.seite)); if (!ziele.some((z) => z.href === u.href)) ziele.unshift(u); } catch { /* egal */ } }
    for (const u of ziele.slice(0, 8)) {
      const s = await seiteHolen(u, waechter, 500_000);
      if (s) seiten.push(s);
    }
  }
  const fund = (email: string, seite: { url: string; text: string }, weg: "website" | "web"): Entscheider | null => {
    const e = email.toLowerCase();
    if (ungueltig.includes(e)) return null;
    if (!radarAdressePruefen(e, f.domain, f.name).ok) return null;
    const person = (chefs.length ? chefs : vertreter).find((v) => radarAdressePersoenlich(e, [v.name]));
    if (namen.length && !person) return null;
    if (!namen.length && !radarAdressePersoenlich(e, [])) return null;
    const name = person?.name ?? "";
    if (!name) return null;
    return { name, rolle: person?.rolle ?? null, email: e, anrede: anredeAusText(seite.text, nachnameVon(name)), quelle: seite.url, weg, am: new Date().toISOString() };
  };
  for (const s of seiten) {
    for (const a of adressenAusSeite(s, f.domain)) {
      const e = fund(a, s, "website");
      if (e) return merken(e);
    }
  }

  // ── 1b. Die Ableitung (E-458): nur mit belegtem Muster der eigenen Domäne und MX — kostenlos ──
  const chef = (chefs.length ? chefs : vertreter)[0] ?? null;
  const beispiele = adressBeispiele(seiten, f.domain, namen);
  const ableiten = async (liste: RadarAdressBeispiel[]): Promise<Entscheider | null> => {
    if (!motor.ableitung || widerlegt || !chef) return null;
    const muster = radarAdressMusterLernen(liste, f.domain);
    const adresse = radarAdresseAbleiten(chef.name, muster, f.domain, liste);
    if (!muster || !adresse || ungueltig.includes(adresse)) return null;
    if (!radarAdressePruefen(adresse, f.domain, f.name).ok || !radarAdressePersoenlich(adresse, [chef.name])) return null;
    if ((await mailDomain(f.domain)) !== "mx") return null;
    const beleg = liste.find((b) => radarMusterVon(b.adresse.split("@")[0], b.name)[0] === muster) ?? liste[0];
    const anrede = seiten.map((x) => anredeAusText(x.text, nachnameVon(chef.name))).find(Boolean) ?? null;
    return { name: chef.name, rolle: chef.rolle, email: adresse, anrede, quelle: beleg?.url ?? f.website, weg: "abgeleitet", am: new Date().toISOString(),
      muster, beleg: { adresse: beleg.adresse, name: beleg.name, url: beleg.url ?? null }, mx: "mx" };
  };
  const abgeleitet = await ableiten(beispiele);
  if (abgeleitet) return merken(abgeleitet);

  // ── 2. Die Websuche ──
  if (opts.websuche === false) return merken(null);
  const { daten } = await radarKi<{ personen: { name: string; rolle: string; email: string; url: string }[]; beispiele?: { name: string; email: string; url: string }[] }>({
    zweck: "radar_entscheider",
    anweisung: [
      "Du suchst für einen persönlichen Brief den richtigen Ansprechpartner in einer Firma: eine Person aus Geschäftsführung, Inhaberschaft oder Vorstand — und deren PERSÖNLICHE geschäftliche E-Mail-Adresse.",
      "Nutze die Websuche: Website der Firma (Impressum, Team, Kontakt, Presse), Pressemitteilungen, Verbands-, Kammer-, Messe- und Ausstellerverzeichnisse, Fachartikel.",
      "NUR Adressen, die WÖRTLICH auf einer Seite stehen, die du gefunden hast — url ist genau diese Seite. Nichts erraten, nichts aus Mustern ableiten (kein vorname.nachname@ auf Verdacht).",
      "KEINE Sammeladressen (info@, office@, kontakt@, hello@, welcome@, service@, support@, vertrieb@, sales@ …).",
      "Antworte mit bis zu drei Personen, die beste zuerst. Findest du nichts Belegbares: personen = [].",
      "beispiele = bis zu drei ANDERE Menschen derselben Firma (Team, Presse, Vertrieb …) mit ihrer persönlichen Adresse DIESER Domäne, die WÖRTLICH auf der genannten Seite steht — nur als Beispiel, wie die Firma Adressen bildet. Nichts erraten. Keine gefunden: beispiele = [].",
      "Antworte ausschließlich im vorgegebenen JSON.",
    ].join("\n"),
    eingabe: `Firma: ${f.name} (${f.website}), ${f.ort ?? ""} ${f.land ?? ""}. Bekannte Vertreter laut Impressum: ${namen.join(", ") || "unbekannt"}.`,
    schema: SCHEMA_SUCHE, webSuche: true, aufwand: "low", maxTokens: 6000,
  });
  for (const p of (daten?.personen ?? []).slice(0, 3)) {
    const e = await entscheiderBelegen(id, p, { seiten, firma: f, namen: [] });
    if (e) return e;
  }
  // E-458: Beispiele aus der Websuche — nur, was auf der genannten Seite wörtlich steht (Adresse UND Name), zählt fürs Muster.
  const weitere: RadarAdressBeispiel[] = [];
  for (const b of (daten?.beispiele ?? []).slice(0, 3)) {
    const email = String(b?.email ?? "").trim().toLowerCase();
    const url = String(b?.url ?? "").trim();
    if (!email.endsWith(`@${f.domain}`) || !/^https?:\/\//i.test(url)) continue;
    const s = seiten.find((x) => x.url === url) ?? await seiteHolen(url, robotsWaechter(), 800_000);
    if (!s || !adressenAusSeite(s, f.domain).includes(email)) continue;
    const flach = (t: string) => t.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    if (!radarNamensteile(b.name).every((t) => flach(s.text).includes(t))) continue;
    weitere.push({ adresse: email, name: String(b.name), url: s.url });
  }
  if (weitere.length) {
    const nachSuche = await ableiten([...beispiele, ...weitere]);
    if (nachSuche) return merken(nachSuche);
  }
  return merken(null);
}

/**
 * Prüft einen genannten Entscheider (aus der Websuche oder schon aus der Firmensuche): Seite lesen, Adresse muss dort
 * wörtlich stehen, Name ebenso, Adresse persönlich und zur Firma passend. Gespeichert wird nur, was besteht.
 */
export async function entscheiderBelegen(id: number, p: { name?: string; rolle?: string; email?: string; url?: string } | null | undefined,
  ctx: { seiten?: { url: string; text: string; html: string }[]; firma?: any; namen?: string[] } = {}): Promise<Entscheider | null> {
  const email = String(p?.email ?? "").trim().toLowerCase();
  const url = String(p?.url ?? "").trim();
  const name = String(p?.name ?? "").trim();
  if (!email.includes("@") || !/^https?:\/\//i.test(url) || name.split(/\s+/).length < 2 || !radarNamensteile(name).length) return null;
  const f: any = ctx.firma ?? zeileLesen(((await sqlPool`SELECT * FROM fiaon_radar_firmen WHERE id = ${id}`) as any[])[0]);
  if (!f) return null;
  const ungueltig = String(f.email_ungueltig ?? "").split(",").map((x: string) => x.trim()).filter(Boolean);
  if (ungueltig.includes(email) || !radarAdressePruefen(email, f.domain, f.name).ok || !radarAdressePersoenlich(email, [name])) return null;
  const s = (ctx.seiten ?? []).find((x) => x.url === url) ?? await seiteHolen(url, robotsWaechter(), 800_000);
  if (!s || (!adressenAusSeite(s, f.domain).includes(email) && !adressenAusSeite(s).includes(email))) return null;
  // Der Name muss auf derselben Seite stehen (sonst gehört die Adresse vielleicht einem anderen Menschen).
  const flach = (t: string) => t.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const seitenText = flach(s.text);
  if (!radarNamensteile(name).every((t) => seitenText.includes(t))) return null;
  const e: Entscheider = { name, rolle: p?.rolle ? String(p.rolle).slice(0, 80) : null, email, anrede: anredeAusText(s.text, nachnameVon(name)), quelle: s.url, weg: "web", am: new Date().toISOString() };
  await sqlPool`UPDATE fiaon_radar_firmen SET entscheider = ${sqlPool.json(e as any)}, entscheider_am = NOW(), email = ${e.email},
                  ansprechpartner = ${`${e.name}${e.rolle ? ` (${e.rolle})` : ""}`.slice(0, 200)},
                  status = CASE WHEN status = 'ohne_kontakt' THEN 'neu' ELSE status END, updated_at = NOW() WHERE id = ${id}`;
  return e;
}
