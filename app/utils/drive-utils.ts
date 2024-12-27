import { backOff } from "exponential-backoff";

export const createDriveFileWithRetry = async (drive: any, requestBody: any, media: any) => {
  return backOff(
    async () => {
      try {
        return await drive.files.create({
          requestBody,
          media,
          fields: 'id',
          supportsAllDrives: true,
          timeout: 60000,
          retry: true,
          retryConfig: {
            retry: 5,
            retryDelay: 1000,
            statusCodesToRetry: [
              [100, 199],
              [429, 429],
              [500, 599]
            ]
          }
        });
      } catch (error: any) {
        if (error.code === 'ECONNRESET') {
          throw error; // This will trigger the backoff retry
        }
        throw new Error('Drive file creation failed: ' + error.message);
      }
    },
    {
      numOfAttempts: 3,
      startingDelay: 2000,
      timeMultiple: 2,
      maxDelay: 10000,
    }
  );
}; 