import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@/lib/env.mjs';
import { searchSimilarContent } from '@/lib/db/vercelai/selector';

export const openai = createOpenAI({
  apiKey: env.AI_KEY,
  baseURL: env.AI_BASE_URL
});

/**
 * 文本分块工具
 */
function chunkText(text: string, separator: string = '\n', maxChunkSize?: number): string[] {
  let chunks = text.split(separator).filter((chunk) => chunk.trim().length > 0);
  if (maxChunkSize && maxChunkSize > 0) {
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length <= maxChunkSize) {
        finalChunks.push(chunk);
      } else {
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
 * 生成文本嵌入向量（批量）
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
  const separator = options.separator || '-------split line-------';
  const model = openai.embedding(env.EMBEDDING);
  const maxChunkSize = options.maxChunkSize || undefined;
  if (!text || typeof text !== 'string') {
    throw new Error('缺少必需的 text 参数或格式不正确');
  }
  const textChunks = chunkText(text, separator, maxChunkSize);
  if (textChunks.length === 0) {
    throw new Error('文本分块后为空，请检查输入文本和分隔符');
  }
  const { embeddings } = await embedMany({
    model,
    values: textChunks
  });
  return textChunks.map((chunk, index) => ({
    text: chunk,
    embedding: embeddings[index],
    index
  }));
}

/**
 * 生成单个文本的 embedding
 */
export async function generateSingleEmbedding(text: string) {
  const model = openai.embedding(env.EMBEDDING);
  const { embedding } = await embed({ model, value: text });
  return embedding;
}

/**
 * 检索召回
 */
export async function searchEmbedding(text: string, threshold: number = 0.5, limit: number = 10) {
  const embedding = await generateSingleEmbedding(text);
  const results = await searchSimilarContent(embedding, threshold, limit);
  return results;
}
