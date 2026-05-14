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

const ADMIN_LOGIN_ID = "admin";
const ADMIN_EMAIL = "miton.tran.95@gmail.com";

function resolveLoginEmail(loginId: string) {
  const normalized = loginId.trim();
  if (normalized.toLowerCase() === ADMIN_LOGIN_ID) return ADMIN_EMAIL;
  return normalized;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: resolveLoginEmail(loginId),
        password,
      });
      if (error) {
        toast.error("Đăng nhập thất bại", {
          description: "Sai ID hoặc mật khẩu.",
        });
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
        <CardTitle>Đăng nhập</CardTitle>
        <CardDescription>
          Admin đăng nhập bằng ID <strong>Admin</strong>. Người dùng khác đăng nhập bằng tài khoản được admin tạo.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login_id">ID đăng nhập</Label>
            <Input
              id="login_id"
              type="text"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="Admin"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Đăng nhập
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
