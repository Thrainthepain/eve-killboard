# Build stage
FROM node:18-alpine AS build
WORKDIR /usr/src/app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /usr/src/app/build /usr/share/nginx/html
# Copy custom Nginx config if needed
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]