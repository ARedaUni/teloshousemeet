"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function Content() {
  const { data: session } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");

  const fileId = params.id as string;
  const type = searchParams.get('type');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(`/api/drive/content/${fileId}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Failed to fetch content");

        setContent(data.content);
        setTitle(data.name || "Content");
      } catch (err: any) {
        setError(err.message || "Failed to load content");
      } finally {
        setLoading(false);
      }
    };

    if (session && fileId) fetchContent();
  }, [session, fileId]);

  if (!session) return null;

  return (
    <main className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-destructive p-4">{error}</div>
            ) : (
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}