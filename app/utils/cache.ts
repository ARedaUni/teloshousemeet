import { kv } from '@vercel/kv';

export async function getCachedTranscript(fileId: string, drive: any): Promise<string | null> {
  try {
    // Check Google Drive file description for cached transcriptId
    const file = await drive.files.get({
      fileId,
      fields: "description",
      supportsAllDrives: true
    });

    if (!file.data.description) return null;

    try {
      const metadata = JSON.parse(file.data.description);
      if (!metadata.transcriptId) return null;

      // Check KV storage
      const cached = await kv.get(`transcript_${fileId}`);
      if (cached) {
        const cacheEntry = JSON.parse(cached as string);
        // Cache valid for 30 days
        if (Date.now() - cacheEntry.timestamp < 30 * 24 * 60 * 60 * 1000) {
          return cacheEntry.transcript;
        }
      }
    } catch (e) {
      return null;
    }
  } catch (error) {
    console.error("Error checking cache:", error);
    return null;
  }
  return null;
}

export async function cacheTranscript(fileId: string, transcriptId: string, transcript: string, drive: any): Promise<void> {
  try {
    // Store in Google Drive metadata
    await drive.files.update({
      fileId,
      requestBody: {
        description: JSON.stringify({
          transcriptId,
          lastProcessed: new Date().toISOString()
        })
      }
    });

    // Store in KV storage
    await kv.set(`transcript_${fileId}`, JSON.stringify({
      transcriptId,
      transcript,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error("Error caching transcript:", error);
  }
} 