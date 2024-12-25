// import { NextRequest, NextResponse } from "next/server";
// import { google } from "googleapis";
// import { getToken } from "next-auth/jwt";

// function calculateSimilarity(text1: string, text2: string): number {
//   const words1 = new Set(text1.toLowerCase().split(/\s+/));
//   const words2 = new Set(text2.toLowerCase().split(/\s+/));
//   const intersection = new Set([...words1].filter(x => words2.has(x)));
//   const union = new Set([...words1, ...words2]);
//   return intersection.size / union.size;
// }

// export async function POST(req: NextRequest) {
//   try {
//     const token = await getToken({ req });
//     if (!token?.accessToken) {
//       return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
//     }

//     const { summary, originalFileId, summaryFileId, transcriptFileId } = await req.json();

//     const oauth2Client = new google.auth.OAuth2();
//     oauth2Client.setCredentials({ access_token: token.accessToken });
//     const calendar = google.calendar({ version: "v3", auth: oauth2Client });
//     const drive = google.drive({ version: "v3", auth: oauth2Client });

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

//     events.data.items?.forEach(event => {
//       const eventText = `${event.summary || ''} ${event.description || ''}`;
//       const similarity = calculateSimilarity(summary, eventText);
      
//       if (similarity > bestSimilarity && similarity > 0.1) { // Threshold of 10% similarity
//         bestSimilarity = similarity;
//         bestMatch = event;
//       }
//     });

//     if (bestMatch) {
//       // Rename both files with event info
//       const eventDate = new Date(bestMatch.start?.dateTime || bestMatch.start?.date!);
//       const newName = `${bestMatch.summary} | ${eventDate.toLocaleDateString()}`;

//       await Promise.all([
//         drive.files.update({
//           fileId: originalFileId,
//           requestBody: {
//             name: `${newName}.m4a`
//           }
//         }),
//         drive.files.update({
//           fileId: summaryFileId,
//           requestBody: {
//             name: `${newName}_summary.txt`
//           }
//         }),
//         drive.files.update({
//           fileId: transcriptFileId,
//           requestBody: {
//             name: `${newName}_transcript.txt`
//           }
//         })
//       ]);
//     }

//     return NextResponse.json({ 
//       success: true,
//       matchedEvent: bestMatch ? {
//         summary: bestMatch.summary,
//         date: bestMatch.start?.dateTime || bestMatch.start?.date
//       } : null
//     });
//   } catch (error) {
//     console.error("Error matching event:", error);
//     return NextResponse.json(
//       { error: "Failed to match event" },
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

const eventEmbeddingsCache = new Map<string, number[]>();

// Rate Limiter
const requestCounts = new Map<string, number>();
const requestTimestamps = new Map<string, number>();
const MAX_REQUESTS_PER_MINUTE = 20; // Adjust this value as needed

// Synonym dictionary
const synonyms = {
  meeting: ["discussion", "session", "conference"],
  project: ["initiative", "task", "assignment"],
  update: ["review", "status", "progress"],
  // Add more as needed
};

// Expand text with synonyms
function expandWithSynonyms(text: string): string {
  const words = text.toLowerCase().split(/\s+/);
  const expanded = words.flatMap(word =>
    synonyms[word] ? [word, ...synonyms[word]] : [word]
  );
  return expanded.join(" ");
}

// Calculate term frequency
function calculateTF(text: string): Map<string, number> {
  const words = text.toLowerCase().split(/\s+/);
  const tfMap = new Map<string, number>();
  words.forEach(word => {
    tfMap.set(word, (tfMap.get(word) || 0) + 1);
  });
  return tfMap;
}

// Calculate inverse document frequency
function calculateIDF(documents: string[]): Map<string, number> {
  const idfMap = new Map<string, number>();
  const totalDocs = documents.length;

  documents.forEach(doc => {
    const words = new Set(doc.toLowerCase().split(/\s+/));
    words.forEach(word => {
      idfMap.set(word, (idfMap.get(word) || 0) + 1);
    });
  });

  idfMap.forEach((count, word) => {
    idfMap.set(word, Math.log(totalDocs / (count + 1))); // Add 1 to avoid division by zero
  });

  return idfMap;
}

// Calculate TF-IDF vector
function calculateTFIDF(text: string, idfMap: Map<string, number>): Map<string, number> {
  const tfMap = calculateTF(text);
  const tfidfMap = new Map<string, number>();

  tfMap.forEach((tf, word) => {
    const idf = idfMap.get(word) || 0;
    tfidfMap.set(word, tf * idf);
  });

  return tfidfMap;
}

// Cosine similarity for TF-IDF vectors
function cosineSimilarityTFIDF(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  vecA.forEach((valueA, key) => {
    const valueB = vecB.get(key) || 0;
    dotProduct += valueA * valueB;
    magnitudeA += valueA ** 2;
  });

  vecB.forEach(valueB => {
    magnitudeB += valueB ** 2;
  });

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

// Weighted similarity function
function calculateSimilarity(summary: string, eventText: string, idfMap: Map<string, number>): number {
  const expandedSummary = expandWithSynonyms(summary);
  const expandedEventText = expandWithSynonyms(eventText);

  const tfidfSummary = calculateTFIDF(expandedSummary, idfMap);
  const tfidfEventText = calculateTFIDF(expandedEventText, idfMap);

  // Cosine similarity for TF-IDF vectors
  const tfidfSimilarity = cosineSimilarityTFIDF(tfidfSummary, tfidfEventText);

  // Basic Jaccard similarity as a secondary score
  const words1 = new Set(expandedSummary.split(/\s+/));
  const words2 = new Set(expandedEventText.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  const jaccardSimilarity = intersection.size / union.size;

  // Weighted combination
  return 0.7 * tfidfSimilarity + 0.3 * jaccardSimilarity;
}


async function getEmbeddings(text: string) {
  const model = vertexAI.preview.getGenerativeModel({
    model: "gemini-1.5-pro",
  });

  const now = Date.now();
  const key = 'gemini-api';

  // Rate limiting logic
  const count = requestCounts.get(key) || 0;
  const lastRequestTime = requestTimestamps.get(key) || 0;
  const timeElapsed = now - lastRequestTime;

  if (count >= MAX_REQUESTS_PER_MINUTE && timeElapsed < 60000) {
    const waitTime = 60000 - timeElapsed;
    console.warn(`Rate limit exceeded. Waiting ${waitTime}ms before next request.`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    requestCounts.set(key, 0);
  }

  requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  requestTimestamps.set(key, now);

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Generate embeddings for this text: ${text}` }]
      }]
    });

    const embeddingString = result.response.candidates[0].content.parts[0].text;
    if (typeof embeddingString === 'string') {
      const embeddingArray = JSON.parse(embeddingString);
      return embeddingArray;
    } else {
      console.error("Embedding string is not a string:", embeddingString);
      return [];
    }
  } catch (error) {
    console.error("Error parsing embeddings:", error);
    throw error; // Re-throw the error to trigger fallback
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

    // Build IDF map from all event texts
    const allEventTexts = events.data.items?.map(event =>
      `${event.summary || ''} ${event.description || ''}`
    ) || [];
    const idfMap = calculateIDF([summary, ...allEventTexts]);

    // Find best matching event
    let bestMatch = null;
    let bestSimilarity = 0;
    let useEmbeddings = true;

    let summaryEmbedding;
    try {
      summaryEmbedding = await getEmbeddings(summary);
      if (!summaryEmbedding) {
        useEmbeddings = false;
      }
    } catch (error) {
      console.error("Error generating embeddings, falling back to TF-IDF:", error);
      useEmbeddings = false;
    }

    for (const event of events.data.items || []) {
      const eventText = `${event.summary || ''} ${event.description || ''}`;
      let similarity;

      if (useEmbeddings) {
        let eventEmbedding = eventEmbeddingsCache.get(eventText);
        if (!eventEmbedding) {
          try {
            eventEmbedding = await getEmbeddings(eventText);
            if (eventEmbedding && eventEmbedding.length > 0) {
              eventEmbeddingsCache.set(eventText, eventEmbedding);
            }
          } catch (error) {
            console.error("Error generating embeddings for event, falling back to TF-IDF:", error);
            useEmbeddings = false;
          }
        }
        if (eventEmbedding && eventEmbedding.length > 0) {
          similarity = cosineSimilarity(summaryEmbedding!, eventEmbedding);
        } else {
          useEmbeddings = false;
        }
      }

      if (!useEmbeddings) {
        similarity = calculateSimilarity(summary, eventText, idfMap);
      }

      if (similarity > bestSimilarity && similarity > (useEmbeddings ? 0.1 : 0.3)) {
        bestSimilarity = similarity;
        bestMatch = event;
      }
    }

    if (bestMatch) {
      // Rename both files with event info
      const eventDate = new Date(bestMatch.start?.dateTime || bestMatch.start?.date!);
      const newName = `${bestMatch.summary} | ${eventDate.toLocaleDateString()}`;

      const updateFile = async (fileId: string, requestBody: any, retries = 3) => {
        try {
          await drive.files.update({ fileId, requestBody });
        } catch (error) {
          console.error(`Error updating file ${fileId}, retries left: ${retries}`, error);
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
            await updateFile(fileId, requestBody, retries - 1);
          } else {
            throw error; // If retries fail, throw the error
          }
        }
      };

      try {
        await Promise.all([
          updateFile(originalFileId, { name: `${newName}.m4a` }),
          updateFile(summaryFileId, { name: `${newName}_summary.txt` }),
          updateFile(transcriptFileId, { name: `${newName}_transcript.txt` })
        ]);
      } catch (error) {
        console.error("Failed to rename files after retries:", error);
        // Handle the error, maybe use a fallback mechanism
      }
    }

    return NextResponse.json({
      success: true,
      matchedEvent: bestMatch ? {
        summary: bestMatch.summary,
        date: bestMatch.start?.dateTime || bestMatch.start?.date
      } : null,
      bestMatch: bestMatch
    });
  } catch (error) {
    console.error("Error matching event:", error);
    return NextResponse.json(
      { error: "Failed to match event" },
      { status: 500 }
    );
  }
}












//---------------------------------------------------------------------------------------


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

//     const { summary, originalFileId, summaryFileId, transcriptFileId } = await req.json();

//     const oauth2Client = new google.auth.OAuth2();
//     oauth2Client.setCredentials({ access_token: token.accessToken });
//     const calendar = google.calendar({ version: "v3", auth: oauth2Client });
//     const drive = google.drive({ version: "v3", auth: oauth2Client });

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

//     const summaryEmbedding = await getEmbeddings(summary);

//     if (!summaryEmbedding) {
//       throw new Error("Could not generate embeddings for summary");
//     }

//     for (const event of events.data.items || []) {
//       const eventText = `${event.summary || ''} ${event.description || ''}`;
//       const eventEmbedding = await getEmbeddings(eventText);

//       if (!eventEmbedding) {
//         continue;
//       }

//       const similarity = cosineSimilarity(summaryEmbedding, eventEmbedding);

//       if (similarity > bestSimilarity && similarity > 0.1) {
//         bestSimilarity = similarity;
//         bestMatch = event;
//       }
//     }

//     if (bestMatch) {
//       // Rename both files with event info
//       const eventDate = new Date(bestMatch.start?.dateTime || bestMatch.start?.date!);
//       const newName = `${bestMatch.summary} | ${eventDate.toLocaleDateString()}`;

//       await Promise.all([
//         drive.files.update({
//           fileId: originalFileId,
//           requestBody: {
//             name: `${newName}.m4a`
//           }
//         }),
//         drive.files.update({
//           fileId: summaryFileId,
//           requestBody: {
//             name: `${newName}_summary.txt`
//           }
//         }),
//         drive.files.update({
//           fileId: transcriptFileId,
//           requestBody: {
//             name: `${newName}_transcript.txt`
//           }
//         })
//       ]);
//     }

//     return NextResponse.json({
//       success: true,
//       matchedEvent: bestMatch ? {
//         summary: bestMatch.summary,
//         date: bestMatch.start?.dateTime || bestMatch.start?.date
//       } : null
//     });
//   } catch (error) {
//     console.error("Error matching event:", error);
//     return NextResponse.json(
//       { error: "Failed to match event" },
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
//   try {
//     const embeddingArray = JSON.parse(embeddingString);
//     return embeddingArray;
//   } catch (error) {
//     console.error("Error parsing embeddings:", error);
//     return []; // Return an empty array if parsing fails
//   }
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

//     const { summary, originalFileId, summaryFileId, transcriptFileId } = await req.json();

//     const oauth2Client = new google.auth.OAuth2();
//     oauth2Client.setCredentials({ access_token: token.accessToken });
//     const calendar = google.calendar({ version: "v3", auth: oauth2Client });
//     const drive = google.drive({ version: "v3", auth: oauth2Client });

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

//     const summaryEmbedding = await getEmbeddings(summary);

//     if (!summaryEmbedding) {
//       throw new Error("Could not generate embeddings for summary");
//     }

//     for (const event of events.data.items || []) {
//       const eventText = `${event.summary || ''} ${event.description || ''}`;
//       const eventEmbedding = await getEmbeddings(eventText);

//       if (!eventEmbedding) {
//         continue;
//       }

//       const similarity = cosineSimilarity(summaryEmbedding, eventEmbedding);

//       if (similarity > bestSimilarity && similarity > 0.1) {
//         bestSimilarity = similarity;
//         bestMatch = event;
//       }
//     }

//     // ... (previous code) ...

//     if (bestMatch) {
//         // Rename both files with event info
//         const eventDate = new Date(bestMatch.start?.dateTime || bestMatch.start?.date!);
//         const newName = `${bestMatch.summary} | ${eventDate.toLocaleDateString()}`;
  
//         const updateFile = async (fileId: string, requestBody: any, retries = 3) => {
//           try {
//             await drive.files.update({ fileId, requestBody });
//           } catch (error) {
//             console.error(`Error updating file ${fileId}, retries left: ${retries}`, error);
//             if (retries > 0) {
//               await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
//               await updateFile(fileId, requestBody, retries - 1);
//             } else {
//               throw error; // If retries fail, throw the error
//             }
//           }
//         };
  
//         try {
//           await Promise.all([
//             updateFile(originalFileId, { name: `${newName}.m4a` }),
//             updateFile(summaryFileId, { name: `${newName}_summary.txt` }),
//             updateFile(transcriptFileId, { name: `${newName}_transcript.txt` })
//           ]);
//         } catch (error) {
//           console.error("Failed to rename files after retries:", error);
//           // Handle the error, maybe use a fallback mechanism
//         }
//       }
  
//     return NextResponse.json({
//       success: true,
//       matchedEvent: bestMatch ? {
//         summary: bestMatch.summary,
//         date: bestMatch.start?.dateTime || bestMatch.start?.date
//       } : null
//     });
//   } catch (error) {
//     console.error("Error matching event:", error);
//     return NextResponse.json(
//       { error: "Failed to match event" },
//       { status: 500 }
//     );
//   }
// }