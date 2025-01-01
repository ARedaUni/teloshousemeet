import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";
import { kv } from '@vercel/kv';

export const revalidate = 3600; // Cache for 1 hour

interface CacheEntry {
  content: string;
  name: string;
  modifiedTime: string;
  contentType?: 'markdown' | 'transcript';
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const myparams = await params
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const fileId = myparams.id;
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'markdown';
    
    // Check KV cache first
    const cached = await kv.get<CacheEntry>(`file_content_${fileId}`);
    if (cached) {
      return NextResponse.json(cached);
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Get file metadata
    const file = await drive.files.get({
      fileId: fileId,
      fields: "name,modifiedTime",
    });

    // Get file content
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      { responseType: "text" }
    );

    const result: CacheEntry = {
      content: response.data,
      name: file.data.name,
      modifiedTime: file.data.modifiedTime,
      contentType: type as 'markdown' | 'transcript'
    };

    // Cache the result
    await kv.set(`file_content_${fileId}`, result, {
      ex: 3600 // Expire in 1 hour
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching file content:", error);
    return NextResponse.json(
      { error: "Failed to fetch file content" },
      { status: 500 }
    );
  }
} 