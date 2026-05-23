import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { portalApi, savePortalToken } from "@/lib/portalApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function PortalLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await portalApi.requestOtp(email);
      setStep("otp");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await portalApi.verifyOtp(email, otp);
      savePortalToken(token);
      navigate("/portal");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-sm bg-slate-900 border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-white text-2xl">Client Portal</CardTitle>
          <CardDescription className="text-slate-400">
            {step === "email"
              ? "Enter your email to receive a one-time password"
              : `Enter the 6-digit code sent to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email address</Label>
                <Input
                  id="email" type="email" value={email} autoFocus
                  onChange={e => setEmail(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                  placeholder="you@company.com"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send OTP
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-slate-300">One-time password</Label>
                <Input
                  id="otp" type="text" value={otp} autoFocus maxLength={6}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="bg-slate-800 border-slate-600 text-white text-center text-2xl tracking-widest"
                  placeholder="000000"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sign in
              </Button>
              <Button type="button" variant="ghost" className="w-full text-slate-400"
                onClick={() => { setStep("email"); setOtp(""); setError(null); }}>
                Use a different email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
