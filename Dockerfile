FROM denoland/deno:alpine-1.41.0

WORKDIR /app

# Copy everything (including the schema folder and index.html)
COPY . .

# Run the server from the schema folder
# We use 'schema/server.js' because that is where it lives in your repo
CMD ["run", "--allow-net", "--allow-read", "--allow-env", "schema/server.js"]
