import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <img
            src="/logo.png"
            alt="Phần Mềm Quản Lý Vàng Bạc"
            className="h-16 w-16 rounded-full object-contain shadow-md"
          />
          <h1 className="text-2xl font-bold tracking-tight">
            Phần Mềm Quản Lý Vàng Bạc
          </h1>
          <p className="text-sm text-muted-foreground">
            Hệ thống quản lý cửa hàng vàng bạc đá quý
          </p>
        </div>
        <LoginForm next={searchParams.next} />
      </div>
    </div>
  );
}
