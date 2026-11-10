// A deliberately-vulnerable MOCK printer for local testing of the scanner.
// Opens several printer ports on 127.0.0.1 so an audit produces findings.
// This is a test fixture only — it is NOT a real printer and stores nothing.
//
//   npx tsx scripts/mock-printer.ts
//   npx tsx scripts/scan-cli.ts 127.0.0.1
//
import net from "node:net";
import http from "node:http";

const UEL = "\x1b%-12345X";

function rawPjl(port: number) {
  const server = net.createServer((socket) => {
    let buf = "";
    socket.on("data", (d) => {
      buf += d.toString("latin1");
      if (buf.includes("@PJL INFO ID")) {
        socket.write(`${UEL}@PJL INFO ID\r\n"MOCK LaserJet 9999 / HP-Mock"\r\n${UEL}\r\n`);
      }
      if (buf.includes("@PJL INFO STATUS")) {
        socket.write(`@PJL INFO STATUS\r\nCODE=10001\r\nDISPLAY="READY"\r\n`);
      }
    });
    socket.on("error", () => {});
  });
  server.listen(port, "127.0.0.1", () => console.log(`[mock] RAW/PJL on ${port}`));
}

function plainOpen(port: number, banner?: string) {
  const server = net.createServer((socket) => {
    if (banner) socket.write(banner);
    socket.on("error", () => {});
  });
  server.listen(port, "127.0.0.1", () => console.log(`[mock] open ${port}`));
}

function httpAdmin(port: number) {
  const server = http.createServer((req, res) => {
    const auth = req.headers.authorization;
    // Accept the default credential admin:admin (base64 YWRtaW46YWRtaW4=).
    if (auth === "Basic YWRtaW46YWRtaW4=") {
      res.writeHead(200, { "Content-Type": "text/html", Server: "HP-ChaiServer/3.0" });
      res.end("<html><title>MOCK Printer Admin</title><body>Welcome admin</body></html>");
      return;
    }
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="MOCK Printer"',
      Server: "HP-ChaiServer/3.0",
      "Content-Type": "text/html",
    });
    res.end("<html><title>MOCK Printer Login</title><body>Auth required</body></html>");
  });
  server.listen(port, "127.0.0.1", () => console.log(`[mock] HTTP admin on ${port}`));
}

// Note: ports <1024 may require elevated privileges. Run as root or remap.
rawPjl(9100);
plainOpen(23, "\r\nMOCK printer telnet\r\nlogin: ");
plainOpen(515);
plainOpen(631);
httpAdmin(80);

console.log("\nMock printer running. Scan with: npx tsx scripts/scan-cli.ts 127.0.0.1");
console.log("Press Ctrl+C to stop.");
