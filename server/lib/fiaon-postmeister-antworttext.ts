// ═══════════════════════════════════════════════════════════════════════════
// DIE FERTIGE NACHRICHT — Anrede, Text, Gruß, HTML im Haus-CI (03.09.2026)
//
// JUSTIN: „der Agent muss auch in unseren HTML antworten, schreiben".
//
// Das Modell schreibt nur den Kern. Anrede und Gruß setzt der Server:
//   · Die ANREDE kommt aus der Person (`fiaon_persons.anrede`) — am 02.09.
//     nannte derselbe Automat dieselbe Person einmal „Herr" und einmal „Frau".
//     Ist sie unbekannt, wird sie EINMAL bestimmt und gespeichert; im Zweifel
//     bleibt es bei „Guten Tag Vorname Nachname" — richtig für jeden.
//   · Der GRUSS gehört zum Postfach, nicht zur Laune des Modells.
//
// Das HTML nutzt dasselbe Gerüst wie jede FIAON-Mail (Kopf, Typografie,
// Fußzeile, Pflichtangaben) — mit einem Knopf, wenn es einen nächsten Schritt
// mit Adresse gibt.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { mailHtml, mailText, type MailBaustein } from "../mail/geruest";
import type { NaechsterSchritt } from "@shared/fiaon-postmeister-typen";

/** Vornamen, bei denen die Anrede eindeutig ist. Alles andere bleibt neutral. */
const WEIBLICH = /^(anna|maria|julia|sabine|petra|claudia|andrea|susanne|monika|katrin|katharina|christina|christine|sandra|nicole|stefanie|melanie|jessica|jasmin|laura|lisa|lena|sarah|sara|nadine|tanja|silke|birgit|gabriele|gaby|heike|kerstin|martina|manuela|marion|ute|ulrike|angelika|barbara|beate|bettina|brigitte|carmen|daniela|denise|diana|doris|elke|erika|eva|franziska|gisela|hannelore|helga|ingrid|irene|iris|karin|kathrin|kristin|marlene|michaela|natalie|nina|patricia|rebecca|regina|renate|rita|ruth|simone|sonja|sylvia|tamara|theresa|vanessa|verena|veronika|victoria|viktoria|waltraud|yvonne|magdalena|teodora|verica|mirjana|milena|snezana|dragana|jelena|olga|elena|irina|natalia|svetlana|halina)$/i;
const MAENNLICH = /^(michael|thomas|andreas|peter|klaus|wolfgang|stefan|stephan|jürgen|juergen|christian|frank|uwe|martin|dieter|manfred|matthias|markus|marcus|bernd|joachim|alexander|daniel|sebastian|tobias|jan|jens|kai|lars|marcel|nico|patrick|rene|robert|sven|torsten|thorsten|ralf|rainer|reiner|norbert|helmut|horst|gerhard|günther|guenther|hans|heinz|herbert|karl|kurt|otto|rudolf|siegfried|walter|werner|willi|adem|ahmet|mehmet|mustafa|ali|hasan|ibrahim|dirk|dennis|erik|felix|florian|gregor|henry|jonas|julian|leon|lukas|maximilian|moritz|nikolas|oliver|philipp|simon|tim|tom|vitor|milan|nikola|goran|zoran|ivan|marko|petar|stefan)$/i;

export async function anredeBestimmen(personId: number | null, vorname: string | null, nachname: string | null): Promise<{ zeile: string; gespeichert: boolean }> {
  const vor = String(vorname || "").trim();
  const nach = String(nachname || "").trim();
  const neutral = `Guten Tag${vor || nach ? ` ${[vor, nach].filter(Boolean).join(" ")}` : ""},`;
  if (!personId) return { zeile: neutral, gespeichert: false };

  const [p] = (await sqlPool`SELECT anrede FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
  const bekannt = String(p?.anrede || "").trim();
  if (bekannt === "Herr" || bekannt === "Frau") return { zeile: `Guten Tag ${bekannt} ${nach || vor},`, gespeichert: true };
  if (bekannt === "neutral") return { zeile: neutral, gespeichert: true };

  // Einmal bestimmen, dann für immer behalten.
  const anrede = WEIBLICH.test(vor) ? "Frau" : MAENNLICH.test(vor) ? "Herr" : "neutral";
  await sqlPool`
    UPDATE fiaon_persons SET anrede = ${anrede}, anrede_quelle = 'vornamensliste', updated_at = NOW()
     WHERE id = ${personId} AND anrede IS NULL
  `.catch(() => {});
  return { zeile: anrede === "neutral" ? neutral : `Guten Tag ${anrede} ${nach || vor},`, gespeichert: true };
}

export interface FertigeAntwort { text: string; html: string }

/**
 * Setzt die Nachricht zusammen. `kern` ist der Text des Modells — ohne Anrede
 * und ohne Gruß.
 */
export function antwortBauen(ein: {
  anrede: string;
  kern: string;
  gruss: string;
  schritt?: NaechsterSchritt | null;
  betreff: string;
}): FertigeAntwort {
  const absaetze = String(ein.kern || "")
    .split(/\n{2,}/)
    .map((a) => a.trim().replace(/\n/g, " "))
    .filter(Boolean);

  const baustein: MailBaustein = {
    betreff: ein.betreff,
    preheader: absaetze[0]?.slice(0, 110) ?? "",
    titel: "",
    absaetze: [ein.anrede, ...absaetze],
    knopf: ein.schritt?.url ? { text: knopfText(ein.schritt), url: ein.schritt.url } : undefined,
    persoenlich: true,
  };

  const html = mailHtml(baustein);
  const text = [ein.anrede, "", ...absaetze, "", ein.schritt?.url ? `${knopfText(ein.schritt)}: ${ein.schritt.url}` : "", "", ein.gruss]
    .filter((z, i, a) => !(z === "" && a[i - 1] === "")).join("\n");
  return { text, html };
}

function knopfText(s: NaechsterSchritt): string {
  switch (s.art) {
    case "zahlung": return "Rechnung ansehen und bezahlen";
    case "termin": return "Termin wählen";
    case "startgespraech": return "Startgespräch buchen";
    case "bereich": return "Zu meinem Bereich";
    case "unterlagen": return "Unterlagen hochladen";
    case "antrag": return "Antrag starten";
    case "angebot": return "Angebot ansehen";
    default: return "Weiter";
  }
}
