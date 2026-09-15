import { createClient } from '@/lib/supabase/server';

export async function getContentBlock(key: string): Promise<Record<string, unknown>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('site_contents')
      .select('content')
      .eq('key', key)
      .single();
    return (data?.content as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

export async function getContentBlocks(keys: string[]): Promise<Record<string, Record<string, unknown>>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('site_contents')
      .select('key, content')
      .in('key', keys);
    const result: Record<string, Record<string, unknown>> = {};
    data?.forEach((row) => {
      result[row.key] = row.content as Record<string, unknown>;
    });
    return result;
  } catch {
    return {};
  }
}
