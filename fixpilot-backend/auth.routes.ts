import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';

export interface InvokeLLMOptions {
  /** The main instruction / question for the model. */
  prompt: string;
  /**
   * Equivalent to base44's `add_context_from_internet`. Lets the model run
   * live web searches (executed server-side by Anthropic) before answering.
   */
  webSearch?: boolean;
  /**
   * Equivalent to base44's `file_urls`. Publicly reachable image URLs to
   * hand to the model (used for the screenshot-verification vision check).
   */
  imageUrls?: string[];
  /**
   * If provided, the response is guaranteed to be valid JSON matching this
   * JSON Schema (object). Internally implemented as a forced tool call,
   * which Claude adheres to far more reliably than "please respond with
   * only JSON" prompting.
   *
   * NOTE: this replaces the old Gemini-era workaround in aiFixOrchestrator
   * ("Gemini doesn't support response_json_schema with web search enabled,
   * so we ask for JSON as plain text and parse it ourselves"). With Claude
   * we can do both — see the two-step flow below.
   */
  jsonSchema?: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
}

/**
 * Drop-in-ish replacement for `base44.integrations.Core.InvokeLLM`.
 * Returns a string when no jsonSchema is given, or a parsed object when one is.
 */
export async function invokeLLM(opts: InvokeLLMOptions): Promise<string | Record<string, unknown>> {
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 4096;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [{ type: 'text', text: opts.prompt }];

  if (opts.imageUrls?.length) {
    for (const url of opts.imageUrls) {
      const imageBlock = await urlToImageBlock(url);
      if (imageBlock) content.unshift(imageBlock);
    }
  }

  // ── Case 1: no schema needed → plain text answer, web search optional ──
  if (!opts.jsonSchema) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
      tools: opts.webSearch ? [{ type: 'web_search_20250305', name: 'web_search' } as never] : undefined,
    });
    return extractText(response);
  }

  // ── Case 2: schema needed, no web search → single forced tool call ──
  if (!opts.webSearch) {
    return await extractStructured(content, opts.jsonSchema, model, maxTokens);
  }

  // ── Case 3: schema AND web search → two-step (research, then extract) ──
  // Step A: let Claude research freely with web search, plain text output.
  const research = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' } as never],
  });
  const researchText = extractText(research);

  // Step B: feed the research back in and force structured extraction.
  const extractionPrompt = `${opts.prompt}\n\n--- Research findings (from web search) ---\n${researchText}\n\nNow produce the final structured result based on the above.`;
  return await extractStructured([{ type: 'text', text: extractionPrompt }], opts.jsonSchema, model, maxTokens);
}

async function extractStructured(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any[],
  jsonSchema: Record<string, unknown>,
  model: string,
  maxTokens: number,
): Promise<Record<string, unknown>> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content }],
    tools: [
      {
        name: 'structured_output',
        description: 'Return the final answer in the required structured format.',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input_schema: jsonSchema as any,
      },
    ],
    tool_choice: { type: 'tool', name: 'structured_output' },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolUse = (response.content as any[]).find((b) => b.type === 'tool_use');
  if (!toolUse) {
    throw new Error('LLM did not return a structured_output tool call');
  }
  return toolUse.input as Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(response: any): string {
  return response.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => b.type === 'text')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any) => b.text)
    .join('\n')
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function urlToImageBlock(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: contentType,
        data: buf.toString('base64'),
      },
    };
  } catch (e) {
    console.error('[llm] failed to fetch image for vision check:', (e as Error).message);
    return null;
  }
}
