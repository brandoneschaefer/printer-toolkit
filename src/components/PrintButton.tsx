"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <button onClick={() => window.print()} className="btn-primary no-print text-sm">
      <Printer className="h-4 w-4" /> Save as PDF
    </button>
  );
}
