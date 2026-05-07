import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { TopBar } from "@/components/app-shell/top-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, store_id, role, full_name, email, removed_at, store:stores(id, name)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-cream rounded-2xl p-8 max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold text-forest">
            Tài khoản chưa được khởi tạo
          </h1>
          <p className="text-sm text-emerald-900/70">
            Vui lòng liên hệ quản trị viên để được gán cửa hàng.
          </p>
        </div>
      </div>
    );
  }

  if (profile.removed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-cream rounded-2xl p-8 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-forest">
            Tài khoản đã được gỡ khỏi cửa hàng
          </h1>
          <p className="text-sm text-emerald-900/75">
            Tài khoản của bạn đã được gỡ khỏi cửa hàng. Vui lòng liên hệ quản
            trị viên.
          </p>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="text-sm underline text-emerald-900/70 hover:text-emerald-900"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!profile.store_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-cream rounded-2xl p-8 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-forest">
            Chưa được gán cửa hàng
          </h1>
          <p className="text-sm text-emerald-900/75">
            Tài khoản <strong>{profile.email}</strong> chưa được liên kết với
            cửa hàng nào. Vui lòng liên hệ quản trị viên.
          </p>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="text-sm underline text-emerald-900/70 hover:text-emerald-900"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Pass profile via React Context-ish prop via cloneElement-like child? We just expose
  // it through a server-data props wrapper rendered by each page that needs it.
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar role={profile.role} />
      <div className="flex flex-1 flex-col min-w-0">
        <MobileNav profile={profile} />
        <TopBar profile={profile} />
        <main className="flex-1 overflow-x-hidden px-3 sm:px-4 lg:px-8 pb-12 pt-4 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
