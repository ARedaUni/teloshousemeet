'use client'

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { CheckIcon, XIcon, Loader2, SettingsIcon } from 'lucide-react'
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { GooglePicker } from '../components/GooglePicker';
import { FolderDisplay } from '../components/FolderDisplay';
import { Skeleton } from '@/components/ui/skeleton';

export default function Settings() {
  const { data: session } = useSession();
  const [sourceFolder, setSourceFolder] = useState<string | null>(null);
  const [summaryFolder, setSummaryFolder] = useState<string | null>(null);
  const [transcriptFolder, setTranscriptFolder] = useState<string | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/settings');
        const data = await response.json();

        if (data.settings) {
          setSourceFolder(data.settings.sourceFolder);
          setSummaryFolder(data.settings.summaryFolder);
          setTranscriptFolder(data.settings.transcriptFolder);
        }
      } catch (error) {
        setAlertInfo({
          type: 'error',
          message: 'Failed to load settings',
        });
      } finally {
        setLoading(false);
      }
    };

    if (session) fetchSettings();
  }, [session]);

  const saveSettings = async () => {
    if (!sourceFolder || !summaryFolder || !transcriptFolder) {
      setAlertInfo({
        type: 'error',
        message: 'Please select all folders',
      });
      return;
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceFolder,
          summaryFolder,
          transcriptFolder,
        }),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      setAlertInfo({
        type: 'success',
        message: 'Settings saved successfully',
      });
    } catch (error) {
      setAlertInfo({
        type: 'error',
        message: 'Failed to save settings',
      });
    }
  };

  if (!session) return null;

  return (
    <main className="min-h-screen p-4 md:p-8 lg:p-12 bg-gradient-to-b from-background to-secondary/10">
      <div className="max-w-4xl mx-auto space-y-8">
        

        {alertInfo && (
          <Alert 
            variant={alertInfo.type === 'success' ? 'default' : 'destructive'}
            className="animate-in slide-in-from-top-5 duration-300"
          >
            {alertInfo.type === 'success' ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
            <AlertTitle className="font-semibold">{alertInfo.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
            <AlertDescription>{alertInfo.message}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Folder Configuration</CardTitle>
            <CardDescription>Set up your default folders for various operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {loading ? (
              <>
                <Skeleton className="w-full h-12 rounded-md" />
                <Skeleton className="w-full h-12 rounded-md" />
                <Skeleton className="w-full h-12 rounded-md" />
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <GooglePicker
                    label="Default Source Folder"
                    onSelect={(id) => setSourceFolder(id)}
                    selectedFolder={sourceFolder || ''}
                  />
                  <FolderDisplay folderId={sourceFolder} />
                </div>
                <div className="space-y-4">
                  <GooglePicker
                    label="Default Summary Folder"
                    onSelect={(id) => setSummaryFolder(id)}
                    selectedFolder={summaryFolder}
                  />
                  <FolderDisplay folderId={summaryFolder} />
                </div>
                <div className="space-y-4">
                  <GooglePicker
                    label="Default Transcript Folder"
                    onSelect={(id) => setTranscriptFolder(id)}
                    selectedFolder={transcriptFolder}
                  />
                  <FolderDisplay folderId={transcriptFolder} />
                </div>
              </>
            )}
            <Button 
              onClick={saveSettings}
              className="w-full transition-all duration-300 hover:scale-105"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

