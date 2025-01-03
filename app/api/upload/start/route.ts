import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { google } from "googleapis";
import { backOff } from "exponential-backoff";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { fileName, fileSize, mimeType, sourceFolderId } = await req.json();

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Create the file metadata first
    const fileMetadata = {
      name: fileName,
      parents: [sourceFolderId],
    };

    const file = await backOff(
      async () => {
        return drive.files.create({
          requestBody: fileMetadata,
          media: {
            mimeType: mimeType,
          },
          fields: 'id',
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

    return NextResponse.json({ 
      fileId: file.data.id,
      uploadId: file.data.id // Use fileId as uploadId for simplicity
    });
  } catch (error) {
    console.error("Error starting upload:", error);
    return NextResponse.json({ error: "Failed to start upload" }, { status: 500 });
  }
}