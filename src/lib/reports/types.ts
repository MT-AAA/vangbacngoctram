/**
 * Shared report metadata. Each report module exports a `REPORT_META` value
 * conforming to `ReportMeta` so the landing page (`/reports`) and tests can
 * iterate over the catalogue without hand-coding the list in two places.
 */

export type ReportSlug =
  | "sales-by-time"
  | "sales-by-category"
  | "avg-selling-price"
  | "value-added-by-category"
  | "vat-payable"
  | "negative-carry-forward"
  | "inventory"
  | "customer-purchases"
  | "unclassified"
  | "import-reconciliation";

export type ReportMeta = {
  slug: ReportSlug;
  title: string;
  description: string;
  /** Shown on the landing card so the user knows roughly what's inside. */
  bullets: string[];
  /** True when the report is range-filterable; shown on the landing card. */
  hasRangeFilter: boolean;
  /** True when the report exposes a category filter / grouping. */
  hasCategoryFilter: boolean;
};

export const REPORT_CATALOGUE: ReadonlyArray<ReportMeta> = [
  {
    slug: "sales-by-time",
    title: "Doanh thu theo thời gian",
    description:
      "Tổng doanh thu, giá vốn, GTGT theo ngày / tháng / quý / năm trong khoảng đã chọn.",
    bullets: ["Bucket day/month/quarter/year", "Số GD và GTGT theo bucket"],
    hasRangeFilter: true,
    hasCategoryFilter: false,
  },
  {
    slug: "sales-by-category",
    title: "Doanh thu theo nhóm sản phẩm",
    description:
      "Tỷ trọng doanh thu của từng nhóm (Vàng ta / Vàng tây / Bạc / chưa phân loại) trong kỳ.",
    bullets: ["Doanh thu, giá vốn, GTGT theo nhóm", "Tỷ trọng %"],
    hasRangeFilter: true,
    hasCategoryFilter: false,
  },
  {
    slug: "avg-selling-price",
    title: "Giá bán bình quân theo nhóm và trọng lượng",
    description:
      "Giá bán bình quân (đơn giá và đồng/chỉ) cho từng nhóm sản phẩm.",
    bullets: ["Đơn giá BQ", "Đồng/chỉ BQ", "Tổng SL và trọng lượng"],
    hasRangeFilter: true,
    hasCategoryFilter: true,
  },
  {
    slug: "value-added-by-category",
    title: "GTGT theo nhóm sản phẩm",
    description:
      "Giá trị gia tăng (= doanh thu − giá vốn) cho từng nhóm trong kỳ.",
    bullets: ["GTGT theo nhóm", "Tỷ suất GTGT", "Đếm dòng ước tính"],
    hasRangeFilter: true,
    hasCategoryFilter: false,
  },
  {
    slug: "vat-payable",
    title: "Thuế GTGT phải nộp theo kỳ",
    description:
      "Báo cáo GTGT trực tiếp: GTGT × thuế suất, không sử dụng VAT đầu ra trên hóa đơn.",
    bullets: [
      "Lấy từ tax_reports đã chốt",
      "GTGT × VAT% sau khi trừ phần âm chuyển kỳ",
      "Phân biệt rõ kỳ có dữ liệu ước tính",
    ],
    hasRangeFilter: true,
    hasCategoryFilter: false,
  },
  {
    slug: "negative-carry-forward",
    title: "GTGT âm chuyển kỳ sau",
    description:
      "Theo dõi phần GTGT âm chuyển vào và chuyển ra của từng kỳ trong cùng năm tài chính.",
    bullets: [
      "carried_in / carried_out theo kỳ",
      "Phần được khấu trừ trong kỳ",
      "GTGT âm cuối năm KHÔNG chuyển sang năm sau",
    ],
    hasRangeFilter: true,
    hasCategoryFilter: false,
  },
  {
    slug: "inventory",
    title: "Tồn kho",
    description:
      "Liệt kê các mặt hàng đang tồn (in_stock), trọng lượng và giá vốn nhập.",
    bullets: [
      "Lọc theo nhóm và trạng thái",
      "Tổng trọng lượng + giá trị tồn",
    ],
    hasRangeFilter: false,
    hasCategoryFilter: true,
  },
  {
    slug: "customer-purchases",
    title: "Báo cáo mua từ khách",
    description:
      "Liệt kê giao dịch mua vàng/bạc từ khách lẻ trong kỳ. Phân biệt rõ phần được tính vào giá mua bình quân.",
    bullets: [
      "Phân loại Tax / Không Tax",
      "Tổng tiền mua, SL, trọng lượng",
    ],
    hasRangeFilter: true,
    hasCategoryFilter: true,
  },
  {
    slug: "unclassified",
    title: "Sản phẩm chưa phân loại",
    description:
      "Liệt kê các dòng bán chưa được gán nhóm sản phẩm (cần xử lý).",
    bullets: ["Theo kỳ", "Liên kết tới /issues/unclassified"],
    hasRangeFilter: true,
    hasCategoryFilter: false,
  },
  {
    slug: "import-reconciliation",
    title: "Đối soát file nhập",
    description:
      "So sánh tổng dòng / tổng tiền của file Excel nhập so với dữ liệu thực tế đã ghi nhận.",
    bullets: [
      "Expected vs Imported",
      "Delta theo từng file",
    ],
    hasRangeFilter: true,
    hasCategoryFilter: false,
  },
];
