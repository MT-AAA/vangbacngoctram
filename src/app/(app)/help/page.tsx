import {
  BookOpen,
  ListChecks,
  LayoutDashboard,
  FileSpreadsheet,
  Receipt,
  ShoppingBag,
  Boxes,
  Tag,
  Calculator,
  History,
  Settings,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";

export const metadata = {
  title: "Hướng dẫn sử dụng — Ngọc Trâm",
};

type Section = {
  id: string;
  title: string;
  icon: typeof BookOpen;
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "tong-quan",
    title: "1. Tổng quan phần mềm",
    icon: BookOpen,
    body: (
      <div className="space-y-2 text-sm text-emerald-900/85">
        <p>
          Phần mềm <strong>Ngọc Trâm</strong> hỗ trợ cửa hàng vàng bạc đá quý
          quản lý dữ liệu kinh doanh và tính thuế GTGT theo phương pháp{" "}
          <em>trực tiếp trên giá trị gia tăng</em>.
        </p>
        <p>Phần mềm giúp bạn:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nhập file Excel báo cáo bán hàng chi tiết.</li>
          <li>Quản lý dữ liệu mua từ khách (mua vàng cũ, đổi trang sức…).</li>
          <li>
            Quản lý tồn kho và phân loại sản phẩm theo nhóm Vàng ta, Vàng tây,
            Bạc.
          </li>
          <li>
            Tính toán chênh lệch giá trị gia tăng và ước tính số thuế GTGT phải
            nộp.
          </li>
          <li>Xuất báo cáo cho kế toán hoặc người phụ trách thuế.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "quy-trinh",
    title: "2. Quy trình sử dụng khuyến nghị",
    icon: ListChecks,
    body: (
      <ol className="list-decimal pl-5 space-y-1 text-sm text-emerald-900/85">
        <li>Nhập file Excel bán hàng của kỳ.</li>
        <li>Kiểm tra kết quả import (đối soát file).</li>
        <li>Xử lý các sản phẩm chưa được phân loại.</li>
        <li>Nhập dữ liệu mua từ khách của kỳ.</li>
        <li>Cập nhật tồn kho và giá mua vào.</li>
        <li>Gắn giá mua vào cho dòng bán còn thiếu giá vốn.</li>
        <li>Kiểm tra chênh lệch giá trị gia tăng.</li>
        <li>Tạo báo cáo thuế kỳ.</li>
        <li>Xuất báo cáo cho kế toán.</li>
      </ol>
    ),
  },
  {
    id: "dashboard",
    title: "3. Hướng dẫn Dashboard Tổng quan",
    icon: LayoutDashboard,
    body: (
      <div className="space-y-2 text-sm text-emerald-900/85">
        <p>
          Trang <strong>Tổng quan</strong> hiển thị các chỉ số quan trọng của
          cửa hàng theo kỳ được chọn:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Tổng bán ra</strong>: tổng tiền bán ra trong kỳ.
          </li>
          <li>
            <strong>Tổng mua vào tương ứng</strong>: tổng giá vốn của các dòng
            bán ra.
          </li>
          <li>
            <strong>Chênh lệch GTGT</strong>: bán ra trừ mua vào tương ứng.
          </li>
          <li>
            <strong>Thuế GTGT phải nộp</strong>: 10% phần chênh lệch dương.
          </li>
          <li>
            <strong>Âm chuyển kỳ sau</strong>: phần chênh lệch âm được chuyển
            sang kỳ tiếp theo trong cùng năm.
          </li>
          <li>
            <strong>Dữ liệu đang tính theo ước tính</strong>: số dòng đang dùng
            giá vốn bình quân (chưa có giá vốn thực).
          </li>
        </ul>
        <p>
          Dùng bộ lọc <em>Ngày / Tháng / Quý / Năm</em> hoặc bộ lọc{" "}
          <em>Tùy chọn</em> để chọn khoảng thời gian tùy ý. Các chỉ số, biểu đồ
          và danh sách giao dịch gần đây sẽ tự động cập nhật theo khoảng đã
          chọn.
        </p>
      </div>
    ),
  },
  {
    id: "import",
    title: "4. Hướng dẫn Nhập Excel",
    icon: FileSpreadsheet,
    body: (
      <div className="space-y-2 text-sm text-emerald-900/85">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Sử dụng đúng <strong>file báo cáo bán hàng chi tiết</strong> xuất
            từ phần mềm bán hàng.
          </li>
          <li>
            Hệ thống cho xem trước (preview) trước khi commit để bạn kiểm tra
            số dòng và tổng tiền.
          </li>
          <li>
            Phần mềm tự nhận diện các dòng trùng theo mã giao dịch. Dòng đã
            tồn tại sẽ được cập nhật theo file mới nhất, không tạo bản sao.
          </li>
          <li>
            Sau khi commit, vào trang <em>Lịch sử import</em> để đối soát số
            dòng nhập, số dòng cập nhật, số dòng lỗi.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "sales",
    title: "5. Hướng dẫn Bán hàng",
    icon: Receipt,
    body: (
      <div className="space-y-2 text-sm text-emerald-900/85">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Danh sách bán hàng được tạo từ file Excel đã nhập, không cần nhập
            tay từng dòng.
          </li>
          <li>
            Một số dòng có thể đang <strong>thiếu giá vốn</strong>. Các dòng
            này phải được bổ sung giá vốn trước khi báo cáo thuế phản ánh
            chính xác.
          </li>
          <li>
            Bạn có thể gắn giá vốn từ tồn kho hoặc nhập tay cho từng dòng.
          </li>
          <li>
            Bộ lọc theo <em>khoảng ngày</em>, <em>phân loại</em> và{" "}
            <em>trạng thái</em> giúp bạn tập trung xử lý các dòng cần lưu ý.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "customer-purchases",
    title: "6. Hướng dẫn Mua từ khách",
    icon: ShoppingBag,
    body: (
      <div className="space-y-2 text-sm text-emerald-900/85">
        <ul className="list-disc pl-5 space-y-1">
          <li>Nhập tay các giao dịch cửa hàng mua vào từ khách.</li>
          <li>
            Đánh dấu <strong>Tính giá vốn</strong> nếu giao dịch này dùng để
            tính giá mua vào cho mục đích thuế.
          </li>
          <li>
            Có thể tùy chọn đưa giao dịch vào tồn kho, để dùng làm nguồn giá
            vốn cho các lần bán sau.
          </li>
          <li>Thiếu phân loại hoặc thiếu số tiền sẽ được nhắc trên dashboard.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "inventory",
    title: "7. Hướng dẫn Tồn kho",
    icon: Boxes,
    body: (
      <div className="space-y-2 text-sm text-emerald-900/85">
        <ul className="list-disc pl-5 space-y-1">
          <li>Tạo, chỉnh sửa, lưu trữ các mặt hàng trong kho.</li>
          <li>
            Mặt hàng có giá vốn rõ ràng có thể được{" "}
            <strong>gắn vào dòng bán</strong> để bổ sung giá mua vào.
          </li>
          <li>
            Giữ chính xác <em>khối lượng</em> và <em>giá vốn</em> của từng mặt
            hàng để đảm bảo tính thuế đúng.
          </li>
          <li>
            Khi giao dịch không có giá vốn cụ thể, hệ thống có thể dùng{" "}
            <em>giá bình quân</em> theo nhóm để ước tính.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "categories",
    title: "8. Hướng dẫn Phân loại sản phẩm",
    icon: Tag,
    body: (
      <div className="space-y-2 text-sm text-emerald-900/85">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Mỗi sản phẩm cần được phân loại vào một trong ba nhóm:{" "}
            <strong>Vàng ta</strong>, <strong>Vàng tây</strong>,{" "}
            <strong>Bạc</strong>.
          </li>
          <li>
            Tên sản phẩm không rõ ràng phải được phân loại thủ công ở trang{" "}
            <em>Cần xử lý → Chưa phân loại</em>.
          </li>
          <li>
            Có thể tạo các <em>quy tắc phân loại theo từ khóa</em> để các lần
            import sau tự nhận diện chính xác hơn.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "tax-reports",
    title: "9. Hướng dẫn Báo cáo thuế",
    icon: Calculator,
    body: (
      <div className="space-y-2 text-sm text-emerald-900/85">
        <p>Phần mềm tính thuế GTGT theo phương pháp trực tiếp trên giá trị gia tăng:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Giá trị gia tăng</strong> = Tổng tiền bán ra − Tổng tiền
            mua vào tương ứng.
          </li>
          <li>
            <strong>Thuế GTGT phải nộp</strong> = Phần giá trị gia tăng dương
            sau khi bù trừ âm chuyển kỳ × 10%.
          </li>
          <li>
            Phần âm chỉ được <em>chuyển kỳ trong cùng năm tài chính</em>.
          </li>
        </ul>
        <p>
          Trang <em>Báo cáo thuế</em> cho phép tạo kỳ thuế (tháng / quý / năm),
          tính lại số liệu và xuất kết quả. Số liệu ước tính cần được kế toán
          hoặc người phụ trách thuế kiểm tra trước khi kê khai.
        </p>
      </div>
    ),
  },
  {
    id: "import-history",
    title: "10. Hướng dẫn Lịch sử import",
    icon: History,
    body: (
      <ul className="list-disc pl-5 space-y-1 text-sm text-emerald-900/85">
        <li>Liệt kê tất cả các file đã được nhập vào hệ thống.</li>
        <li>Hiển thị số dòng nhập mới, số dòng cập nhật, số dòng lỗi.</li>
        <li>So sánh tổng tiền của file với tổng tiền đã ghi nhận thực tế.</li>
        <li>Hữu ích để kiểm tra nhanh khi nghi ngờ dữ liệu bị thiếu.</li>
      </ul>
    ),
  },
  {
    id: "settings",
    title: "11. Hướng dẫn Cài đặt & phân quyền",
    icon: Settings,
    body: (
      <div className="space-y-2 text-sm text-emerald-900/85">
        <p>Trang Cài đặt dành cho quản trị viên gồm các phần:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Cửa hàng</strong>: thông tin cửa hàng, mã số thuế, địa chỉ.
          </li>
          <li>
            <strong>Cài đặt thuế GTGT</strong>: phương pháp và thuế suất mặc
            định áp dụng cho cửa hàng.
          </li>
          <li>
            <strong>Người dùng &amp; phân quyền</strong>: xem danh sách người
            dùng trong cửa hàng và đổi vai trò khi cần.
          </li>
        </ul>
        <p>Các vai trò:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Quản trị viên</strong>: toàn quyền quản lý hệ thống, dữ
            liệu, người dùng và cài đặt.
          </li>
          <li>
            <strong>Nhân viên</strong>: nhập liệu hằng ngày và xem các phần
            được phân quyền.
          </li>
          <li>
            <strong>Người xem</strong>: chỉ xem dữ liệu, không chỉnh sửa.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "faq",
    title: "12. Câu hỏi thường gặp",
    icon: HelpCircle,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <div>
          <p className="font-semibold text-forest">
            Vì sao file đã nhập rồi vẫn có dòng được cập nhật?
          </p>
          <p>
            Hệ thống nhận diện trùng theo mã giao dịch. Khi bạn nhập lại file
            có cùng giao dịch, dòng đã tồn tại sẽ được cập nhật theo file mới
            nhất, không tạo bản sao.
          </p>
        </div>
        <div>
          <p className="font-semibold text-forest">Vì sao thuế chưa tính được?</p>
          <p>
            Thường do còn dòng bán <em>chưa có giá vốn</em> hoặc{" "}
            <em>chưa được phân loại</em>. Hãy xử lý hết các mục trong{" "}
            <em>Cần xử lý</em> trước khi tạo báo cáo thuế.
          </p>
        </div>
        <div>
          <p className="font-semibold text-forest">Vì sao có dữ liệu ước tính?</p>
          <p>
            Khi một số dòng đang dùng giá vốn bình quân vì chưa có giá vốn
            thực. Dữ liệu này được đánh dấu rõ và cần kiểm tra trước khi báo
            cáo.
          </p>
        </div>
        <div>
          <p className="font-semibold text-forest">Khi nào cần phân loại sản phẩm?</p>
          <p>
            Khi tên sản phẩm không đủ rõ để hệ thống tự nhận diện thuộc nhóm
            Vàng ta, Vàng tây hay Bạc. Bạn nên phân loại càng sớm càng tốt vì
            phân loại ảnh hưởng trực tiếp đến giá vốn và thuế.
          </p>
        </div>
        <div>
          <p className="font-semibold text-forest">
            Khi nào dùng giá mua bình quân?
          </p>
          <p>
            Khi không có giá vốn cụ thể cho một dòng bán, hệ thống có thể tính
            theo giá bình quân của nhóm sản phẩm đó. Đây là số ước tính.
          </p>
        </div>
        <div>
          <p className="font-semibold text-forest">Nếu import sai file thì làm gì?</p>
          <p>
            Vào <em>Lịch sử import</em>, kiểm tra file bị sai, đối soát lại với
            file đúng và import lại. Hệ thống sẽ tự cập nhật các dòng theo file
            mới nhất.
          </p>
        </div>
        <div>
          <p className="font-semibold text-forest">
            Vì sao số thuế trên hóa đơn là 0 nhưng app vẫn tính thuế?
          </p>
          <p>
            Vì cửa hàng đang áp dụng thuế GTGT theo phương pháp{" "}
            <em>trực tiếp trên giá trị gia tăng</em>, không phải theo phương
            pháp khấu trừ. Thuế được tính trên chênh lệch giữa giá bán và giá
            mua, không cộng lên hóa đơn.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "tax-note",
    title: "13. Lưu ý quan trọng về dữ liệu thuế",
    icon: AlertTriangle,
    body: (
      <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900">
        <p>
          Phần mềm hỗ trợ tổng hợp dữ liệu và ước tính số thuế theo cấu hình.
          Số liệu cuối cùng cần được kế toán hoặc người phụ trách thuế kiểm
          tra trước khi kê khai.
        </p>
      </div>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 pt-1">
      <div>
        <h1 className="text-[24px] lg:text-[28px] font-semibold tracking-tight text-forest">
          Hướng dẫn sử dụng
        </h1>
        <p className="text-sm text-emerald-900/70 mt-1">
          Tài liệu nhanh giúp chủ cửa hàng và nhân viên sử dụng phần mềm hiệu
          quả.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
        {/* Table of contents */}
        <aside className="card-cream rounded-2xl p-4 lg:sticky lg:top-4 self-start">
          <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-900/55 mb-2">
            Mục lục
          </div>
          <nav>
            <ul className="space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block px-2 py-1.5 rounded-lg text-sm text-emerald-900/85 hover:bg-amber-300/20 hover:text-emerald-950"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <div className="space-y-4 min-w-0">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <section
                key={s.id}
                id={s.id}
                className="card-cream rounded-2xl p-5 lg:p-6 scroll-mt-24"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="icon-rim h-10 w-10 rounded-full flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-amber-700" />
                  </span>
                  <h2 className="text-base lg:text-lg font-semibold text-forest">
                    {s.title}
                  </h2>
                </div>
                {s.body}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
