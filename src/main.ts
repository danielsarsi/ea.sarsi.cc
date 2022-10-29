import { AggregationUpdater } from "./aggregation/aggregationUpdater.ts";
import { ClientBox } from "./clientBox.ts";
import { calculate } from "./deps.ts";
import { Message, MessagePollingState } from "./message/message.ts";
import { MessagePolling } from "./message/messagePolling.ts";
import { MessageTouch } from "./message/messageTouch.ts";
import { dateTimeFormat, numberFormat } from "./utils.ts";

const clientBox = new ClientBox();

const aggregationUpdater = new AggregationUpdater();
await aggregationUpdater.start();

aggregationUpdater.addEventListener("update", () => {
  if (MessagePolling.stateForNow() === "after") {
    const lastAggregation = aggregationUpdater.getLastAggregation();

    if (lastAggregation) {
      const message = new MessagePolling(lastAggregation);
      clientBox.broadcast(message.toJSONString());
    }
  }
});

let lastState: MessagePollingState;

setInterval(() => {
  const state = MessagePolling.stateForNow();

  if (!lastState) {
    lastState = state;
  }

  if (lastState !== state) {
    if (state === "after") {
      const lastAggregation = aggregationUpdater.getLastAggregation();

      if (lastAggregation) {
        const message = new MessagePolling(lastAggregation);
        clientBox.broadcast(message.toJSONString());
        return;
      }
    }

    const message = new Message();
    clientBox.broadcast(message.toJSONString());

    lastState = state;
  }
}, 1000);

Deno.serve(
  async (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/api.txt") {
      const apiTxt = await Deno.open("./src/docs/api.txt", { read: true });

      const apiTxtStat = await apiTxt.stat();
      const etag = await calculate(apiTxtStat);

      if (request.headers.get("if-none-match") === etag) {
        return new Response(null, {
          status: 304,
          headers: {
            "Content-Type": "text/plain; charset=UTF-8",
            ETag: etag,
          },
        });
      }

      const readableStream = apiTxt.readable;

      return new Response(readableStream, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          ETag: etag,
        },
      });
    }

    if (
      url.pathname === "/now.txt" ||
      request.headers.get("user-agent")?.includes("curl") ||
      request.headers.get("user-agent")?.includes("Wget")
    ) {
      return sendPollingTxt();
    }

    if (url.pathname === "/") {
      if (request.headers.get("upgrade")?.includes("websocket")) {
        const webSocketUpgrade = upgradeWebSocket(request);
        return webSocketUpgrade;
      }

      return sendPollingJSON(request);
    }

    return new Response("404", { status: 404 });
  },
  { hostname: "0.0.0.0", port: 9000 }
);

function sendPollingTxt() {
  const lastAggregation = aggregationUpdater.getLastAggregation();

  const message = MessagePolling.parseAggregation(lastAggregation!);

  const now = new Date();
  const nowFormatted = dateTimeFormat.format(now);

  const votes = numberFormat.format(message.votes);

  const percentageValidVotes = numberFormat.format(message.validVotes[0]);
  const validVotes = numberFormat.format(message.validVotes[1]);

  const percentageBlankVotes = numberFormat.format(message.blankVotes[0]);
  const blankVotes = numberFormat.format(message.blankVotes[1]);

  const percentageNullVotes = numberFormat.format(message.nullVotes[0]);
  const nullVotes = numberFormat.format(message.nullVotes[1]);

  const percentageSectionsCleared = numberFormat.format(
    message.sectionsCleared[0]
  );
  const sectionsCleared = numberFormat.format(message.sectionsCleared[1]);

  const percentageSectionsTotalized = numberFormat.format(
    message.sectionsTotalized[0]
  );
  const sectionsTotalized = numberFormat.format(message.sectionsTotalized[1]);

  const timeFormatted = dateTimeFormat.format(message.time);

  const candidates = message.candidates.map((candidate) => ({
    percentageVotes: numberFormat.format(candidate.votes[0]),
    votes: numberFormat.format(candidate.votes[1]),
    elected: candidate.elected ? " <<ELEITO>>" : "",
    name: candidate.name === "Jair Bolsonaro" ? "Jair" : candidate.name,
  }));

  let candidatesTxt = "";

  for (const candidate of candidates) {
    candidatesTxt += `${candidate.name}: ${candidate.percentageVotes}% (${candidate.votes})${candidate.elected}\n`;
  }

  const txt = `${nowFormatted}

Última atualização: ${timeFormatted}
Votos totais: ${votes}

${candidatesTxt}
Votos válidos: ${percentageValidVotes}% (${validVotes})
Votos em branco: ${percentageBlankVotes}% (${blankVotes})
Votos nulos: ${percentageNullVotes}% (${nullVotes})

Seções apuradas: ${percentageSectionsCleared}% (${sectionsCleared})
Seções totalizadas: ${percentageSectionsTotalized}% (${sectionsTotalized})
`;

  return new Response(txt, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=UTF-8" },
  });
}

async function sendPollingJSON(request: Request) {
  const lastAggregation = aggregationUpdater.getLastAggregation();

  const message = MessagePolling.parseAggregation(lastAggregation!);
  const messageString = JSON.stringify(message);

  const etag = await calculate(messageString, { weak: false });

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        "Content-Type": "application/json",
        ETag: etag,
      },
    });
  }

  return new Response(JSON.stringify(message), {
    status: 200,
    headers: { "Content-Type": "application/json", ETag: etag },
  });
}

function upgradeWebSocket(req: Request): Response {
  const { socket, response } = Deno.upgradeWebSocket(req, {
    idleTimeout: 0,
  });

  const clientUuid = clientBox.add(socket);

  socket.onopen = () => {
    console.debug(`${clientUuid} connected`);

    if (MessageTouch.stateForNow() === "after") {
      const lastAggregation = aggregationUpdater.getLastAggregation();

      if (lastAggregation) {
        const message = new MessagePolling(lastAggregation);
        clientBox.send(clientUuid, message.toJSONString());
        return;
      }
    }

    const message = new Message();
    clientBox.send(clientUuid, message.toJSONString());
  };

  socket.onmessage = (e) => {
    console.debug(`receiving message from ${clientUuid}`);

    try {
      const parsedTouch = JSON.parse(e.data);

      if (
        typeof parsedTouch !== "object" ||
        typeof parsedTouch.x !== "number" ||
        typeof parsedTouch.y !== "number"
      ) {
        console.warn(`malformed touch by ${clientUuid}, discarding`);
        return;
      }

      const message = new MessageTouch(parsedTouch.x, parsedTouch.y);
      clientBox.broadcast(message.toJSONString(), [clientUuid]);
    } catch (_error) {
      console.warn(`error sending touch by ${clientUuid}, discarding`);
    }
  };

  socket.onclose = () => {
    console.info(`${clientUuid} disconnected`);
    clientBox.remove(clientUuid);
  };

  socket.onerror = (e) => {
    console.error(`${clientUuid} errored out:`, e);
    clientBox.remove(clientUuid);
  };

  return response;
}
