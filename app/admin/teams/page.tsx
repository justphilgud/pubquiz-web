import TeamManagementPage from "./TeamManagementPage";
export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <TeamManagementPage {...props} />; }
