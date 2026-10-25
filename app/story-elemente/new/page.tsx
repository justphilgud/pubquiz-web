import StoryCreationPage from "./StoryCreationPage";
export default function Page(props: { searchParams: Promise<{ questionId?: string; relationship?: string; quizId?: string; sectionId?: string; returnTo?: string }> }) { return <StoryCreationPage {...props} />; }
