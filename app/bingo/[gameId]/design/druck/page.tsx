import PrintDesignPage from '../../../preparation/PrintDesignPage';
export default async function Page({params,searchParams}:{params:Promise<{gameId:string}>;searchParams:Promise<{returnTo?:string}>}){const {gameId}=await params;return <PrintDesignPage target={{kind:'BINGO',id:gameId}} returnTo={(await searchParams).returnTo}/>;}
