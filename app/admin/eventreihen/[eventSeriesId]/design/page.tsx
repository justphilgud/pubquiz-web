import SharedDesignPage from "@/app/rendering/sharedDesign/SharedDesignPage";
export default async function Page({params}:{params:Promise<{eventSeriesId:string}>}){const p=await params;return <SharedDesignPage target={{kind:"SERIES",id:p.eventSeriesId}}/>;}
