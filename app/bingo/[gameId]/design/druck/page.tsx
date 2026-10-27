import PrintDesignPage from '../../../preparation/PrintDesignPage';
export default async function Page({params}:{params:Promise<{gameId:string}>}){const {gameId}=await params;return <PrintDesignPage target={{kind:'BINGO',id:gameId}}/>;}
