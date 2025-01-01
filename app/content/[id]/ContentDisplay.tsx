'use client';

import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import { formatFileName, formatTranscriptText } from "@/app/utils/text-formatting";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface ContentData {
  content: string;
  name: string;
  contentType?: 'markdown' | 'transcript';
}

export function ContentDisplay({ id }: { id: string }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");

  const type = searchParams.get('type');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(`/api/cached-drive-content/${id}?type=${type || 'markdown'}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch content");
        }
        
        const data: ContentData = await response.json();
        const formattedContent = type === 'transcript' 
          ? formatTranscriptText(data.content)
          : data.content;

        setContent(formattedContent);
        setTitle(data.name || "Content");
      } catch (err: any) {
        setError(err.message || "Failed to load content");
      } finally {
        setLoading(false);
      }
    };

    if (session) fetchContent();
  }, [session, id, type]);

  if (!session) return null;

  const renderContent = () => {
    if (type === 'transcript') {
      return (
        <div 
          className="space-y-6"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }
    
    return (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({node, ...props}) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-2xl font-bold mt-6 mb-3" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
          p: ({node, ...props}) => <p className="mb-4" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4" {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4" {...props} />,
          table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-gray-200" {...props} /></div>,
          thead: ({node, ...props}) => <thead className="bg-gray-50 dark:bg-gray-800" {...props} />,
          tbody: ({node, ...props}) => <tbody className="divide-y divide-gray-200" {...props} />,
          tr: ({node, ...props}) => <tr className="hover:bg-gray-50 dark:hover:bg-gray-700" {...props} />,
          th: ({node, ...props}) => <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props} />,
          td: ({node, ...props}) => <td className="px-6 py-4 whitespace-nowrap text-sm" {...props} />,
          code: ({node, inline, ...props}) => 
            inline 
              ? <code className="bg-gray-100 dark:bg-gray-800 rounded px-1" {...props} />
              : <code className="block bg-gray-100 dark:bg-gray-800 rounded p-4 my-4 overflow-x-auto" {...props} />
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-xl">{formatFileName(title)}</CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-destructive p-4">{error}</div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {renderContent()}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 