import Link from "next/link";
import { Cog6ToothIcon, DocumentArrowDownIcon, MegaphoneIcon, PaintBrushIcon, PencilSquareIcon, PlayIcon, UsersIcon } from "@heroicons/react/24/outline";
const actions={
 prepare:{icon:PencilSquareIcon,style:"bg-slate-900 p-2 text-white"},
 moderation:{icon:MegaphoneIcon,style:"border border-violet-300 bg-violet-50 p-2 text-violet-700"},
 presentation:{icon:PlayIcon,style:"border border-cyan-300 bg-cyan-50 p-2 text-cyan-700"},
 settings:{icon:Cog6ToothIcon,style:"border border-slate-200 bg-white p-2 text-slate-600"},
 teams:{icon:UsersIcon,style:"border border-emerald-300 bg-emerald-50 p-2 text-emerald-700"},
 cards:{icon:DocumentArrowDownIcon,style:"border border-slate-200 bg-white p-2 text-slate-600"},
 print:{icon:PaintBrushIcon,style:"border border-slate-200 bg-white p-2 text-slate-600"},
} as const;
/** The existing Quiz action appearance, shared without changing its default dimensions or tones. */
export function EventActionLink({kind,href,label,title=label,newWindow=false}:{kind:keyof typeof actions;href:string;label:string;title?:string;newWindow?:boolean}){
 const {icon:Icon,style}=actions[kind];
 return <Link {...(newWindow?{target:"_blank",rel:"noreferrer"}:{})} title={title} href={href} aria-label={label} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl ${style}`}><Icon aria-hidden="true" className="h-5 w-5"/></Link>;
}
