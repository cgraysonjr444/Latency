FROM denoland/deno:alpine-1.41.0

WORKDIR /app

# Copy everything from your repo into the container
COPY . .

# Grant permissions and run the server
# Adjust the path below if your server.js is in a folder (e.g., ./schema/server.js)
CMD ["run", "--allow-net", "--allow-read", "--allow-env", "server.js"]
