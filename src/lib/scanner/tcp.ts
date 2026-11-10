import net from "node:net";

export interface TcpProbe {
  open: boolean;
  banner?: string;
}

/** Non-intrusive TCP connect probe with optional short banner read. */
export function probePort(host: string, port: number, timeoutMs: number, readBanner = false): Promise<TcpProbe> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    let connected = false;
    let banner = "";

    const finish = () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ open: connected, banner: banner.trim() || undefined });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      connected = true;
      // Open port confirmed. If not reading a banner, we're done immediately.
      if (!readBanner) return finish();
      // Otherwise give the service a brief moment to volunteer a banner.
      socket.setTimeout(Math.min(timeoutMs, 1200));
    });
    socket.on("data", (chunk) => {
      banner += chunk.toString("latin1");
      if (banner.length > 1024) finish();
    });
    // Timeout after connect = banner wait elapsed (still "open").
    // Timeout before connect = unreachable port.
    socket.once("timeout", finish);
    socket.once("error", finish);
    socket.once("close", finish);

    try {
      socket.connect(port, host);
    } catch {
      finish();
    }
  });
}

const UEL = "\x1b%-12345X";

/**
 * Read-only PJL identity probe against an open raw/JetDirect port (9100).
 * Sends only `@PJL INFO` queries — never any state-changing command — to
 * demonstrate unauthenticated PJL access and extract the device identity.
 */
export function pjlInfo(host: string, port: number, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    let out = "";

    const finish = (val: string | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(val);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      const cmd = `${UEL}@PJL INFO ID\r\n@PJL INFO STATUS\r\n${UEL}\r\n`;
      socket.write(cmd);
    });
    socket.on("data", (chunk) => {
      out += chunk.toString("latin1");
      if (out.length > 2048) finish(out);
    });
    socket.once("timeout", () => finish(out.length ? out : null));
    socket.once("error", () => finish(null));
    socket.once("close", () => finish(out.length ? out : null));

    try {
      socket.connect(port, host);
    } catch {
      finish(null);
    }
  });
}
