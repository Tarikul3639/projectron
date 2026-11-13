import {
  Injectable,
  ServiceUnavailableException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service.js';
import type {
  AiCompletionOptions,
  AiMessage,
  AiProvider,
} from '../interfaces/ai-provider.interface.js';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | Array<{ type?: string; text?: string }> };
  }>;
  error?: { message?: string };
}

/** OpenAI-compatible JSON chat-completions adapter; it never invokes tools. */
@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly config: AppConfigService) {}

  async completeJson(
    messages: AiMessage[],
    options: AiCompletionOptions = {},
  ): Promise<string> {
    const apiKey = this.config.aiApiKey;
    if (!apiKey)
      throw new ServiceUnavailableException(
        'AI provider is not configured. Set AI_API_KEY before requesting AI planning.',
      );

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.aiTimeoutMs,
    );
    try {
      const response = await fetch(
        `${this.config.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.aiModel,
            messages,
            temperature: options.temperature ?? 0.1,
            max_tokens: options.maxTokens ?? 4_000,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as ChatCompletionResponse;
      if (!response.ok)
        throw new ServiceUnavailableException(
          payload.error?.message?.slice(0, 1_000) ??
            `AI provider returned HTTP ${response.status}`,
        );
      const content = payload.choices?.[0]?.message?.content;
      const result = Array.isArray(content)
        ? content
            .filter((part) => part.type === 'text')
            .map((part) => part.text ?? '')
            .join('')
        : content;
      if (!result?.trim())
        throw new ServiceUnavailableException(
          'AI provider returned an empty response',
        );
      return result;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (controller.signal.aborted)
        throw new GatewayTimeoutException('AI provider request timed out');
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : 'AI provider request failed',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
