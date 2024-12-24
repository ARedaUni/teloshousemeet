import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";

function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { summary, originalFileId, summaryFileId, transcriptFileId } = await req.json();

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Get events from the last month
    const startTime = new Date();
    startTime.setMonth(startTime.getMonth() - 1);
    const endTime = new Date();
    endTime.setMonth(endTime.getMonth() + 1);

    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    // Find best matching event
    let bestMatch = null;
    let bestSimilarity = 0;

    events.data.items?.forEach(event => {
      const eventText = `${event.summary || ''} ${event.description || ''}`;
      const similarity = calculateSimilarity(summary, eventText);
      
      if (similarity > bestSimilarity && similarity > 0.1) { // Threshold of 10% similarity
        bestSimilarity = similarity;
        bestMatch = event;
      }
    });

    if (bestMatch) {
      // Rename both files with event info
      const eventDate = new Date(bestMatch.start?.dateTime || bestMatch.start?.date!);
      const newName = `${bestMatch.summary} | ${eventDate.toLocaleDateString()}`;

      await Promise.all([
        drive.files.update({
          fileId: originalFileId,
          requestBody: {
            name: `${newName}.m4a`
          }
        }),
        drive.files.update({
          fileId: summaryFileId,
          requestBody: {
            name: `${newName}_summary.txt`
          }
        }),
        drive.files.update({
          fileId: transcriptFileId,
          requestBody: {
            name: `${newName}_transcript.txt`
          }
        })
      ]);
    }

    return NextResponse.json({ 
      success: true,
      matchedEvent: bestMatch ? {
        summary: bestMatch.summary,
        date: bestMatch.start?.dateTime || bestMatch.start?.date
      } : null
    });
  } catch (error) {
    console.error("Error matching event:", error);
    return NextResponse.json(
      { error: "Failed to match event" },
      { status: 500 }
    );
  }
} 