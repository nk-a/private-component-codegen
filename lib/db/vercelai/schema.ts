import { pgTable, varchar, index, vector, text } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

// VercelAI embeddings 表
export const vercelAiEmbeddings = pgTable(
  'vercel_ai_embeddings',
  {
    id: varchar('id', { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull() // 存储为 JSON 字符串格式的向量
  },
  (table) => ({
    // 创建索引用于向量搜索
    vercelAiEmbeddingsIdx: index('vercel_ai_embeddings_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    )
  })
);

// 导出类型
export type VercelAiEmbedding = typeof vercelAiEmbeddings.$inferSelect;
export type NewVercelAiEmbedding = typeof vercelAiEmbeddings.$inferInsert;
