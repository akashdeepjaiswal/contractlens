import { NextRequest, NextResponse } from 'next/server';
import { listContracts } from '@/lib/db/contracts';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    const contracts = await listContracts();
    return NextResponse.json({ contracts });
  } catch (err) {
    console.error('List contracts error:', err);
    return NextResponse.json({ error: 'Failed to load contracts' }, { status: 500 });
  }
}
