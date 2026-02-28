FROM denoland/deno:alpine-1.41.0

# Set the working directory inside the container
WORKDIR /app

# Copy everything from your GitHub (including the schema folder)
COPY . .

# Grant permissions and point Deno to the file inside the schema folder
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "schema/server.js"]
