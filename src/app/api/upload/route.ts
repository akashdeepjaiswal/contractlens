import { NextRequest, NextResponse } from 'next/server';
import { uploadContractFile } from '@/lib/db/storage';
import { createContract } from '@/lib/db/contracts';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 50 MB.` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to storage (Supabase if configured, otherwise persistent local store)
    const fileName = `${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
    const filePath = `contracts/${fileName}`;

    const { error: uploadError } = await uploadContractFile(filePath, buffer);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to store file. Please try again.' },
        { status: 500 }
      );
    }

    // Create contract record
    const contract = await createContract({
      name: file.name.replace(/\.pdf$/i, ''),
      filePath,
    });

    return NextResponse.json({
      contractId: contract.id,
      name: contract.name,
      contract,
      fileBase64: buffer.toString('base64'),
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}
