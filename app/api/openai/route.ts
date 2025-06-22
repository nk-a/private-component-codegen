import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { env } from '@/lib/env.mjs';
import { getSystemPrompt } from '@/lib/prompt';
import { z } from 'zod';
import { searchEmbedding } from './embedding';
import { OpenAiRequest } from './types';

// 响应数据类型

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: env.AI_KEY,
  baseURL: env.AI_BASE_URL
});

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const { message } = (await request.json()) as OpenAiRequest;

    // 获取最后一条用户消息
    const lastUserMessage = message[message.length - 1];
    const lastUserMessageContent = lastUserMessage.content as string;

    if (!lastUserMessage) {
      return NextResponse.json({ error: '没有找到用户消息' }, { status: 400 });
    }

    const searchResults = await searchEmbedding(lastUserMessageContent, 0.5, 3);

    const reference = searchResults.map((result) => result.content).join('\n\n');
    // 使用全局prompt，将相关内容作为参考传递
    const systemPrompt = getSystemPrompt(reference);

    // 创建流式对话
    const stream = await openai.chat.completions.create({
      model: env.MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...message],
      temperature: 0.7,
      stream: true
    });

    // 创建 ReadableStream 用于 SSE
    const readableStream = new ReadableStream({
      async start(controller) {
        // 处理流式响应
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;

          if (content) {
            const response = {
              content: content,
              references: searchResults
            };

            controller.enqueue(`data: ${JSON.stringify(response)}\n\n`);
          }
        }

        controller.enqueue(`data: [DONE]\n\n`);

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
