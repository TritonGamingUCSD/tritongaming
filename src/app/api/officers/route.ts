import { NextResponse } from 'next/server';
import officers from '@/data/officers.json';

export async function GET() {
  return NextResponse.json({ officers });
}
