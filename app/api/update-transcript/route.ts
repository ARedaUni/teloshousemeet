import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { transcriptFileId, text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "No transcript text provided" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Format the transcript text
    const formattedText = text
      .split('\n')
      .filter(line => line.trim())
      .join('\n\n');

    await drive.files.update({
      fileId: transcriptFileId,
      requestBody: {
        description: 'Transcript generated by AssemblyAI'
      },
      media: {
        mimeType: 'text/plain',
        body: formattedText
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating transcript:", error);
    return NextResponse.json(
      { error: "Failed to update transcript" },
      { status: 500 }
    );
  }
} 