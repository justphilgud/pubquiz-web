import type {Metadata} from 'next';
import {requireActor} from '@/app/lib/permissions';
import Gallery from './Gallery';
export const metadata:Metadata={title:'Gudi · 75 Bingo-Szenen (intern)',robots:{index:false,follow:false}};
export default async function Page(){await requireActor();return <Gallery/>;}
