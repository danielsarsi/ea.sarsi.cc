FROM denoland/deno:alpine-1.26.2

EXPOSE 9000

WORKDIR /app

COPY src/deps.ts .
RUN deno cache deps.ts

ADD src .
RUN deno cache main.ts

CMD ["run", "--allow-net", "--allow-read", "--unstable", "main.ts"]
