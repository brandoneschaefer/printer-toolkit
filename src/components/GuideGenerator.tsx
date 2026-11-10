"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

export function GuideGenerator({ defaultContact }: { defaultContact: string }) {
  const [client, setClient] = useState("");
  const [contact, setContact] = useState(defaultContact);
  const [device, setDevice] = useState("PRET Monitoring Sensor");

  const open = () => {
    const q = new URLSearchParams();
    if (client) q.set("client", client);
    if (contact) q.set("contact", contact);
    if (device) q.set("device", device);
    window.open(`/guide?${q.toString()}`, "_blank");
  };

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold text-white">Client setup guide</h2>
        <p className="text-sm text-slate-400">
          Generate a branded one-page PDF to hand to a client with their sensor. Personalize it, then Save as PDF.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="guide-client">Client company</label>
          <input id="guide-client" className="input" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Acme Corp" />
        </div>
        <div>
          <label className="label" htmlFor="guide-contact">Support contact</label>
          <input id="guide-contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@company.com" />
        </div>
        <div>
          <label className="label" htmlFor="guide-device">Device label</label>
          <input id="guide-device" className="input" value={device} onChange={(e) => setDevice(e.target.value)} />
        </div>
      </div>
      <button type="button" onClick={open} className="btn-ghost text-sm">
        <FileText className="h-4 w-4" /> Open printable guide
      </button>
    </div>
  );
}
