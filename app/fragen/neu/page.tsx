import { redirect } from "next/navigation";

export default function LegacyNewQuestionPage() {
  redirect("/content/questions/new");
}
