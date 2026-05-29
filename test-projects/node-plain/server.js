const http = require("http");
const os = require("os");

// The platform injects PORT; bind to it on all interfaces (0.0.0.0).
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      app: "node-plain",
      message: "Hello from Node stdlib on the BaaS platform",
      hostname: os.hostname(),
      time: new Date().toISOString(),
    })
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`node-plain listening on 0.0.0.0:${PORT}`);
});
