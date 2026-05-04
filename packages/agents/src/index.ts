import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PropertyAttributes, BuyerContext } from '@properdata/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

let _client: Anthropic | undefined;
const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    if (!_client) _client = createClient();
    return Reflect.get(_client, prop, receiver);
  },
});

// -----------------------------------------------------------------------------
// Model selection
// -----------------------------------------------------------------------------

export const MODELS = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
} as const;

export type ModelName = keyof typeof MODELS;

// -----------------------------------------------------------------------------
// Prompt loading
// -----------------------------------------------------------------------------

/**
 * Load a system prompt from packages/agents/prompts/<name>.md
 *
 * In production, prompts are bundled at build time. In dev, they are read fresh
 * from disk so prompt edits don't require a rebuild.
 */
export function loadPrompt(name: string): string {
  const path = join(__dirname, '..', 'prompts', `${name}.md`);
  return readFileSync(path, 'utf-8');
}

// -----------------------------------------------------------------------------
// JSON-output agent runner
// -----------------------------------------------------------------------------

export interface RunAgentOptions {
  /** Which prompt file to load (without .md extension) */
  promptName: string;
  /** Which model to use */
  model: ModelName;
  /** User-message content for the request */
  input: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Whether to expect a JSON object response (parsed and validated) */
  expectJson?: boolean;
}

/**
 * Run an agent with a given input and parse the output as JSON if requested.
 *
 * Throws if expectJson is true but the response isn't valid JSON.
 */
export async function runAgent<T = unknown>(opts: RunAgentOptions): Promise<T> {
  const systemPrompt = loadPrompt(opts.promptName);

  const response = await anthropic.messages.create({
    model: MODELS[opts.model],
    max_tokens: opts.maxTokens ?? 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: opts.input }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Agent returned no text content');
  }

  if (!opts.expectJson) {
    return textBlock.text as T;
  }

  // Extract JSON: try the full text first, then look for a ```json block
  const raw = textBlock.text.trim();

  // Try parsing the whole response as-is
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Not pure JSON — look for a fenced code block
  }

  // Extract the first ```json ... ``` block
  const fenceMatch = raw.match(/```json\s*\n([\s\S]*?)\n```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]!) as T;
    } catch (err) {
      throw new Error(`Agent returned invalid JSON inside code fence: ${(err as Error).message}\n\nExtracted:\n${fenceMatch[1]!.slice(0, 500)}`);
    }
  }

  // Last resort: strip leading/trailing non-JSON and try again
  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(raw.slice(braceStart, braceEnd + 1)) as T;
    } catch {
      // fall through to error
    }
  }

  throw new Error(`Agent returned no parseable JSON\n\nResponse:\n${raw.slice(0, 500)}`);
}

// -----------------------------------------------------------------------------
// Specific agent functions (typed wrappers)
//
// Implement these as you build each pipeline. Each one wraps runAgent() with
// the right prompt name, model, and input/output types.
// -----------------------------------------------------------------------------

export interface NormalisedSale {
  address_normalised: string;
  town: string | null;
  town_match_confidence: 'high' | 'medium' | 'low';
  county: string;
  eircode: string | null;
  property_type: 'detached' | 'semi_detached' | 'terraced' | 'apartment' | 'duplex' | 'bungalow' | 'unknown';
  property_type_confidence: 'high' | 'medium' | 'low';
  is_new: boolean;
  notes: string | null;
}

export async function normaliseSale(rawRow: Record<string, unknown>): Promise<NormalisedSale> {
  const results = await normaliseSaleBatch([rawRow]);
  return results[0]!;
}

export async function normaliseSaleBatch(rawRows: Record<string, unknown>[]): Promise<NormalisedSale[]> {
  return runAgent<NormalisedSale[]>({
    promptName: 'normalise-sales',
    model: 'haiku',
    input: JSON.stringify(rawRows),
    maxTokens: 8192,
    expectJson: true,
  });
}

// -----------------------------------------------------------------------------
// Comparable Analysis (Sonnet)
// -----------------------------------------------------------------------------

export interface ComparableUsed {
  address: string;
  sale_date: string;
  price: number;
  distance_meters: number | null;
  weight: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface ComparableExcluded {
  address: string;
  reason: string;
}

export interface ComparableAnalysisResult {
  estimated_value: number;
  confidence: 'high' | 'medium' | 'low';
  comparables_used: ComparableUsed[];
  comparables_excluded: ComparableExcluded[];
  narrative: string;
}

export interface ComparableAnalysisInput {
  target: PropertyAttributes;
  candidates: {
    address: string;
    sale_date: string;
    price: number;
    distance_meters: number | null;
    property_type: string | null;
    is_new: boolean;
    description: string | null;
    months_ago: number;
  }[];
}

export async function comparableAnalysis(
  input: ComparableAnalysisInput,
): Promise<ComparableAnalysisResult> {
  return runAgent<ComparableAnalysisResult>({
    promptName: 'comparable-analysis',
    model: 'sonnet',
    input: JSON.stringify(input),
    maxTokens: 8192,
    expectJson: true,
  });
}

// -----------------------------------------------------------------------------
// Grant Calculator (Sonnet)
// -----------------------------------------------------------------------------

export interface GrantSchemeInput {
  code: string;
  name: string;
  provider: string;
  category: string;
  max_amount: number | null;
  description: string;
  eligibility_rules: {
    buyerType?: string[];
    propertyType?: string[];
    vacancyMinYears?: number;
    maxBerRating?: string;
    minBuildYear?: number;
    maxBuildYear?: number;
    maxPropertyValue?: number;
    stackingExclusions?: string[];
  };
}

export interface ApplicableScheme {
  code: string;
  name: string;
  amount_low: number;
  amount_high: number;
  eligibility_status: 'definite' | 'probable' | 'possible' | 'excluded';
  rationale: string;
  conditions: string[];
  stacking_notes: string | null;
}

export interface ExcludedScheme {
  code: string;
  reason: string;
}

export interface GrantCalculationResult {
  total_grants_low: number;
  total_grants_high: number;
  applicable_schemes: ApplicableScheme[];
  excluded_schemes: ExcludedScheme[];
  net_acquisition_cost: {
    purchase_price: number;
    total_grants_central: number;
    stamp_duty: number;
    estimated_legal_fees: number;
    effective_cost: number;
  };
  narrative: string;
}

export interface GrantCalculatorInput {
  property: PropertyAttributes;
  buyer: BuyerContext;
  available_schemes: GrantSchemeInput[];
}

export async function grantCalculator(
  input: GrantCalculatorInput,
): Promise<GrantCalculationResult> {
  return runAgent<GrantCalculationResult>({
    promptName: 'grant-calculator',
    model: 'sonnet',
    input: JSON.stringify(input),
    maxTokens: 8192,
    expectJson: true,
  });
}

// -----------------------------------------------------------------------------
// Yield Analysis (Sonnet)
// -----------------------------------------------------------------------------

export interface RentBenchmark {
  monthly_rent: number;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface CostAssumptions {
  void_weeks: number;
  management_fee_percent: number;
  insurance_annual: number;
  lpt_annual: number;
  maintenance_percent: number;
  rtb_registration: number;
  accountant_fees: number;
  marginal_tax_rate: number;
  mortgage_interest_annual: number;
}

export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  void_weeks: 4,
  management_fee_percent: 10,
  insurance_annual: 500,
  lpt_annual: 495,
  maintenance_percent: 1,
  rtb_registration: 40,
  accountant_fees: 300,
  marginal_tax_rate: 52,
  mortgage_interest_annual: 0,
};

export interface YieldAnalysisResult {
  property: {
    purchase_price: number;
    estimated_rent_monthly: number;
    rent_data_source: string;
    rent_confidence: 'high' | 'medium' | 'low';
  };
  yields: {
    gross_yield_annual: number;
    net_yield_annual: number;
    tax_adjusted_yield: number;
  };
  cost_breakdown_annual: {
    rental_income_gross: number;
    void_allowance: number;
    rental_income_effective: number;
    letting_management_fees: number;
    insurance_landlord: number;
    lpt: number;
    maintenance_reserve: number;
    rtb_registration: number;
    accountant_fees: number;
    total_costs: number;
  };
  tax_position: {
    marginal_rate_assumed: number;
    rental_income_taxable: number;
    tax_payable: number;
    landlord_retrofit_deduction_applied: number | null;
    after_tax_income: number;
  };
  acquisition: {
    purchase_price: number;
    stamp_duty: number;
    legal_fees: number;
    valuation_survey: number;
    available_grants_value: number;
    total_acquisition_cost: number;
    effective_capital_invested: number;
  };
  narrative: string;
}

export interface YieldAnalysisInput {
  property: PropertyAttributes;
  rent_benchmark: RentBenchmark;
  cost_assumptions: CostAssumptions;
  buyer: BuyerContext;
}

export async function yieldAnalysis(
  input: YieldAnalysisInput,
): Promise<YieldAnalysisResult> {
  return runAgent<YieldAnalysisResult>({
    promptName: 'yield-analysis',
    model: 'sonnet',
    input: JSON.stringify(input),
    maxTokens: 4096,
    expectJson: true,
  });
}

// -----------------------------------------------------------------------------
// Draft Writer — Weekly Pulse (Sonnet, markdown output)
// -----------------------------------------------------------------------------

export interface WeeklyPulseNotableSale {
  address: string;
  price: number;
  date: string;
  property_type: string | null;
  is_new: boolean;
}

export interface WeeklyPulseBerPremium {
  rating: string;
  medianPrice: number;
  saleCount: number;
  premiumVsD: number | null;
}

export interface WeeklyPulseAnomalyItem {
  metric: string;
  currentValue: number;
  baselineValue: number;
  deviationPct: number;
  significance: string;
  explanation: string;
}

export interface WeeklyPulseTown {
  name: string;
  county: string;
  metrics: {
    median_price_12m: number | null;
    median_price_3m: number | null;
    yoy_change_pct: number | null;
    sales_count_90d: number;
  };
  notable_sales: WeeklyPulseNotableSale[];
  ber_premium?: WeeklyPulseBerPremium[] | null;
  anomalies?: WeeklyPulseAnomalyItem[] | null;
}

export interface WeeklyPulseRegulatoryChange {
  label: string;
  category: string;
  summary: string;
  subscriberImpact: string | null;
}

export interface WeeklyPulseInput {
  week_ending: string;
  towns: WeeklyPulseTown[];
  grant_updates: string | null;
  regulatory_context: string | null;
  regulatory_changes?: WeeklyPulseRegulatoryChange[] | null;
}

export interface WeeklyPulseResult {
  markdown: string;
  suggested_subject: string;
  word_count: number;
  sections: string[];
}

export async function draftWeeklyPulse(
  input: WeeklyPulseInput,
): Promise<WeeklyPulseResult> {
  const markdown = await runAgent<string>({
    promptName: 'draft-writer',
    model: 'sonnet',
    input: `Generate this week's newsletter (week ending ${input.week_ending}):\n\n${JSON.stringify(input, null, 2)}`,
    maxTokens: 4096,
    expectJson: false,
  });

  const lines = markdown.split('\n');
  const headingLine = lines.find((l) => l.startsWith('#'));
  const suggested_subject = headingLine?.replace(/^#+\s*/, '').trim() ?? `Weekly pulse: ${input.week_ending}`;

  const sections = lines
    .filter((l) => /^##\s/.test(l))
    .map((l) => l.replace(/^##\s*/, '').trim());

  const word_count = markdown
    .replace(/[#*_\[\]()>|`~-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return { markdown, suggested_subject, word_count, sections };
}

// -----------------------------------------------------------------------------
// Regulatory Monitor (Haiku)
// -----------------------------------------------------------------------------

export interface RegulatoryChangeInput {
  url: string;
  label: string;
  category: string;
  new_content: string;
}

export interface RegulatoryChangeResult {
  is_material: boolean;
  category: string;
  summary: string;
  subscriber_impact: string | null;
  recommended_action: 'alert_subscribers' | 'include_in_newsletter' | 'log_only' | 'ignore';
}

export async function checkRegulatoryChange(
  input: RegulatoryChangeInput,
): Promise<RegulatoryChangeResult> {
  // The regulatory monitor prompt is embedded in operational-agents.md
  // We extract just the regulatory monitor section
  const fullPrompt = loadPrompt('operational-agents');
  const regSection = fullPrompt.split('# Regulatory Monitor Agent')[1] ?? fullPrompt;

  const response = await anthropic.messages.create({
    model: MODELS.haiku,
    max_tokens: 1024,
    system: regSection,
    messages: [
      {
        role: 'user',
        content: `A change was detected on the following government page:\n\nURL: ${input.url}\nLabel: ${input.label}\nCategory: ${input.category}\n\nCurrent page content (truncated):\n\n${input.new_content}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Regulatory monitor agent returned no text');
  }

  const cleaned = textBlock.text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  return JSON.parse(cleaned) as RegulatoryChangeResult;
}

// -----------------------------------------------------------------------------
// Anomaly Detector (Haiku)
// -----------------------------------------------------------------------------

export interface AnomalyInput {
  town: string;
  current_metrics: {
    median_price_90d: number | null;
    median_price_12m: number | null;
    sales_count_90d: number;
    yoy_price_change: number | null;
    new_build_share: number | null;
    ftb_share: number | null;
  };
  baseline_metrics: {
    median_price_90d: number | null;
    median_price_12m: number | null;
    sales_count_90d: number;
    yoy_price_change: number | null;
    new_build_share: number | null;
    ftb_share: number | null;
  };
}

export interface Anomaly {
  metric: string;
  current_value: number;
  baseline_value: number;
  deviation_pct: number;
  significance: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
}

export async function detectAnomalies(
  input: AnomalyInput,
): Promise<AnomalyDetectionResult> {
  const fullPrompt = loadPrompt('operational-agents');
  const anomalySection = fullPrompt.split('# Anomaly Detector Agent')[1]?.split('# Regulatory Monitor Agent')[0] ?? fullPrompt;

  const response = await anthropic.messages.create({
    model: MODELS.haiku,
    max_tokens: 1024,
    system: anomalySection,
    messages: [
      {
        role: 'user',
        content: `Analyse the following town metrics for anomalies:\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Anomaly detector agent returned no text');
  }

  const cleaned = textBlock.text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  return JSON.parse(cleaned) as AnomalyDetectionResult;
}

// -----------------------------------------------------------------------------
// Chart rendering (re-export from charts module)
// -----------------------------------------------------------------------------

export {
  renderChartToSvg,
  priceTrendSpec,
  townComparisonSpec,
  propertyTypeMixSpec,
  type PriceTrendPoint,
  type TownComparisonPoint,
  type PropertyTypeMixPoint,
} from './charts';
