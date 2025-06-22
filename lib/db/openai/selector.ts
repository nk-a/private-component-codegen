import { db } from '@/lib/db';
import { openAiEmbeddings } from './schema';
import { sql } from 'drizzle-orm';

// 搜索结果类型定义
export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
}

// 搜索参数类型定义
export interface SearchParams {
  queryEmbedding: number[];
  threshold?: number;
  limit?: number;
}

/**
 * 基于向量嵌入的语义相似度搜索函数
 * @param params 搜索参数
 * @returns 相似度最高的搜索结果数组
 */
export async function semanticSearch(params: SearchParams): Promise<SearchResult[]> {
  const { queryEmbedding, threshold = 0.7, limit = 10 } = params;

  try {
    // 使用 PostgreSQL 的向量余弦相似度函数进行搜索
    const results = await db
      .select({
        id: openAiEmbeddings.id,
        content: openAiEmbeddings.content,
        similarity: sql<number>`
          (${openAiEmbeddings.embedding} <=> ${sql.raw(
          `'[${queryEmbedding.join(',')}]'::vector`
        )}) as similarity
        `
      })
      .from(openAiEmbeddings)
      .where(
        sql`
        (${openAiEmbeddings.embedding} <=> ${sql.raw(
          `'[${queryEmbedding.join(',')}]'::vector`
        )}) > ${threshold}
      `
      )
      .orderBy(sql`similarity DESC`)
      .limit(limit);

    // 转换结果格式，将相似度转换为 0-1 范围
    return results.map((result) => ({
      id: result.id,
      content: result.content,
      similarity: 1 - result.similarity // 将距离转换为相似度
    }));
  } catch (error) {
    console.error('语义搜索失败:', error);
    throw new Error(`语义搜索失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 批量语义搜索函数 - 支持多个查询向量
 * @param queryEmbeddings 查询向量数组
 * @param threshold 相似度阈值
 * @param limit 每个查询返回的结果数量
 * @returns 每个查询的搜索结果
 */
export async function batchSemanticSearch(
  queryEmbeddings: number[][],
  threshold: number = 0.7,
  limit: number = 10
): Promise<SearchResult[][]> {
  const searchPromises = queryEmbeddings.map((embedding) =>
    semanticSearch({ queryEmbedding: embedding, threshold, limit })
  );

  try {
    return await Promise.all(searchPromises);
  } catch (error) {
    console.error('批量语义搜索失败:', error);
    throw new Error(`批量语义搜索失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 获取最相似的单个结果
 * @param queryEmbedding 查询向量
 * @param threshold 相似度阈值
 * @returns 最相似的结果，如果没有找到则返回 null
 */
export async function findMostSimilar(
  queryEmbedding: number[],
  threshold: number = 0.7
): Promise<SearchResult | null> {
  const results = await semanticSearch({
    queryEmbedding,
    threshold,
    limit: 1
  });

  return results.length > 0 ? results[0] : null;
}

/**
 * 计算两个向量之间的余弦相似度（纯 JavaScript 实现，用于客户端计算）
 * @param vectorA 向量A
 * @param vectorB 向量B
 * @returns 余弦相似度值 (0-1)
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('向量维度不匹配');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * 验证向量格式是否正确
 * @param embedding 向量数组
 * @param expectedDimensions 期望的维度
 * @returns 是否有效
 */
export function validateEmbedding(embedding: number[], expectedDimensions: number = 1536): boolean {
  return (
    Array.isArray(embedding) &&
    embedding.length === expectedDimensions &&
    embedding.every((val) => typeof val === 'number' && !isNaN(val))
  );
}
