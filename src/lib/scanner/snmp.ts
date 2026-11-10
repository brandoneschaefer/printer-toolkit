// SNMP default-community probe. Read-only GET of sysDescr/sysName using the
// manufacturer-default community strings. A successful read proves the device
// exposes SNMP with a guessable community (a very common printer finding).

// net-snmp is CommonJS; import defensively so a missing optional dep never
// crashes the whole scan.
type SnmpResult = { ok: boolean; community?: string; sysDescr?: string; version: string } | null;

const OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0";
const OID_SYS_NAME = "1.3.6.1.2.1.1.5.0";
const DEFAULT_COMMUNITIES = ["public", "private"];

function getSnmp(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("net-snmp");
  } catch {
    return null;
  }
}

function tryCommunity(
  snmp: any,
  host: string,
  community: string,
  timeoutMs: number
): Promise<{ sysDescr?: string } | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val: { sysDescr?: string } | null) => {
      if (done) return;
      done = true;
      try {
        session.close();
      } catch {
        /* ignore */
      }
      resolve(val);
    };

    const session = snmp.createSession(host, community, {
      timeout: timeoutMs,
      retries: 0,
      version: snmp.Version2c,
    });

    session.on?.("error", () => finish(null));

    try {
      session.get([OID_SYS_DESCR, OID_SYS_NAME], (error: unknown, varbinds: any[]) => {
        if (error || !varbinds?.length) return finish(null);
        const vb = varbinds[0];
        if (snmp.isVarbindError(vb)) return finish(null);
        const sysDescr = vb?.value ? vb.value.toString() : undefined;
        finish({ sysDescr });
      });
    } catch {
      finish(null);
    }

    // Hard stop in case the library never calls back.
    setTimeout(() => finish(null), timeoutMs + 500);
  });
}

export async function snmpDefaultCommunity(host: string, timeoutMs: number): Promise<SnmpResult> {
  const snmp = getSnmp();
  if (!snmp) return null;
  for (const community of DEFAULT_COMMUNITIES) {
    const res = await tryCommunity(snmp, host, community, timeoutMs);
    if (res) {
      return { ok: true, community, sysDescr: res.sysDescr, version: "v2c" };
    }
  }
  return null;
}
