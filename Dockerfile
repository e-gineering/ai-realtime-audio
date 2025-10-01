# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose port
EXPOSE 5050

# Set environment variables
ENV NODE_ENV=production
ENV DB_PATH=/app/data/inspections.db

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5050', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["node", "index.js"]
