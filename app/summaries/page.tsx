"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import Link from "next/link";

interface FileItem {
  id: string;
  name: string;
}

export default function Summaries() {
  const { data: session } = useSession();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const settingsResponse = await fetch('/api/settings');
        const settingsData = await settingsResponse.json();

        if (!settingsData.settings?.summaryFolder) {
          setError("Summary folder not configured. Please visit settings.");
          setLoading(false);
          return;
        }

        const filesResponse = await fetch(`/api/drive/files?folderId=${settingsData.settings.summaryFolder}`);
        const filesData = await filesResponse.json();

        if (!filesResponse.ok) throw new Error(filesData.error || "Failed to fetch files");

        setFiles(filesData.files || []);
      } catch (err: any) {
        setError(err.message || "Failed to load summaries");
      } finally {
        setLoading(false);
      }
    };

    if (session) fetchSummaries();
  }, [session]);

  if (!session) return null;

  return (
    <main className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Summaries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-destructive p-4">{error}</div>
            ) : (
              <div className="grid gap-4">
                {files.map((file) => (
                  <Link 
                    key={file.id} 
                    href={`/content/${file.id}?type=summary`}
                    className="block"
                  >
                    <Card className="hover:bg-accent transition-colors">
                      <CardContent className="flex items-center gap-4 p-4">
                        <FileText className="h-5 w-5 text-primary" />
                        <span>{file.name}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}