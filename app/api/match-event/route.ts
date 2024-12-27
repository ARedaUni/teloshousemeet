import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";
import { getEmbeddings, cosineSimilarity } from "@/lib/embeddings";
import { backOff } from "exponential-backoff";

function prepareTextForMatching(text: string): string {
  // Take first 1000 chars, middle 500 chars, and last 1000 chars
  const startLength = 1000;
  const middleLength = 500;
  const endLength = 1000;

  if (text.length <= startLength + endLength + middleLength) {
    return text;
  }
  
  const start = text.slice(0, startLength);
  
  // Get middle section
  const middleStart = Math.floor((text.length - middleLength) / 2);
  const middle = text.slice(middleStart, middleStart + middleLength);
  
  const end = text.slice(-endLength);

  // Combine with clear section markers
  return `
Beginning:
${start}

Middle Section:
${middle}

End:
${end}
  `.trim();
}

const getEmbeddingsWithRetry = async (text: string) => {
  return backOff(
    async () => {
      try {
        return await getEmbeddings(text);
      } catch (error: any) {
        if (error.code === 'ECONNRESET') {
          throw error;
        }
        throw new Error('Embedding generation failed: ' + error.message);
      }
    },
    {
      numOfAttempts: 3,
      startingDelay: 2000,
      timeMultiple: 2,
      maxDelay: 10000
    }
  );
};

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
    startTime.setFullYear(startTime.getFullYear() - 1);
    const endTime = new Date();

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
      const summaryEmbedding = await getEmbeddingsWithRetry(processedText);

      for (const event of events.data.items || []) {
        // Get embeddings for both title and full text separately
        const eventTitle = event.summary || '';
        const eventDescription = event.description || '';
        const eventFullText = `${eventTitle} ${eventDescription}`;
        
        const titleEmbedding = await getEmbeddingsWithRetry(eventTitle);
        const fullTextEmbedding = await getEmbeddingsWithRetry(eventFullText);
        
        // Calculate similarities with different weights
        const titleSimilarity = cosineSimilarity(summaryEmbedding, titleEmbedding) * 0.7; // 70% weight to title
        const fullTextSimilarity = cosineSimilarity(summaryEmbedding, fullTextEmbedding) * 0.3; // 30% weight to full text
        
        const combinedSimilarity = titleSimilarity + fullTextSimilarity;

        if (combinedSimilarity > bestSimilarity && combinedSimilarity > 0.5) {
          bestSimilarity = combinedSimilarity;
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