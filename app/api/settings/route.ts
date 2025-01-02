import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getToken } from "next-auth/jwt";

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  global.prisma = global.prisma || new PrismaClient();
  prisma = global.prisma;
}

prisma = global.prisma;


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

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}