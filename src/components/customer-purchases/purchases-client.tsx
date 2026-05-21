"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { categoryBadgeClassName } from "@/components/product-category-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatVND, formatVNDate } from "@/lib/utils";
import { PURITY_LABELS, type Purity } from "@/lib/customer-purchases/schema";
import type { CustomerPurchaseListRow } from "@/lib/customer-purchases/queries";
import {
  CustomerPurchaseForm,
  type CategoryOption,
} from "./purchase-form";

type Props = {
  rows: CustomerPurchaseListRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
  /** "admin" | "staff" | "viewer" — controls delete-button visibility. */
  role: string;
  filters: {
    from: string;
    to: string;
    category: string;
    q: string;
    customer: string;
    taxInput: string;
  };
};

export function CustomerPurchasesClient({
  rows,
  total,
  page,
  pageSize,
  categories,
  role,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [category, setCategory] = useState(filters.category || "all");
  const [q, setQ] = useState(filters.q);
  const [customer, setCustomer] = useState(filters.customer);
  const [taxInput, setTaxInput] = useState(filters.taxInput || "all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerPurchaseListRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomerPurchaseListRow | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [verifiedDuplicateIds, setVerifiedDuplicateIds] = useState<Set<string>>(
    () => {
      if (typeof window === "undefined") return new Set();
      try {
        const saved = window.localStorage.getItem("customerPurchaseVerifiedDuplicates");
        return new Set(saved ? (JSON.parse(saved) as string[]) : []);
      } catch {
        return new Set();
      }
    }
  );
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const normalizeDuplicateText = (value: string | null | undefined) =>
    (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  const duplicateKeyOf = (row: CustomerPurchaseListRow) => {
    const cat = Array.isArray(row.category) ? row.category[0] : row.category;
    return [
      row.purchase_date,
      normalizeDuplicateText(row.customer_name),
      normalizeDuplicateText(row.product_name),
      cat?.id ?? row.product_category_id ?? "none",
    ].join("|");
  };

  const duplicateCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = duplicateKeyOf(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const verifyDuplicate = (id: string) => {
    const next = new Set(verifiedDuplicateIds);
    next.add(id);
    setVerifiedDuplicateIds(next);
    window.localStorage.setItem(
      "customerPurchaseVerifiedDuplicates",
      JSON.stringify(Array.from(next))
    );
    toast.success("Đã xác minh giao dịch này là dữ liệu khác nhau");
  };

  const apply = () => {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (category && category !== "all") sp.set("category", category);
    if (q.trim()) sp.set("q", q.trim());
    if (customer.trim()) sp.set("customer", customer.trim());
    if (taxInput && taxInput !== "all") sp.set("tax_input", taxInput);
    router.push(`/customer-purchases${sp.toString() ? `?${sp}` : ""}`);
  };

  const reset = () => {
    setFrom("");
    setTo("");
    setCategory("all");
    setQ("");
    setCustomer("");
    setTaxInput("all");
    router.push("/customer-purchases");
  };

  const goToPage = (p: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(p));
    router.push(`/customer-purchases?${sp.toString()}`);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: CustomerPurchaseListRow) => {
    setEditing(row);
    setFormOpen(true);
  };

  const confirmDelete = (row: CustomerPurchaseListRow) => {
    setPendingDelete(row);
  };

  const runDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeleting(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/customer-purchases/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error("Xóa thất bại", {
            description: err?.error ?? `HTTP ${res.status}`,
          });
          return;
        }
        toast.success("Đã xóa giao dịch mua");
        setPendingDelete(null);
        router.refresh();
      } finally {
        setDeleting(false);
      }
    });
  };

  const categoryIdByName = new Map(
    categories.map((c) => [c.name.trim().toLowerCase(), c.id])
  );

  const exportHeaders = [
    "Ngày mua",
    "Tên khách hàng",
    "SĐT",
    "MST",
    "CCCD",
    "Địa chỉ",
    "Tên sản phẩm",
    "Phân loại",
    "Tuổi",
    "Đơn vị",
    "Trọng lượng",
    "Đơn vị trọng lượng",
    "Số lượng",
    "Đơn giá mua",
    "Thành tiền mua",
    "Tính giá vốn",
    "Đưa vào tồn kho",
    "Ghi chú",
  ] as const;

  const exportColumnWidths = [
    { wch: 16.25 },
    { wch: 17.13 },
    { wch: 21 },
    { wch: 14 },
    { wch: 14.75 },
    { wch: 24 },
    { wch: 16.63 },
    { wch: 17.5 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12.5 },
    { wch: 15.63 },
    { wch: 11.5 },
    { wch: 13.25 },
    { wch: 24 },
  ];

  const excelSerialFromISO = (value: string | null | undefined) => {
    if (!value) return "";
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return value;
    return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000;
  };

  const buildFormattedWorksheet = (rowsForSheet: Record<string, unknown>[]) => {
    const ws = XLSX.utils.aoa_to_sheet([[...exportHeaders]]);
    ws["!cols"] = exportColumnWidths;

    rowsForSheet.forEach((row, index) => {
      const sheetRow = index + 2;
      exportHeaders.forEach((header, colIndex) => {
        const address = XLSX.utils.encode_cell({ r: sheetRow - 1, c: colIndex });
        const value = row[header];
        if (header === "Ngày mua") {
          const serial = excelSerialFromISO(String(value ?? ""));
          ws[address] = typeof serial === "number" ? { t: "n", v: serial, z: "m/d/yy" } : { t: "s", v: String(serial) };
        } else if (header === "SĐT" || header === "MST" || header === "CCCD" || header === "Địa chỉ") {
          ws[address] = { t: "s", v: String(value ?? ""), z: "@" };
        } else if (header === "Đơn giá mua") {
          ws[address] = { t: "n", v: Number(value ?? 0), z: "#,##0" };
        } else if (header === "Thành tiền mua") {
          ws[address] = { t: "n", f: `N${sheetRow}*K${sheetRow}`, z: "#,##0" };
        } else if (header === "Trọng lượng" || header === "Số lượng") {
          ws[address] = { t: "n", v: Number(value ?? 0) };
        } else if (header === "Tính giá vốn" || header === "Đưa vào tồn kho") {
          ws[address] = { t: "b", v: value === true || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "có" };
        } else {
          ws[address] = { t: "s", v: String(value ?? "") };
        }
      });
    });

    ws["!ref"] = `A1:R${Math.max(rowsForSheet.length + 1, 1)}`;
    return ws;
  };

  const downloadWorkbook = (fileName: string, rowsForSheet: Record<string, unknown>[]) => {
    const wb = XLSX.utils.book_new();
    const ws = buildFormattedWorksheet(rowsForSheet);
    XLSX.utils.book_append_sheet(wb, ws, "Mua từ khách");
    XLSX.writeFile(wb, fileName, { bookType: "xlsx", cellStyles: true });
  };

  const downloadFormattedTemplate = () => {
    const link = document.createElement("a");
    link.href = "/mau_nhap_mua_tu_khach.xlsx";
    link.download = "mau_nhap_mua_tu_khach.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadTemplate = () => {
    downloadWorkbook("mau_nhap_mua_tu_khach.xlsx", [
      {
        "Ngày mua": "2026-05-21",
        "Tên khách hàng": "Nguyễn Văn A",
        "SĐT": "0900000000",
        "MST": "",
        "CCCD": "",
        "Địa chỉ": "",
        "Tên sản phẩm": "Nhẫn vàng 9999",
        "Phân loại": categories[0]?.name ?? "",
        "Tuổi": "9999",
        "Đơn vị": "chỉ",
        "Trọng lượng": 1,
        "Đơn vị trọng lượng": "chỉ",
        "Số lượng": 1,
        "Đơn giá mua": 8000000,
        "Thành tiền mua": "",
        "Tính giá vốn": true,
        "Đưa vào tồn kho": true,
        "Ghi chú": "",
      },
    ]);
  };

  const buildExportRows = (exportRows: CustomerPurchaseListRow[]) =>
    exportRows.map((r) => {
      const cat = Array.isArray(r.category) ? r.category[0] : r.category;
      return {
        "Ngày mua": r.purchase_date,
        "Tên khách hàng": r.customer_name ?? "",
        "SĐT": r.customer_phone ?? "",
        "MST": r.customer_tax_code ?? "",
        "CCCD": r.customer_id_card ?? "",
        "Địa chỉ": r.customer_address ?? "",
        "Tên sản phẩm": r.product_name,
        "Phân loại": cat?.name ?? "",
        "Tuổi": r.purity ?? "",
        "Đơn vị": r.unit ?? "",
        "Trọng lượng": r.weight ?? "",
        "Đơn vị trọng lượng": r.weight_unit ?? "",
        "Số lượng": r.quantity ?? 0,
        "Đơn giá mua": r.unit_price ?? 0,
        "Thành tiền mua": r.total_amount ?? 0,
        "Tính giá vốn": Boolean(r.is_tax_purchase_input),
        "Đưa vào tồn kho": Boolean(r.becomes_inventory),
        "Ghi chú": r.notes ?? "",
      };
    });

  const exportExcel = async () => {
    setExporting(true);
    try {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("page");
      const res = await fetch(`/api/customer-purchases/export?${sp.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rows?: CustomerPurchaseListRow[] };
      const exportRows = data.rows ?? [];
      downloadWorkbook(
        `mua_tu_khach_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buildExportRows(exportRows)
      );
      toast.success(`Đã xuất ${exportRows.length} giao dịch theo bộ lọc`);
    } catch (err) {
      toast.error("Xuất Excel thất bại", {
        description: err instanceof Error ? err.message : "Không lấy được dữ liệu",
      });
    } finally {
      setExporting(false);
    }
  };

  const parseBool = (value: unknown) => {
    const text = String(value ?? "").trim().toLowerCase();
    return ["có", "co", "yes", "true", "1", "x"].includes(text);
  };

  const parseNumber = (value: unknown) => {
    if (typeof value === "number") return value;
    const normalized = String(value ?? "0").replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const parsePurchaseDate = (value: unknown) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      }
    }

    const text = String(value ?? "").trim();
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    }

    const vn = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
    if (vn) {
      const year = vn[3].length === 2 ? `20${vn[3]}` : vn[3];
      return `${year}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`;
    }

    return "";
  };

  const importExcel = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const importedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      let ok = 0;

      for (const row of importedRows) {
        const purchaseDate = parsePurchaseDate(row["Ngày mua"]);
        const categoryName = String(row["Phân loại"] ?? "").trim().toLowerCase();
        const quantity = parseNumber(row["Số lượng"]);
        const unitPrice = parseNumber(row["Đơn giá mua"]);
        const totalAmount = parseNumber(row["Thành tiền mua"]) || quantity * unitPrice;

        const res = await fetch("/api/customer-purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purchase_date: purchaseDate,
            customer_name: row["Tên khách hàng"] || null,
            customer_phone: row["SĐT"] || null,
            customer_tax_code: row["MST"] || null,
            customer_id_card: row["CCCD"] || null,
            customer_address: row["Địa chỉ"] || null,
            product_name: row["Tên sản phẩm"],
            product_category_id: categoryIdByName.get(categoryName) ?? null,
            purity: row["Tuổi"] || null,
            unit: row["Đơn vị"] || null,
            weight: row["Trọng lượng"] === "" ? null : parseNumber(row["Trọng lượng"]),
            weight_unit: row["Đơn vị trọng lượng"] || "chỉ",
            quantity,
            unit_buy_price: unitPrice,
            total_buy_amount: totalAmount,
            is_tax_purchase_input: parseBool(row["Tính giá vốn"]),
            add_to_inventory: parseBool(row["Đưa vào tồn kho"]),
            notes: row["Ghi chú"] || null,
            image_url: null,
            attachment_url: null,
          }),
        });
        if (!res.ok) throw new Error(`Dòng ${ok + 2}: nhập không thành công`);
        ok += 1;
      }

      toast.success(`Đã nhập ${ok} giao dịch từ Excel`);
      router.refresh();
    } catch (err) {
      toast.error("Nhập Excel thất bại", {
        description: err instanceof Error ? err.message : "File không hợp lệ",
      });
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="space-y-1">
            <Label>Từ ngày</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Đến ngày</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
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
                <SelectItem value="none">Chưa phân loại</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tên sản phẩm</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="VD: Nhẫn 9999"
            />
          </div>
          <div className="space-y-1">
            <Label>Khách hàng</Label>
            <Input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Tên / SĐT / MST / CCCD"
            />
          </div>
          <div className="space-y-1">
            <Label>Tính giá vốn</Label>
            <Select value={taxInput} onValueChange={setTaxInput}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="1">Có tính</SelectItem>
                <SelectItem value="0">Không tính</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={apply} size="sm">
            Áp dụng
          </Button>
          <Button onClick={reset} variant="outline" size="sm">
            Xóa bộ lọc
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importExcel(file);
            }}
          />
          <Button onClick={downloadFormattedTemplate} variant="outline" size="sm">
            <Download className="mr-1 h-4 w-4" />
            Tải Excel mẫu
          </Button>
          <Button
            onClick={() => importInputRef.current?.click()}
            variant="outline"
            size="sm"
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-1 h-4 w-4" />
            )}
            Nhập Excel
          </Button>
          <Button
            onClick={() => void exportExcel()}
            variant="outline"
            size="sm"
            disabled={total === 0 || exporting}
          >
            {exporting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-1 h-4 w-4" />
            )}
            Xuất Excel
          </Button>
          <div className="ml-auto">
            <Button onClick={openCreate} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Thêm giao dịch mua
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Sản phẩm</TableHead>
              <TableHead>Phân loại</TableHead>
              <TableHead>Tuổi</TableHead>
              <TableHead className="text-right">Trọng lượng</TableHead>
              <TableHead className="text-right">SL</TableHead>
              <TableHead className="text-right">Đơn giá</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead>Thuế</TableHead>
              <TableHead>Tồn kho</TableHead>
              <TableHead className="text-right w-[120px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-sm text-muted-foreground py-8">
                  Chưa có giao dịch nào phù hợp.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const cat = Array.isArray(r.category) ? r.category[0] : r.category;
                const isDuplicate = duplicateCounts[duplicateKeyOf(r)] > 1;
                const isVerifiedDuplicate = verifiedDuplicateIds.has(r.id);
                const shouldWarnDuplicate = isDuplicate && !isVerifiedDuplicate;
                return (
                  <TableRow
                    key={r.id}
                    className={
                      shouldWarnDuplicate
                        ? "bg-rose-50/90 hover:bg-rose-100 border-l-4 border-l-rose-500"
                        : undefined
                    }
                  >
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatVNDate(r.purchase_date)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.customer_name ?? "—"}</div>
                      <div className="text-muted-foreground">
                        {[r.customer_phone, r.customer_tax_code, r.customer_id_card]
                          .filter(Boolean)
                          .join(" • ") || ""}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">
                      <div className="font-medium">{r.product_name}</div>
                      {shouldWarnDuplicate && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                          <AlertTriangle className="h-3 w-3" />
                          Nghi trùng giao dịch
                        </div>
                      )}
                      {isDuplicate && isVerifiedDuplicate && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Đã xác minh khác nhau
                        </div>
                      )}
                      {r.unit && (
                        <div className="text-xs text-muted-foreground">
                          ĐV: {r.unit}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {cat ? (
                        <Badge className={categoryBadgeClassName(cat.name)}>{cat.name}</Badge>
                      ) : (
                        <Badge variant="outline">Chưa phân loại</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.purity ? PURITY_LABELS[r.purity as Purity] ?? r.purity : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {r.weight !== null && r.weight !== undefined
                        ? `${formatNumber(Number(r.weight), 4)} ${r.weight_unit ?? ""}`.trim()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(Number(r.quantity ?? 0), 4)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatVND(Number(r.unit_price ?? 0))}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatVND(Number(r.total_amount ?? 0))}
                    </TableCell>
                    <TableCell>
                      {r.is_tax_purchase_input ? (
                        <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                          Có tính
                        </Badge>
                      ) : (
                        <Badge variant="outline">Không</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.becomes_inventory ? (
                        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                          Đã đưa vào
                        </Badge>
                      ) : (
                        <Badge variant="outline">Không</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {shouldWarnDuplicate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => verifyDuplicate(r.id)}
                            title="Xác minh đây là giao dịch khác nhau"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(r)}
                          title="Sửa"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {role === "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDelete(r)}
                            title="Xóa"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Trang {page}/{totalPages} • Tổng {formatNumber(total, 0)} giao dịch
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Sau
          </Button>
        </div>
      </div>

      <CustomerPurchaseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        editing={editing}
        onSaved={() => {
          router.refresh();
        }}
      />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(v) => {
          if (!v && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa giao dịch mua?</DialogTitle>
            <DialogDescription>
              {pendingDelete && (
                <>
                  {formatVNDate(pendingDelete.purchase_date)} •{" "}
                  {pendingDelete.product_name} •{" "}
                  {formatVND(Number(pendingDelete.total_amount ?? 0))}.
                  Hành động này không thể hoàn tác.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={runDelete}
              disabled={deleting || pending}
            >
              {(deleting || pending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
