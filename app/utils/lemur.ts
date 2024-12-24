import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";
import { AssemblyAI } from 'assemblyai';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { transcript, summaryFolderId, originalFileName } = await req.json();

    // Initialize Google Drive API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Initialize AssemblyAI client
    const client = new AssemblyAI({
      apiKey: process.env.ASSEMBLY_AI_API_KEY as string
    });

    // Generate summary using AssemblyAI's LeMur
    const { response } = await client.lemur.task({
      transcript_ids: [transcript],
      prompt: "summarise for me the people, the companies, concepts mentioned in the discussion, main talking points, main opinions and if possible by whom",
      final_model: 'anthropic/claude-3-sonnet-20240229'
    });

    // Create summary file with content
    const summaryFile = await drive.files.create({
      requestBody: {
        name: `${originalFileName.replace(/\.[^/.]+$/, '')}_summary.txt`,
        parents: [summaryFolderId],
        mimeType: 'text/plain'
      },
      media: {
        mimeType: 'text/plain',
        body: response
      },
      fields: 'id',
      supportsAllDrives: true
    });

    return NextResponse.json({ 
      success: true,
      summary: response,
      summaryFileId: summaryFile.data.id
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
} 