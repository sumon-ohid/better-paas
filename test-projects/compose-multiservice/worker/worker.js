// Minimal background worker for the compose test project. It publishes no
// port, so the platform lists it as a service row without a public URL. It
// just logs a heartbeat so you can watch its output in the runtime logs and
// open a terminal into it.
let tick = 0;
console.log("worker started");
setInterval(() => {
  tick += 1;
  console.log(`[worker] heartbeat ${tick} @ ${new Date().toISOString()}`);
}, 5000);
