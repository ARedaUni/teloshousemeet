import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';

// Load credentials from the service account file
const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

// Initialize Vertex AI with the credentials
const vertexAI = new VertexAI({
  project: process.env.PROJECT_ID,
  location: process.env.LOCATION,
  auth: auth,
});

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { transcript, summaryFolderId, transcriptFolderId, originalFileName } = await req.json();

    const model = vertexAI.preview.getGenerativeModel({
      model: "gemini-1.5-pro",
    });

    // Create prompt with calendar context and transcript
    const prompt = `Given this transcript from a meeting or conversation, create a detailed summary in the following format:

⭐️ EXECUTIVE SUMMARY
══════════════════
[2-3 sentences overview]

📅 MEETING DETAILS
════════════════
[Date, time, duration, location, type of meeting]

👥 KEY PARTICIPANTS
════════════════
[List of speakers and their roles if available]

🎯 MAIN OBJECTIVES
════════════════
[Bullet points of main meeting objectives]

💫 KEY DISCUSSION POINTS
═══════════════════
[Main topics discussed with sub-points]

📊 DECISIONS & OUTCOMES
═════════════
[List of decisions made and outcomes]

⚡️ ACTION ITEMS
════════════
[List of action items with owners and deadlines if mentioned]

🔄 NEXT STEPS
════════════
[Summary of next steps and follow-ups]

Here's the transcript:
${transcript}`;

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    });
    
    const summary = result.response.candidates[0].content.parts[0].text;

    // Initialize Google Drive API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Create transcript file
    const transcriptFile = await drive.files.create({
      requestBody: {
        name: `${originalFileName.replace(/\.[^/.]+$/, '')}_transcript.txt`,
        parents: [transcriptFolderId],
        mimeType: 'text/plain'
      },
      media: {
        mimeType: 'text/plain',
        body: transcript
      },
      fields: 'id',
      supportsAllDrives: true
    });

    // Create summary file
    const summaryFile = await drive.files.create({
      requestBody: {
        name: `${originalFileName.replace(/\.[^/.]+$/, '')}_summary.txt`,
        parents: [summaryFolderId],
        mimeType: 'text/plain'
      },
      media: {
        mimeType: 'text/plain',
        body: summary
      },
      fields: 'id',
      supportsAllDrives: true
    });

    return NextResponse.json({ 
      success: true,
      summary: summary,
      summaryFileId: summaryFile.data.id,
      transcriptFileId: transcriptFile.data.id
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
} 