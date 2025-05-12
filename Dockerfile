# Use official Node.js image with specific version
FROM node:18-alpine

# Set work directory
WORKDIR /usr/src/app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --production

# Copy source code
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q -O- http://localhost:${PORT:-5000}/health || exit 1

# Expose port (use environment variable with fallback)
EXPOSE ${PORT:-5000}

# Start the server
CMD ["npm", "start"]