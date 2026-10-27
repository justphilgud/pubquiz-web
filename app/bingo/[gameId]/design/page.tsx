import SharedDesignPage from "@/app/rendering/sharedDesign/SharedDesignPage";
export default async function Page({params}:{params:Promise<{gameId:string}>}){const p=await params;return <SharedDesignPage target={{kind:"BINGO",id:p.gameId}}/>;}
