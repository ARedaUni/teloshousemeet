import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleAuth } from "google-auth-library";

// Load credentials from the service account file
const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
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

    const { transcript, summaryFolderId, transcriptFolderId, originalFileName, bestMatch } = await req.json();

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });

    // Extract calendar context
    let calendarContext = "";
    if (bestMatch) {
      const eventDate = new Date(bestMatch.start?.dateTime || bestMatch.start?.date!);
      const endDate = new Date(bestMatch.end?.dateTime || bestMatch.end?.date!);
      
      calendarContext = `
        Calendar Event Details:
        Event Title: ${bestMatch.summary}
        Date: ${eventDate.toLocaleDateString()}
        Time: ${eventDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}
        Location: ${bestMatch.location || "Not specified"}
        Description: ${bestMatch.description || "No description"}
        Organizer: ${bestMatch.organizer?.email || "Not specified"}
        Attendees: ${bestMatch.attendees?.map(a => `${a.email} (${a.responseStatus})`).join(', ') || "None listed"}
        Conference Details: ${bestMatch.conferenceData?.entryPoints?.[0]?.uri || "No conference link"}
        Created: ${new Date(bestMatch.created).toLocaleString()}
        Last Updated: ${new Date(bestMatch.updated).toLocaleString()}
        Status: ${bestMatch.status}
        Calendar: ${bestMatch.calendar || "Primary"}
      `;
    }

    const model = vertexAI.preview.getGenerativeModel({
      model: "gemini-1.5-pro",
    });

    const prompt = `
    You are an expert summarizer for Telos House, a London-based community that brings together builders, industry experts, academics, and government bodies. Your task is to generate a clear, structured, and professional summary of their meeting transcripts. Focus on collaborative problem-solving, cross-industry insights, and actionable outcomes.

    # Meeting Summary

    ## 1. Executive Summary
    Provide a concise overview of the meeting's key themes and outcomes in 2-3 sentences, highlighting how they align with Telos House's mission of breaking down silos and fostering innovation.

    ## 2. Meeting Details
    - **Date:** [Extract from context or mark as "Not Available"]
    - **Location:** [Specify if at Telos House, King's Cross, or virtual]
    - **Meeting Type:** [Sprint/Workshop/Discussion/Project Meeting]
    - **Duration:** [Extract or mark as "Not Available"]

    ## 3. Participants and Roles
    List participants with their:
    - Name
    - Role/Organization
    - Area of Expertise
    [If not explicitly mentioned, note "Participants' details not specified"]

    ## 4. Key Discussion Areas
    Outline the main topics discussed, structured by:
    - Problem Statement
    - Cross-industry Perspectives
    - Proposed Solutions

    ## 5. Innovation & Insights
    Present a table of key innovations and insights discussed:

    | Domain | Innovation/Insight | Potential Impact | Contributors |
    |--------|-------------------|------------------|--------------|
    | [e.g., AI Ethics] | [Description] | [Impact] | [Names] |

    ## 6. Organizations & Projects Referenced
    Create a structured table of mentioned organizations and projects:

    | Category | Name | Relevance to Discussion | Potential Collaboration |
    |----------|------|------------------------|------------------------|
    | [Tech/Academia/Government] | [Name] | [Context] | [Opportunities] |

    ## 7. Action Items & Next Steps
    List concrete action items:
    - Task
    - Owner
    - Timeline
    - Expected Outcome

    ## 8. Cross-Industry Applications
    Highlight potential applications across different sectors:
    - Industry
    - Application
    - Implementation Considerations

    ## 9. Resources & References
    List any mentioned:
    - Research papers
    - Tools
    - Frameworks
    - External resources

    ## 10. Follow-up Actions
    - Immediate next steps
    - Future collaboration opportunities
    - Scheduled follow-ups

    Calendar Context:
    ${calendarContext}

    Transcript:
    ${transcript}

    Generate a professional summary following this format, emphasizing cross-industry collaboration and practical outcomes.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const summary = result.response.candidates[0].content.parts[0].text;

    // Create files in Google Drive
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Create transcript file
    const transcriptFile = await drive.files.create({
      requestBody: {
        name: `${originalFileName.replace(/\.[^/.]+$/, "")}_transcript.txt`,
        parents: [transcriptFolderId],
        mimeType: "text/plain",
      },
      media: {
        mimeType: "text/plain",
        body: transcript,
      },
      fields: "id",
      supportsAllDrives: true,
    });

    // Create summary file
    const summaryFile = await drive.files.create({
      requestBody: {
        name: `${originalFileName.replace(/\.[^/.]+$/, "")}_summary.txt`,
        parents: [summaryFolderId],
        mimeType: "text/plain",
      },
      media: {
        mimeType: "text/plain",
        body: summary,
      },
      fields: "id",
      supportsAllDrives: true,
    });

    return NextResponse.json({
      success: true,
      summary: summary,
      summaryFileId: summaryFile.data.id,
      transcriptFileId: transcriptFile.data.id,
    });
  } catch (error) {
    console.error("Error generating summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
