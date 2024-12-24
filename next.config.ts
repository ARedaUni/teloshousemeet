/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    ASSEMBLY_AI_API_KEY: process.env.ASSEMBLY_AI_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    PROJECT_ID: process.env.PROJECT_ID,
    LOCATION: process.env.LOCATION,
  },
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
};

export default nextConfig;
