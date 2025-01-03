import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getEmbeddings } from "@/lib/embeddings";
import { backOff } from "exponential-backoff";

export const maxDuration = 300; // Set maximum duration to 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const embeddings = await backOff(
      async () => {
        try {
          return await getEmbeddings(text);
        } catch (error: any) {
          console.error("Embedding error:", error);
          throw error;
        }
      },
      {
        numOfAttempts: 5,
        startingDelay: 1000,
        timeMultiple: 2,
        maxDelay: 10000,
        jitter: 'full'
      }
    );

    return NextResponse.json({ embeddings });
  } catch (error) {
    console.error("Error generating embeddings:", error);
    return NextResponse.json({ error: "Failed to generate embeddings" }, { status: 500 });
  }
} 