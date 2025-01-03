import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { google } from "googleapis";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { uploadId } = await req.json();

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Get the file details to verify upload
    const file = await drive.files.get({
      fileId: uploadId,
      fields: 'id,name,size',
      supportsAllDrives: true
    });

    return NextResponse.json({ 
      success: true, 
      fileId: file.data.id,
      fileName: file.data.name
    });
  } catch (error) {
    console.error("Error completing upload:", error);
    return NextResponse.json({ error: "Failed to complete upload" }, { status: 500 });
  }
}