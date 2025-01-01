"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';


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

  // if not session then push to home

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

  if (!session) return ;

  return (
    <main className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8">
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
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto mb-6">
                        <table className="border-collapse table-auto w-full" {...props} />
                      </div>
                    ),
                    th: ({ node, ...props }) => (
                      <th className="border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2 text-left" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="border border-slate-300 dark:border-slate-700 px-4 py-2" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong className="font-bold" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-2xl font-bold mt-8 mb-4" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-xl font-bold mt-6 mb-2" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="list-disc pl-6 mb-4" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="mb-2" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="mb-4" {...props} />
                    )
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

