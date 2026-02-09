import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { registerBusiness } from "@/api/user";
import { Building2 } from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (businessName.trim().length < 2) {
      alert("Please enter a valid business name");
      return;
    }

    setIsLoading(true);
    
    try {
      const token = await registerBusiness({
        businessName,
        fullName,
        email,
        password,
      });
      localStorage.setItem("sb_access_token", token);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      
      // Check if it's a success message (account created, needs email confirmation)
      if (message.includes("Account created successfully")) {
        alert(message);
        navigate("/", { replace: true }); // Redirect to login page
      } else {
        alert(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>
        <div className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold">
            Register Your Business
          </CardTitle>
          <CardDescription>
            Create your business account to start managing cash flow
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              type="text"
              placeholder="DDD Enterprise"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              This is your company or organization name
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Admin Account
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-full-name">Your Full Name</Label>
            <Input
              id="register-full-name"
              type="text"
              placeholder="Juan Dela Cruz"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-email">Email</Label>
            <Input
              id="register-email"
              type="email"
              placeholder="owner@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-password">Password</Label>
            <Input
              id="register-password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating Business..." : "Create Business Account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/" className="font-medium text-foreground hover:underline">
            Sign in
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}