import SharedDesignPage from "@/app/rendering/sharedDesign/SharedDesignPage";
export default async function Page({params}:{params:Promise<{quizId:string}>}){const p=await params;return <SharedDesignPage target={{kind:"QUIZ",id:p.quizId}}/>;}
