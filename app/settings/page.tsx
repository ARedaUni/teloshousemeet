'use client'

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckIcon, XIcon } from 'lucide-react'
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import GooglePicker from '../components/GooglePicker';

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
    <main className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        {alertInfo && (
          <Alert variant={alertInfo.type === 'success' ? 'default' : 'destructive'}>
            {alertInfo.type === 'success' ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
            <AlertTitle>{alertInfo.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
            <AlertDescription>{alertInfo.message}</AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <GooglePicker
              label="Default Source Folder"
              onSelect={(id) => setSourceFolder(id)}
              selectedFolder={sourceFolder}
            />
            <GooglePicker
              label="Default Summary Folder"
              onSelect={(id) => setSummaryFolder(id)}
              selectedFolder={summaryFolder}
            />
            <GooglePicker
              label="Default Transcript Folder"
              onSelect={(id) => setTranscriptFolder(id)}
              selectedFolder={transcriptFolder}
            />
            <Button 
              onClick={saveSettings}
              className="w-full"
            >
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

