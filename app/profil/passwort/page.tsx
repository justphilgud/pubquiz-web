import { AuthGuard } from "@/app/components/AuthGuard";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default function PasswortPage() {
  return (
    <AuthGuard allowPasswordChange>
      <ChangePasswordForm />
    </AuthGuard>
  );
}
