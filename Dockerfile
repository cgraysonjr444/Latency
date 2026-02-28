FROM denoland/deno:alpine-1.41.0

# Set the working directory
WORKDIR /app

# Copy files and set ownership to the deno user immediately
COPY --chown=deno:deno . .

# Switch to the non-root user
USER deno

# Cache dependencies to speed up startup
RUN deno cache schema/server.js

# Run the app with necessary flags
# Added --no-lock to prevent any remaining lockfile permission issues
CMD ["run", \
     "--allow-net", \
     "--allow-env", \
     "--no-lock", \
     "--unsafely-ignore-certificate-errors", \
     "schema/server.js"]
