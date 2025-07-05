'use server';

import { db } from '../index';
import { vercelAiEmbeddings, type NewVercelAiEmbedding } from './schema';

/**
 * 保存 OpenAI embeddings 到数据库
 * @param embeddings - 包含 embedding 向量和内容的数组
 * @returns 保存的记录数量
 */
export async function saveVercelAiEmbeddings(
  embeddings: Array<{ embedding: number[]; content: string }>
) {
  try {
    // 将输入数据转换为数据库格式
    const records: NewVercelAiEmbedding[] = embeddings.map((item) => ({
      content: item.content,
      embedding: item.embedding
    }));

    // 批量插入数据
    const result = await db.insert(vercelAiEmbeddings).values(records);

    // 返回插入的记录数量
    return { success: true, data: result };
  } catch (error) {
    console.error('保存 VercelAI embeddings 失败:', error);
    throw new Error(`保存 embeddings 失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 保存单个 VercelAI embedding 到数据库
 * @param embedding - embedding 向量
 * @param content - 内容文本
 * @returns 保存的记录 ID
 */
export async function saveSingleVercelAiEmbedding(
  embedding: number[],
  content: string
): Promise<string> {
  try {
    const record: NewVercelAiEmbedding = {
      content,
      embedding
    };

    const result = await db
      .insert(vercelAiEmbeddings)
      .values(record)
      .returning({ id: vercelAiEmbeddings.id });

    return result[0].id;
  } catch (error) {
    console.error('保存单个 VercelAI embedding 失败:', error);
    throw new Error(`保存 embedding 失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}
