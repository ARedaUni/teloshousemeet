import { google } from "googleapis";

export const initializeDrive = (accessToken: string) => {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: oauth2Client });
};

export const getFileContent = async (drive: any, fileId: string) => {
  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      { responseType: "text" }
    );
    return response.data;
  } catch (error) {
    console.error("Error getting file content:", error);
    throw error;
  }
};

export const getFileMetadata = async (drive: any, fileId: string, fields = "name") => {
  try {
    const response = await drive.files.get({
      fileId,
      fields,
      supportsAllDrives: true,
    });
    return response.data;
  } catch (error) {
    console.error("Error getting file metadata:", error);
    throw error;
  }
}; 