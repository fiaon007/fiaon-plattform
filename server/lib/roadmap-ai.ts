/**
 * ============================================================================
 * FIAON FAHRPLAN — KI-Analyse & Coaching (architektonisch sauber)
 * ============================================================================
 * REGEL: An die KI gehen NUR aggregierte, anonymisierte Kennzahlen — niemals
 * Namen, IBANs, Kontonummern oder Einzeltransaktionen. `buildMetrics()` erzeugt
 * genau dieses anonyme Aggregat aus den strukturierten Profildaten.
 *
 * Ohne OPENAI_API_KEY liefert `analyzeMetrics()` eine hochwertige, regelbasierte
 * Analyse (deterministisch) — das Produkt funktioniert also strukturell immer;
 * mit Key wird die Analyse durch das Sprachmodell angereichert/verfeinert.
 *
 * Rechtlicher Rahmen: Alle Ausgaben sind BILDUNGSINHALTE, keine Finanzberatung.
 * ============================================================================
 */
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function aiConfigured(): boolean {
  return !!openai;
}

/* ── Aggregierte, anonyme Kennzahlen (das Einzige, was die KI je sieht) ── */
export interface AggregatedMetrics {
  monthlyIncome: number;
  additionalIncome: number;
  totalIncome: number;
  fixedCosts: number;      // Miete + Versicherungen + Kredite + Abos
  variableCosts: number;   // Lebensmittel + Mobilität + Sonstiges
  totalExpenses: number;
  surplus: number;         // Einnahmen − Ausgaben
  savingsRatePct: number;  // Sparquote in %
  debtPaymentsMonthly: number;
  debtToIncomePct: number; // Kreditrate / Einnahmen in %
  fixedCostRatioPct: number;
  housing: string | null;
  employment: string | null;
  categories: Record<string, number>;
  flags: string[];
  statementsCount: number;
}

const n = (v: any) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };

/** Baut das anonyme Aggregat aus einem Profil-Datensatz (kein PII enthalten). */
export function buildMetrics(profile: any, statementsCount = 0): AggregatedMetrics {
  const monthlyIncome = n(profile.income);
  const additionalIncome = n(profile.additional_income_amount ?? profile.additionalIncomeAmount);
  const totalIncome = monthlyIncome + additionalIncome;

  const rent = n(profile.rent);
  const cFood = n(profile.expenses_food ?? profile.expensesFood);
  const cTransport = n(profile.expenses_transport ?? profile.expensesTransport);
  const cInsurance = n(profile.expenses_insurance ?? profile.expensesInsurance);
  const cLoans = n(profile.expenses_loans ?? profile.expensesLoans);
  const cSubs = n(profile.expenses_subscriptions ?? profile.expensesSubscriptions);
  const cOther = n(profile.expenses_other ?? profile.expensesOther);
  const debtField = n(profile.debts);

  const debtPaymentsMonthly = cLoans || debtField;
  const fixedCosts = rent + cInsurance + debtPaymentsMonthly + cSubs;
  const variableCosts = cFood + cTransport + cOther;
  const totalExpenses = fixedCosts + variableCosts;
  const surplus = totalIncome - totalExpenses;

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const savingsRatePct = pct(surplus, totalIncome);
  const debtToIncomePct = pct(debtPaymentsMonthly, totalIncome);
  const fixedCostRatioPct = pct(fixedCosts, totalIncome);

  const flags: string[] = [];
  if (totalIncome > 0 && surplus < 0) flags.push("negativer_saldo");
  if (savingsRatePct < 10 && surplus >= 0) flags.push("niedrige_sparquote");
  if (debtToIncomePct > 35) flags.push("hohe_schuldenquote");
  if (fixedCostRatioPct > 60) flags.push("hohe_fixkosten");
  if (cSubs > 0 && totalIncome > 0 && cSubs / totalIncome > 0.08) flags.push("hohe_abokosten");
  if (totalIncome === 0) flags.push("einkommen_unbekannt");

  return {
    monthlyIncome, additionalIncome, totalIncome,
    fixedCosts, variableCosts, totalExpenses, surplus,
    savingsRatePct, debtPaymentsMonthly, debtToIncomePct, fixedCostRatioPct,
    housing: profile.housing ?? null,
    employment: profile.employment ?? null,
    categories: {
      miete: rent, lebensmittel: cFood, mobilitaet: cTransport, versicherungen: cInsurance,
      kreditraten: debtPaymentsMonthly, abos: cSubs, sonstiges: cOther,
    },
    flags,
    statementsCount,
  };
}

/* ── Ergebnis-Struktur der Analyse ── */
export interface Recommendation {
  title: string; why: string; benefit: string; category: string; targetValue?: string; priority: number;
}
export interface ScoreFactor { factor: string; status: "gut" | "mittel" | "kritisch"; note: string; }
export interface AnalysisResult {
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: Recommendation[];
  scoreFactors: ScoreFactor[];
  generatedBy: "openai" | "rules";
  model: string | null;
}

const eur = (x: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(x));

/* ── Regelbasierte Analyse (Fallback + Basis, immer verfügbar) ── */
export function rulesAnalysis(m: AggregatedMetrics): AnalysisResult {
  const recs: Recommendation[] = [];
  const strengths: string[] = [];
  const risks: string[] = [];

  if (m.surplus > 0) strengths.push(`Positiver Monatssaldo von ${eur(m.surplus)} — eine gute Ausgangslage.`);
  if (m.savingsRatePct >= 15) strengths.push(`Solide Sparquote von ${m.savingsRatePct}%.`);
  if (m.debtToIncomePct > 0 && m.debtToIncomePct <= 20) strengths.push("Überschaubare Kreditbelastung.");
  if (strengths.length === 0) strengths.push("Du hast den wichtigsten Schritt gemacht: Du kennst jetzt deine Zahlen.");

  if (m.flags.includes("negativer_saldo")) risks.push(`Deine Ausgaben liegen aktuell über deinen Einnahmen (Saldo ${eur(m.surplus)}).`);
  if (m.flags.includes("hohe_schuldenquote")) risks.push(`Kreditraten binden ${m.debtToIncomePct}% deiner Einnahmen — das belastet dein Scoring.`);
  if (m.flags.includes("hohe_fixkosten")) risks.push(`Fixkosten machen ${m.fixedCostRatioPct}% deiner Einnahmen aus.`);
  if (m.flags.includes("niedrige_sparquote")) risks.push(`Deine Sparquote liegt bei ${m.savingsRatePct}% — hier ist Luft nach oben.`);

  // Priorisierte, umsetzbare Bildungs-Schritte
  if (m.flags.includes("negativer_saldo")) {
    recs.push({ priority: 1, category: "Budget", title: "Ausgaben-Bremse: 3 größte variable Posten senken", why: "Ein negativer Saldo zehrt an Reserven und verschlechtert langfristig deine Bonität.", benefit: "Wieder einen positiven Monatssaldo erreichen.", targetValue: `Saldo ≥ ${eur(0)}` });
  }
  if (m.categories.abos > 0) {
    recs.push({ priority: 2, category: "Fixkosten", title: "Abos & Verträge prüfen und kündigen", why: `Abos kosten dich aktuell ${eur(m.categories.abos)}/Monat. Ungenutzte Verträge sind unnötiger Abfluss.`, benefit: "Sofort mehr freier Betrag pro Monat, ohne Verzicht im Alltag.", targetValue: `−${eur(Math.round(m.categories.abos * 0.4))}/Monat` });
  }
  if (m.flags.includes("hohe_schuldenquote") || m.debtPaymentsMonthly > 0) {
    recs.push({ priority: 1, category: "Verbindlichkeiten", title: "Kreditraten strukturieren (Schneeball-/Lawinen-Methode)", why: "Pünktliche Zahlungen und eine sinkende Schuldenquote sind zentrale Scoring-Faktoren.", benefit: "Bessere Bonität und weniger Zinslast.", targetValue: "Schuldenquote < 35 %" });
  }
  recs.push({ priority: 3, category: "Zahlungsverhalten", title: "Alle Zahlungen auf Termin & per Dauerauftrag", why: "Zahlungshistorie ist der wichtigste Einzelfaktor für dein Scoring.", benefit: "Vermeidet Mahnkosten und negative Einträge.", targetValue: "100 % pünktlich" });
  recs.push({ priority: 4, category: "Sparen", title: `Automatische Rücklage von ${eur(Math.max(25, Math.round(Math.max(m.surplus, m.totalIncome * 0.05) * 0.5)))}/Monat`, why: "Ein Notgroschen verhindert neue Schulden bei unerwarteten Kosten.", benefit: "Finanzielle Stabilität als Basis für deine Ziele.", targetValue: "3 Netto-Monatseinkommen" });
  recs.push({ priority: 5, category: "Bildung", title: "Haushaltsbuch 4 Wochen führen", why: "Wer seine Ausgaben sieht, trifft bessere Entscheidungen.", benefit: "Klarheit und Kontrolle über dein Geld.", targetValue: "28 Tage am Stück" });

  const scoreFactors: ScoreFactor[] = [
    { factor: "Zahlungshistorie", status: "mittel", note: "Sorge für durchgehend pünktliche Zahlungen." },
    { factor: "Schuldenquote", status: m.debtToIncomePct > 35 ? "kritisch" : m.debtToIncomePct > 20 ? "mittel" : "gut", note: `Aktuell ${m.debtToIncomePct}% deiner Einnahmen.` },
    { factor: "Sparquote / Rücklagen", status: m.savingsRatePct >= 15 ? "gut" : m.savingsRatePct >= 5 ? "mittel" : "kritisch", note: `Aktuell ${m.savingsRatePct}%.` },
    { factor: "Fixkostenlast", status: m.fixedCostRatioPct > 60 ? "kritisch" : m.fixedCostRatioPct > 45 ? "mittel" : "gut", note: `Fixkosten binden ${m.fixedCostRatioPct}% deiner Einnahmen.` },
  ];

  const summary = m.totalIncome > 0
    ? `Bei Einnahmen von ${eur(m.totalIncome)} und Ausgaben von ${eur(m.totalExpenses)} bleibt dir aktuell ein Monatssaldo von ${eur(m.surplus)} (Sparquote ${m.savingsRatePct}%). Deine Fixkosten liegen bei ${m.fixedCostRatioPct}% deiner Einnahmen. Der Fahrplan unten zeigt dir Schritt für Schritt, wie du deinen finanziellen Spielraum und dein Scoring verbesserst.`
    : "Sobald deine Einkommens- und Ausgabenangaben vollständig sind, berechnen wir deine Kennzahlen und leiten daraus deinen persönlichen Fahrplan ab.";

  recs.sort((a, b) => a.priority - b.priority);
  return { summary, strengths, risks, recommendations: recs, scoreFactors, generatedBy: "rules", model: null };
}

/* ── KI-Analyse (nur aggregierte Kennzahlen; Bildungs-Framing) ── */
export async function analyzeMetrics(m: AggregatedMetrics): Promise<AnalysisResult> {
  const base = rulesAnalysis(m);
  if (!openai) return base;

  const system = [
    "Du bist der Finanzbildungs-Coach von FIAON.",
    "WICHTIG: Du gibst BILDUNGSINHALTE und Optimierungs-Tipps, KEINE regulierte Finanzberatung, keine Kredit-/Anlageberatung.",
    "Du erhältst ausschließlich anonyme, aggregierte Kennzahlen (keine Namen/IBANs/Transaktionen).",
    "Formuliere motivierend, klar, konkret und auf Deutsch (Du-Form). Keine Emojis.",
    "Ziel des Nutzers: bessere finanzielle Gesundheit und ein besseres Scoring, um sich langfristig eine Kreditkarte über einen lizenzierten Partner zu ERARBEITEN. Stelle die Karte nur als künftiges, erarbeitbares Ziel dar — niemals als Zusage.",
    "Gib AUSSCHLIESSLICH gültiges JSON zurück nach dem vorgegebenen Schema.",
  ].join(" ");

  const schema = `{
  "summary": "string (3-5 Sätze, Überblick über die finanzielle Lage)",
  "strengths": ["string"],
  "risks": ["string"],
  "recommendations": [{"title":"string","why":"string","benefit":"string","category":"string","targetValue":"string","priority":1}],
  "scoreFactors": [{"factor":"string","status":"gut|mittel|kritisch","note":"string"}]
}`;

  try {
    const resp = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Aggregierte Kennzahlen (anonym):\n${JSON.stringify(m)}\n\nErstelle eine detaillierte, hochwertige Analyse mit 5-7 priorisierten, umsetzbaren Empfehlungen, die Scoring-relevante Faktoren adressieren. Antworte NUR als JSON nach diesem Schema:\n${schema}` },
      ],
    });
    const raw = resp.choices[0]?.message?.content;
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      summary: String(parsed.summary || base.summary),
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length ? parsed.strengths.map(String) : base.strengths,
      risks: Array.isArray(parsed.risks) && parsed.risks.length ? parsed.risks.map(String) : base.risks,
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length
        ? parsed.recommendations.map((r: any, i: number) => ({
            title: String(r.title || `Schritt ${i + 1}`),
            why: String(r.why || ""),
            benefit: String(r.benefit || ""),
            category: String(r.category || "Allgemein"),
            targetValue: r.targetValue ? String(r.targetValue) : undefined,
            priority: Number(r.priority) || i + 1,
          })).sort((a: Recommendation, b: Recommendation) => a.priority - b.priority)
        : base.recommendations,
      scoreFactors: Array.isArray(parsed.scoreFactors) && parsed.scoreFactors.length
        ? parsed.scoreFactors.map((s: any) => ({ factor: String(s.factor || ""), status: (["gut", "mittel", "kritisch"].includes(s.status) ? s.status : "mittel"), note: String(s.note || "") }))
        : base.scoreFactors,
      generatedBy: "openai",
      model: MODEL,
    };
  } catch (err) {
    console.error("[ROADMAP-AI] analyze failed, using rules fallback:", (err as any)?.message);
    return base;
  }
}

/* ── Kontextsensible KI-Login-Begrüßung (nur aggregierte Signale) ── */
export interface GreetingContext {
  firstName?: string;
  stage: string;
  nextStepTitle?: string | null;
  completedSteps: number;
  totalSteps: number;
  nextDueDate?: string | null;
  nextDueAmount?: number | null;
  surplusPositive?: boolean;
  savingsRatePct?: number | null;
}

export async function generateGreeting(ctx: GreetingContext): Promise<string> {
  const name = (ctx.firstName || "").trim();
  const fallback = (() => {
    const parts: string[] = [];
    parts.push(name ? `Schön, dass du wieder da bist, ${name}.` : "Schön, dass du wieder da bist.");
    if (ctx.nextDueDate) parts.push(`Denk an deine nächste Zahlung${ctx.nextDueAmount ? ` über ${eur(ctx.nextDueAmount)}` : ""} am ${new Date(ctx.nextDueDate).toLocaleDateString("de-DE")}.`);
    if (ctx.nextStepTitle) parts.push(`Dein nächster Schritt: „${ctx.nextStepTitle}".`);
    if (ctx.totalSteps > 0) parts.push(`Du hast schon ${ctx.completedSteps} von ${ctx.totalSteps} Schritten geschafft — bleib dran, jeder Schritt bringt dich näher an dein Ziel.`);
    return parts.join(" ");
  })();

  if (!openai) return fallback;
  try {
    const resp = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 160,
      messages: [
        { role: "system", content: "Du bist der unterstützende Finanzbildungs-Coach von FIAON. Schreibe eine kurze, motivierende Begrüßung (2-3 Sätze, Deutsch, Du-Form, keine Emojis). Bildungsinhalt, keine Finanzberatung. Die Kreditkarte ist ein künftiges, erarbeitbares Ziel — nie eine Zusage." },
        { role: "user", content: `Kontext (anonym): ${JSON.stringify(ctx)}. Begrüße den Kunden, nenne — falls vorhanden — die nächste Zahlung/Frist und den nächsten offenen Schritt, und ermutige zum Fortschritt.` },
      ],
    });
    return resp.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}
