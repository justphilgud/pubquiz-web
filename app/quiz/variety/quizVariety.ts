import { questionTemplateIds, resolveCanonicalQuestionTemplateId } from "../../fragen/editor/templates/questionTemplateRegistry";

export const BROAD_CATEGORIES = ["Geschichte", "Geografie", "Politik & Zeitgeschehen", "Gesellschaft", "Natur & Wissenschaft", "Technik & Digitales", "Sport", "Musik", "Film & Fernsehen", "Kunst & Kultur", "Sprache & Literatur", "Essen & Trinken", "Wirtschaft", "Alltag & Kurioses", "Religion & Weltanschauung"] as const;
export const EXPERIENCE_FAMILIES = ["TEXT", "VISUAL", "AUDIO", "CREATIVE", "ESTIMATE", "SORT", "LIVE_REVEAL"] as const;
export type ExperienceFamily = typeof EXPERIENCE_FAMILIES[number];
const EXPERIENCE_LABELS: Record<ExperienceFamily, string> = { TEXT: "Textwissen", VISUAL: "Visuelles Wissen", AUDIO: "Audio", CREATIVE: "Kreativität", ESTIMATE: "Schätzen", SORT: "Sortieren", LIVE_REVEAL: "Live-Aufdecken / interaktiv" };
export type VarietyConfig = { version: 1; mode: "STANDARD" | "THEMENQUIZ" | "DEAKTIVIERT";
  ignoredCategories: readonly string[]; theme: { categoryIds: readonly string[]; tags: readonly string[] } };
export const DEFAULT_VARIETY_CONFIG: VarietyConfig = { version: 1, mode: "STANDARD", ignoredCategories: [], theme: { categoryIds: [], tags: [] } };
export type VarietyQuestion = { slot: number; block: number; templateId: string | null;
  baseTemplateId?: string | null; categories: readonly string[]; tags: readonly string[];
  experience: ExperienceFamily | null; reviewStatus?: string };
export type VarietyHint = { code: string; priority: number; message: string; block?: number; slot?: number };
type Distribution = Record<string, number>;
export type VarietyMetrics = { count: number; categories: Distribution; templates: Distribution; experiences: Distribution;
  categoryCoverage: number; experienceCoverage: number; templateCoverage: number; components: { themeBreadth: number; themeBalance: number;
    templateBreadth: number; templateBalance: number; experienceDiversity: number }; intrinsicScore: number;
  switches: number; transitions: number; longestRun: number; runStart: number | null;
  foreign: number; uncheckable: number; verifiedTheme: number; invalidCategories: number };
export type VarietyResult = { status: "DISABLED" | "EMPTY" | "INCOMPLETE_THEME" | "ANALYZED";
  score: number | null; provisional: boolean; label: string; metrics: VarietyMetrics | null;
  blocks: { block: number; score: number; metrics: VarietyMetrics }[]; hints: VarietyHint[]; topHints: VarietyHint[];
  calculation: { version: 1; blockAndSwitchPoints: number; weightedTotal: number; blockCeiling: number | null } | null };

export function resolveVarietyConfig(series: VarietyConfig, override: VarietyConfig | null) {
  return { config: structuredClone(override ?? series), source: override ? "QUIZ_OVERRIDE" as const : "EVENT_SERIES" as const };
}
export function copyVarietyOverride(override: VarietyConfig | null): VarietyConfig | null { return override ? structuredClone(override) : null; }
export function resetVarietyOverride(): null { return null; }
export function canonicalVarietyTemplate(template: string | null) {
  const id = resolveCanonicalQuestionTemplateId(template);
  return !id || id === "multiple_choice" ? "standard" : (Object.values(questionTemplateIds) as readonly string[]).includes(id) ? id : "UNKNOWN";
}
/** Use resolved presentation roles, never answer/solution images or generator inputs. */
export function resolveVarietyExperience(input: { templateId: string | null; questionHasVisual: boolean;
  questionHasAudio: boolean; sequentialReveal?: boolean }): ExperienceFamily {
  const id = canonicalVarietyTemplate(input.templateId);
  if (id === "pixelbild" || (id === "google_rezensionen" && input.sequentialReveal)) return "LIVE_REVEAL";
  if (id === "meme_beschriften" || id === "anagramm") return "CREATIVE";
  if (id === "schaetzfrage") return "ESTIMATE";
  if (id === "reihenfolge") return "SORT";
  if (["musik_rueckwaerts", "eight_bit", "uebersetzt_vorgelesen"].includes(id) || input.questionHasAudio) return "AUDIO";
  if (["kunstwerk", "face_morph"].includes(id) || input.questionHasVisual) return "VISUAL";
  return "TEXT";
}
const add = (distribution: Distribution, key: string, value = 1) => { distribution[key] = (distribution[key] ?? 0) + value; };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function entropy(distribution: Distribution, target: number) {
  const values = Object.values(distribution), total = values.reduce((sum, value) => sum + value, 0);
  if (!total || values.length < 2) return 0;
  return clamp(values.reduce((sum, value) => { const p = value / total; return sum - p * Math.log(p); }, 0) / Math.log(Math.max(2, target, values.length)));
}
function validCategories(question: VarietyQuestion) {
  const unique = [...new Set(question.categories)];
  return unique.length > 0 && unique.length <= 2 && unique.every(category => (BROAD_CATEGORIES as readonly string[]).includes(category)) ? unique : [];
}
function measure(questions: readonly VarietyQuestion[], config: VarietyConfig): VarietyMetrics {
  const categories: Distribution = {}, templates: Distribution = {}, experiences: Distribution = {};
  let covered = 0, experienceCovered = 0, templateCovered = 0, invalidCategories = 0, foreign = 0, uncheckable = 0, verifiedTheme = 0;
  let switches = 0, transitions = 0, longestRun = 0, run = 0, runStart: number | null = null, currentStart: number | null = null;
  let previous: VarietyQuestion | null = null;
  const ordered = [...questions].sort((a, b) => a.block - b.block || a.slot - b.slot);
  for (const q of ordered) {
    const assigned = validCategories(q);
    if (assigned.length) { covered++; for (const category of assigned) add(categories, category, 1 / assigned.length); }
    else if (q.categories.length) invalidCategories++;
    const template = canonicalVarietyTemplate(q.baseTemplateId ?? q.templateId);
    if (template !== "UNKNOWN") { templateCovered++; add(templates, template); }
    if (q.experience) { experienceCovered++; add(experiences, q.experience); }
    if (config.mode === "THEMENQUIZ") {
      const categoryMatch = assigned.some(category => config.theme.categoryIds.includes(category));
      const tagMatch = q.tags.some(tag => config.theme.tags.includes(tag));
      const checkable = categoryMatch || tagMatch || (assigned.length > 0 && (config.theme.categoryIds.length > 0 || (config.theme.tags.length > 0 && q.tags.length > 0)));
      if (!checkable) uncheckable++; else { verifiedTheme++; if (!categoryMatch && !tagMatch) foreign++; }
    }
    const adjacent = previous && previous.block === q.block && previous.slot + 1 === q.slot;
    if (adjacent && previous?.experience && q.experience) { transitions++; if (previous.experience !== q.experience) switches++; }
    if (q.experience && adjacent && previous?.experience === q.experience) run++;
    else { run = q.experience ? 1 : 0; currentStart = q.experience ? q.slot : null; }
    if (run > longestRun) { longestRun = run; runStart = currentStart; }
    previous = q;
  }
  const count = questions.length, categoryCoverage = count ? covered / count : 0, experienceCoverage = count ? experienceCovered / count : 0;
  const targetCategories = Math.min(10, Math.max(1, BROAD_CATEGORIES.length - new Set(config.ignoredCategories.filter(c => (BROAD_CATEGORIES as readonly string[]).includes(c))).size));
  const categoryCount = Object.keys(categories).length, templateCount = Object.keys(templates).length;
  const templateCoverage = count ? templateCovered / count : 0;
  const themeCoverage = count ? verifiedTheme / count : 0;
  const purity = verifiedTheme ? 1 - foreign / verifiedTheme : 0;
  const components = {
    themeBreadth: config.mode === "THEMENQUIZ" ? 20 * themeCoverage * purity : 20 * clamp(categoryCount / targetCategories) * categoryCoverage,
    themeBalance: config.mode === "THEMENQUIZ" ? 20 * themeCoverage * purity : 20 * entropy(categories, targetCategories) * categoryCoverage,
    templateBreadth: 15 * clamp(templateCount / 10) * templateCoverage, templateBalance: 10 * entropy(templates, 10) * templateCoverage,
    experienceDiversity: 20 * ((clamp(Object.keys(experiences).length / 5) + entropy(experiences, 5)) / 2) * experienceCoverage,
  };
  const intrinsicScore = Object.values(components).reduce((sum, value) => sum + value, 0) / 85 * 100;
  return { count, categories, templates, experiences, categoryCoverage, experienceCoverage, templateCoverage, components, intrinsicScore,
    switches, transitions, longestRun, runStart, foreign, uncheckable, verifiedTheme, invalidCategories };
}
export function calculateQuizVariety(questions: readonly VarietyQuestion[], config: VarietyConfig): VarietyResult {
  const empty = (status: VarietyResult["status"], label: string, score: number | null): VarietyResult => ({ status, score, label,
    provisional: status !== "DISABLED", metrics: null, blocks: [], hints: [], topHints: [], calculation: null });
  if (config.mode === "DEAKTIVIERT") return empty("DISABLED", "Abwechslungsanalyse deaktiviert", null);
  if (!questions.length) return empty("EMPTY", "Noch nicht bewertbar", 0);
  if (config.mode === "THEMENQUIZ" && !config.theme.categoryIds.length && !config.theme.tags.length) return empty("INCOMPLETE_THEME", "Themenquiz unvollständig konfiguriert", null);
  if (new Set(questions.map(q => `${q.block}:${q.slot}`)).size !== questions.length) throw new Error("VARIETY_DUPLICATE_SLOT");
  const metrics = measure(questions, config);
  const blocks = [...new Set(questions.map(q => q.block))].sort((a, b) => a - b).map(block => {
    const measured = measure(questions.filter(q => q.block === block), config);
    return { block, score: Math.round(measured.intrinsicScore), metrics: measured };
  });
  const minBlock = Math.min(...blocks.map(block => block.metrics.intrinsicScore)) / 100;
  const switchRate = metrics.transitions ? metrics.switches / metrics.transitions : 0;
  const runPenalty = clamp(1 - Math.max(0, metrics.longestRun - 3) / 7);
  const blockAndSwitchPoints = 15 * (minBlock + switchRate * runPenalty) / 2;
  const weightedTotal = Object.values(metrics.components).reduce((sum, value) => sum + value, 0) + blockAndSwitchPoints;
  const blockCeiling = blocks.length >= 2 && blocks.every(block => block.metrics.count >= 5) ? Math.min(...blocks.map(block => block.metrics.intrinsicScore)) + 15 : null;
  const score = Math.round(Math.max(0, Math.min(100, weightedTotal, blockCeiling ?? 100)));
  const hints: VarietyHint[] = [];
  const hint = (code: string, priority: number, message: string, details: Partial<VarietyHint> = {}) => hints.push({ code, priority, message, ...details });
  const unknown = Math.round(questions.length * (1 - metrics.categoryCoverage));
  if (unknown) hint("CATEGORY_COVERAGE", 1, `${unknown} von ${questions.length} Fragen sind thematisch noch nicht gültig eingeordnet.`);
  if (metrics.invalidCategories) hint("INVALID_CATEGORIES", 1, `${metrics.invalidCategories} Fragen besitzen unbekannte oder mehr als zwei Oberkategorien.`);
  if (metrics.templateCoverage < 1) hint("TEMPLATE_COVERAGE", 1, `${questions.length - Math.round(metrics.templateCoverage * questions.length)} Fragen besitzen noch kein überprüfbares Basistemplate.`);
  const unknownExperience = questions.length - Math.round(metrics.experienceCoverage * questions.length);
  if (unknownExperience) hint("EXPERIENCE_COVERAGE", 1, `${unknownExperience} Fragen besitzen noch keine Erlebnisfamilie.`);
  if (questions.length < 5) hint("SMALL_QUIZ", 1, "Weniger als fünf Fragen: Die Analyse ist vorläufig.");
  if (config.mode === "THEMENQUIZ") {
    if (metrics.foreign) hint("FOREIGN_QUESTIONS", 2, `${metrics.foreign} Fragen liegen außerhalb des Themenrahmens.`);
    if (metrics.uncheckable) hint("UNCHECKABLE_THEME", 1, `${metrics.uncheckable} Fragen sind im Themenrahmen nicht überprüfbar.`);
  }
  for (const [category, weight] of Object.entries(metrics.categories)) if (weight / questions.length > 0.25) hint(`DOMINANT_CATEGORY:${category}`, 2, `${category} umfasst ${Math.round(weight / questions.length * 100)} % der Themenanteile.`);
  for (const [template, count] of Object.entries(metrics.templates)) if (count / questions.length > 0.5) hint(`DOMINANT_TEMPLATE:${template}`, 2, `${template} wird in ${count} von ${questions.length} Slots verwendet.`);
  for (const block of blocks) {
    const b = block.metrics;
    if (b.count < 5) hint(`SMALL_BLOCK:${block.block}`, 1, `Block ${block.block} enthält weniger als fünf Fragen und ist vorläufig.`, { block: block.block });
    if (b.longestRun >= 4) {
      const family = questions.find(q => q.block === block.block && q.slot === b.runStart)?.experience;
      const alternative = family === "VISUAL" ? "eine Audio- oder Schätzfrage" : family === "AUDIO" ? "eine visuelle oder Schätzfrage" : "eine visuelle oder Audiofrage";
      hint(`MONOTONY:${block.block}`, 3, `${b.longestRun} Fragen derselben Erlebnisfamilie folgen in Block ${block.block} direkt aufeinander. Slot ${(b.runStart ?? 0) + 2} könnte durch ${alternative} ersetzt werden.`, { block: block.block, slot: (b.runStart ?? 0) + 2 });
    }
    if (Object.keys(b.experiences).length < 3) hint(`BLOCK_FAMILIES:${block.block}`, 3, `Block ${block.block} besitzt nur ${Object.keys(b.experiences).length} Erlebnisfamilien.`, { block: block.block });
    if (Object.keys(b.categories).length < Math.min(5, Object.keys(metrics.categories).length)) hint(`BLOCK_THEMES:${block.block}`, 3, `Block ${block.block} enthält deutlich weniger Themen als das Gesamtquiz.`, { block: block.block });
  }
  if (blocks.length >= 2) {
    for (const family of EXPERIENCE_FAMILIES) {
      const present = blocks.filter(block => (block.metrics.experiences[family] ?? 0) > 0);
      if (present.length > 0 && present.length < blocks.length) hint(`ONE_BLOCK_FAMILY:${family}`, 3, `${EXPERIENCE_LABELS[family]} kommt ausschließlich in Block ${present.map(block => block.block).join(", ")} vor.`);
      if (family === "VISUAL") {
        const rates = blocks.map(block => ({ block: block.block, rate: (block.metrics.experiences.VISUAL ?? 0) / block.metrics.count }));
        const high = [...rates].sort((a, b) => b.rate - a.rate)[0], low = [...rates].sort((a, b) => a.rate - b.rate)[0];
        if (high.rate - low.rate >= 0.2) hint("VISUAL_BLOCK_IMBALANCE", 3, `Block ${low.block} enthält deutlich weniger visuelle Fragen als Block ${high.block}.`);
      }
    }
  }
  if (config.mode === "STANDARD") for (const category of BROAD_CATEGORIES) if (!metrics.categories[category] && !config.ignoredCategories.includes(category)) hint(`MISSING_CATEGORY:${category}`, 4, `${category} fehlt bisher.`);
  for (const family of EXPERIENCE_FAMILIES) if (!metrics.experiences[family]) hint(`MISSING_FAMILY:${family}`, 4, `${EXPERIENCE_LABELS[family]} fehlt bisher als Erlebnisfamilie.`);
  hint("TEMPLATE_COUNT", 5, `Du verwendest ${Object.keys(metrics.templates).length} unterschiedliche Fragentemplates.`);
  hints.sort((a, b) => a.priority - b.priority || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const provisional = questions.length < 5 || metrics.categoryCoverage < 1 || metrics.experienceCoverage < 1 || metrics.templateCoverage < 1 || metrics.uncheckable > 0 || blocks.some(block => block.metrics.count < 5);
  return { status: "ANALYZED", score, provisional, label: provisional ? "vorläufig" : score >= 80 ? "sehr vielfältig" : score >= 60 ? "abwechslungsreich" : "ausbaufähig",
    metrics, blocks, hints, topHints: hints.slice(0, 3), calculation: { version: 1, blockAndSwitchPoints, weightedTotal, blockCeiling } };
}
