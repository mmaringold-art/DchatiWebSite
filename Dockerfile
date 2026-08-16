# Dchati marketing website — static site, no build step, no Node runtime.
# Served by nginx. Multi-stage is unnecessary because nothing is compiled.

FROM nginx:1.27-alpine

# Replace the default server config with ours
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the static assets (keeps the image clean — no node_modules, no Docker files)
COPY ["Dchati Landing.html", "platform.html", "dashboard.html", "privacy.html", "terms.html", "/usr/share/nginx/html/"]
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/
COPY .well-known/ /usr/share/nginx/html/.well-known/

# Serve the landing page at "/". The original file is kept too,
# so platform.html's "← Volver al sitio" link still resolves.
RUN cp "/usr/share/nginx/html/Dchati Landing.html" /usr/share/nginx/html/index.html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
