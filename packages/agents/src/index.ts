import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set');
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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

  // Strip any markdown code fences the model may have added
  const cleaned = textBlock.text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(`Agent returned invalid JSON: ${(err as Error).message}\n\nResponse:\n${textBlock.text}`);
  }
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
  return runAgent<NormalisedSale>({
    promptName: 'normalise-sales',
    model: 'haiku',
    input: JSON.stringify(rawRow, null, 2),
    expectJson: true,
  });
}

// TODO: implement comparableAnalysis(), grantCalculator(), yieldAnalysis(),
// draftWeeklyPulse(), parsePlanningPage(), detectAnomalies(), monitorRegulatoryChange()
// as Sprint 2-4 progresses. Each follows the same pattern as normaliseSale.
