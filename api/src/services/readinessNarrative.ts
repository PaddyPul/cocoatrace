import logger from '../logger';
import { ReadinessFacts, ReadinessRecommendation } from './readinessAdvisor';
import { config } from '../config/env';

function deterministicSummary(score: number, top: ReadinessRecommendation): string {
  return `Measured readiness is ${score}%. ${top.title}. ${top.detail}`;
}

export async function createReadinessNarrative(
  score: number,
  facts: ReadinessFacts,
  recommendations: ReadinessRecommendation[],
) {
  const fallback = {
    mode: 'rules' as const,
    text: deterministicSummary(score, recommendations[0]),
  };
  const apiKey = config.openAiApiKey;
  const model = config.openAiModel;
  if (!apiKey || !model) return fallback;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions:
          'You summarize a food traceability workspace. Use only the supplied counts and recommendation. Never claim legal compliance, certification, safety, or facts not present. Write two plain-language sentences for an operations manager.',
        input: JSON.stringify({ score, facts, topRecommendation: recommendations[0] }),
        max_output_tokens: 140,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const data: unknown = await response.json();
    const text = extractNarrativeText(data);
    return text ? { mode: 'openai' as const, text } : fallback;
  } catch (error) {
    logger.warn({ error }, 'Readiness narrative fell back to deterministic guidance');
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

/** External provider envelopes are untrusted; only an explicit text field becomes guidance. */
export function extractNarrativeText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  if ('output_text' in data && typeof data.output_text === 'string' && data.output_text) {
    return data.output_text;
  }
  if (!('output' in data) || !Array.isArray(data.output)) return null;
  const output: unknown[] = data.output;
  for (const item of output) {
    if (!item || typeof item !== 'object' || !('content' in item) || !Array.isArray(item.content))
      continue;
    const contents: unknown[] = item.content;
    for (const content of contents) {
      if (
        content &&
        typeof content === 'object' &&
        'type' in content &&
        'text' in content &&
        content.type === 'output_text' &&
        typeof content.text === 'string' &&
        content.text
      )
        return content.text;
    }
  }
  return null;
}
