import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const companyLogo = "/mcn-logo.png?v=999";

export default function AuthClean() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, forgotPassword, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      toast({ title: "Login Alert", description: "Enter email/employee code and password." });
      return;
    }
    setLoading(true);
    const { error } = await signIn(identifier.trim(), password);
    setLoading(false);
    if (error) toast({ title: "Login Alert", description: error.message });
  };

  const handleForgot = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetEmail.trim()) {
      toast({ title: "Reset Password", description: "Enter your registered official email." });
      return;
    }
    setLoading(true);
    const { error } = await forgotPassword(resetEmail.trim());
    setLoading(false);
    if (error) {
      toast({ title: "Reset Password", description: error.message });
      return;
    }
    toast({ title: "Reset Link Sent", description: "If this email is registered, a reset link has been sent." });
    setShowForgot(false);
  };

  return (
    <div className="min-h-screen bg-[#f3f6fb]">
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(79,70,229,0.12),transparent_35%)]" />
        <div className="relative w-full max-w-md">
          <Card className="overflow-hidden rounded-[2rem] border border-white bg-white/95 shadow-2xl shadow-slate-200/80 backdrop-blur">
            <CardHeader className="space-y-5 px-7 pb-4 pt-8 text-center">
              <div className="mx-auto w-full max-w-[315px] rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-xl shadow-slate-950/10">
                <div className="flex h-[78px] items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-200 px-3 py-2 shadow-lg">
                  <img src={companyLogo} alt="MAS Callnet" className="block h-14 w-full max-w-[190px] object-contain drop-shadow-md" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">Welcome Back</CardTitle>
                <CardDescription className="mt-2 text-sm text-slate-500">Login with official email or employee code</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-7 pb-7">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-sm font-medium text-slate-700">Email or Employee Code</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="name@company.com or EMP001" className="h-12 rounded-2xl border-slate-200 bg-white pl-11" disabled={loading} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" className="h-12 rounded-2xl border-slate-200 bg-white pl-11 pr-12" disabled={loading} />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-xl p-0" onClick={() => setShowPassword((value) => !value)} tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />Secure access</div>
                  <Button type="button" variant="link" className="h-auto p-0 text-xs font-semibold text-sky-700" onClick={() => { setShowForgot(true); setResetEmail(identifier.includes("@") ? identifier : ""); }}>Forgot password?</Button>
                </div>

                <Button type="submit" className="h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold text-white hover:bg-slate-800" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Please wait...</> : <>Sign In<ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              </form>

              {showForgot && (
                <form onSubmit={handleForgot} className="mt-5 space-y-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Reset Password</p>
                    <p className="mt-1 text-xs text-slate-500">Enter your registered official email.</p>
                  </div>
                  <Input type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="official.email@company.com" className="h-11 rounded-2xl border-sky-100 bg-white" disabled={loading} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="submit" className="rounded-2xl bg-slate-950 text-white" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Link"}</Button>
                    <Button type="button" variant="outline" className="rounded-2xl border-slate-200" onClick={() => setShowForgot(false)}>Cancel</Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
