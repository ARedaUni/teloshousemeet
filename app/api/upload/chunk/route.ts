import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { google } from "googleapis";
import { Readable } from "stream";
import { backOff } from "exponential-backoff";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const chunk = formData.get('chunk') as Blob;
    const uploadId = formData.get('uploadId') as string;
    const partNumber = parseInt(formData.get('partNumber') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const mimeType = formData.get('mimeType') as string;

    if (!chunk || !uploadId || isNaN(partNumber)) {
      return NextResponse.json({ error: "Invalid chunk data" }, { status: 400 });
    }

    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    await backOff(
      async () => {
        try {
          const response = await drive.files.update({
            fileId: uploadId,
            media: {
              mimeType: mimeType || 'application/octet-stream',
              body: Readable.from(buffer),
            },
            supportsAllDrives: true,
            uploadType: 'resumable',
            fields: 'id,size'
          });

          return response;
        } catch (error: any) {
          if (error.code === 'ECONNRESET' || error.code === 503 || error.code === 504) {
            throw error; // Trigger retry
          }
          throw new Error(`Upload failed: ${error.message}`);
        }
      },
      {
        numOfAttempts: 5,
        startingDelay: 2000,
        timeMultiple: 2,
        maxDelay: 30000,
        jitter: 'full'
      }
    );

    return NextResponse.json({ 
      success: true,
      progress: (partNumber + 1) / totalChunks * 100
    });
  } catch (error) {
    console.error("Error uploading chunk:", error);
    return NextResponse.json({ error: "Failed to upload chunk" }, { status: 500 });
  }
}