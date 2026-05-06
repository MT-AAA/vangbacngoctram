"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => window.print()}
      className="report-action"
      title="In hoặc lưu PDF qua trình duyệt"
    >
      <Printer className="h-3 w-3" />
      <span className="ml-1">In · Lưu PDF</span>
    </Button>
  );
}
