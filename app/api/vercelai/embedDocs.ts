import { generateEmbeddings } from './embedding';
import { saveVercelAiEmbeddings } from '@/lib/db/vercelai/actions';
import path from 'path';
import fs from 'fs';

export async function embedDocs() {
  const docs = fs.readFileSync(
    path.resolve(process.cwd(), 'ai-docs', 'basic-components.txt'),
    'utf-8'
  );
  const embeddings = await generateEmbeddings(docs);
  console.log('done');
  await saveVercelAiEmbeddings(
    embeddings.map((item) => ({
      content: item.text,
      embedding: item.embedding
    }))
  );
  return embeddings;
}

embedDocs();
