# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy the built frontend from the build stage
COPY --from=build /app/dist ./dist

# Copy the backend server
COPY server.js ./

# Set environment variables (GEMINI_API_KEY should be provided at runtime)
ENV PORT=80
ENV NODE_ENV=production

EXPOSE 80

CMD ["node", "server.js"]
