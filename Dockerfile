FROM denoland/deno:alpine-1.41.0

WORKDIR /app

# Copy everything
COPY . .

# Run from the root
CMD ["run", "--allow-net", "--allow-read", "--allow-env", "server.js"]
