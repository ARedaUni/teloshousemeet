import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const folderId = url.searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const response = await drive.files.get({
      fileId: folderId,
      fields: "name",
    });

    return NextResponse.json({ name: response.data.name });
  } catch (error) {
    console.error("Error fetching folder name:", error);
    return NextResponse.json(
      { error: "Failed to fetch folder name" },
      { status: 500 }
    );
  }
} 