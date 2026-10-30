FROM node:24-bookworm-slim AS build
WORKDIR /workspace
ARG VITE_SOCIAL_LINKEDIN_URL=
ARG VITE_SOCIAL_INSTAGRAM_URL=
ARG VITE_SOCIAL_TELEGRAM_URL=
ENV VITE_SOCIAL_LINKEDIN_URL=${VITE_SOCIAL_LINKEDIN_URL}
ENV VITE_SOCIAL_INSTAGRAM_URL=${VITE_SOCIAL_INSTAGRAM_URL}
ENV VITE_SOCIAL_TELEGRAM_URL=${VITE_SOCIAL_TELEGRAM_URL}
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY apps/web ./apps/web
RUN npm run build --workspace @skillbridge/web

FROM nginx:1.27-alpine AS runtime
ENV API_UPSTREAM=http://api:4000 NGINX_ENVSUBST_FILTER="^API_UPSTREAM$"
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
