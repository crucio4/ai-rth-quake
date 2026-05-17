import { promises as fs } from 'fs';
import path from 'path';

export async function GET(): Promise<Response> {
  try {
    const filePath = path.join(process.cwd(), 'buildings.json');
    const json = await fs.readFile(filePath, 'utf-8');
    return new Response(json, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to read buildings.json:', error);
    return new Response(JSON.stringify({ error: 'Failed to load buildings data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
