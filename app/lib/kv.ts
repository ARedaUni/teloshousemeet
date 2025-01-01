import { kv } from '@vercel/kv';

export const getKV = () => {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error('KV credentials not found');
  }
  return kv;
}; 