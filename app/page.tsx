
"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import GooglePicker from "./components/GooglePicker";
import { Loader2, ArrowLeft, Upload, FolderOpen } from 'lucide-react';

export default function Home() {
  const { data: session } = useSession();
  const [sourceFolder, setSourceFolder] = useState<string | null>(null);
  const [summaryFolder, setSummaryFolder] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<'select' | 'upload' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<{
    stage: 'uploading' | 'transcribing' | 'summarizing' | 'complete' | null;
    progress?: number;
  }>({ stage: null });
  const [transcriptFolder, setTranscriptFolder] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>("");

  const pollStatus = async (
    transcriptId: string,
    originalFileId: string,
    summaryFolderId: string,
    transcriptFolderId: string,
    originalFileName: string
  ) => {
    while (true) {
      const statusResponse = await fetch(`/api/assembly-status?id=${transcriptId}`);
      const status = await statusResponse.json();
      
      if (status.status === 'completed') {
        setProcessingStatus({ stage: 'summarizing', progress: 70 });
        
        const summaryResponse = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcript: status.text,
            summaryFolderId,
            transcriptFolderId,
            originalFileName
          })
        });
        
        const summaryData = await summaryResponse.json();
        if (!summaryResponse.ok) {
          throw new Error(summaryData.error || 'Failed to generate summary');
        }

        const matchResponse = await fetch('/api/match-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: summaryData.summary,
            originalFileId,
            summaryFileId: summaryData.summaryFileId,
            transcriptFileId: summaryData.transcriptFileId
          })
        });

        const matchData = await matchResponse.json();
        if (!matchResponse.ok) {
          throw new Error(matchData.error || 'Failed to match event');
        }
        
        setProcessingStatus({ stage: 'complete', progress: 100 });
        break;
      } else if (status.status === 'error') {
        throw new Error('Transcription failed');
      }
      
      setProcessingStatus({ 
        stage: 'transcribing', 
        progress: status.progress || 30 
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!session) {
      setError("Please sign in first");
      return;
    }

    if (!sourceFolder) {
      setError("Please select a destination folder first");
      return;
    }

    setProcessing(true);
    setError(null);
    setProcessingStatus({ stage: 'uploading', progress: 0 });

    try {
      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceFolderId", sourceFolder);
      formData.append("summaryFolderId", summaryFolder);
      formData.append("transcriptFolderId", transcriptFolder);

      setProcessingStatus({ stage: 'uploading', progress: 20 });
      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      if (data.transcriptId) {
        await pollStatus(
          data.transcriptId,
          data.originalFileId,
          data.summaryFolderId,
          data.transcriptFolderId,
          data.originalFileName
        );
      }

      setProcessingStatus({ stage: 'complete', progress: 100 });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while processing the file");
    } finally {
      setProcessing(false);
      setProcessingStatus({ stage: null });
    }
  }, [session, sourceFolder, summaryFolder, transcriptFolder]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a"],
    },
    multiple: false,
  });

  const processFiles = async () => {
    try {
      setProcessing(true);
      setError(null);

      if (!sourceFolder || !summaryFolder || !transcriptFolder) {
        setError("Please select all folders first");
        return;
      }

      const filesResponse = await fetch(`/api/drive/files?folderId=${sourceFolder}`);
      const filesData = await filesResponse.json();

      if (!filesResponse.ok) {
        throw new Error(filesData.error || "Failed to fetch files");
      }

      if (!filesData.files || filesData.files.length === 0) {
        setError("No audio files found in the selected folder");
        return;
      }

      for (const file of filesData.files) {
        const formData = new FormData();
        formData.append("fileId", file.id);
        formData.append("sourceFolderId", sourceFolder);
        formData.append("summaryFolderId", summaryFolder);
        formData.append("transcriptFolderId", transcriptFolder);

        const response = await fetch("/api/process", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Something went wrong");
        }

        if (data.transcriptId) {
          await pollStatus(
            data.transcriptId,
            data.originalFileId,
            data.summaryFolderId,
            data.transcriptFolderId,
            data.originalFileName
          );
        }
      }

      setProcessingStatus({ stage: 'complete', progress: 100 });
    } catch (err: any) {
      setError(err.message || "An error occurred while processing the files");
    } finally {
      setProcessing(false);
      setProcessingStatus({ stage: null });
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl md:text-3xl font-bold">Audio Processing App</CardTitle>
            {session ? (
              <Button variant="destructive" onClick={() => signOut()}>
                Sign Out
              </Button>
            ) : (
              <Button onClick={() => signIn("google")}>
                Sign in with Google
              </Button>
            )}
          </CardHeader>
        </Card>

        {session && !workflow && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center mb-8">Choose Your Workflow</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setWorkflow('select')}>
                <CardContent className="p-6">
                  <FolderOpen className="w-12 h-12 mb-4 text-blue-500" />
                  <h3 className="text-lg font-semibold mb-4">Process Existing Files</h3>
                  <p className="text-gray-600">
                    Select a Google Drive folder containing your audio files to process them
                  </p>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setWorkflow('upload')}>
                <CardContent className="p-6">
                  <Upload className="w-12 h-12 mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold mb-4">Upload New Files</h3>
                  <p className="text-gray-600">
                    Upload new audio files and organize them in Google Drive
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {session && workflow && (
          <div className="space-y-6">
            <Button variant="ghost" onClick={() => setWorkflow(null)} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to workflow selection
            </Button>

            <Card>
              <CardHeader>
                <CardTitle>
                  {workflow === 'select' ? 'Select Folders to Process' : 'Upload New Audio Files'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <GooglePicker
                  label="Select Source Folder"
                  onSelect={setSourceFolder}
                  selectedFolder={sourceFolder}
                  setFolderName={setFolderName}
                />

                <GooglePicker
                  label="Select Summary Destination Folder"
                  onSelect={setSummaryFolder}
                  selectedFolder={summaryFolder}
                  setFolderName={setFolderName}
                />

                <GooglePicker
                  label="Select Transcript Destination Folder"
                  onSelect={setTranscriptFolder}
                  selectedFolder={transcriptFolder}
                  setFolderName={setFolderName}
                />

                {workflow === 'upload' && (
                  <div
                    {...getRootProps()}
                    className={`p-12 rounded-lg border-2 border-dashed transition-colors ${
                      isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">
                        {isDragActive
                          ? `Drop the audio file here to upload to "${folderName || 'selected folder'}"`
                          : `Drag and drop an audio file here, or click to select and upload to "${folderName || 'selected folder'}"`}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Supported formats: MP3, WAV, M4A
                      </p>
                    </div>
                  </div>
                )}

                {workflow === 'select' && sourceFolder && summaryFolder && (
                  <Button
                    onClick={processFiles}
                    className="w-full"
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Process Files in Selected Folder"
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {processing && (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="text-center font-semibold">
                      {processingStatus.stage === 'uploading' && 'Uploading to Google Drive'}
                      {processingStatus.stage === 'transcribing' && 'Transcribing Audio'}
                      {processingStatus.stage === 'summarizing' && 'Generating Summary'}
                    </div>
                    <Progress value={processingStatus.progress} className="w-full" />
                    <p className="text-center text-sm text-gray-600">
                      {processingStatus.stage === 'uploading' && 'Uploading your audio file...'}
                      {processingStatus.stage === 'transcribing' && 'Converting speech to text...'}
                      {processingStatus.stage === 'summarizing' && 'Analyzing and summarizing content...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4 text-red-700">
                  {error}
                </CardContent>
              </Card>
            )}

            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.matchedEvent && (
                    <div>
                      <h3 className="font-medium">Matched Calendar Event:</h3>
                      <p>{result.matchedEvent}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium">Summary:</h3>
                    <p className="whitespace-pre-wrap">{result.summary}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

