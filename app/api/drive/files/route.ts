import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const folderId = url.searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json({ error: "No folder ID provided" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'audio/' or mimeType = 'audio/mpeg' or mimeType = 'audio/wav' or mimeType = 'audio/x-m4a') and trashed = false`,
      fields: "files(id, name, mimeType, webContentLink, parents)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    // Filter files to only include those directly in the selected folder
    const files = response.data.files.filter(file => 
      file.parents && file.parents[0] === folderId
    );

    console.log("Found files:", files);

    return NextResponse.json({ files: files });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
} 