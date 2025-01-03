import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";

export const maxDuration = 60; 

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } // Adjusted to handle params as a Promise
) {
  try {
    // Await the params to extract the ID
    const { id: fileId } = await context.params;

    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Get file metadata
    const file = await drive.files.get({
      fileId: fileId,
      fields: "name",
    });

    // Get file content
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      { responseType: "text" }
    );

    return NextResponse.json({
      content: response.data,
      name: file.data.name,
    });
  } catch (error) {
    console.error("Error fetching file content:", error);
    return NextResponse.json(
      { error: "Failed to fetch file content" },
      { status: 500 }
    );
  }
}
