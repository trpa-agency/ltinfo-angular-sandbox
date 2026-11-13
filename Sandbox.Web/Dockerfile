# Sandbox.Web: the Angular app.
#
#   docker build --target dev -t sandbox-web:dev .     the dev server, hot reload
#   docker build -t sandbox-web:prod .                 the built app behind nginx
#
# The build context is this folder only. Ecology is already vendored under
# src/ecology/, so nothing outside Sandbox.Web is needed.

# ---- deps: install node_modules once, inside the image ----------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NG_CLI_ANALYTICS=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- dev: ng serve with a proxy to the API container ------------------------
# docker-compose bind-mounts src/ (and the config files) over this image, so an
# edit on the host rebuilds in the container, while node_modules stays in the
# image and never lands in the Windows folder. --poll is what makes file
# changes visible across a Windows bind mount.
FROM deps AS dev
COPY . .
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--poll", "1000", "--proxy-config", "proxy.conf.docker.json"]

# ---- build: the production bundle -------------------------------------------
FROM deps AS build
COPY . .
RUN npx ng build

# ---- pages: the GitHub Pages copy, read-only, from the static-api/ snapshot --
#   docker build --target pages-out --build-arg BASE_HREF=/<repo>/ --output dist/pages .
FROM deps AS pages
COPY . .
ARG BASE_HREF=/ltinfo-angular-sandbox/
RUN node scripts/build-pages.mjs "$BASE_HREF"

FROM scratch AS pages-out
COPY --from=pages /app/dist/sandbox-web/browser /

# ---- production: nginx serves the bundle and proxies /api -------------------
# This is the last stage, so a plain "docker build ." produces it.
FROM nginx:1.28-alpine AS production
# API_UPSTREAM is host:port of the API. NGINX_ENTRYPOINT_LOCAL_RESOLVERS tells
# the nginx image to expose the container's DNS server to the config template.
ENV API_UPSTREAM=sandbox.api:8080 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/sandbox-web/browser /usr/share/nginx/html
EXPOSE 80
