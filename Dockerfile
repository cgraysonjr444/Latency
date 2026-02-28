FROM denoland/deno:alpine-1.41.0

# Set the working directory
WORKDIR /app

# Copy all files to the container
COPY . .

# Grant permissions and run the server
# Note: Render provides the PORT env variable automatically
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "server.js"]
