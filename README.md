# Audio Processing App

This application allows users to upload audio files to Google Drive, automatically rename them based on matching calendar events, and generate transcripts and summaries using AssemblyAI's API.

## Features

- Google Drive integration for file storage
- Google Calendar integration for event matching
- Audio transcription using AssemblyAI
- Intelligent summarization using AssemblyAI's LeMur
- Drag-and-drop file upload interface
- Real-time processing status updates

## Prerequisites

- Node.js 18+ installed
- Google Cloud Platform account with Drive and Calendar APIs enabled
- AssemblyAI API key
- Google OAuth 2.0 credentials

## Setup

1. Clone the repository:
\`\`\`bash
git clone [repository-url]
cd [repository-name]
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Create a \`.env.local\` file in the root directory with the following variables:
\`\`\`
ASSEMBLY_AI_API_KEY=your-assemblyai-api-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key
\`\`\`

4. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

## Usage

1. Sign in with your Google account
2. Enter the Google Drive folder ID where you want to store the files
3. Drag and drop an audio file or click to select one
4. Wait for the processing to complete
5. View the results, including:
   - Matched calendar event (if found)
   - Audio transcript
   - Summary of the discussion

## Environment Variables

- \`ASSEMBLY_AI_API_KEY\`: Your AssemblyAI API key
- \`GOOGLE_CLIENT_ID\`: Google OAuth 2.0 client ID
- \`GOOGLE_CLIENT_SECRET\`: Google OAuth 2.0 client secret
- \`NEXTAUTH_URL\`: Your application's URL (http://localhost:3000 for development)
- \`NEXTAUTH_SECRET\`: A random string used to encrypt session data

## Google Drive Setup

1. Go to the Google Cloud Console
2. Create a new project or select an existing one
3. Enable the Google Drive and Google Calendar APIs
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - http://localhost:3000/api/auth/callback/google (for development)
   - Your production URL/api/auth/callback/google (for production)

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add some amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
# teloshousemeet
