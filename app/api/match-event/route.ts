import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";
import { getEmbeddings, cosineSimilarity } from "@/lib/embeddings";
import { backOff } from "exponential-backoff";

function prepareTextForMatching(text: string): string {
  const keyExtractionsMarker = 'Key extractions:';
  const keyExtractionsIndex = text.indexOf(keyExtractionsMarker);
  
  if (keyExtractionsIndex === -1) {
    // If no "Key extractions:" section found, return original text
    return text;
  }
  
  // Get everything after "Key extractions:"
  const keyExtractions = text.slice(keyExtractionsIndex + keyExtractionsMarker.length).trim();
  return keyExtractions;
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

export const maxDuration = 300; // Set maximum duration to 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { summary } = await req.json();
    if (!summary) {
      return NextResponse.json({ error: "No summary provided" }, { status: 400 });
    }

    const preparedText = prepareTextForMatching(summary);
    
    // Generate embeddings in a separate request
    const embeddingsResponse = await fetch(new URL('/api/generate-embeddings', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || ''
      },
      body: JSON.stringify({ text: preparedText })
    });

    if (!embeddingsResponse.ok) {
      throw new Error('Failed to generate embeddings');
    }

    const { embeddings } = await embeddingsResponse.json();

    // Rest of your calendar matching logic...
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token.accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Get events from the last month with caching
    const cacheKey = `calendar-events-${token.email}`;
    let events = await getFromCache(cacheKey);

    if (!events) {
      const startTime = new Date();
      startTime.setFullYear(startTime.getFullYear() - 1);
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startTime.toISOString(),
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
      });
      
      events = response.data.items;
      await setInCache(cacheKey, events, 3600); // Cache for 1 hour
    }

    // Find best matching event using Jina embeddings
    let bestMatch: any|null = null;
    let bestSimilarity = 0;

    try {
      for (const event of events) {
        // Get embeddings for both title and full text separately
        const eventTitle = event.summary || '';
        const eventDescription = event.description || '';
        const eventFullText = `${eventTitle} ${eventDescription}`;
        
        const titleEmbedding = await getEmbeddingsWithRetry(eventTitle);
        const fullTextEmbedding = await getEmbeddingsWithRetry(eventFullText);
        
        // Calculate similarities with different weights
        const titleSimilarity = cosineSimilarity(embeddings, titleEmbedding) * 0.85; 
        const fullTextSimilarity = cosineSimilarity(embeddings, fullTextEmbedding) * 0.15; 
        
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
    console.error("Error in match-event:", error);
    return NextResponse.json(
      { error: "Failed to match event" },
      { status: error instanceof Error && 'code' in error ? error.code === 504 ? 504 : 500 : 500 }
    );
  }
}