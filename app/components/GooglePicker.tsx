"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from "@/components/ui/button";
import { FolderIcon, Loader2 } from 'lucide-react';

interface GooglePickerProps {
  onSelect: (folderId: string) => void;
  label: string;
  selectedFolder: string | null;
}

export function GooglePicker({ onSelect, label, selectedFolder }: GooglePickerProps) {
  const { data: session } = useSession();
  const [pickerInited, setPickerInited] = useState(false);
  const [currentFolderName, setCurrentFolderName] = useState<string>("");
  const [loadingFolderName, setLoadingFolderName] = useState(false);

  useEffect(() => {
    const loadGoogleApi = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        // @ts-expect-error not necessary to type
        window.gapi.load('picker', () => {
          setPickerInited(true);
        });
      };
      document.body.appendChild(script);
    };

    loadGoogleApi();
  }, []);

  useEffect(() => {
    const fetchFolderName = async () => {
      if (!selectedFolder) {
        setCurrentFolderName("");
        return;
      }

      try {
        setLoadingFolderName(true);
        const response = await fetch(`/api/drive/folder-name?folderId=${selectedFolder}`);
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error);
        
        setCurrentFolderName(data.name);
      } catch (err) {
        console.error("Error fetching folder name:", err);
      } finally {
        setLoadingFolderName(false);
      }
    };

    fetchFolderName();
  }, [selectedFolder]);

  const showPicker = () => {
    if (!session?.accessToken) {
      console.error('No access token available');
      return;
    }

    // @ts-expect-error not necessary to type
    const view = new google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

    if (label.toLowerCase().includes('source')) {
      view.setMimeTypes('audio/mp3,audio/wav,audio/x-m4a,application/vnd.google-apps.folder');
    } else {
      view.setMimeTypes('application/vnd.google-apps.folder');
    }

    // @ts-expect-error not necessary to type
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(session.accessToken as string)
      .setDeveloperKey(process.env.GOOGLE_API_KEY)
      .setTitle(`Select ${label}`)
      .setCallback((data: any) => {
        if (data.action === 'picked') {
          const folder = data.docs[0];
          onSelect(folder.id);
        }
      })
      .build();
    picker.setVisible(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        </div>
        <div className="flex items-center gap-4">
          {/* {loadingFolderName ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : currentFolderName && (
            <div className="flex items-center gap-2 text-sm">
              <FolderIcon className="h-4 w-4 text-primary" />
              <span>{currentFolderName}</span>
            </div>
          )} */}
          <Button 
            onClick={showPicker}
            disabled={!pickerInited || !session?.accessToken}
            variant="outline"
          >
            Choose Folder
          </Button>
        </div>
      </div>
    </div>
  );
}

