FROM node:20-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Build the frontend and compile the server.ts backend
RUN npm run build

# Expose port 3000 (which is the required port)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the unified server which hosts both frontend and backend
CMD ["npm", "run", "start"]
