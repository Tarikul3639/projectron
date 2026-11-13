export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiMessage {
  role: 'system' | 'user';
  content: string;
}
export interface AiCompletionOptions {
  temperature?: number;
  maxTokens?: number;
}
export interface AiProvider {
  completeJson(
    messages: AiMessage[],
    options?: AiCompletionOptions,
  ): Promise<string>;
}
