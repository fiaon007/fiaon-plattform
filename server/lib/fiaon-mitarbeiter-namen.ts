// ═══════════════════════════════════════════════════════════════════════════
// DIE MITARBEITERLISTE FÜR DIE HARTE NAMENSPRÜFUNG (29.09.2026, E-265)
//
// Justin: „nicht ‚Daniel, Florentine, Nikita' schreiben, sondern die Nachnamen,
// zum letzten Mal!!" Die Regel steht in shared/fiaon-mitarbeiter-name.ts; hier
// holt der Server, WESSEN Vorname nie allein in einem Kundentext stehen darf:
// alle echten Konten (keine Testkonten — deren Vornamen wie „Demo" wären
// Fehlalarme), dazu der Vertreter der Team-Abwesenheit (E-260, heute Justins
// Testkonto 928 — er ruft an, also darf auch „Justin" nie allein stehen).
// 10 Minuten zwischengespeichert; bei einer Störung der letzte Stand, sonst leer
// (dann prüft die Wand ohne Liste — lieber eine Lücke als kein Versand).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { nennform, anredeLesen, type MitarbeiterEintrag } from "@shared/fiaon-mitarbeiter-name";

type Lauf = typeof sqlPool;

let zwischen: { liste: MitarbeiterEintrag[]; bis: number } | null = null;

/** Nur für Prüfstände: den Zwischenspeicher verwerfen (nach eigenen Test-Agenten). */
export function mitarbeiterListeVergessen(): void { zwischen = null; }

export async function mitarbeiterListe(lauf: Lauf = sqlPool): Promise<MitarbeiterEintrag[]> {
  if (zwischen && zwischen.bis > Date.now()) return zwischen.liste;
  try {
    // E-265 Nachbesserung (29.09.2026): dazu jedes AKTIVE Leitungskonto (vertriebsleiter/chef), auch wenn es als
    // Testkonto markiert ist — Justins Konto 928 ruft an (Gründer-Termine /justin, E-124) und stand vorher nur
    // während der Abwesenheit in der Liste; ab Fr 02.10. wäre „Justin ruft Sie an" nicht mehr hart geprüft worden.
    const zeilen = (await lauf`
      SELECT id, name, first_name, last_name, anrede FROM fiaon_agents
       WHERE NOT COALESCE(is_test_account, FALSE)
          OR (COALESCE(active, TRUE) AND LOWER(COALESCE(rolle, '')) IN ('vertriebsleiter', 'chef'))`) as any[];
    const liste: MitarbeiterEintrag[] = zeilen.map((a) => {
      const n = nennform(a);
      return { vorname: n.vorname, nachname: n.nachname, anrede: anredeLesen(a.anrede) };
    });
    // E-260: Der Vertreter (auch ein Testkonto) ruft an — sein Vorname gehört dazu.
    try {
      const { abwesenheitJetzt } = await import("./fiaon-abwesenheit");
      const ab = await abwesenheitJetzt(lauf);
      if (ab) {
        const [v] = (await lauf`SELECT name, first_name, last_name, anrede FROM fiaon_agents WHERE id = ${ab.vertreter.id}`) as any[];
        if (v) { const n = nennform(v); liste.push({ vorname: n.vorname, nachname: n.nachname, anrede: anredeLesen(v.anrede) }); }
      }
    } catch { /* ohne Abwesenheit keine Ergänzung */ }
    zwischen = { liste, bis: Date.now() + 10 * 60_000 };
    return liste;
  } catch (e) {
    console.error("[NAMEN] Mitarbeiterliste nicht lesbar:", String((e as Error)?.message || e).slice(0, 160));
    return zwischen?.liste ?? [];
  }
}
