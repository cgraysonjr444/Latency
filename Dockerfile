FROM denoland/deno:alpine-1.41.0

# Set the working directory
WORKDIR /app

# Copy files and EXPLICITLY set ownership to the deno user
COPY --chown=deno:deno . .

# Now switch to the deno user
USER deno

# Cache dependencies
RUN deno cache schema/server.js

# Run the app with the necessary flags
CMD ["run", \
     "--allow-net", \
     "--allow-env", \
     "--unsafely-ignore-certificate-errors", \
     "schema/server.js"]
