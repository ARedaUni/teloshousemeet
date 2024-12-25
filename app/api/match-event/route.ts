import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";
import { getEmbeddings, cosineSimilarity } from "@/lib/embeddings";

function prepareTextForMatching(text: string): string {
  // Take first 500 chars and last 500 chars
  const maxLength = 500;
  if (text.length <= maxLength * 2) {
    return text;
  }
  
  const start = text.slice(0, maxLength);
  const end = text.slice(-maxLength);
  return `${start}\n...\n${end}`;
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { summary, originalFileId } = await req.json();

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

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

    // Find best matching event using Jina embeddings
    let bestMatch = null;
    let bestSimilarity = 0;

    try {
      const processedText = prepareTextForMatching(summary);
      const summaryEmbedding = await getEmbeddings(processedText);

      for (const event of events.data.items || []) {
        const eventText = `${event.summary || ''} ${event.description || ''}`;
        const eventEmbedding = await getEmbeddings(eventText);
        const similarity = cosineSimilarity(summaryEmbedding, eventEmbedding);

        if (similarity > bestSimilarity && similarity > 0.5) {
          bestSimilarity = similarity;
          bestMatch = event;
        }
      }

      return NextResponse.json({
        success: true,
        matchedEvent: bestMatch ? {
          summary: bestMatch.summary,
          start: bestMatch.start,
          end: bestMatch.end,
          date: bestMatch.start?.dateTime || bestMatch.start?.date,
          description: bestMatch.description,
          location: bestMatch.location,
          organizer: bestMatch.organizer,
          attendees: bestMatch.attendees,
          conferenceData: bestMatch.conferenceData,
          created: bestMatch.created,
          updated: bestMatch.updated,
          status: bestMatch.status,
          similarity: bestSimilarity
        } : null
      });
    } catch (error) {
      console.error("Error with embeddings:", error);
      return NextResponse.json(
        { error: "Failed to generate embeddings" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error matching event:", error);
    return NextResponse.json(
      { error: "Failed to match event" },
      { status: 500 }
    );
  }
}