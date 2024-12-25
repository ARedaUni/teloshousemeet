import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { originalFileId, summaryFileId, transcriptFileId, matchedEvent } = await req.json();

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const eventDate = new Date(matchedEvent.date);
    const newName = `${matchedEvent.summary} | ${eventDate.toLocaleDateString()}`;

    await Promise.all([
      drive.files.update({
        fileId: originalFileId,
        requestBody: { name: `${newName}.m4a` }
      }),
      drive.files.update({
        fileId: summaryFileId,
        requestBody: { name: `${newName}_summary.txt` }
      }),
      drive.files.update({
        fileId: transcriptFileId,
        requestBody: { name: `${newName}_transcript.txt` }
      })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating filenames:", error);
    return NextResponse.json(
      { error: "Failed to update filenames" },
      { status: 500 }
    );
  }
}