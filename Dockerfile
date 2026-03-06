FROM denoland/deno:alpine-1.41.0

# The port Render expects
EXPOSE 10000

WORKDIR /app

# Copy everything from your repo into the container
COPY . .

# Grant permissions and run the server
# Make sure "server.js" is the actual name of your file in the root
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "server.js"]
