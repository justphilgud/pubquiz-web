import QuizManagementPage from "./QuizManagementPage";
export const metadata = { title: "Alle Quizze" };
export default function Page(props: { searchParams: Promise<{ tab?: string; eventreiheId?: string; editQuizId?: string }> }) { return <QuizManagementPage {...props} />; }
