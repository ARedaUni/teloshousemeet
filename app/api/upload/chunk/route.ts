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
    const uploadId = formData.get('uploadId') as string; // This is the fileId
    const partNumber = parseInt(formData.get('partNumber') as string);

    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    await backOff(
      async () => {
        return drive.files.update({
          fileId: uploadId,
          media: {
            mimeType: 'application/octet-stream',
            body: Readable.from(buffer),
          },
          supportsAllDrives: true,
        });
      },
      {
        numOfAttempts: 3,
        startingDelay: 2000,
        timeMultiple: 2,
        maxDelay: 10000,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error uploading chunk:", error);
    return NextResponse.json({ error: "Failed to upload chunk" }, { status: 500 });
  }
}