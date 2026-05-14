import { LoginForm } from "@/components/auth/login-form";
import { Coins } from "lucide-react";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Coins className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Vàng Bạc Ngọc Trâm
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
