import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import axios from "axios";
import { getToken } from "next-auth/jwt";

const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLY_AI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const fileId = formData.get("fileId");
    const sourceFolderId = formData.get("sourceFolderId") as string;
    const summaryFolderId = formData.get("summaryFolderId") as string;
    const transcriptFolderId = formData.get("transcriptFolderId") as string;

    if (!fileId) {
      return NextResponse.json({ error: "No valid file provided" }, { status: 400 });
    }

    // Initialize Google Drive API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Get file details
    const fileResponse = await drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType',
      supportsAllDrives: true
    });

    // Make the file publicly accessible for AssemblyAI
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      },
      fields: 'id'
    });

    // Get the public link
    const publicFile = await drive.files.get({
      fileId: fileId,
      fields: 'webContentLink',
      supportsAllDrives: true
    });

    if (!publicFile.data.webContentLink) {
      throw new Error("Could not generate public link for file");
    }

    // Start transcription with AssemblyAI
    const assemblyResponse = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      {
        audio_url: publicFile.data.webContentLink,
        speaker_labels: true,
      },
      {
        headers: {
          authorization: ASSEMBLY_AI_API_KEY,
        },
      }
    );

    if (!assemblyResponse.data.id) {
      throw new Error("Failed to start transcription");
    }

    return NextResponse.json({
      success: true,
      transcriptId: assemblyResponse.data.id,
      originalFileId: fileId,
      summaryFolderId: summaryFolderId,
      transcriptFolderId: transcriptFolderId,
      originalFileName: fileResponse.data.name,
      message: "Processing started"
    });
  } catch (error: any) {
    console.error("Error processing file:", error.response?.data || error);
    const errorMessage = error.response?.data?.error || error.message || "Error processing file";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
} 