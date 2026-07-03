// Tiny dependency-free API service for the compose test project.
//
// Binds a fixed port (3001) that the compose file publishes - the platform
// pins the real host port via its generated override. Demonstrates reaching
// the `db` service by its compose service name over the project network.
const http = require("http");
const net = require("net");
const os = require("os");

const PORT = Number(process.env.PORT) || 3001;
const DB_HOST = process.env.DB_HOST || "db";
const DB_PORT = Number(process.env.DB_PORT) || 5432;

// checkDB attempts a TCP connect to the db service to prove service-name DNS
// and the shared compose network work. Resolves to a status string.
function checkDB() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (status) => {
      socket.destroy();
      resolve(status);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => done("reachable"));
    socket.once("timeout", () => done("timeout"));
    socket.once("error", () => done("unreachable"));
    socket.connect(DB_PORT, DB_HOST);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  const db = await checkDB();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      service: "api",
      message: "Hello from the API service",
      hostname: os.hostname(),
      db: { host: DB_HOST, port: DB_PORT, status: db },
      time: new Date().toISOString(),
    }),
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`api listening on 0.0.0.0:${PORT} (db ${DB_HOST}:${DB_PORT})`);
});
