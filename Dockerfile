ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG APK_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/alpine

FROM node:24-alpine AS web-build
ARG NPM_REGISTRY
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_REGISTRY=$NPM_REGISTRY
WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --registry="$NPM_REGISTRY" || true \
 && pnpm approve-builds --all \
 && pnpm install --registry="$NPM_REGISTRY"
COPY shared/ /app/shared/
COPY server/render/src/shared/ /app/server/render/src/shared/
COPY web/ ./
RUN pnpm run build

FROM node:24-alpine AS server-deps
ARG NPM_REGISTRY
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app/server
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --registry="$NPM_REGISTRY" || true \
 && pnpm approve-builds --all \
 && pnpm install --registry="$NPM_REGISTRY"

COPY server/render/package.json server/render/pnpm-lock.yaml server/render/pnpm-workspace.yaml ./render/
WORKDIR /app/server/render
RUN pnpm install --registry="$NPM_REGISTRY" || true \
 && pnpm approve-builds --all \
 && pnpm install --registry="$NPM_REGISTRY"

FROM node:24-alpine AS runtime
ARG APK_MIRROR

RUN sed -i 's|dl-cdn.alpinelinux.org/alpine|mirrors.tuna.tsinghua.edu.cn/alpine|g' /etc/apk/repositories \
  && cat /etc/apk/repositories

RUN apk add --no-cache \
    nginx \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    fontconfig \
    ttf-freefont \
    font-noto-cjk \
    bash \
    curl \
    ffmpeg \
    util-linux \
    libstdc++ \
    libgcc \
    libxkbcommon \
    libxcomposite \
    libxdamage \
    libxrandr \
    libxcursor \
    libxi \
    mesa \
    mesa-gl \
    gtk+3.0 \
    && rm -rf /var/cache/apk/*

WORKDIR /app

COPY shared/ /app/shared/
COPY server/ /app/server/
COPY --from=server-deps /app/server/node_modules /app/server/node_modules
COPY --from=server-deps /app/server/render /app/server/render
COPY --from=web-build /app/web/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/http.d/default.conf

ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium \
    REMOTION_BROWSER=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium \
    NODE_ENV=production

RUN node /app/server/render/scripts/bundle.mjs

EXPOSE 80

CMD ["sh", "-c", "nginx -g 'daemon off;' & /app/server/node_modules/.bin/tsx /app/server/src/index.ts"]
