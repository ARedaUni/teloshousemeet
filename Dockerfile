# Use Node.js LTS (Latest Stable)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Copy service account file
COPY service-account.json /app/service-account.json

# Set environment variables
ENV NODE_ENV=production
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Create a .env.local file from environment variables
RUN echo "ASSEMBLY_AI_API_KEY=$ASSEMBLY_AI_API_KEY\n\
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID\n\
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET\n\
NEXTAUTH_URL=$NEXTAUTH_URL\n\
NEXTAUTH_SECRET=$NEXTAUTH_SECRET\n\
GOOGLE_API_KEY=$GOOGLE_API_KEY\n\
PROJECT_ID=$PROJECT_ID\n\
LOCATION=$LOCATION\n\
JINA_API_KEY=$JINA_API_KEY" > .env.local

# Start the application
CMD ["npm", "start"]
