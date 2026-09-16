import { NextRequest, NextResponse } from 'next/server';
import { getContract } from '@/lib/db/contracts';
import { getClausesByContract, getSectionMap, getDefinedTerms } from '@/lib/db/clauses';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contract = await getContract(id);

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const [clauses, sectionMap, definedTerms] = await Promise.all([
      getClausesByContract(id),
      getSectionMap(id),
      getDefinedTerms(id),
    ]);

    return NextResponse.json({ contract, clauses, sectionMap, definedTerms });
  } catch (err) {
    console.error('Get contract error:', err);
    return NextResponse.json({ error: 'Failed to load contract' }, { status: 500 });
  }
}
