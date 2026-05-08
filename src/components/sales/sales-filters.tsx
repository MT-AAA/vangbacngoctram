"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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

type Category = { id: string; name: string; code: string };

export function SalesFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [invoice, setInvoice] = useState(params.get("invoice") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "all");
  const [status, setStatus] = useState(params.get("status") ?? "all");

  const apply = () => {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (invoice.trim()) sp.set("invoice", invoice.trim());
    if (category && category !== "all") sp.set("category", category);
    if (status && status !== "all") sp.set("status", status);
    const sort = params.get("sort");
    const dir = params.get("dir");
    if (sort) sp.set("sort", sort);
    if (dir) sp.set("dir", dir);
    // Always reset to page 1 when filters change so the user doesn't land on a
    // page that no longer exists with the new filter set.
    router.push(`/sales${sp.toString() ? `?${sp}` : ""}`);
  };

  const reset = () => {
    setFrom("");
    setTo("");
    setInvoice("");
    setCategory("all");
    setStatus("all");
    router.push("/sales");
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <div className="space-y-1">
        <Label>Từ ngày</Label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Đến ngày</Label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Số hóa đơn</Label>
        <Input
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
          placeholder="vd: 123"
        />
      </div>
      <div className="space-y-1">
        <Label>Phân loại</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Trạng thái thuế</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="complete">Đầy đủ</SelectItem>
            <SelectItem value="estimated">Ước tính</SelectItem>
            <SelectItem value="missing_purchase_cost">Thiếu giá vốn</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button onClick={apply} className="flex-1">
          Áp dụng
        </Button>
        <Button variant="outline" onClick={reset}>
          Xóa
        </Button>
      </div>
    </div>
  );
}
