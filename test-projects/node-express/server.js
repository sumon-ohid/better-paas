const express = require("express");

const app = express();
// The platform injects PORT; bind to it on all interfaces (0.0.0.0).
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    app: "node-express",
    message: "Hello from Express on the BaaS platform",
    hostname: require("os").hostname(),
    time: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`node-express listening on 0.0.0.0:${PORT}`);
});
