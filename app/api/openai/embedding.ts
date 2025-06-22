import OpenAI from 'openai';
import { env } from '@/lib/env.mjs';
import { semanticSearch } from '@/lib/db/openai/selector';

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: env.AI_KEY,
  baseURL: env.AI_BASE_URL
});

/**
 * 将文本按指定分隔符分块
 * @param text 原始文本
 * @param separator 分隔符
 * @param maxChunkSize 每个块的最大字符数
 * @returns 文本块数组
 */
function chunkText(text: string, separator: string = '\n', maxChunkSize?: number): string[] {
  // 首先按分隔符分割
  let chunks = text.split(separator).filter((chunk) => chunk.trim().length > 0);

  // 如果指定了最大块大小，进一步分割大块
  if (maxChunkSize && maxChunkSize > 0) {
    const finalChunks: string[] = [];

    for (const chunk of chunks) {
      if (chunk.length <= maxChunkSize) {
        finalChunks.push(chunk);
      } else {
        // 将大块按句子或单词分割
        const sentences = chunk.split(/[.!?。！？]/).filter((s) => s.trim().length > 0);
        let currentChunk = '';

        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= maxChunkSize) {
            currentChunk += sentence + '.';
          } else {
            if (currentChunk) {
              finalChunks.push(currentChunk.trim());
              currentChunk = sentence + '.';
            } else {
              // 如果单个句子就超过最大长度，按单词分割
              const words = sentence.split(/\s+/);
              let wordChunk = '';

              for (const word of words) {
                if ((wordChunk + ' ' + word).length <= maxChunkSize) {
                  wordChunk += (wordChunk ? ' ' : '') + word;
                } else {
                  if (wordChunk) {
                    finalChunks.push(wordChunk);
                    wordChunk = word;
                  } else {
                    // 如果单个单词就超过最大长度，截断
                    finalChunks.push(word.substring(0, maxChunkSize));
                  }
                }
              }

              if (wordChunk) {
                currentChunk = wordChunk + '.';
              }
            }
          }
        }

        if (currentChunk) {
          finalChunks.push(currentChunk.trim());
        }
      }
    }

    chunks = finalChunks;
  }

  return chunks;
}

/**
 * 生成文本嵌入向量
 * @param text 输入文本
 * @param options 配置选项
 * @returns 包含原文本和向量的结果数组
 */
export async function generateEmbeddings(
  text: string,
  options: {
    separator?: string;
    maxChunkSize?: number;
  } = {}
): Promise<
  Array<{
    text: string;
    embedding: number[];
    index: number;
  }>
> {
  try {
    // 设置默认值
    const separator = options.separator || '-------split line-------';
    const model = env.EMBEDDING;
    const maxChunkSize = options.maxChunkSize || undefined;

    // 验证输入
    if (!text || typeof text !== 'string') {
      throw new Error('缺少必需的 text 参数或格式不正确');
    }

    // 分块处理文本
    const textChunks = chunkText(text, separator, maxChunkSize);

    if (textChunks.length === 0) {
      throw new Error('文本分块后为空，请检查输入文本和分隔符');
    }

    // 调用 OpenAI API 生成嵌入向量
    const response = await openai.embeddings.create({
      model,
      input: textChunks,
      encoding_format: 'float'
    });

    // 构建结果数组
    return textChunks.map((chunk, index) => ({
      text: chunk,
      embedding: response.data[index].embedding,
      index
    }));
  } catch (error) {
    console.error('生成嵌入向量失败:', error);
    throw new Error(`生成嵌入向量失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 生成单个embedding
export async function generateSingleEmbedding(text: string) {
  const embedding = await openai.embeddings.create({
    model: env.EMBEDDING,
    input: text,
    encoding_format: 'float'
  });
  return embedding.data[0].embedding;
}

// 检索召回
export async function searchEmbedding(text: string, threshold: number = 0.7, limit: number = 10) {
  const embedding = await generateSingleEmbedding(text);
  const results = await semanticSearch({
    queryEmbedding: embedding,
    threshold,
    limit
  });
  return results;
}
