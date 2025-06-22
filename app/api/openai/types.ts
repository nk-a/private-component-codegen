import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface OpenAiRequest {
  message: ChatCompletionMessageParam[];
}
