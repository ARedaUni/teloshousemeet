"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useSession } from 'next-auth/react';

interface GooglePickerProps {
  onSelect: (folderId: string) => void;
  label: string;
  selectedFolder: string | null;
}

export default function GooglePicker({ onSelect, label, selectedFolder }: GooglePickerProps) {
  const { data: session } = useSession();
  const [pickerInited, setPickerInited] = useState(false);
  const [folderName, setFolderName] = useState<string>("");

  useEffect(() => {
    const loadGoogleApi = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        // @ts-ignore
        window.gapi.load('picker', () => {
          setPickerInited(true);
        });
      };
      document.body.appendChild(script);
    };

    loadGoogleApi();
  }, []);

  const showPicker = () => {
    if (!session?.accessToken) {
      console.error('No access token available');
      return;
    }

    // @ts-ignore
    const view = new google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

    // If this is source folder picker, also show audio files
    if (label.toLowerCase().includes('source')) {
      view.setMimeTypes('audio/mp3,audio/wav,audio/x-m4a,application/vnd.google-apps.folder');
    } else {
      view.setMimeTypes('application/vnd.google-apps.folder');
    }

    // @ts-ignore
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(session.accessToken as string)
      .setDeveloperKey(process.env.GOOGLE_API_KEY)
      .setTitle(`Select ${label}`)
      .setCallback(async (data: any) => {
        if (data.action === 'picked') {
          const folder = data.docs[0];
          setFolderName(folder.name);
          onSelect(folder.id);
        }
      })
      .build();
    picker.setVisible(true);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">{label}</h2>
      <div className="flex items-center gap-4">
        <button
          onClick={showPicker}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          disabled={!pickerInited || !session?.accessToken}
        >
          Choose Folder
        </button>
        {folderName && (
          <span className="text-gray-700">Selected: {folderName}</span>
        )}
      </div>
    </div>
  );
} 