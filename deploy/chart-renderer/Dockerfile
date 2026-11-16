# The chart renderer of the eQMS reports: Chart.js drawn on the server (REPORT-CHARTJS-2026-11-15).
ARG NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm-slim
FROM ${NODE_IMAGE}
# The libraries the canvas of node-canvas draws with (cairo, pango, jpeg, gif, svg).
RUN apt-get update && apt-get install -y --no-install-recommends libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js chartConfig.js ./
# The fonts of the reports are the ones the backend bundles (one source): the compose file gives them as the build context "fonts".
COPY --from=fonts . /app/fonts
ENV NODE_ENV=production PORT=3100 FONT_DIR=/app/fonts
USER node
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=5s --retries=6 CMD node -e "require('http').get('http://127.0.0.1:3100/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.js"]
