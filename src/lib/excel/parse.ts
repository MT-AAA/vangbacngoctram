import * as XLSX from "xlsx";
import { parseVietnameseNumber } from "@/lib/utils";

/**
 * Parse a sales-import Excel file into normalized rows.
 *
 * Column header detection is case-insensitive and supports Vietnamese aliases.
 * Recognised header tokens (any of the listed forms map to the canonical field):
 *
 *   sale_date         → "ngày", "ngay", "ngày bán", "ngay ban", "date", "sale date"
 *   invoice_no        → "số hóa đơn", "so hoa don", "invoice", "invoice_no", "hoa don", "mã", "ma"
 *   product_name_raw  → "tên hàng", "ten hang", "sản phẩm", "san pham", "product", "name"
 *   quantity          → "số lượng", "so luong", "qty", "quantity", "sl"
 *   weight            → "trọng lượng", "trong luong", "weight", "khối lượng", "kl", "chỉ", "chi"
 *   unit_price        → "đơn giá", "don gia", "unit price", "giá bán", "gia ban"
 *   total_amount      → "thành tiền", "thanh tien", "total", "tổng tiền", "tong tien"
 *   purchase_cost     → "giá mua vào", "gia mua vao", "purchase cost", "giá vốn", "gia von", "cost"
 *   customer_name     → "khách hàng", "khach hang", "customer", "tên khách", "ten khach"
 *   customer_phone    → "số điện thoại", "so dien thoai", "phone", "điện thoại", "dien thoai"
 */

export type ParsedRow = {
  row_number: number; // 1-based row in the source file (header = row 1)
  sale_date: string | null; // ISO date YYYY-MM-DD
  invoice_no: string | null;
  product_name_raw: string;
  quantity: number | null;
  weight: number | null;
  unit_price: number | null;
  total_amount: number | null;
  purchase_cost_amount: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  raw: Record<string, unknown>;
  errors: string[];
};

const HEADER_MAP: Record<string, keyof ParsedRow> = {};
const ALIASES: Array<[keyof ParsedRow, string[]]> = [
  ["sale_date", ["ngày", "ngày bán", "date", "sale date", "ngay", "ngay ban"]],
  [
    "invoice_no",
    [
      "số hóa đơn",
      "so hoa don",
      "invoice",
      "invoice no",
      "invoice_no",
      "hóa đơn",
      "hoa don",
      "mã",
      "ma",
      "mã hóa đơn",
      "ma hoa don",
      "số hđ",
      "so hd",
      "số hd",
      "hđ",
      "hd",
    ],
  ],
  [
    "product_name_raw",
    [
      "tên hàng",
      "ten hang",
      "sản phẩm",
      "san pham",
      "product",
      "name",
      "tên sản phẩm",
      "ten san pham",
      "diễn giải",
      "dien giai",
    ],
  ],
  ["quantity", ["số lượng", "so luong", "qty", "quantity", "sl"]],
  [
    "weight",
    ["trọng lượng", "trong luong", "weight", "khối lượng", "khoi luong", "kl", "chỉ", "chi"],
  ],
  ["unit_price", ["đơn giá", "don gia", "unit price", "giá bán", "gia ban", "đơn giá bán", "don gia ban"]],
  [
    "total_amount",
    ["thành tiền", "thanh tien", "total", "tổng tiền", "tong tien", "tổng cộng", "tong cong"],
  ],
  [
    "purchase_cost_amount",
    [
      "giá mua vào",
      "gia mua vao",
      "purchase cost",
      "giá vốn",
      "gia von",
      "cost",
      "giá nhập",
      "gia nhap",
    ],
  ],
  ["customer_name", ["khách hàng", "khach hang", "customer", "tên khách", "ten khach"]],
  ["customer_phone", ["số điện thoại", "so dien thoai", "phone", "điện thoại", "dien thoai"]],
];

function buildHeaderMap() {
  if (Object.keys(HEADER_MAP).length > 0) return HEADER_MAP;
  for (const [field, aliases] of ALIASES) {
    for (const alias of aliases) {
      HEADER_MAP[alias.toLowerCase()] = field;
    }
  }
  return HEADER_MAP;
}

function normalizeHeader(s: string): string {
  return s.toString().trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Coerce an Excel cell value to a number, preserving JS-number decimals.
 *
 * SheetJS yields numeric cells as JS `number`, so we must NOT stringify them
 * before parsing — `parseVietnameseNumber("1.5")` would strip the `.` (treating
 * it as a thousand separator) and return `15`. Strings still go through the
 * Vietnamese-aware parser to handle `"6.500.000"`, `"1,5"`, etc.
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return parseVietnameseNumber(String(value));
}

function excelDateToISO(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    // Excel serial date — convert via xlsx's helper
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    const yyyy = String(d.y).padStart(4, "0");
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Try DD/MM/YYYY or DD-MM-YYYY (Vietnamese standard)
    const m = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const yyyy = y.length === 2 ? `20${y}` : y;
      return `${yyyy.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const dt = new Date(trimmed);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toISOString().slice(0, 10);
    }
  }
  return null;
}

export type ParseResult = {
  rows: ParsedRow[];
  unrecognized_columns: string[];
  recognized_columns: Record<string, keyof ParsedRow>;
  total_rows: number;
};

export async function parseSalesExcel(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) {
    return { rows: [], unrecognized_columns: [], recognized_columns: {}, total_rows: 0 };
  }
  const sheet = wb.Sheets[firstSheet];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: null,
    blankrows: false,
  });

  const headerMap = buildHeaderMap();
  const recognized: Record<string, keyof ParsedRow> = {};
  const unrecognized: string[] = [];

  if (json.length > 0) {
    for (const key of Object.keys(json[0])) {
      const norm = normalizeHeader(key);
      const field = headerMap[norm];
      if (field) recognized[key] = field;
      else unrecognized.push(key);
    }
  }

  const rows: ParsedRow[] = json.map((rawRow, idx) => {
    const errors: string[] = [];
    const row: ParsedRow = {
      row_number: idx + 2, // +2 because header is row 1, data starts at row 2
      sale_date: null,
      invoice_no: null,
      product_name_raw: "",
      quantity: null,
      weight: null,
      unit_price: null,
      total_amount: null,
      purchase_cost_amount: null,
      customer_name: null,
      customer_phone: null,
      raw: rawRow,
      errors,
    };

    for (const [colName, field] of Object.entries(recognized)) {
      const v = rawRow[colName];
      if (v === null || v === undefined || v === "") continue;
      switch (field) {
        case "sale_date":
          row.sale_date = excelDateToISO(v);
          if (!row.sale_date) errors.push(`Cột "${colName}" không hợp lệ: ${String(v)}`);
          break;
        case "invoice_no":
          row.invoice_no = String(v).trim() || null;
          break;
        case "product_name_raw":
          row.product_name_raw = String(v).trim();
          break;
        case "quantity":
          row.quantity = toNumber(v);
          break;
        case "weight":
          row.weight = toNumber(v);
          break;
        case "unit_price":
          row.unit_price = toNumber(v);
          break;
        case "total_amount":
          row.total_amount = toNumber(v);
          break;
        case "purchase_cost_amount":
          row.purchase_cost_amount = toNumber(v);
          break;
        case "customer_name":
          row.customer_name = String(v).trim() || null;
          break;
        case "customer_phone":
          row.customer_phone = String(v).trim() || null;
          break;
      }
    }

    // Default quantity to 1 if missing
    if (row.quantity === null) row.quantity = 1;

    // Required fields
    if (!row.product_name_raw) errors.push("Thiếu tên sản phẩm");
    if (!row.sale_date) errors.push("Thiếu ngày bán");

    // If total missing but unit price + quantity provided, derive
    if (row.total_amount === null && row.unit_price !== null && row.quantity !== null) {
      row.total_amount = +(row.unit_price * row.quantity).toFixed(2);
    }
    if (row.total_amount === null) {
      row.total_amount = 0;
    }

    return row;
  });

  return { rows, recognized_columns: recognized, unrecognized_columns: unrecognized, total_rows: rows.length };
}
