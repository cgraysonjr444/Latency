FROM denoland/deno:alpine-1.41.0

# Set the working directory inside the container
WORKDIR /app

# Prefer non-root user for security
USER deno

# Copy the project files into the container
COPY . .

# Cache dependencies (optional but speeds up restarts)
RUN deno cache schema/server.js

# The critical fix: Adding the unsafe certificate flag 
# and necessary permissions for Render
CMD ["run", \
     "--allow-net", \
     "--allow-env", \
     "--unsafely-ignore-certificate-errors", \
     "schema/server.js"]
