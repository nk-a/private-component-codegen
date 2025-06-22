import { generateEmbeddings } from './embedding';
import { saveOpenAiEmbeddings } from '@/lib/db/openai/actions';
import path from 'path';
import fs from 'fs';

export async function embedDocs() {
  const docs = fs.readFileSync(
    path.resolve(process.cwd(), 'ai-docs', 'basic-components.txt'),
    'utf-8'
  );
  const embeddings = await generateEmbeddings(docs);
  console.log('done');
  const result = await saveOpenAiEmbeddings(
    embeddings.map((item) => ({
      content: item.text,
      embedding: item.embedding
    }))
  );
  console.log(result);
  return embeddings;
}

embedDocs();
