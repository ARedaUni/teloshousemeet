
// "use client";

// import { useEffect, useState } from 'react';
// import Script from 'next/script';
// import { useSession } from 'next-auth/react';
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { FolderOpen } from 'lucide-react';

// interface GooglePickerProps {
//   onSelect: (folderId: string) => void;
//   label: string;
//   selectedFolder: string | null;
//   setFolderName?: (name: string) => void;
// }

// export default function GooglePicker({ onSelect, label, selectedFolder, setFolderName }: GooglePickerProps) {
//   const { data: session } = useSession();
//   const [pickerInited, setPickerInited] = useState(false);

//   useEffect(() => {
//     const loadGoogleApi = () => {
//       const script = document.createElement('script');
//       script.src = 'https://apis.google.com/js/api.js';
//       script.onload = () => {
//         // @ts-ignore
//         window.gapi.load('picker', () => {
//           setPickerInited(true);
//         });
//       };
//       document.body.appendChild(script);
//     };

//     loadGoogleApi();
//   }, []);

//   const showPicker = () => {
//     if (!session?.accessToken) {
//       console.error('No access token available');
//       return;
//     }

//     // @ts-ignore
//     const view = new google.picker.DocsView()
//       .setIncludeFolders(true)
//       .setSelectFolderEnabled(true);

//     // If this is source folder picker, also show audio files
//     if (label.toLowerCase().includes('source')) {
//       view.setMimeTypes('audio/mp3,audio/wav,audio/x-m4a,application/vnd.google-apps.folder');
//     } else {
//       view.setMimeTypes('application/vnd.google-apps.folder');
//     }

//     // @ts-ignore
//     const picker = new google.picker.PickerBuilder()
//       .addView(view)
//       .setOAuthToken(session.accessToken as string)
//       .setDeveloperKey(process.env.GOOGLE_API_KEY)
//       .setTitle(`Select ${label}`)
//       .setCallback(async (data: any) => {
//         if (data.action === 'picked') {
//           const folder = data.docs[0];
//           setFolderName?.(folder.name);
//           onSelect(folder.id);
//         }
//       })
//       .build();
//     picker.setVisible(true);
//   };

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle className="text-lg">{label}</CardTitle>
//       </CardHeader>
//       <CardContent className="flex items-center justify-between">
//         <Button
//           onClick={showPicker}
//           disabled={!pickerInited || !session?.accessToken}
//         >
//           <FolderOpen className="mr-2 h-4 w-4" />
//           Choose Folder
//         </Button>
//         {selectedFolder && (
//           <span className="text-sm text-gray-600">Selected: {selectedFolder}</span>
//         )}
//       </CardContent>
//     </Card>
//   );
// }


"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useSession } from 'next-auth/react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen } from 'lucide-react';

interface GooglePickerProps {
  onSelect: (folderId: string, folderName: string) => void;
  label: string;
  selectedFolder: string | null;
}

export default function GooglePicker({ onSelect, label, selectedFolder }: GooglePickerProps) {
  const { data: session } = useSession();
  const [pickerInited, setPickerInited] = useState(false);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);

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
          setSelectedFolderName(folder.name);
          onSelect(folder.id, folder.name);
        }
      })
      .build();
    picker.setVisible(true);
  };

  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-lg">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <Button
          onClick={showPicker}
          disabled={!pickerInited || !session?.accessToken}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          Choose Folder
        </Button>
        {selectedFolderName && (
          <span className="text-sm text-muted-foreground">Selected: {selectedFolderName}</span>
        )}
      </CardContent>
    </Card>
  );
}

