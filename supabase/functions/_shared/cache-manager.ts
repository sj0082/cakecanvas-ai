import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface CacheKey {
  stylepackId: string;
  userTextHash: string;
  sizeCategoryId: string;
}

export async function getCachedStage1(
  supabase: any,
  key: CacheKey
): Promise<any | null> {
  const { data, error } = await supabase
    .from('stage1_cache')
    .select('result')
    .eq('stylepack_id', key.stylepackId)
    .eq('user_text_hash', key.userTextHash)
    .eq('size_category_id', key.sizeCategoryId)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    console.log('❌ Stage 1 cache miss');
    return null;
  }
  
  console.log('✅ Stage 1 cache hit');
  return (data as any).result;
}

export async function setCachedStage1(
  supabase: any,
  key: CacheKey,
  result: any
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const { error } = await (supabase as any)
    .from('stage1_cache')
    .upsert({
      stylepack_id: key.stylepackId,
      user_text_hash: key.userTextHash,
      size_category_id: key.sizeCategoryId,
      result: result,
      expires_at: expiresAt.toISOString()
    });

  if (error) {
    console.error('Failed to cache Stage 1 results:', error);
  } else {
    console.log('✅ Stage 1 cached until', expiresAt);
  }
}

export async function hashUserText(text: string): Promise<string> {
  const normalized = text.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
