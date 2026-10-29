import type { Metadata } from 'next';
import Link from 'next/link';
import './style.css';
export const metadata:Metadata={title:'Trust Desk · Revent Lab',description:'Agents draft. Code decides.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><div className="shell"><aside><Link className="brand" href="/">T<span>Trust Desk<small>REVENT LAB / OPERATIONS</small></span></Link><div className="workspace">SHARED PLATFORM <span className="pulse"/></div><nav><Link href="/">▤ &nbsp; Approvals inbox</Link><Link href="/quality">◈ &nbsp; Quality & trust</Link><Link href="/audit">≋ &nbsp; Audit trail</Link></nav><div className="sidebar-note"><span className="eyebrow">THE OPERATING PRINCIPLE</span><h3>Agents draft.<br/>Code decides.</h3><p>Every decision has evidence.<br/>Every send has a record.</p><span className="badge">LOCAL CHALLENGE BUILD</span></div></aside><main>{children}</main></div></body></html>}
