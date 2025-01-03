import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getToken } from "next-auth/jwt";

// Create a single PrismaClient instance
const prisma = new PrismaClient();

export const maxDuration = 60; 

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { sourceFolder, summaryFolder, transcriptFolder } = await req.json();

    const settings = await prisma.settings.upsert({
      where: {
        userId: token.email,
      },
      update: {
        sourceFolder,
        summaryFolder,
        transcriptFolder,
      },
      create: {
        userId: token.email,
        sourceFolder,
        summaryFolder,
        transcriptFolder,
      },
    });

    if (!settings) {
      throw new Error("Failed to save settings");
    }

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const settings = await prisma.settings.findUnique({
      where: {
        userId: token.email,
      },
    });

    // Always return an object with a settings property, even if null
    return NextResponse.json({ settings: settings || null });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}