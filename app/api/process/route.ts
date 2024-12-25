import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import axios from "axios";
import { getToken } from "next-auth/jwt";
import { Readable } from "stream";

const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLY_AI_API_KEY;

export async function POST(req: NextRequest) {
    try {
        const token = await getToken({ req });
        if (!token?.accessToken) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const contentType = req.headers.get('content-type');
        let fileId, sourceFolderId, summaryFolderId, transcriptFolderId, originalFileName, file;

        if (contentType?.startsWith('multipart/form-data')) {
            const formData = await req.formData();
            fileId = formData.get("fileId") as string;
            sourceFolderId = formData.get("sourceFolderId") as string;
            summaryFolderId = formData.get("summaryFolderId") as string;
            transcriptFolderId = formData.get("transcriptFolderId") as string;
            file = formData.get("file") as File;
            originalFileName = file?.name;

            if (!fileId && !file) {
                return NextResponse.json({ error: "No valid file provided" }, { status: 400 });
            }
        } else if (contentType?.startsWith('application/json')) {
            const data = await req.json();
            fileId = data.fileId;
            sourceFolderId = data.sourceFolderId;
            summaryFolderId = data.summaryFolderId;
            transcriptFolderId = data.transcriptFolderId;
            originalFileName = data.originalFileName;

            if (!fileId) {
                return NextResponse.json({ error: "No valid file ID provided" }, { status: 400 });
            }
        } else {
            return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
        }

        // Initialize Google Drive API
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: token.accessToken });
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        // If a local file was uploaded, upload it to Google Drive first
        if (file) {
            const fileMetadata = {
                name: file.name,
                parents: [sourceFolderId],
            };
            
            const buffer = await file.arrayBuffer();
            const media = {
                mimeType: file.type,
                body: Readable.from(Buffer.from(buffer)),
            };

            const uploadedFile = await drive.files.create({
                // @ts-ignore
                requestBody: fileMetadata,
                media: media,
                fields: 'id'
            });

            if (!uploadedFile.data.id) {
                throw new Error("Failed to upload file to Google Drive");
            }
            fileId = uploadedFile.data.id;
        }

        // Get file details if fileId is available
        let fileResponse;
        if (fileId && !originalFileName) {
            fileResponse = await drive.files.get({
                fileId: fileId,
                fields: 'name,mimeType',
                supportsAllDrives: true
            });
            originalFileName = fileResponse.data.name;
        }

        if (!fileId) {
            return NextResponse.json({ error: "Could not determine the file ID" }, { status: 400 });
        }

        // Make the file publicly accessible for AssemblyAI
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            },
            fields: 'id'
        });

        // Get the public link
        const publicFile = await drive.files.get({
            fileId: fileId,
            fields: 'webContentLink',
            supportsAllDrives: true
        });
        if (!publicFile.data.webContentLink) {
            throw new Error("Could not generate public link for file");
        }

        // Start transcription with AssemblyAI
        const assemblyResponse = await axios.post(
            "https://api.assemblyai.com/v2/transcript",
            {
                audio_url: publicFile.data.webContentLink,
                speaker_labels: true,
            },
            {
                headers: {
                    authorization: ASSEMBLY_AI_API_KEY,
                },
                timeout: 60000
            }
        );

        if (!assemblyResponse.data.id) {
            throw new Error("Failed to start transcription");
        }

        return NextResponse.json({
            success: true,
            transcriptId: assemblyResponse.data.id,
            originalFileId: fileId,
            summaryFolderId: summaryFolderId,
            transcriptFolderId: transcriptFolderId,
            originalFileName: originalFileName,
            message: "Processing started"
        });
    } catch (error: any) {
        console.error("Error processing file:", error.response?.data || error);
        const errorMessage = error.response?.data?.error || error.message || "Error processing file";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
} 