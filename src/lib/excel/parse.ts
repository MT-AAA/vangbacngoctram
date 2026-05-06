import * as XLSX from "xlsx";
import { parseVietnameseNumber } from "@/lib/utils";

/**
 * Parser for Vietnamese e-invoice "Báo cáo bán hàng chi tiết" Excel exports.
 *
 * Real export quirks this parser handles:
 *
 *   * `Sheet1`'s `!ref` only covers the title block (e.g. `A1:AN6`); the actual
 *     data extends well beyond it. We rebuild the used range by scanning every
 *     cell key.
 *   * The header row is not at a fixed position — title rows, company info
 *     rows, and a blank row precede it. We detect it by scanning the first 20
 *     rows for the canonical column tokens (STT / Số hóa đơn / Ngày lập / Tên
 *     hàng hóa / Số lượng / Đơn giá / Tổng cộng VNĐ).
 *   * Data rows are only the rows whose STT is numeric. Title rows, company
 *     info rows, blank rows, and the "Tổng cộng:" summary row are all skipped.
 *   * `Ngày, tháng, năm lập hóa đơn` is a Vietnamese `dd/MM/yyyy HH:mm` string.
 *     Parsing it with `new Date(...)` would mis-detect it as US `MM/dd/yyyy`.
 *   * `Số lượng` may be decimal (1.5, 0.75, etc.) — never coerced to integer.
 *   * `Thuế suất (%)` is blank and `Thuế GTGT đầu ra VNĐ` is `0` for direct-
 *     method gold/silver/gemstone invoices. We DO NOT treat the on-invoice VAT
 *     output column as VAT payable — it is stored only on the row as
 *     `vat_output_amount_from_invoice` for reconciliation. The actual VAT
 *     payable is derived later by the tax engine from purchase cost.
 *   * One invoice can contain many product rows. Two identifiers are produced
 *     per line:
 *       - `invoice_key` groups all product rows under the same e-invoice
 *       - `transaction_hash` is unique per product line
 *     See `src/lib/excel/hash.ts` for the hash inputs.
 *   * Columns AY..BR of the export relate to xăng/dầu (fuel pumps). They are
 *     ignored for the jewelry MVP — we only consume up to AX.
 */

export type ParsedRow = {
  /** 1-based STT cell from the source file (numeric). */
  source_stt: number | null;
  /** 1-based row number in the source sheet (header is row N, first data = N+1). */
  source_row_number: number;

  // Invoice identity
  invoice_template_code: string | null;
  invoice_series: string | null;
  invoice_no: string | null;
  invoice_date: string | null; // ISO-8601 with time, e.g. 2026-01-03T16:06:00
  sale_date: string | null; // ISO date YYYY-MM-DD (date portion of invoice_date)

  // Customer
  customer_name: string | null;
  customer_tax_code: string | null;
  customer_address: string | null;

  // Product
  product_code: string | null;
  product_name_raw: string;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;

  // Money
  currency: string | null;
  currency_rate: number | null;
  sales_amount_before_tax: number | null;
  vat_output_amount_from_invoice: number | null;
  total_amount: number | null;

  // Payment + e-invoice status
  payment_method: string | null;
  payment_status: string | null;
  invoice_status: string | null;
  tax_authority_status: string | null;
  tax_authority_code: string | null;

  raw: Record<string, unknown>;
  errors: string[];
};

export type ParseResult = {
  rows: ParsedRow[];
  total_rows: number;
  /** Rows whose STT is numeric; same as `rows.length` in practice. */
  data_row_count: number;
  /** Header row number (1-based) within the source sheet. */
  header_row_number: number | null;
  /** Names of header columns we recognised. */
  recognized_columns: string[];
  /** Header columns we did not map (informational). */
  unrecognized_columns: string[];
  /** Aggregates over `rows` (only well-formed rows). */
  total_amount: number;
  period_start: string | null; // ISO date
  period_end: string | null;
  /** Number of distinct (invoice_series, invoice_no, tax_authority_code) tuples. */
  unique_invoice_count: number;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

/**
 * Canonical header tokens. For each parsed field, we list one or more
 * Vietnamese (and English fallback) header strings. The first match wins. All
 * comparisons are case-insensitive and whitespace-collapsed.
 *
 * Aliases use the canonical Vietnamese form first (no diacritic stripping
 * required on the source side — these reflect the real export verbatim).
 */
const HEADER_ALIASES: Array<[keyof ParsedRow, string[]]> = [
  ["invoice_template_code", ["ký hiệu mẫu hóa đơn", "ky hieu mau hoa don"]],
  ["invoice_series", ["ký hiệu hóa đơn", "ky hieu hoa don"]],
  ["invoice_no", ["số hóa đơn", "so hoa don", "số hđ", "so hd", "invoice", "invoice no"]],
  [
    "invoice_date",
    [
      "ngày, tháng, năm lập hóa đơn",
      "ngay, thang, nam lap hoa don",
      "ngày lập hóa đơn",
      "ngay lap hoa don",
      "ngày",
      "ngay",
      "ngày bán",
      "ngay ban",
      "date",
    ],
  ],
  [
    "payment_method",
    [
      "phương thức thanh toán",
      "phuong thuc thanh toan",
      // "Hình thức thanh toán" is a fallback — handled below if the primary
      // column is empty.
    ],
  ],
  ["customer_name", ["tên khách hàng", "ten khach hang", "khách hàng", "khach hang", "customer"]],
  ["customer_tax_code", ["mã số thuế", "ma so thue"]],
  ["customer_address", ["địa chỉ", "dia chi", "address"]],
  ["product_code", ["mã hàng hóa", "ma hang hoa", "mã sản phẩm", "ma san pham"]],
  [
    "product_name_raw",
    [
      "tên hàng hóa",
      "ten hang hoa",
      "tên hàng",
      "ten hang",
      "tên sản phẩm",
      "ten san pham",
      "diễn giải",
      "dien giai",
      "product",
      "name",
    ],
  ],
  ["currency_rate", ["tỷ giá", "ty gia"]],
  ["unit", ["đvt", "dvt", "đơn vị tính", "don vi tinh"]],
  ["quantity", ["số lượng", "so luong", "qty", "quantity", "sl"]],
  ["unit_price", ["đơn giá", "don gia", "unit price"]],
  [
    "sales_amount_before_tax",
    [
      "doanh số bán hàng chưa thuế vnđ",
      "doanh so ban hang chua thue vnd",
      "doanh số bán hàng chưa thuế",
      "doanh so ban hang chua thue",
    ],
  ],
  [
    "vat_output_amount_from_invoice",
    [
      "thuế gtgt đầu ra vnđ",
      "thue gtgt dau ra vnd",
      "thuế gtgt đầu ra",
      "thue gtgt dau ra",
    ],
  ],
  [
    "total_amount",
    [
      "tổng cộng vnđ",
      "tong cong vnd",
      "tổng cộng",
      "tong cong",
      "thành tiền",
      "thanh tien",
      "tổng tiền",
      "tong tien",
      "total",
    ],
  ],
  ["currency", ["đơn vị tiền tệ", "don vi tien te"]],
  ["payment_status", ["trạng thái thanh toán", "trang thai thanh toan"]],
  ["invoice_status", ["trạng thái hóa đơn", "trang thai hoa don"]],
  ["tax_authority_status", ["trạng thái gửi cqt", "trang thai gui cqt"]],
  ["tax_authority_code", ["mã cqt cấp", "ma cqt cap"]],
];

/** Aliases for the secondary "Hình thức thanh toán" column (fallback for `payment_method`). */
const PAYMENT_METHOD_FALLBACK_ALIASES = ["hình thức thanh toán", "hinh thuc thanh toan"];

const STT_HEADER_ALIASES = ["stt", "số tt", "so tt", "thứ tự", "thu tu"];

function normalize(s: unknown): string {
  return s === null || s === undefined ? "" : String(s).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Detect the header row by scanning the first `maxRowsToScan` rows for the
 * canonical "STT" / "Số hóa đơn" / "Ngày lập" / "Tên hàng hóa" / "Số lượng" /
 * "Đơn giá" / "Tổng cộng VNĐ" header tokens. Returns `null` if not found.
 */
function detectHeaderRow(
  sheet: XLSX.WorkSheet,
  maxRowsToScan: number,
  maxC: number
): { row: number; columns: Map<string, keyof ParsedRow>; sttColumn: number | null; paymentMethodFallbackColumn: number | null } | null {
  const requiredAliasGroups: string[][] = [
    STT_HEADER_ALIASES,
    ["số hóa đơn", "so hoa don"],
    ["ngày, tháng, năm lập hóa đơn", "ngay, thang, nam lap hoa don", "ngày lập hóa đơn", "ngay lap hoa don"],
    ["tên hàng hóa", "ten hang hoa"],
    ["số lượng", "so luong"],
    ["đơn giá", "don gia"],
    ["tổng cộng vnđ", "tong cong vnd"],
  ];

  for (let r = 0; r < maxRowsToScan; r++) {
    const cellsByLower: Record<string, number> = {};
    for (let c = 0; c <= maxC; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === null || cell.v === undefined || cell.v === "") continue;
      const norm = normalize(cell.v);
      if (norm) cellsByLower[norm] = c;
    }
    const allFound = requiredAliasGroups.every((aliases) =>
      aliases.some((alias) => alias in cellsByLower)
    );
    if (!allFound) continue;

    // Build column map for THIS row.
    const columns = new Map<string, keyof ParsedRow>();
    let sttColumn: number | null = null;
    let paymentMethodFallbackColumn: number | null = null;

    for (let c = 0; c <= maxC; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === null || cell.v === undefined || cell.v === "") continue;
      const norm = normalize(cell.v);
      if (!norm) continue;

      if (STT_HEADER_ALIASES.includes(norm)) {
        sttColumn = c;
        continue;
      }
      if (PAYMENT_METHOD_FALLBACK_ALIASES.includes(norm)) {
        paymentMethodFallbackColumn = c;
        continue;
      }

      for (const [field, aliases] of HEADER_ALIASES) {
        if (aliases.includes(norm)) {
          // Only set the first column that matches each field.
          const colKey = XLSX.utils.encode_col(c);
          if (!Array.from(columns.values()).includes(field)) {
            columns.set(colKey, field);
          }
          break;
        }
      }
    }

    return { row: r, columns, sttColumn, paymentMethodFallbackColumn };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Cell coercion
// ---------------------------------------------------------------------------

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
  if (value instanceof Date) return null;
  return parseVietnameseNumber(String(value));
}

function toString_(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = typeof value === "string" ? value : String(value);
  const t = s.trim();
  return t === "" ? null : t;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Parse an invoice date cell to ISO-8601 with optional time component.
 *
 * Accepts:
 *   * Date objects (XLSX cellDates: true)
 *   * Excel serial date numbers
 *   * Vietnamese strings: "dd/MM/yyyy HH:mm", "dd/MM/yyyy HH:mm:ss",
 *     "dd/MM/yyyy", or with `-` / `.` separators.
 *
 * Returns `null` if it cannot be parsed.
 */
export function parseInvoiceDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    const yyyy = String(d.y).padStart(4, "0");
    const mm = pad2(d.m);
    const dd = pad2(d.d);
    const hh = pad2(d.H ?? 0);
    const mi = pad2(d.M ?? 0);
    const ss = pad2(Math.floor(d.S ?? 0));
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Vietnamese: dd/MM/yyyy [HH:mm[:ss]] (also `-` and `.` separators).
    const m = trimmed.match(
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
    );
    if (m) {
      const [, dStr, moStr, yStr, hhStr, miStr, ssStr] = m;
      const yyyy = (yStr.length === 2 ? `20${yStr}` : yStr).padStart(4, "0");
      const mm = moStr.padStart(2, "0");
      const dd = dStr.padStart(2, "0");
      if (hhStr !== undefined) {
        const hh = pad2(Number(hhStr));
        const mi = pad2(Number(miStr));
        const ss = pad2(Number(ssStr ?? "0"));
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
      }
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
}

function dateOnly(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function parseSalesExcel(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return emptyResult([]);
  }
  const sheet = wb.Sheets[sheetName];

  // Real exports often have a `!ref` that does not cover the data range
  // (only the title block). Recompute the bounds by scanning cell keys so
  // we can detect the header row and read every data cell.
  let maxR = 0;
  let maxC = 0;
  for (const k of Object.keys(sheet)) {
    if (k[0] === "!") continue;
    const a = XLSX.utils.decode_cell(k);
    if (a.r > maxR) maxR = a.r;
    if (a.c > maxC) maxC = a.c;
  }
  if (maxR === 0 && maxC === 0) {
    return emptyResult([]);
  }
  // Extend !ref so subsequent cell reads (and downstream tools) see the full
  // used range. Always include columns up to AX (50, 0-indexed) — the columns
  // beyond AX (xăng/dầu telemetry) are not consumed by this importer.
  const realMaxR = maxR;
  const realMaxC = Math.min(maxC, /* AX = */ 49);
  sheet["!ref"] = `A1:${XLSX.utils.encode_col(maxC)}${maxR + 1}`;

  // Detect the header row. Scan up to the first 20 rows.
  const detected = detectHeaderRow(sheet, Math.min(20, realMaxR + 1), realMaxC);
  if (!detected) {
    return emptyResult([], ["Không tìm thấy dòng tiêu đề (cần các cột STT, Số hóa đơn, Ngày, Tên hàng hóa, Số lượng, Đơn giá, Tổng cộng VNĐ)."]);
  }

  const headerRowIdx = detected.row;
  const recognized = Array.from(detected.columns.entries()).map(
    ([col, field]) => `${col}=${field}`
  );

  // Build a list of all header cells in this row (for unrecognized list).
  const allHeaders: string[] = [];
  for (let c = 0; c <= realMaxC; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c })];
    if (!cell || cell.v === null || cell.v === undefined || cell.v === "") continue;
    const colKey = XLSX.utils.encode_col(c);
    if (!detected.columns.has(colKey) && c !== detected.sttColumn && c !== detected.paymentMethodFallbackColumn) {
      allHeaders.push(`${colKey}=${String(cell.v).trim()}`);
    }
  }

  const rows: ParsedRow[] = [];

  for (let r = headerRowIdx + 1; r <= realMaxR; r++) {
    const sttCell =
      detected.sttColumn === null
        ? null
        : sheet[XLSX.utils.encode_cell({ r, c: detected.sttColumn })];
    const sttValue = sttCell ? sttCell.v : null;
    let stt: number | null = null;
    if (typeof sttValue === "number" && Number.isFinite(sttValue) && Number.isInteger(sttValue)) {
      stt = sttValue;
    } else if (typeof sttValue === "string" && /^\s*\d+\s*$/.test(sttValue)) {
      stt = Number(sttValue.trim());
    }
    if (stt === null) {
      // Skips: blank rows, title rows, company info rows, and the "Tổng cộng:"
      // summary row (its STT cell contains the literal "Tổng cộng:" text, not
      // a number).
      continue;
    }

    const errors: string[] = [];
    const rawByCol: Record<string, unknown> = {};

    const row: ParsedRow = {
      source_stt: stt,
      source_row_number: r + 1,
      invoice_template_code: null,
      invoice_series: null,
      invoice_no: null,
      invoice_date: null,
      sale_date: null,
      customer_name: null,
      customer_tax_code: null,
      customer_address: null,
      product_code: null,
      product_name_raw: "",
      unit: null,
      quantity: null,
      unit_price: null,
      currency: null,
      currency_rate: null,
      sales_amount_before_tax: null,
      vat_output_amount_from_invoice: null,
      total_amount: null,
      payment_method: null,
      payment_status: null,
      invoice_status: null,
      tax_authority_status: null,
      tax_authority_code: null,
      raw: rawByCol,
      errors,
    };

    for (const [colKey, field] of Array.from(detected.columns.entries())) {
      const c = XLSX.utils.decode_col(colKey);
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      const v = cell ? cell.v : null;
      if (v !== null && v !== undefined && v !== "") {
        rawByCol[colKey] = v instanceof Date ? v.toISOString() : v;
      }
      if (v === null || v === undefined || v === "") continue;

      switch (field) {
        case "invoice_template_code":
          row.invoice_template_code = toString_(v);
          break;
        case "invoice_series":
          row.invoice_series = toString_(v);
          break;
        case "invoice_no":
          row.invoice_no = toString_(v);
          break;
        case "invoice_date": {
          row.invoice_date = parseInvoiceDate(v);
          row.sale_date = dateOnly(row.invoice_date);
          if (!row.invoice_date) {
            errors.push(`Cột "${colKey}" không hợp lệ: ${String(v)}`);
          }
          break;
        }
        case "customer_name":
          row.customer_name = toString_(v);
          break;
        case "customer_tax_code":
          row.customer_tax_code = toString_(v);
          break;
        case "customer_address":
          row.customer_address = toString_(v);
          break;
        case "product_code":
          row.product_code = toString_(v);
          break;
        case "product_name_raw":
          row.product_name_raw = (toString_(v) ?? "").trim();
          break;
        case "unit":
          row.unit = toString_(v);
          break;
        case "currency":
          row.currency = toString_(v);
          break;
        case "currency_rate":
          row.currency_rate = toNumber(v);
          break;
        case "quantity":
          row.quantity = toNumber(v);
          break;
        case "unit_price":
          row.unit_price = toNumber(v);
          break;
        case "sales_amount_before_tax":
          row.sales_amount_before_tax = toNumber(v);
          break;
        case "vat_output_amount_from_invoice":
          row.vat_output_amount_from_invoice = toNumber(v);
          break;
        case "total_amount":
          row.total_amount = toNumber(v);
          break;
        case "payment_method":
          row.payment_method = toString_(v);
          break;
        case "payment_status":
          row.payment_status = toString_(v);
          break;
        case "invoice_status":
          row.invoice_status = toString_(v);
          break;
        case "tax_authority_status":
          row.tax_authority_status = toString_(v);
          break;
        case "tax_authority_code":
          row.tax_authority_code = toString_(v);
          break;
        default:
          // unhandled — ignore
          break;
      }
    }

    // Fallback for payment_method using "Hình thức thanh toán" column.
    if (!row.payment_method && detected.paymentMethodFallbackColumn !== null) {
      const c = detected.paymentMethodFallbackColumn;
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== null && cell.v !== undefined && cell.v !== "") {
        row.payment_method = toString_(cell.v);
        rawByCol[XLSX.utils.encode_col(c)] = cell.v;
      }
    }

    if (row.quantity === null) row.quantity = 1;

    if (!row.product_name_raw) errors.push("Thiếu tên sản phẩm");
    if (!row.invoice_date) errors.push("Thiếu ngày lập hóa đơn");

    if (
      row.total_amount === null &&
      row.unit_price !== null &&
      row.quantity !== null
    ) {
      row.total_amount = +(row.unit_price * row.quantity).toFixed(2);
    }
    if (row.total_amount === null) row.total_amount = 0;

    rows.push(row);
  }

  // Aggregates over well-formed rows only.
  let total = 0;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  const invoiceKeys = new Set<string>();
  for (const r of rows) {
    if (r.errors.length === 0) {
      total += r.total_amount ?? 0;
      if (r.sale_date) {
        if (!periodStart || r.sale_date < periodStart) periodStart = r.sale_date;
        if (!periodEnd || r.sale_date > periodEnd) periodEnd = r.sale_date;
      }
      invoiceKeys.add(
        `${r.invoice_series ?? ""}|${r.invoice_no ?? ""}|${r.tax_authority_code ?? ""}`
      );
    }
  }

  return {
    rows,
    total_rows: rows.length,
    data_row_count: rows.length,
    header_row_number: headerRowIdx + 1,
    recognized_columns: recognized,
    unrecognized_columns: allHeaders,
    total_amount: +total.toFixed(2),
    period_start: periodStart,
    period_end: periodEnd,
    unique_invoice_count: invoiceKeys.size,
    errors: [],
  };
}

function emptyResult(unrecognized: string[], errors: string[] = []): ParseResult {
  return {
    rows: [],
    total_rows: 0,
    data_row_count: 0,
    header_row_number: null,
    recognized_columns: [],
    unrecognized_columns: unrecognized,
    total_amount: 0,
    period_start: null,
    period_end: null,
    unique_invoice_count: 0,
    errors,
  };
}
