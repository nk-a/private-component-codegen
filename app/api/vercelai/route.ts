import { NextRequest, NextResponse } from 'next/server';
import { openai } from './embedding';
import { streamText, createDataStreamResponse } from 'ai';
import { env } from '@/lib/env.mjs';
import { getSystemPrompt } from '@/lib/prompt';
import { z } from 'zod';
import { searchEmbedding } from './embedding';

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const { messages } = await request.json();

    // 获取最后一条用户消息
    const lastUserMessage = messages[messages.length - 1];
    const lastUserMessageContent = lastUserMessage.content as string;

    if (!lastUserMessage || lastUserMessage.role !== 'user') {
      return NextResponse.json({ error: '没有找到用户消息' }, { status: 400 });
    }

    // 搜索相关内容
    const searchResults = await searchEmbedding(lastUserMessageContent, 0.5, 3);
    const reference = searchResults.map((result) => result.content).join('\n\n');

    // 使用全局prompt，将相关内容作为参考传递
    const systemPrompt = getSystemPrompt(reference);

    // 创建包含RAG文档信息的自定义响应
    const ragDocs = searchResults.map((result, index) => ({
      id: `doc-${index}`,
      content: result.content,
      score: result.similarity
    }));

    // 使用 Vercel AI SDK 创建流式响应
    const result = await streamText({
      model: openai(env.MODEL),
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.7,
      onFinish: (completion) => {
        console.log('对话完成:', completion);
      }
    });

    // 使用createDataStreamResponse创建自定义响应
    return createDataStreamResponse({
      execute: async (dataStream) => {
        // 写入RAG文档信息作为消息注解
        dataStream.writeMessageAnnotation({
          ragDocs: ragDocs
        });

        // 将文本流合并到数据流中
        result.mergeIntoDataStream(dataStream);
      },
      onError: (error) => {
        console.error('聊天完成错误:', error);
        return error instanceof Error ? error.message : '发生未知错误';
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
