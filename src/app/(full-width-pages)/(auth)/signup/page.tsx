import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Somali Dreams - Sign Up",
  description: "Sign up for Somali Dreams",
};

export default function SignUp() {
  return <SignUpForm />;
}
