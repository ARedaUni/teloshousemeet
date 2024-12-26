import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLY_AI_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "No transcript ID provided" }, { status: 400 });
    }

    const response = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${id}`,
      {
        headers: {
          authorization: ASSEMBLY_AI_API_KEY,
        },
      }
    );

    const { status, text, words, chapters, speaker_labels } = response.data;

    if (status === 'completed') {
      // Format transcript with speakers
      let formattedTranscript = '';
      let currentSpeaker = '';
      
      if (words && speaker_labels) {
        words.forEach((word: any) => {
          if (word.speaker !== currentSpeaker) {
            currentSpeaker = word.speaker;
            formattedTranscript += `\n\nSpeaker ${currentSpeaker}: `;
          }
          formattedTranscript += word.text + ' ';
        });
      }

      // Add chapter/topic information
      let topicSummary = '\n\n## Topics Discussed:\n';
      if (chapters) {
        chapters.forEach((chapter: any) => {
          topicSummary += `\n${chapter.start_str} - ${chapter.end_str}: ${chapter.headline}\n`;
          topicSummary += `Summary: ${chapter.summary}\n`;
        });
      }

      return NextResponse.json({
        status,
        text: formattedTranscript.trim() + topicSummary,
        topics: chapters
      });
    }

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error checking status:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
} 