import logger from '../logger';
import { ReadinessFacts, ReadinessRecommendation } from './readinessAdvisor';

function deterministicSummary(score: number, top: ReadinessRecommendation): string {
  return `Measured readiness is ${score}%. ${top.title}. ${top.detail}`;
}

export async function createReadinessNarrative(score: number, facts: ReadinessFacts, recommendations: ReadinessRecommendation[]) {
  const fallback = { mode: 'rules' as const, text: deterministicSummary(score, recommendations[0]) };
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return fallback;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions: 'You summarize a food traceability workspace. Use only the supplied counts and recommendation. Never claim legal compliance, certification, safety, or facts not present. Write two plain-language sentences for an operations manager.',
        input: JSON.stringify({ score, facts, topRecommendation: recommendations[0] }),
        max_output_tokens: 140,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const data: any = await response.json();
    const text = data.output_text || data.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === 'output_text')?.text;
    return text ? { mode: 'openai' as const, text } : fallback;
  } catch (error) {
    logger.warn({ error }, 'Readiness narrative fell back to deterministic guidance');
    return fallback;
  } finally { clearTimeout(timeout); }
}
