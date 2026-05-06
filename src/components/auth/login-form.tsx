"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "signin" | "signup";

export function LoginForm({
  initialMode = "signin",
  next,
}: {
  initialMode?: Mode;
  next?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [storeName, setStoreName] = useState("Cửa hàng vàng bạc");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              store_name: storeName,
            },
          },
        });
        if (error) {
          toast.error("Đăng ký thất bại", { description: error.message });
          return;
        }
        if (data.session) {
          toast.success("Tạo tài khoản thành công, đang đăng nhập...");
          router.push(next ?? "/dashboard");
          router.refresh();
          return;
        }
        toast.success("Tạo tài khoản thành công", {
          description:
            "Vui lòng kiểm tra email để xác nhận tài khoản, sau đó đăng nhập bằng mật khẩu vừa tạo.",
        });
        setMode("signin");
        setPassword("");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error("Đăng nhập thất bại", { description: error.message });
        return;
      }
      router.push(next ?? "/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isSignup ? "Tạo tài khoản" : "Đăng nhập"}</CardTitle>
        <CardDescription>
          {isSignup
            ? "Tài khoản đầu tiên sẽ tự động trở thành quản trị viên cửa hàng."
            : "Đăng nhập bằng email và mật khẩu của bạn."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {isSignup && (
            <>
              <div className="space-y-2">
                <Label htmlFor="full_name">Họ và tên</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store_name">Tên cửa hàng</Label>
                <Input
                  id="store_name"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Vàng bạc Ngọc Trâm"
                  required
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@cuahang.vn"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSignup ? "Tạo tài khoản" : "Đăng nhập"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(isSignup ? "signin" : "signup")}
          >
            {isSignup
              ? "Đã có tài khoản? Đăng nhập"
              : "Chưa có tài khoản? Đăng ký mới"}
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}
