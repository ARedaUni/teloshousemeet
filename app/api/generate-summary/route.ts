// import { NextRequest, NextResponse } from "next/server";
// import { google } from "googleapis";
// import { getToken } from "next-auth/jwt";
// import { VertexAI } from '@google-cloud/vertexai';
// import { GoogleAuth } from 'google-auth-library';

// // Load credentials from the service account file
// const auth = new GoogleAuth({
//   keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
//   scopes: ['https://www.googleapis.com/auth/cloud-platform'],
// });

// // Initialize Vertex AI with the credentials
// const vertexAI = new VertexAI({
//   project: process.env.PROJECT_ID,
//   location: process.env.LOCATION,
//   auth: auth,
// });

// export async function POST(req: NextRequest) {
//   try {
//     const token = await getToken({ req });
//     if (!token?.accessToken) {
//       return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
//     }

//     const { transcript, summaryFolderId, transcriptFolderId, originalFileName } = await req.json();

//     const model = vertexAI.preview.getGenerativeModel({
//       model: "gemini-1.5-pro",
//     });

//     // Create prompt with calendar context and transcript
//     const prompt = `Given this transcript from a meeting or conversation, create a detailed summary in the following format:

// ⭐️ EXECUTIVE SUMMARY
// ══════════════════
// [2-3 sentences overview]

// 📅 MEETING DETAILS
// ════════════════
// [Date, time, duration, location, type of meeting]

// 👥 KEY PARTICIPANTS
// ════════════════
// [List of speakers and their roles if available]

// 🎯 MAIN OBJECTIVES
// ════════════════
// [Bullet points of main meeting objectives]

// 💫 KEY DISCUSSION POINTS
// ═══════════════════
// [Main topics discussed with sub-points]

// 📊 DECISIONS & OUTCOMES
// ═════════════
// [List of decisions made and outcomes]

// ⚡️ ACTION ITEMS
// ════════════
// [List of action items with owners and deadlines if mentioned]

// 🔄 NEXT STEPS
// ════════════
// [Summary of next steps and follow-ups]

// Here's the transcript:
// ${transcript}`;

//     const result = await model.generateContent({
//       contents: [{
//         role: 'user',
//         parts: [{ text: prompt }]
//       }]
//     });
    
//     const summary = result.response.candidates[0].content.parts[0].text;

//     // Initialize Google Drive API
//     const oauth2Client = new google.auth.OAuth2();
//     oauth2Client.setCredentials({ access_token: token.accessToken });
//     const drive = google.drive({ version: "v3", auth: oauth2Client });

//     // Create transcript file
//     const transcriptFile = await drive.files.create({
//       requestBody: {
//         name: `${originalFileName.replace(/\.[^/.]+$/, '')}_transcript.txt`,
//         parents: [transcriptFolderId],
//         mimeType: 'text/plain'
//       },
//       media: {
//         mimeType: 'text/plain',
//         body: transcript
//       },
//       fields: 'id',
//       supportsAllDrives: true
//     });

//     // Create summary file
//     const summaryFile = await drive.files.create({
//       requestBody: {
//         name: `${originalFileName.replace(/\.[^/.]+$/, '')}_summary.txt`,
//         parents: [summaryFolderId],
//         mimeType: 'text/plain'
//       },
//       media: {
//         mimeType: 'text/plain',
//         body: summary
//       },
//       fields: 'id',
//       supportsAllDrives: true
//     });

//     return NextResponse.json({ 
//       success: true,
//       summary: summary,
//       summaryFileId: summaryFile.data.id,
//       transcriptFileId: transcriptFile.data.id
//     });
//   } catch (error) {
//     console.error('Error generating summary:', error);
//     return NextResponse.json(
//       { error: "Failed to generate summary" },
//       { status: 500 }
//     );
//   }
// } 

// import { NextRequest, NextResponse } from "next/server";
// import { google } from "googleapis";
// import { getToken } from "next-auth/jwt";
// import { VertexAI } from '@google-cloud/vertexai';
// import { GoogleAuth } from 'google-auth-library';

// // Load credentials from the service account file
// const auth = new GoogleAuth({
//   keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
//   scopes: ['https://www.googleapis.com/auth/cloud-platform'],
// });

// // Initialize Vertex AI with the credentials
// const vertexAI = new VertexAI({
//   project: process.env.PROJECT_ID,
//   location: process.env.LOCATION,
//   auth: auth,
// });

// async function getEmbeddings(text: string) {
//   const model = vertexAI.preview.getGenerativeModel({
//     model: "gemini-1.5-pro",
//   });

//   const result = await model.generateContent({
//     contents: [{
//       role: 'user',
//       parts: [{ text: `Generate embeddings for this text: ${text}` }]
//     }]
//   });

//   const embeddingString = result.response.candidates[0].content.parts[0].text;
//   const embeddingArray = JSON.parse(embeddingString);
//   return embeddingArray;
// }

// function cosineSimilarity(vecA: number[], vecB: number[]): number {
//   let dotProduct = 0;
//   let magnitudeA = 0;
//   let magnitudeB = 0;

//   for (let i = 0; i < vecA.length; i++) {
//     dotProduct += vecA[i] * vecB[i];
//     magnitudeA += vecA[i] * vecA[i];
//     magnitudeB += vecB[i] * vecB[i];
//   }

//   magnitudeA = Math.sqrt(magnitudeA);
//   magnitudeB = Math.sqrt(magnitudeB);

//   if (magnitudeA === 0 || magnitudeB === 0) {
//     return 0;
//   }

//   return dotProduct / (magnitudeA * magnitudeB);
// }

// export async function POST(req: NextRequest) {
//   try {
//     const token = await getToken({ req });
//     if (!token?.accessToken) {
//       return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
//     }

//     const { transcript, summaryFolderId, transcriptFolderId, originalFileName } = await req.json();

//     const oauth2Client = new google.auth.OAuth2();
//     oauth2Client.setCredentials({ access_token: token.accessToken });
//     const calendar = google.calendar({ version: "v3", auth: oauth2Client });

//     // Get events from the last month
//     const startTime = new Date();
//     startTime.setMonth(startTime.getMonth() - 1);
//     const endTime = new Date();
//     endTime.setMonth(endTime.getMonth() + 1);

//     const events = await calendar.events.list({
//       calendarId: 'primary',
//       timeMin: startTime.toISOString(),
//       timeMax: endTime.toISOString(),
//       singleEvents: true,
//       orderBy: 'startTime'
//     });

//     // Find best matching event
//     let bestMatch = null;
//     let bestSimilarity = 0;

//     const transcriptEmbedding = await getEmbeddings(transcript);

//     if (!transcriptEmbedding) {
//       throw new Error("Could not generate embeddings for transcript");
//     }

//     for (const event of events.data.items || []) {
//       const eventText = `${event.summary || ''} ${event.description || ''}`;
//       const eventEmbedding = await getEmbeddings(eventText);

//       if (!eventEmbedding) {
//         continue;
//       }

//       const similarity = cosineSimilarity(transcriptEmbedding, eventEmbedding);

//       if (similarity > bestSimilarity && similarity > 0.1) {
//         bestSimilarity = similarity;
//         bestMatch = event;
//       }
//     }

//     let calendarContext = "";
//     if (bestMatch) {
//       const eventDate = new Date(bestMatch.start?.dateTime || bestMatch.start?.date!);
//       calendarContext = `
//         Calendar Event Details:
//         Event Title: ${bestMatch.summary}
//         Event Date: ${eventDate.toLocaleDateString()}
//         Event Description: ${bestMatch.description || 'No description'}
//       `;
//     }

//     const model = vertexAI.preview.getGenerativeModel({
//       model: "gemini-1.5-pro",
//     });

//     // Create prompt with calendar context and transcript
//     const prompt = `
//     You are an expert summarizer of meeting and conversation transcripts. Your goal is to extract key information and present it in a structured format.

// Given the following transcript and calendar event details (if available), provide a detailed summary. If specific information is not present in the transcript or calendar details, explicitly state "Not Available".

// **Summary Format:**

// **1. EXECUTIVE SUMMARY**
//    - A concise overview of the meeting or conversation (2-3 sentences). If not available, state "Not Available".

// **2. MEETING/CONVERSATION DETAILS**
//    - **Date:** [Date of the meeting/conversation, if available from calendar, otherwise "Not Available"]
//    - **Time:** [Time of the meeting/conversation, if available from calendar, otherwise "Not Available"]
//    - **Duration:** [Duration of the meeting/conversation, if available from calendar or transcript, otherwise "Not Available"]
//    - **Location:** [Location of the meeting/conversation, if available from calendar, otherwise "Not Available"]
//    - **Type:** [Type of meeting/conversation, if available from calendar or transcript, otherwise "Not Available"]

// **3. KEY PARTICIPANTS**
//    - List of people who spoke, along with their roles or affiliations if mentioned. If not available, state "Not Available".

// **4. MAIN OBJECTIVES**
//    - Bullet points of the main goals or purposes of the meeting/conversation. If not available, state "Not Available".

// **5. KEY DISCUSSION POINTS**
//    - Main topics discussed, with sub-points for details. If not available, state "Not Available".

// **6. COMPANIES AND CONCEPTS MENTIONED**
//    - List of companies and concepts discussed. If not available, state "Not Available".

// **7. MAIN OPINIONS AND BY WHOM**
//    - List of main opinions expressed and who expressed them. If not available, state "Not Available".

// **8. DECISIONS AND OUTCOMES**
//    - List of decisions made and outcomes of the meeting/conversation. If not available, state "Not Available".

// **9. ACTION ITEMS**
//    - List of action items, including owners and deadlines if mentioned. If not available, state "Not Available".

// **10. NEXT STEPS**
//     - Summary of next steps and follow-ups. If not available, state "Not Available".

// **Transcript:**
// ${transcript}

// **Calendar Event Details:**
// ${calendarContext}
//     `;

//     const result = await model.generateContent({
//       contents: [{
//         role: 'user',
//         parts: [{ text: prompt }]
//       }]
//     });

//     const summary = result.response.candidates[0].content.parts[0].text;

//     // Initialize Google Drive API
//     const drive = google.drive({ version: "v3", auth: oauth2Client });

//     // Create transcript file
//     const transcriptFile = await drive.files.create({
//       requestBody: {
//         name: `${originalFileName.replace(/\.[^/.]+$/, '')}_transcript.txt`,
//         parents: [transcriptFolderId],
//         mimeType: 'text/plain'
//       },
//       media: {
//         mimeType: 'text/plain',
//         body: transcript
//       },
//       fields: 'id',
//       supportsAllDrives: true
//     });

//     // Create summary file
//     const summaryFile = await drive.files.create({
//       requestBody: {
//         name: `${originalFileName.replace(/\.[^/.]+$/, '')}_summary.txt`,
//         parents: [summaryFolderId],
//         mimeType: 'text/plain'
//       },
//       media: {
//         mimeType: 'text/plain',
//         body: summary
//       },
//       fields: 'id',
//       supportsAllDrives: true
//     });

//     return NextResponse.json({
//       success: true,
//       summary: summary,
//       summaryFileId: summaryFile.data.id,
//       transcriptFileId: transcriptFile.data.id
//     });
//   } catch (error) {
//     console.error('Error generating summary:', error);
//     return NextResponse.json(
//       { error: "Failed to generate summary" },
//       { status: 500 }
//     );
//   }
// }


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

async function getEmbeddings(text: string) {
  const model = vertexAI.preview.getGenerativeModel({
    model: "gemini-1.5-pro",
  });

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: `Generate embeddings for this text: ${text}` }]
    }]
  });

  const embeddingString = result.response.candidates[0].content.parts[0].text;
  try {
    if (typeof embeddingString === 'string') {
      const embeddingArray = JSON.parse(embeddingString);
      return embeddingArray;
    } else {
      console.error("Embedding string is not a string:", embeddingString);
      return [];
    }
  } catch (error) {
    console.error("Error parsing embeddings:", error);
    return []; // Return an empty array if parsing fails
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { transcript, summaryFolderId, transcriptFolderId, originalFileName, bestMatch } = await req.json();

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    let calendarContext = "";
    if (bestMatch) {
      const eventDate = new Date(bestMatch.start?.dateTime || bestMatch.start?.date!);
      calendarContext = `
        Calendar Event Details:
        Event Title: ${bestMatch.summary}
        Event Date: ${eventDate.toLocaleDateString()}
        Event Description: ${bestMatch.description || 'No description'}
      `;
    }

    const model = vertexAI.preview.getGenerativeModel({
      model: "gemini-1.5-pro",
    });

    // Create prompt with calendar context and transcript
    const prompt = `
    You are an expert summarizer of meeting and conversation transcripts. Your goal is to extract key information and present it in a structured format.

Given the following transcript and calendar event details (if available), provide a detailed summary. If specific information is not present in the transcript or calendar details, explicitly state "Not Available".

**Summary Format:**

**1. EXECUTIVE SUMMARY**
   - A concise overview of the meeting or conversation (2-3 sentences). If not available, state "Not Available".

**2. MEETING/CONVERSATION DETAILS**
   - **Date:** [Date of the meeting/conversation, if available from calendar, otherwise "Not Available"]
   - **Time:** [Time of the meeting/conversation, if available from calendar, otherwise "Not Available"]
   - **Duration:** [Duration of the meeting/conversation, if available from calendar or transcript, otherwise "Not Available"]
   - **Location:** [Location of the meeting/conversation, if available from calendar, otherwise "Not Available"]
   - **Type:** [Type of meeting/conversation, if available from calendar or transcript, otherwise "Not Available"]

**3. KEY PARTICIPANTS**
   - List of people who spoke, along with their roles or affiliations if mentioned. If not available, state "Not Available".

**4. MAIN OBJECTIVES**
   - Bullet points of the main goals or purposes of the meeting/conversation. If not available, state "Not Available".

**5. KEY DISCUSSION POINTS**
   - Main topics discussed, with sub-points for details. If not available, state "Not Available".

**6. COMPANIES AND CONCEPTS MENTIONED**
   - List of companies and concepts discussed. If not available, state "Not Available".

**7. MAIN OPINIONS AND BY WHOM**
   - List of main opinions expressed and who expressed them. If not available, state "Not Available".

**8. DECISIONS AND OUTCOMES**
   - List of decisions made and outcomes of the meeting/conversation. If not available, state "Not Available".

**9. ACTION ITEMS**
   - List of action items, including owners and deadlines if mentioned. If not available, state "Not Available".

**10. NEXT STEPS**
    - Summary of next steps and follow-ups. If not available, state "Not Available".

**Transcript:**
${transcript}

**Calendar Event Details:**
${calendarContext}
    `;

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    });

    const summary = result.response.candidates[0].content.parts[0].text;

    // Initialize Google Drive API
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