import { createServerClient, isSupabaseConfigured } from './client';
import { mockStore } from './mockStore';

/**
 * Upload contract PDF to Supabase Storage with fallback to in-memory/tmp store.
 */
export async function uploadContractFile(
  filePath: string,
  buffer: Buffer
): Promise<{ error: Error | null }> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { error } = await supabase.storage
        .from('contracts')
        .upload(filePath, buffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (error) {
        console.warn('Supabase storage upload error, saving to local store:', error.message);
        await mockStore.saveFile(filePath, buffer);
      }
      return { error: null };
    } catch (err) {
      console.warn('Supabase client error on upload, saving to local store:', err);
      await mockStore.saveFile(filePath, buffer);
      return { error: null };
    }
  }

  // Fallback to mockStore
  await mockStore.saveFile(filePath, buffer);
  return { error: null };
}

/**
 * Download contract PDF buffer from Supabase Storage or fallback store.
 */
export async function downloadContractFile(
  filePath: string
): Promise<{ data: Buffer | null; error: Error | null }> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase.storage
        .from('contracts')
        .download(filePath);

      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        return { data: Buffer.from(arrayBuf), error: null };
      }
      console.warn('Supabase storage download error, checking local store:', error?.message);
    } catch (err) {
      console.warn('Supabase download error, checking local store:', err);
    }
  }

  const localBuffer = await mockStore.getFile(filePath);
  if (localBuffer) {
    return { data: localBuffer, error: null };
  }

  return { data: null, error: new Error('File not found in storage') };
}
