"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FolderIcon } from "lucide-react";

interface FolderDisplayProps {
  folderId: string;
  label: string;
}

export function FolderDisplay({ folderId, label }: FolderDisplayProps) {
  const [folderName, setFolderName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFolderName = async () => {
      try {
        const response = await fetch(`/api/drive/folder-name?folderId=${folderId}`);
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error);
        
        setFolderName(data.name);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (folderId) {
      fetchFolderName();
    }
  }, [folderId]);

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <FolderIcon className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading folder name...</span>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="font-medium">{folderName}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 