// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM — DIE VORLAGE GEGEN DIE PAPIERFASSUNG (E-489, Nachbesserung 09.11.2026)
//
// Gutachten: „Wortgleich mit der Papierfassung ist der Text nur, wenn die Fallsätze genau stimmen — und dafür gibt
// es keine Prüfung.“ Dieses Modul rechnet ohne Datenbank und ohne Netz:
//   · drPapierBloecke: liest die Papierfassung (HTML aus der Vorlage des Hauses: p.auge, h1, p.unter, .partei mit
//     p-nr/p-name/p-text, p.seiten, h2 mit span.nr, p.abs mit span.z, ul.themen mit span.bu und i, ul.liste,
//     p.nach, Unterschriften mit u-wer/u-rolle) in Abschnitte mit Schlüssel („§ 4 (2)“, „Partei 3 Text“ …).
//   · drVorlageTextBloecke: dieselben Schlüssel aus den Blöcken der Vorlage (shared/fiaon-datenraum-nda.ts).
//   · drVergleichen: Abschnitt für Abschnitt; gewollt anders sind nur § 8 Abs. 1 (elektronisch, Anlage 1),
//     § 10 Abs. 5 (Datenraum als Unterschriftsweg) und die Anlage 1 selbst.
//   · drAusPapier: liest die Fallsätze (Zusätze des Raums, Projekte, geschützte Gesellschaften, Partei 3) aus der
//     Papierfassung — daraus werden raum.json und gast.json AUSSERHALB des Repos (scripts/datenraum.ts nda-aus-papier).
// Im Repo steht keine Fallangabe — nur der Weg, sie aus der Datei auf Justins Rechner zu lesen.
// ═══════════════════════════════════════════════════════════════════════════
import { NDA_FIAON, drPartei3Rolle, type DrAnrede, type DrGastAngaben, type DrNdaBlock, type DrNdaRaum } from "@shared/fiaon-datenraum-nda";

export interface DrTextBlock { schluessel: string; text: string }
/** Gewollte Abweichungen der elektronischen Fassung von der Papierfassung. */
export const DR_ERWARTET_ANDERS = ["§ 8 (1)", "§ 10 (5)", "Anlage 1"] as const;

const ENTITAETEN: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&shy;": "" };
/** Text ohne Auszeichnung, mit einfachen Leerzeichen — so werden beide Seiten verglichen. */
export function drTextNormal(s: string): string {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp|shy);/g, (m) => ENTITAETEN[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[    ]/g, " ").replace(/­/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ").trim();
}

/** Die Abschnitte der Papierfassung in Lesereihenfolge. */
export function drPapierBloecke(html: string): DrTextBlock[] {
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
  const out: DrTextBlock[] = [];
  let para = ""; let partei = ""; let unterschriften = false; let uWer = "";
  const re = /<(h1|h2|p|li)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  const span = (inner: string, k: string) => new RegExp(`<span class="${k}">([\\s\\S]*?)</span>`).exec(inner);
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase(); const inner = m[3];
    const klassen = new Set((/class="([^"]*)"/.exec(m[2] ?? "")?.[1] ?? "").split(/\s+/).filter(Boolean));
    const text = drTextNormal(inner);
    if (tag === "h1") { out.push({ schluessel: "titel", text }); continue; }
    if (tag === "h2") {
      const nr = span(inner, "nr");
      if (nr) { para = drTextNormal(nr[1]); out.push({ schluessel: `${para} Titel`, text: drTextNormal(inner.replace(nr[0], "")) }); }
      else if (/^Unterschriften$/i.test(text)) { unterschriften = true; para = ""; }
      continue;
    }
    if (unterschriften) {
      if (klassen.has("u-wer")) uWer = text;
      else if (klassen.has("u-rolle") && /^Partei 3\b/.test(uWer)) out.push({ schluessel: "Rolle Partei 3", text });
      continue;
    }
    if (tag === "li") {
      const bu = span(inner, "bu"); const z = span(inner, "z");
      if (bu) out.push({ schluessel: `${para} Thema ${drTextNormal(bu[1])}`, text: drTextNormal(inner.replace(bu[0], "")) });
      else if (z) out.push({ schluessel: `${para} ${drTextNormal(z[1])}`, text: drTextNormal(inner.replace(z[0], "")) });
      continue;
    }
    if (klassen.has("p-nr")) { partei = text; continue; }
    if (klassen.has("p-name")) { out.push({ schluessel: `${partei} Name`, text }); continue; }
    if (klassen.has("p-text")) { out.push({ schluessel: `${partei} Text`, text }); continue; }
    for (const k of ["auge", "unter", "zwischen", "seiten"]) if (klassen.has(k)) { out.push({ schluessel: k, text }); break; }
    if (["auge", "unter", "zwischen", "seiten"].some((k) => klassen.has(k))) continue;
    if (klassen.has("nach")) { out.push({ schluessel: `${para} nach`, text }); continue; }
    if (klassen.has("abs")) {
      const z = span(inner, "z");
      const zz = z ? drTextNormal(z[1]) : "";
      out.push({ schluessel: zz ? `${para} ${zz}` : para, text: drTextNormal(z ? inner.replace(z[0], "") : inner) });
      continue;
    }
    if (para && klassen.size === 0) out.push({ schluessel: para, text });
  }
  return out;
}

/** Dieselben Abschnitte aus den Blöcken der Vorlage (und die Rollenzeile unter der Unterschrift von Partei 3). */
export function drVorlageTextBloecke(bloecke: DrNdaBlock[], gast?: Pick<DrGastAngaben, "anrede" | "firma"> | null): DrTextBlock[] {
  const out: DrTextBlock[] = [];
  let para = ""; let vorher = "";
  for (const b of bloecke) {
    switch (b.art) {
      case "auge": case "titel": case "unter": case "zwischen": out.push({ schluessel: b.art, text: drTextNormal(b.text) }); break;
      case "partei": out.push({ schluessel: `${b.nr} Name`, text: drTextNormal(b.name) }, { schluessel: `${b.nr} Text`, text: drTextNormal(b.text) }); break;
      case "text": out.push({ schluessel: "seiten", text: drTextNormal(b.text) }); break;
      case "paragraf": para = b.nr; out.push({ schluessel: `${para} Titel`, text: drTextNormal(b.titel) }); break;
      case "abs": out.push({ schluessel: b.z ? `${para} ${b.z}` : vorher === "punkt" ? `${para} nach` : para, text: drTextNormal(b.text) }); break;
      case "punkt": out.push({ schluessel: `${para} ${b.z}`, text: drTextNormal(b.text) }); break;
      case "thema": out.push({ schluessel: `${para} Thema ${b.bu}`, text: drTextNormal(`${b.titel} – ${b.text}`) }); break;
      case "anlage": out.push({ schluessel: b.nr, text: drTextNormal(`${b.titel} ${b.zeilen.join(" ")}`) }); break;
    }
    vorher = b.art;
  }
  if (gast) out.push({ schluessel: "Rolle Partei 3", text: drTextNormal(drPartei3Rolle(gast)) });
  return out;
}

/** Wort-Unterschied kurz und lesbar: „… [-alt-] {+neu+} …“ (gemeinsame Strecken gekürzt). */
export function drWortDiff(a: string, b: string): string {
  const x = a.split(" ").slice(0, 700); const y = b.split(" ").slice(0, 700);
  const n = x.length; const m = y.length;
  const l: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) l[i][j] = x[i] === y[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  const teile: string[] = []; let gleich: string[] = [];
  const gleichAus = (ende: boolean) => {
    if (!gleich.length) return;
    teile.push(gleich.length > 8 ? `${teile.length ? gleich.slice(0, 3).join(" ") + " … " : "… "}${ende ? "" : gleich.slice(-3).join(" ")}`.trim() : gleich.join(" "));
    gleich = [];
  };
  let i = 0; let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) { gleich.push(x[i]); i++; j++; continue; }
    gleichAus(false);
    const weg: string[] = []; const neu: string[] = [];
    while ((i < n || j < m) && !(i < n && j < m && x[i] === y[j])) {
      if (j >= m || (i < n && l[i + 1][j] >= l[i][j + 1])) weg.push(x[i++]); else neu.push(y[j++]);
    }
    if (weg.length) teile.push(`[-${weg.join(" ")}-]`);
    if (neu.length) teile.push(`{+${neu.join(" ")}+}`);
  }
  gleichAus(true);
  return teile.join(" ");
}

export interface DrVergleich {
  gleich: string[];
  anders: { schluessel: string; papier: string; vorlage: string; diff: string; erwartet: boolean }[];
  nurPapier: string[];
  nurVorlage: string[];
  /** Nur die gewollten Abweichungen (§ 8 Abs. 1, § 10 Abs. 5, Anlage 1). */
  gruen: boolean;
}
export function drVergleichen(papier: DrTextBlock[], vorlage: DrTextBlock[]): DrVergleich {
  const karte = (l: DrTextBlock[]) => { const k = new Map<string, string>(); for (const b of l) { let s = b.schluessel; let i = 2; while (k.has(s)) s = `${b.schluessel} #${i++}`; k.set(s, b.text); } return k; };
  const p = karte(papier); const v = karte(vorlage);
  const erwartet = (s: string) => (DR_ERWARTET_ANDERS as readonly string[]).includes(s);
  const erg: DrVergleich = { gleich: [], anders: [], nurPapier: [], nurVorlage: [], gruen: true };
  for (const [s, t] of Array.from(p.entries())) {
    if (!v.has(s)) { erg.nurPapier.push(s); if (!erwartet(s)) erg.gruen = false; continue; }
    const u = v.get(s)!;
    if (u === t) erg.gleich.push(s);
    else { erg.anders.push({ schluessel: s, papier: t, vorlage: u, diff: drWortDiff(t, u), erwartet: erwartet(s) }); if (!erwartet(s)) erg.gruen = false; }
  }
  for (const s of Array.from(v.keys())) if (!p.has(s)) { erg.nurVorlage.push(s); if (!erwartet(s)) erg.gruen = false; }
  return erg;
}

/** Was die Papierfassung über den Fall sagt — Zusätze des Raums, Projekte und Partei 3. */
export interface DrAusPapier {
  raum: { nda: DrNdaRaum; projekte: { schluessel: string; titel: string; beschreibung: string; ndaText: string; geschuetzt: string }[] };
  gast: DrGastAngaben;
  fehler: string[];
}
export function drAusPapier(bl: DrTextBlock[]): DrAusPapier {
  const t = (s: string) => bl.find((b) => b.schluessel === s)?.text ?? "";
  const fehler: string[] = [];
  const ohneSchluss = (s: string) => s.replace(/[\s.;,]+$/g, "");
  // Partei 2
  const p2 = /^persönlich, (.*); geschäftsansässig c\/o FIAON LTD, Anschrift wie Partei 1$/.exec(t("Partei 2 Text"));
  if (!p2) fehler.push("Partei 2: Satz nicht erkannt.");
  const partei2Zusatz = p2 && p2[1] !== NDA_FIAON.partei2Zusatz ? p2[1] : null;
  // Partei 3
  const nameRoh = t("Partei 3 Name");
  const an = /^(Herr|Frau)\s+(.*)$/.exec(nameRoh);
  const anrede: DrAnrede = an ? (an[1] === "Herr" ? "herr" : "frau") : "";
  const namen = (an ? an[2] : nameRoh).trim().split(/\s+/);
  const p3 = /^(.*?), handelnd im eigenen Namen sowie (.*)$/.exec(t("Partei 3 Text"));
  let strasse = ""; let plz = ""; let ort = ""; let land = ""; let firma = ""; let funktion = "";
  if (!p3) fehler.push("Partei 3: Anschrift nicht erkannt.");
  else {
    const teile = p3[1].split(", ");
    land = teile.length >= 3 ? teile[teile.length - 1] : "";
    const po = /^(\S+)\s+(.*)$/.exec(teile.length >= 3 ? teile[teile.length - 2] : teile[1] ?? "");
    plz = po?.[1] ?? ""; ort = po?.[2] ?? "";
    strasse = teile.slice(0, teile.length >= 3 ? -2 : 1).join(", ");
    const rest = /^(?:als (.+?) )?für (?:(.+?) und für )?die Gesellschaften, die (?:er|sie|Partei 3) der FIAON-Seite per E-Mail benennt$/.exec(p3[2]);
    if (!rest) fehler.push("Partei 3: Firma/Funktion nicht erkannt.");
    else { funktion = rest[1] ?? ""; firma = rest[2] ?? ""; }
  }
  const mails = Array.from(t("§ 9").matchAll(/\(([^()\s]+@[^()\s]+)\)/g)).map((x) => x[1]).filter((x) => x.toLowerCase() !== NDA_FIAON.kontaktEmail);
  if (!mails.length) fehler.push("§ 9: E-Mail von Partei 3 nicht erkannt.");
  const gast: DrGastAngaben = {
    anrede, vorname: namen.slice(0, -1).join(" "), nachname: namen[namen.length - 1] ?? "", firma, funktion, strasse, plz, ort, land,
    email: mails[0] ?? "", telefon: "", weitergabe: "",
  };
  // Zusätze des Raums
  const v = /vorgestellt, (.*) \(die „Themen“\):$/.exec(t("§ 1 (1)"));
  const z = /genutzt werden, also (.*) \(der „Zweck“\)\.$/.exec(t("§ 1 (2)"));
  const va = /ausgetauschten Informationen, insbesondere (.*), sowie Tatsache und Inhalt der Gespräche/.exec(t("§ 2 (1)"));
  const z4 = /nur für Geschäfte zu [^.]*?\. (.*?) ?Wird eine Seite von einem geschützten Kontakt/.exec(t("§ 4 (2)"));
  const nda: DrNdaRaum = { vorgestellt: v?.[1] ?? null, zweck: z?.[1] ?? null, vorab: va?.[1] ?? null, partei2Zusatz, zusatz4: z4?.[1]?.trim() || null };
  // Projekte und geschützte Gesellschaften
  const themen = bl.filter((b) => /^§ 1 Thema /.test(b.schluessel)).map((b) => {
    const bu = b.schluessel.replace(/^§ 1 Thema /, "");
    const i = b.text.indexOf(" – ");
    return { bu, titel: i > 0 ? b.text.slice(0, i) : b.text, text: ohneSchluss(i > 0 ? b.text.slice(i + 3) : "") };
  });
  if (!themen.length) fehler.push("§ 1: keine Themen erkannt.");
  const st = /Geschützte Kontakte der FIAON-Seite sind ausserdem stets (.+?), jeweils mit ihren Organen/.exec(t("§ 4 (1)"));
  const geschuetzt = new Map<string, string>();
  if (st && st[1] !== "die in § 1 beschriebenen Gesellschaften") {
    for (const name of st[1].split(/, | und /).map((x) => x.trim()).filter(Boolean)) {
      const begriff = name.replace(/^(die|der|das|den)\s+/i, "");
      const th = themen.find((x) => x.text.includes(`„${begriff}“`));
      if (th) geschuetzt.set(th.bu, name); else fehler.push(`§ 4 Abs. 1: „${name}“ passt zu keinem Thema.`);
    }
  }
  return {
    raum: { nda, projekte: themen.map((x) => ({ schluessel: x.bu.toLowerCase(), titel: x.titel, beschreibung: "", ndaText: x.text, geschuetzt: geschuetzt.get(x.bu) ?? "" })) },
    gast, fehler,
  };
}
