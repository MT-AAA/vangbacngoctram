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
  title: "Hướng dẫn sử dụng — Phần Mềm Quản Lý Vàng Bạc",
  description:
    "Hướng dẫn sử dụng Phần Mềm Quản Lý Vàng Bạc: nhập Excel, bán hàng, mua từ khách, tồn kho và báo cáo thuế.",
};

type Section = {
  id: string;
  title: string;
  icon: typeof BookOpen;
  body: React.ReactNode;
};

function ExampleBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50/80 p-3 text-sm text-amber-950">
      <div className="mb-1 font-semibold text-forest">Ví dụ</div>
      {children}
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-950">
      {children}
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "tong-quan",
    title: "1. Tổng quan phần mềm",
    icon: BookOpen,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <p>
          <strong>Phần Mềm Quản Lý Vàng Bạc</strong> dùng để quản lý bán hàng, mua từ
          khách, tồn kho và hỗ trợ tính thuế GTGT theo phương pháp trực tiếp
          trên giá trị gia tăng.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Nhập file Excel bán hàng.</li>
          <li>Ghi nhận giao dịch mua vàng/bạc từ khách.</li>
          <li>Quản lý tồn kho để gắn giá vốn cho giao dịch bán.</li>
          <li>Theo dõi dòng thiếu giá vốn, chưa phân loại, hóa đơn trùng.</li>
          <li>Tổng hợp số liệu phục vụ báo cáo thuế.</li>
        </ul>
        <NoteBox>
          Nguyên tắc chính: muốn tính thuế đúng thì mỗi dòng bán cần có
          <strong> phân loại sản phẩm</strong> và <strong>giá mua vào/giá vốn</strong>.
        </NoteBox>
      </div>
    ),
  },
  {
    id: "quy-trinh",
    title: "2. Quy trình sử dụng khuyến nghị",
    icon: ListChecks,
    body: (
      <div className="space-y-4 text-sm text-emerald-900/85">
        <p>
          Quy trình dưới đây giúp dữ liệu bán hàng, mua vào, tồn kho và thuế đi
          đúng thứ tự, hạn chế thiếu giá vốn hoặc tính sai thuế.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              step: "01",
              title: "Nhập Excel bán hàng",
              desc: "Vào Nhập Excel, chọn file bán hàng chi tiết và kiểm tra preview trước khi ghi dữ liệu.",
              result: "Dữ liệu xuất hiện ở trang Bán hàng.",
            },
            {
              step: "02",
              title: "Đối soát sau import",
              desc: "Kiểm tra tổng tiền, số dòng, hóa đơn trùng và các dòng chưa phân loại.",
              result: "Biết dòng nào cần xử lý trước khi tính thuế.",
            },
            {
              step: "03",
              title: "Nhập Mua từ khách",
              desc: "Nhập các giao dịch mua vàng/bạc từ khách trong kỳ, điền trọng lượng tính thuế và đơn giá mua.",
              result: "Có nguồn giá mua vào để tính giá vốn.",
            },
            {
              step: "04",
              title: "Đưa hàng vào Tồn kho",
              desc: "Nếu món mua từ khách sẽ bán lại, tích Đưa vào hàng tồn kho để tạo mặt hàng tồn.",
              result: "Có hàng tồn để gắn với giao dịch bán sau này.",
            },
            {
              step: "05",
              title: "Xử lý Thiếu giá vốn",
              desc: "Vào Cần xử lý → Thiếu giá vốn, ưu tiên Gắn tồn kho cho từng dòng hoặc hàng loạt.",
              result: "Dòng bán có giá vốn và tồn kho được trừ đúng.",
            },
            {
              step: "06",
              title: "Kiểm tra Dashboard & Thuế",
              desc: "Xem Dashboard, kiểm tra GTGT, dòng ước tính, rồi tạo hoặc tính lại báo cáo thuế.",
              result: "Số liệu sẵn sàng để kế toán kiểm tra.",
            },
          ].map((item, index, arr) => (
            <div key={item.step} className="relative rounded-2xl border border-amber-300/60 bg-white/70 p-4 shadow-sm">
              {index < arr.length - 1 ? (
                <div className="absolute -right-3 top-1/2 hidden h-px w-3 bg-amber-300 xl:block" />
              ) : null}
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">
                  {item.step}
                </span>
                <h3 className="font-semibold text-forest">{item.title}</h3>
              </div>
              <p>{item.desc}</p>
              <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <strong>Kết quả:</strong> {item.result}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">
          <p className="font-semibold">Lưu ý quan trọng</p>
          <p className="mt-1">
            Khi xử lý thiếu giá vốn, cách chuẩn nhất là <strong>Gắn tồn kho</strong>.
            Chỉ dùng <strong>Nhập giá vốn thủ công</strong> khi có lý do đặc biệt,
            vì giá vốn tự nhập không trừ vào tồn kho.
          </p>
        </div>
        <ExampleBox>
          <p>
            Ví dụ tháng 05: nhập file bán hàng → nhập 3 giao dịch mua vàng cũ
            từ khách → đưa các món sẽ bán lại vào tồn kho → gắn tồn kho cho các
            hóa đơn đang thiếu giá vốn → kiểm tra Dashboard và báo cáo thuế.
          </p>
        </ExampleBox>
      </div>
    ),
  },
  {
    id: "dashboard",
    title: "3. Dashboard Tổng quan",
    icon: LayoutDashboard,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <p>Dashboard hiển thị nhanh tình hình bán hàng, mua vào, tồn kho và thuế.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Tổng bán ra</strong>: tổng tiền bán hàng trong kỳ lọc.</li>
          <li><strong>Tổng mua vào</strong>: giá vốn tương ứng với hàng đã bán.</li>
          <li><strong>Chênh lệch GTGT</strong>: bán ra trừ mua vào.</li>
          <li><strong>Thuế GTGT phải nộp</strong>: tính trên phần chênh lệch dương.</li>
          <li><strong>Tổng quan hàng hóa</strong>: theo Vàng ta, Vàng tây, Bạc gồm Tổng khối lượng, Tổng tiền, Đơn giá bình quân.</li>
        </ul>
        <ExampleBox>
          <p>
            Vàng ta tồn kho 106 chỉ, tổng tiền 1.745.470.200đ thì đơn giá bình
            quân khoảng 16.466.700đ/chỉ.
          </p>
        </ExampleBox>
      </div>
    ),
  },
  {
    id: "import",
    title: "4. Nhập Excel bán hàng",
    icon: FileSpreadsheet,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <p>Trang này dùng để đưa file báo cáo bán hàng từ phần mềm ngoài vào hệ thống.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Chọn đúng file Excel bán hàng chi tiết.</li>
          <li>Xem trước dữ liệu trước khi lưu vào hệ thống.</li>
          <li>Sau khi lưu, dữ liệu xuất hiện ở trang Bán hàng.</li>
          <li>Hệ thống tự nhận diện giao dịch trùng để tránh nhân đôi dữ liệu.</li>
        </ul>
        <NoteBox>
          Nếu nhập sai file, vào <strong>Lịch sử nhập gần đây</strong> để kiểm tra và dùng
          chức năng xóa dữ liệu của file đó nếu cần hủy.
        </NoteBox>
      </div>
    ),
  },
  {
    id: "sales",
    title: "5. Bán hàng và giá vốn",
    icon: Receipt,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <p>Trang Bán hàng lấy dữ liệu từ file Excel đã import.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Bán ra</strong>: số tiền khách trả khi mua hàng.</li>
          <li><strong>Mua vào</strong>: giá vốn của món hàng đã bán.</li>
          <li><strong>GTGT</strong>: Bán ra − Mua vào.</li>
          <li><strong>Thiếu giá vốn</strong>: dòng bán chưa có giá mua vào để tính thuế.</li>
        </ul>
        <NoteBox>
          Khi gặp dòng <strong>Thiếu giá vốn</strong>, bấm <strong>Xử lý</strong> để
          gắn với mặt hàng tồn kho hoặc nhập/chỉnh giá vốn phù hợp.
        </NoteBox>
        <div className="rounded-xl border border-emerald-200 bg-white/70 p-3">
          <p className="font-semibold text-forest">Cách hệ thống tính giá vốn khi gắn tồn kho</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Hệ thống chia tồn kho bình quân thành 3 rổ: <strong>Vàng ta</strong>, <strong>Vàng tây</strong> và <strong>Bạc</strong>.</li>
            <li>Khi gắn một giao dịch bán với tồn kho, hệ thống lấy <strong>giá vốn bình quân của rổ tại đúng ngày bán</strong>.</li>
            <li>Giá bình quân chỉ tính tồn đầu kỳ và các giao dịch mua từ khách có ngày <strong>trước hoặc bằng ngày bán</strong>.</li>
            <li>Nếu sau này nhập thêm mua từ khách với ngày mua trước/ngày bán, các giao dịch bán bị ảnh hưởng sẽ được tự tính lại.</li>
            <li>Nếu mua từ khách có ngày sau ngày bán, giao dịch bán trước đó không bị thay đổi.</li>
            <li>Ứng dụng chỉ hỗ trợ phần doanh thu bán ra, mua vào và giá vốn; chi phí, hóa đơn chứng từ và quyết toán đầy đủ do kế toán xử lý.</li>
          </ul>
        </div>
        <ExampleBox>
          <p>
            Bán nhẫn 2 chỉ giá 36.000.000đ. Nếu gắn với tồn kho có giá vốn
            16.500.000đ/chỉ thì mua vào = 33.000.000đ, GTGT = 3.000.000đ.
          </p>
        </ExampleBox>
      </div>
    ),
  },
  {
    id: "customer-purchases",
    title: "6. Mua từ khách",
    icon: ShoppingBag,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <p>Trang này dùng để nhập các giao dịch cửa hàng mua vàng/bạc từ khách.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Ngày mua</strong>: ngày phát sinh giao dịch.</li>
          <li><strong>Tên hàng</strong>: mô tả món mua, ví dụ “Nhẫn vàng 9999”.</li>
          <li><strong>Phân loại</strong>: Vàng ta, Vàng tây hoặc Bạc.</li>
          <li><strong>Trọng lượng tính thuế</strong>: số chỉ dùng để tính tiền và giá bình quân.</li>
          <li><strong>Đơn giá mua</strong>: giá mua trên 1 chỉ.</li>
          <li><strong>Thành tiền</strong>: tự tính = trọng lượng tính thuế × đơn giá mua.</li>
        </ul>
        <NoteBox>
          <p className="font-semibold">Hai lựa chọn quan trọng:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li><strong>Tính vào giá mua bình quân</strong>: giao dịch được dùng làm nguồn giá vốn.</li>
            <li><strong>Đưa vào hàng tồn kho</strong>: tạo thêm mặt hàng trong Tồn kho để bán/gắn giá vốn sau này.</li>
          </ul>
        </NoteBox>
        <ExampleBox>
          <p>
            Mua của khách 6 chỉ vàng ta, đơn giá 17.000.000đ/chỉ. Thành tiền =
            6 × 17.000.000 = 102.000.000đ. Nếu món này sẽ bán lại, nên tích cả
            <strong> Tính vào giá mua bình quân</strong> và <strong>Đưa vào hàng tồn kho</strong>.
          </p>
        </ExampleBox>
      </div>
    ),
  },
  {
    id: "inventory",
    title: "7. Tồn kho",
    icon: Boxes,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <p>Tồn kho quản lý các món hàng có thể dùng để bán và gắn giá vốn.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>SKU</strong>: mã hàng, có thể để trống nếu chưa có.</li>
          <li><strong>Tên hàng</strong>: tên/mô tả món hàng.</li>
          <li><strong>Nhóm</strong>: Vàng ta, Vàng tây hoặc Bạc.</li>
          <li><strong>SL món ban đầu</strong>: số món lúc nhập kho.</li>
          <li><strong>SL món hiện có</strong>: số món còn lại.</li>
          <li><strong>Trọng lượng ban đầu</strong>: tổng trọng lượng lúc nhập.</li>
          <li><strong>Trọng lượng hiện có</strong>: trọng lượng còn lại sau khi bán một phần.</li>
          <li><strong>Giá mua vào</strong>: tổng giá vốn của món hàng.</li>
          <li><strong>Giá mua ĐV</strong>: giá vốn trên 1 chỉ.</li>
          <li><strong>Giá bán</strong>: giá dự kiến bán ra, nếu có.</li>
        </ul>
        <ExampleBox>
          <p>
            Nhập 1 dây chuyền 5 chỉ, giá mua 82.500.000đ: SL ban đầu = 1, SL
            hiện có = 1, trọng lượng ban đầu = 5, trọng lượng hiện có = 5, giá
            mua ĐV = 16.500.000đ/chỉ.
          </p>
        </ExampleBox>
        <NoteBox>
          Có thể <strong>chỉnh sửa</strong>, <strong>lưu trữ</strong> hoặc <strong>xóa</strong>.
          Chỉ nên xóa khi nhập sai và mặt hàng chưa gắn với giao dịch bán.
        </NoteBox>
      </div>
    ),
  },
  {
    id: "categories",
    title: "8. Phân loại sản phẩm",
    icon: Tag,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <p>Phân loại giúp hệ thống tính giá bình quân và báo cáo đúng nhóm hàng.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Vàng ta</strong>: vàng 9999, 24K, vàng nhẫn trơn...</li>
          <li><strong>Vàng tây</strong>: 10K, 14K, 18K, trang sức vàng tây...</li>
          <li><strong>Bạc</strong>: trang sức bạc, bạc nguyên liệu...</li>
        </ul>
        <ExampleBox>
          <p>
            “Nhẫn 9999 2 chỉ” nên phân loại Vàng ta. “Lắc tay 18K” nên phân
            loại Vàng tây. “Dây bạc Ý” nên phân loại Bạc.
          </p>
        </ExampleBox>
      </div>
    ),
  },
  {
    id: "tax-reports",
    title: "9. Báo cáo thuế",
    icon: Calculator,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <p>Phần mềm hỗ trợ tính thuế GTGT theo phương pháp trực tiếp.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Giá trị gia tăng</strong> = Tổng bán ra − Tổng mua vào.</li>
          <li><strong>Thuế GTGT</strong> = phần giá trị gia tăng dương × thuế suất cấu hình.</li>
          <li>Dòng thiếu giá vốn hoặc chưa phân loại có thể làm báo cáo chưa chính xác.</li>
        </ul>
        <ExampleBox>
          <p>
            Tổng bán ra 500.000.000đ, tổng mua vào 460.000.000đ, GTGT =
            40.000.000đ. Nếu thuế suất 10% thì thuế tạm tính = 4.000.000đ.
          </p>
        </ExampleBox>
      </div>
    ),
  },
  {
    id: "import-history",
    title: "10. Lịch sử import",
    icon: History,
    body: (
      <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-900/85">
        <li>Xem danh sách file đã nhập.</li>
        <li>Kiểm tra số dòng thêm mới, cập nhật, lỗi.</li>
        <li>Đối chiếu tổng tiền trong file với dữ liệu đã ghi nhận.</li>
        <li>Rollback file nhập sai nếu cần hủy dữ liệu import.</li>
      </ul>
    ),
  },
  {
    id: "settings",
    title: "11. Cài đặt & phân quyền",
    icon: Settings,
    body: (
      <div className="space-y-3 text-sm text-emerald-900/85">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Cửa hàng</strong>: tên, địa chỉ, mã số thuế.</li>
          <li><strong>Thuế GTGT</strong>: cấu hình phương pháp và thuế suất.</li>
          <li><strong>Người dùng</strong>: quản lý vai trò admin, nhân viên, người xem.</li>
        </ul>
        <NoteBox>
          Chỉ admin nên được quyền xóa dữ liệu, lưu trữ tồn kho và quản lý người dùng.
        </NoteBox>
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
          <p className="font-semibold text-forest">Tích cả “Tính vào giá mua bình quân” và “Đưa vào tồn kho” có bị tính 2 lần không?</p>
          <p>Không. Một mục dùng cho giá vốn bình quân, một mục tạo hàng tồn để quản lý/bán lại.</p>
        </div>
        <div>
          <p className="font-semibold text-forest">Nếu chỉ tích “Tính vào giá mua bình quân” thì sao?</p>
          <p>Giao dịch chỉ dùng làm nguồn giá vốn, không tạo mặt hàng tồn kho để bán/gắn sau này.</p>
        </div>
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">
          <p className="font-semibold">Dòng bán thiếu giá vốn xử lý thế nào?</p>
          <p className="mt-1">
            Cách chuẩn nhất là <strong>Gắn tồn kho</strong> để hệ thống vừa lấy
            đúng giá vốn, vừa trừ đúng số lượng/trọng lượng tồn kho và lưu dấu
            vết món hàng bán ra lấy từ đâu.
          </p>
          <p className="mt-1">
            <strong>Nhập giá vốn thủ công</strong> chỉ nên dùng khi chưa có dữ
            liệu tồn kho cũ, có chứng từ giá vốn riêng hoặc cần xử lý tạm. Giá
            vốn tự nhập chỉ dùng để tính thuế cho hóa đơn đó và
            <strong> không trừ vào tồn kho</strong>.
          </p>
        </div>
        <div>
          <p className="font-semibold text-forest">Khi nào nên xóa tồn kho?</p>
          <p>Chỉ xóa khi nhập sai và mặt hàng chưa gắn với giao dịch bán. Nếu không chắc, nên lưu trữ.</p>
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
        Phần mềm hỗ trợ tổng hợp và ước tính số liệu. Trước khi kê khai chính
        thức, kế toán hoặc người phụ trách thuế cần kiểm tra lại dữ liệu bán
        hàng, mua vào, giá vốn và phân loại sản phẩm.
      </div>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 pt-1">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-forest lg:text-[28px]">
          Hướng dẫn sử dụng
        </h1>
        <p className="mt-1 text-sm text-emerald-900/70">
          Tài liệu hướng dẫn nhập liệu, xử lý giá vốn, quản lý tồn kho và báo
          cáo thuế cho cửa hàng.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="card-cream self-start rounded-2xl p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-emerald-900/55">
            Mục lục
          </div>
          <nav>
            <ul className="space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block rounded-lg px-2 py-1.5 text-sm text-emerald-900/85 hover:bg-amber-300/20 hover:text-emerald-950"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <section
                key={s.id}
                id={s.id}
                className="card-cream scroll-mt-24 rounded-2xl p-5 lg:p-6"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="icon-rim flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <Icon className="h-4 w-4 text-amber-700" />
                  </span>
                  <h2 className="text-base font-semibold text-forest lg:text-lg">
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
