import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { env } from '@/lib/env.mjs';
import { semanticSearch } from '@/lib/db/openai/selector';
import { getSystemPrompt } from '@/lib/prompt';
import { z } from 'zod';

// 请求体验证模式
const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string()
    })
  ),
  searchThreshold: z.number().min(0).max(1).default(0.7),
  searchLimit: z.number().min(1).max(20).default(5),
  model: z.string().default('gpt-3.5-turbo'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(4000).default(1000)
});

// 响应数据类型
interface ChatResponse {
  type: 'content' | 'related' | 'done';
  data: string;
  relatedContent?: Array<{
    id: string;
    content: string;
    similarity: number;
  }>;
}

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: env.AI_KEY,
  baseURL: env.AI_BASE_URL
});

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const validatedData = ChatRequestSchema.parse(body);

    const { messages, searchThreshold = 0.7, searchLimit = 3, temperature = 0.7 } = validatedData;

    // 获取最后一条用户消息
    const lastUserMessage = messages.filter((msg) => msg.role === 'user').pop();

    if (!lastUserMessage) {
      return NextResponse.json({ error: '没有找到用户消息' }, { status: 400 });
    }

    // 创建向量嵌入
    const embeddingResponse = await openai.embeddings.create({
      model: env.EMBEDDING,
      input: lastUserMessage.content
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 执行语义搜索
    const searchResults = await semanticSearch({
      queryEmbedding,
      threshold: searchThreshold,
      limit: searchLimit
    });

    // 构建系统提示词，整合相关内容
    const relatedContentText =
      searchResults.length > 0
        ? `\n\n相关参考内容：\n${searchResults
            .map(
              (result, index) =>
                `${index + 1}. ${result.content} (相似度: ${(result.similarity * 100).toFixed(1)}%)`
            )
            .join('\n')}`
        : '';

    // 使用全局prompt，将相关内容作为参考传递
    const systemPrompt = getSystemPrompt(relatedContentText);

    // 创建流式对话
    const stream = await openai.chat.completions.create({
      model: env.MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
      stream: true
    });

    // 创建 ReadableStream 用于 SSE
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // 首先发送相关内容
        if (searchResults.length > 0) {
          const relatedResponse: ChatResponse = {
            type: 'related',
            data: '找到相关内容',
            relatedContent: searchResults
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(relatedResponse)}\n\n`));
        }

        // 处理流式响应
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;

          if (content) {
            const response: ChatResponse = {
              type: 'content',
              data: content
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
          }
        }

        // 发送完成信号
        const doneResponse: ChatResponse = {
          type: 'done',
          data: '对话完成'
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneResponse)}\n\n`));

        controller.close();
      }
    });

    // 返回 SSE 响应
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('流式对话 API 错误:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '请求参数验证失败', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '服务器内部错误', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
