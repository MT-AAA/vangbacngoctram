"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type PeriodType = "month" | "quarter" | "year" | "custom";

export function CreatePeriodForm() {
  const router = useRouter();
  const [type, setType] = useState<PeriodType>("month");
  const now = new Date();
  const [year, setYear] = useState(String(now.getUTCFullYear()));
  const [month, setMonth] = useState(String(now.getUTCMonth() + 1));
  const [quarter, setQuarter] = useState(String(Math.floor(now.getUTCMonth() / 3) + 1));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    start(async () => {
      const res = await fetch("/api/tax/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_type: type,
          year: parseInt(year, 10),
          month: type === "month" ? parseInt(month, 10) : undefined,
          quarter: type === "quarter" ? parseInt(quarter, 10) : undefined,
          start_date: type === "custom" ? startDate : undefined,
          end_date: type === "custom" ? endDate : undefined,
          name: type === "custom" ? name || undefined : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error("Tạo kỳ thất bại", {
          description: err.error ?? "Lỗi không xác định",
        });
        return;
      }
      toast.success("Đã tạo kỳ và tính thuế");
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div className="space-y-1">
        <Label>Loại kỳ</Label>
        <Select value={type} onValueChange={(v) => setType(v as PeriodType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Tháng</SelectItem>
            <SelectItem value="quarter">Quý</SelectItem>
            <SelectItem value="year">Năm</SelectItem>
            <SelectItem value="custom">Tùy chỉnh</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {type !== "custom" && (
        <div className="space-y-1">
          <Label>Năm</Label>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min={2000}
            max={2100}
          />
        </div>
      )}
      {type === "month" && (
        <div className="space-y-1">
          <Label>Tháng</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  Tháng {String(m).padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {type === "quarter" && (
        <div className="space-y-1">
          <Label>Quý</Label>
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((q) => (
                <SelectItem key={q} value={String(q)}>
                  Quý {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {type === "custom" && (
        <>
          <div className="space-y-1">
            <Label>Tên kỳ</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Kỳ kiểm tra"
            />
          </div>
          <div className="space-y-1">
            <Label>Từ ngày</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Đến ngày</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </>
      )}
      <div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Tạo và tính
        </Button>
      </div>
    </div>
  );
}
