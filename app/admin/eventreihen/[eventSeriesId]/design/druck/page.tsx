import PrintDesignPage from '@/app/bingo/preparation/PrintDesignPage';
export default async function Page({params}:{params:Promise<{eventSeriesId:string}>}){const {eventSeriesId}=await params;return <PrintDesignPage target={{kind:'SERIES',id:eventSeriesId}}/>;}
