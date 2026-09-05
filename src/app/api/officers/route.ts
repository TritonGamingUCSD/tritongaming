import { NextResponse } from 'next/server';
import { getContentBlock } from '@/lib/content';

export async function GET() {
  const content = await getContentBlock('officers');
  const items = content.items || [];
  return NextResponse.json({ officers: items });
}
