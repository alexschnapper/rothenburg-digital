// Passenger-kompatibler Einstiegspunkt für Plesk (Phusion Passenger).
// In Plesk als "Application Startup File" auf `server.js` setzen.
// Voraussetzung: vorher `pnpm build` ausführen (erzeugt `.next`).
//
// Passenger fängt `.listen()` ab und bindet an seinen eigenen Socket; der
// konkrete Port ist daher nebensächlich, `process.env.PORT` wird respektiert.
const { createServer } = require("http");
const next = require("next");

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000);
});
