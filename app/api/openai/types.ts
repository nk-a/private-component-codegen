import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// 请求类型
export interface OpenAiRequest {
  message: ChatCompletionMessageParam[];
}

// 响应类型
export interface ChatResponse {
  type: 'content' | 'related' | 'done';
  data: string;
  relatedContent?: Array<{
    id: string;
    content: string;
    similarity: number;
  }>;
}

// 消息类型
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
  ragDocs?: RAGDocument[];
}

export interface MessageContent {
  type: 'image_url' | 'text';
  image_url?: {
    url: string;
  };
  text?: string;
}

export interface RAGDocument {
  id: string;
  content: string;
  similarity: number;
}
