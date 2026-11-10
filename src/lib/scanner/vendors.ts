// Printer / copier (MFP) fingerprinting from banners, PJL identity, SNMP
// sysDescr, and embedded web-server strings. Shared by the scan engine and the
// external exposure check so detection is consistent.

// [lowercase keyword, display vendor]. Order matters only for display; the
// first match wins.
export const VENDOR_HINTS: Array<[string, string]> = [
  ["hewlett", "HP"], ["jetdirect", "HP"], ["chaiserver", "HP"], ["laserjet", "HP"], ["officejet", "HP"], ["designjet", "HP"],
  ["lexmark", "Lexmark"],
  ["imagerunner", "Canon"], ["imageclass", "Canon"], ["canon", "Canon"], ["imagepress", "Canon"], ["remote ui", "Canon"],
  ["epson", "Epson"], ["workforce", "Epson"],
  ["brother", "Brother"], ["mfc-", "Brother"], ["hl-", "Brother"], ["dcp-", "Brother"],
  ["workcentre", "Xerox"], ["versalink", "Xerox"], ["altalink", "Xerox"], ["centreware", "Xerox"], ["phaser", "Xerox"], ["xerox", "Xerox"],
  ["aficio", "Ricoh"], ["web image monitor", "Ricoh"], ["ricoh", "Ricoh"], ["savin", "Ricoh"], ["lanier", "Ricoh"], ["nashuatec", "Ricoh"],
  ["taskalfa", "Kyocera"], ["ecosys", "Kyocera"], ["command center", "Kyocera"], ["kyocera", "Kyocera"],
  ["bizhub", "Konica Minolta"], ["develop ineo", "Konica Minolta"], ["konica", "Konica Minolta"], ["minolta", "Konica Minolta"],
  ["e-studio", "Toshiba"], ["estudio", "Toshiba"], ["e-bridge", "Toshiba"], ["toshiba", "Toshiba"],
  ["okidata", "OKI"], ["oki ", "OKI"],
  ["samsung", "Samsung"], ["dell", "Dell"], ["pantum", "Pantum"], ["muratec", "Muratec"],
  ["zebra", "Zebra"], ["sato", "SATO"], ["primera", "Primera"],
  ["fiery", "EFI Fiery"],
  ["sharp", "Sharp"],
];

// Product-line keywords that indicate a multifunction copier (MFP) rather than
// a plain printer.
const MFP_HINTS = [
  "imagerunner", "imagepress", "workcentre", "versalink", "altalink", "aficio", "bizhub", "taskalfa", "e-studio",
  "estudio", "mfc-", "multifunction", "mfp", "copier", "savin", "develop ineo", "versant", "accuriopress",
  "workforce pro", "ecosys m", "colorqube", "e-bridge",
];

const PRINTER_HINTS = ["laserjet", "officejet", "designjet", "phaser", "ecosys p", "hl-", "printer", "print server", "jetdirect"];

export function guessVendor(text?: string): string | undefined {
  if (!text) return undefined;
  const t = ` ${text.toLowerCase()} `;
  for (const [kw, name] of VENDOR_HINTS) {
    if (t.includes(kw)) return name;
  }
  return undefined;
}

export type DeviceType = "Copier / MFP" | "Printer";

export function classifyDevice(text?: string): DeviceType | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (MFP_HINTS.some((h) => t.includes(h))) return "Copier / MFP";
  if (PRINTER_HINTS.some((h) => t.includes(h))) return "Printer";
  return undefined;
}

/** Extract a short, human-readable model/identity string from raw banners. */
export function extractModel(text?: string): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/[\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim();
  // Prefer a quoted identity (PJL INFO ID returns "VENDOR MODEL").
  const quoted = cleaned.match(/"([^"]{3,60})"/);
  if (quoted) return quoted[1].trim();
  return cleaned.slice(0, 60) || undefined;
}

// Keyword list for the exposure check's banner/subdomain matching.
export const PRINTER_VENDOR_KEYWORDS = Array.from(new Set(VENDOR_HINTS.map(([k]) => k.trim()).filter((k) => k.length > 2)));
