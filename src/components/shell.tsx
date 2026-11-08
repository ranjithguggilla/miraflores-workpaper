import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Activity, Sparkles, FileSpreadsheet, FolderOpen, Users, History, GitCompare, FlaskConical, Send, ShieldAlert, ArrowRightLeft, Building2, IdCard, Briefcase, LineChart, Store, Home, Share2, Receipt, MapPin, Calculator, Lock } from "lucide-react";
import { db, schema as s } from "@/db";
import { getActor } from "@/lib/session";
import { switchActor } from "@/lib/actions";
import { AREAS } from "@/lib/areas";
import { changesSince, openIssues } from "@/lib/state";
import { roleLabel } from "@/lib/labels";
import { Avatar, Badge } from "./ui";
import { ActionForm, RailToggle, SearchBox, ThemeToggle } from "./client";

export const AREA_ICONS: Record<string, React.ReactNode> = {
  intake_and_engagement: <IdCard />, wages_and_stock_compensation: <Briefcase />, investments_and_digital_assets: <LineChart />, business: <Store />, rentals_and_sale: <Home />,
  pass_throughs_and_basis: <Share2 />, deductions_and_credits: <Receipt />, california: <MapPin />, partner_review: <Calculator />,
};

export async function Shell({ children, path }: { children: React.ReactNode; path: string }) {
  const actor = await getActor();
  if (actor.role === "client" && !["/filing", "/client", "/about"].includes(path)) redirect("/filing");
  const staff = await db.select().from(s.staff);
  const [changes, issues] = await Promise.all([changesSince(actor.id), openIssues()]);
  const blockers = issues.filter((i) => i.blocksFiling).length;
  const mine = issues.filter((i) => i.assignedTo === actor.id && i.kind !== "variance").length;
  const nav: [string, string, React.ReactNode, string?][] = [
    ["/", "Inbox", <Inbox key="i" />, mine ? String(mine) : undefined],
    ["/activity", "Since I last looked", <Activity key="a" />, changes.events.length ? String(changes.events.length) : undefined],
    ["/return", "Return", <FileSpreadsheet key="r" />],
    ["/documents", "Documents", <FolderOpen key="d" />],
    ["/client", "Client", <Users key="c" />],
    ["/prior-year", "Prior year", <History key="p" />],
    ["/versions", "Versions", <GitCompare key="v" />],
    ["/whatif", "What-ifs", <FlaskConical key="w" />],
    ["/filing", "Filing", <Send key="f" />, blockers ? `${blockers}` : undefined],
    ["/notice", "Notice response", <ShieldAlert key="n" />],
    ["/carry-forward", "Carry forward", <ArrowRightLeft key="cf" />],
    ["/firm", "Firm", <Building2 key="fm" />],
  ];
  const visibleNav = actor.role === "client" ? nav.filter(([h]) => ["/filing", "/client"].includes(h)) : nav;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="topbar sticky top-0 z-20 h-14 border-b border-line bg-s1/85 backdrop-blur flex items-center gap-4 px-4">
        <RailToggle />
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-semibold tracking-tight">Okafor-Lindqvist</span>
          <span className="text-fg-3 text-xs">Tax year 2025 · Married filing jointly · California → Texas</span>
        </div>
        <Link href="/about" className="btn ghost sm ml-2" title="About this workpaper"><Sparkles /> <span>About</span></Link>
        <div className="ml-auto flex items-center gap-2">
          <SearchBox />
          <ActionForm action={switchActor} toast="Role switched" className="flex items-center gap-2">
            <input type="hidden" name="_return" value={path} />
            <Avatar name={actor.name} size={26} />
            <select name="actor" defaultValue={actor.id} className="max-w-56" aria-label="Acting as">
              {staff.map((m) => <option key={m.id} value={m.id}>{m.name} · {roleLabel(m.role)}</option>)}
            </select>
            <button className="btn sm">Switch</button>
          </ActionForm>
          {!actor.sensitiveClearance && <Badge tone="adj" icon={<Lock />}>Sensitive data masked</Badge>}
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="rail w-60 [.rail-collapsed_&]:w-14 shrink-0 border-r border-line bg-s1 px-2 py-3 flex flex-col gap-4 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto transition-[width] duration-150">
          <nav className="nav flex flex-col gap-0.5">
            {visibleNav.map(([href, label, icon, badge]) => (
              <Link key={href} href={href} className={path === href ? "active" : ""} title={label}>{icon}<span className="label flex-1 truncate">{label}</span>{badge && <span className="rail-only badge bad">{badge}</span>}</Link>
            ))}
          </nav>
          {actor.role !== "client" && <div className="nav flex flex-col gap-0.5">
            <div className="group-label text-fg-4 text-[11px] px-2.5 mb-1 uppercase tracking-wide">Areas</div>
            {AREAS.map((a) => {
              const n = issues.filter((i) => i.area === a.id && i.kind !== "variance").length;
              const bl = issues.some((i) => i.area === a.id && i.severity === "blocker");
              return <Link key={a.id} href={`/areas/${a.id}`} className={path === `/areas/${a.id}` ? "active" : ""} title={a.name}>{AREA_ICONS[a.id]}<span className="label flex-1 truncate">{a.name}</span>{n ? <span className={`rail-only num text-xs ${bl ? "text-bad" : "text-fg-3"}`}>{n}</span> : null}</Link>;
            })}
          </div>}
          <div className="rail-only mt-auto px-2.5 text-[11px] text-fg-4">Signed in as<br /><span className="text-fg-2">{actor.name}</span> · {roleLabel(actor.role)}</div>
        </aside>
        <main className="flex-1 min-w-0 px-8 py-6 max-w-[1280px]">{children}</main>
      </div>
    </div>
  );
}
