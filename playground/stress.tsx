/**
 * Worst-case stress page: every component and block fed the longest, strangest data a real user could
 * produce. Open /stress.html?g=<group>&data=worst|demo|empty. Groups: basic, forms, data, nav, charts, blocks.
 * Not linked from the playground; it is the regression harness for "Worst case" data.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { Sparkline } from "../src/charts/sparkline";
import { TimeseriesChart } from "../src/charts/timeseries-chart";
import { Avatar } from "../src/components/avatar";
import { Badge } from "../src/components/badge";
import { Banner } from "../src/components/banner";
import { Breadcrumbs } from "../src/components/breadcrumbs";
import { Button } from "../src/components/button";
import { Checkbox } from "../src/components/checkbox";
import { CodeBlock } from "../src/components/code-block";
import { CommandPalette } from "../src/components/command-palette";
import { CopyId } from "../src/components/copy-id";
import { DescriptionList } from "../src/components/description-list";
import { EmptyState } from "../src/components/empty-state";
import { Field } from "../src/components/field";
import { IconButton } from "../src/components/icon-button";
import { Input } from "../src/components/input";
import { Kbd } from "../src/components/kbd";
import { Link } from "../src/components/link";
import { Meter, UsageMeter } from "../src/components/meter";
import { MetricTile } from "../src/components/metric-tile";
import { PageHeader, PageTab, PageTabs } from "../src/components/page-header";
import { Pagination } from "../src/components/pagination";
import { RadioGroup } from "../src/components/radio-group";
import { SegmentedControl } from "../src/components/segmented-control";
import { Select } from "../src/components/select";
import { SensitiveInput } from "../src/components/sensitive-input";
import { Sidebar, SidebarFooter, SidebarHeader, SidebarItem, SidebarNav } from "../src/components/sidebar";
import { Skeleton } from "../src/components/skeleton";
import { StatusDot } from "../src/components/status-dot";
import { Switch } from "../src/components/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../src/components/table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../src/components/tabs";
import { Textarea } from "../src/components/textarea";
import { ToastProvider, toast } from "../src/components/toast";
import { Tooltip, TooltipProvider } from "../src/components/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "../src/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "../src/components/popover";
import { D1Console } from "../blocks/d1-console/d1-console";
import { EmptyStates } from "../blocks/empty-states/empty-states";
import { KvBrowser } from "../blocks/kv-browser/kv-browser";
import { LogsPanel } from "../blocks/logs-panel/logs-panel";
import { MetricRow } from "../blocks/metric-row/metric-row";
import { ProjectTray } from "../blocks/project-tray/project-tray";
import { SettingsSection } from "../blocks/settings-section/settings-section";
import { SignInCard } from "../blocks/sign-in-card/sign-in-card";
import { ToastDeck } from "../blocks/toast-deck/toast-deck";
import { TrafficChart } from "../blocks/traffic-chart/traffic-chart";
import { UsageLine } from "../blocks/usage-line/usage-line";

const params = new URLSearchParams(location.search);
const group = params.get("g") ?? "basic";
const data = params.get("data") ?? "worst";

/* Worst-case values: real naming patterns and plausible limits, not noise. */
const LONG_NAME = "Aleksandra Wiśniewska-Kowalczyk-Montgomery the Third";
const LONG_PROJECT = "customer-onboarding-and-billing-reconciliation-service-production-eu-west";
const LONG_EMAIL = "bartholomew.fitzgerald.the.third@northwind-industries-holdings-international.example.com";
const LONG_URL =
  "https://my-very-long-application-name-for-the-eu-west-region.sproutboat.app/api/v2/customers/reconcile";
const DE = "Donaudampfschifffahrtsgesellschaftskapitän";
const JA = "東京都渋谷区神宮前の顧客管理システム本番環境データベース";
const AR = "نظام إدارة العملاء في قاعدة البيانات الإنتاجية للمنطقة";
const EMOJI = "🚀🔥 Launch day: deploy to prod 🎉";
const HUGE = 1e12;

const only = params.get("only");

function Case({ name, children, width }: { name: string; children: ReactNode; width?: string }) {
  if (only && !name.startsWith(only)) return null;
  return (
    <section data-case={name} className="min-w-0 rounded-xl border border-dashed border-hairline-strong p-3">
      <h3 className="mb-2 font-mono text-xs text-fg-muted">{name}</h3>
      <div className="min-w-0" style={width ? { maxWidth: width } : undefined}>
        {children}
      </div>
    </section>
  );
}

function Basic() {
  const names = [LONG_NAME, "J", "Jo", EMOJI, JA, AR, "", "  ", DE];
  return (
    <>
      <Case name="Avatar">
        <div className="flex flex-wrap gap-2">
          {names.map((n, i) => (
            <Avatar key={i} name={n} size={i % 3 === 0 ? "lg" : "md"} />
          ))}
          <Avatar name="Bad" src="https://127.0.0.1:1/nope.png" />
        </div>
      </Case>
      <Case name="Badge">
        <div className="flex flex-col items-start gap-2">
          <Badge tone="success" dot live>
            {LONG_PROJECT}
          </Badge>
          <Badge tone="danger" dot>
            {EMOJI}
          </Badge>
          <Badge>{DE}</Badge>
          <Badge tone="warning">{AR}</Badge>
          <Badge>{"9".repeat(24)}</Badge>
        </div>
      </Case>
      <Case name="Banner">
        <div className="flex flex-col gap-2">
          <Banner
            tone="danger"
            title={`Deploy of ${LONG_PROJECT} was blocked by the quota`}
            dismissible
            action={<Button size="sm">Upgrade your plan to the next tier now</Button>}
          >
            {LONG_URL} {LONG_EMAIL}
          </Banner>
          <Banner tone="info" title={JA}>
            {AR}
          </Banner>
        </div>
      </Case>
      <Case name="Breadcrumbs">
        <Breadcrumbs
          items={[
            { label: LONG_NAME, href: "#a" },
            { label: LONG_PROJECT, href: "#b" },
            { label: DE, href: "#c" },
            { label: "Production environment of the eu-west cluster", href: "#d" },
            { label: LONG_URL },
          ]}
          maxItems={3}
        />
        <div className="mt-2">
          <Breadcrumbs items={[{ label: "Org", href: "#a" }, { label: LONG_PROJECT }]} />
        </div>
      </Case>
      <Case name="Button">
        <div className="flex flex-col items-start gap-2">
          <Button variant="primary">{`Deploy ${LONG_PROJECT} to production now`}</Button>
          <Button loading>Saving the very long configuration changes</Button>
          <Button>{JA}</Button>
          <Button size="sm">{EMOJI}</Button>
        </div>
      </Case>
      <Case name="IconButton / Kbd / Link / Spinner / Skeleton">
        <div className="flex flex-wrap items-center gap-2">
          <IconButton label={LONG_NAME}>+</IconButton>
          <Kbd>Ctrl+Alt+Shift+Delete</Kbd>
          <Link href="#x">{LONG_URL}</Link>
          <Link href="https://example.com" external>
            {LONG_EMAIL}
          </Link>
          <Skeleton className="w-full" />
        </div>
      </Case>
      <Case name="CopyId" width="22rem">
        <div className="flex flex-col gap-2">
          <CopyId value={"dpl_" + "a1b2c3d4e5f6".repeat(8)} />
          <CopyId value="x" />
          <CopyId value={LONG_EMAIL} />
        </div>
      </Case>
      <Case name="CodeBlock">
        <CodeBlock
          label="Deploy command"
          code={`curl -X POST ${LONG_URL}?token=${"abcdef0123456789".repeat(6)} --data '{"name":"${LONG_NAME}"}'`}
        />
        <div className="mt-2">
          <CodeBlock label="Wrapped" wrap code={`${LONG_URL}${"x".repeat(80)}`} />
        </div>
      </Case>
      <Case name="DescriptionList">
        <DescriptionList
          items={[
            { id: "1", term: "A very long term label that keeps going and going", details: LONG_EMAIL },
            { id: "2", term: DE, details: LONG_URL, mono: true },
            { id: "3", term: "Name", details: JA },
            { id: "4", term: AR, details: "" },
          ]}
        />
        <div className="mt-3">
          <DescriptionList layout="stacked" items={[{ id: "1", term: LONG_PROJECT, details: LONG_EMAIL }]} />
        </div>
      </Case>
      <Case name="EmptyState" width="24rem">
        <EmptyState
          title={`No deployments for ${LONG_PROJECT}`}
          description={`${LONG_URL} ${LONG_EMAIL}`}
          action={<Button>{"Create the first deployment of this project"}</Button>}
          icon="◇"
        />
      </Case>
      <Case name="StatusDot">
        <div className="flex flex-col items-start gap-2">
          <StatusDot tone="success" live label={`Live 100% ${LONG_PROJECT}`} />
          <StatusDot tone="danger" label={LONG_EMAIL} />
          <div className="w-48 border border-hairline">
            <StatusDot tone="warning" label={DE + DE} />
          </div>
        </div>
      </Case>
      <Case name="Meter / UsageMeter" width="22rem">
        <div className="flex flex-col gap-4">
          <Meter label={LONG_PROJECT} value={99.999} />
          <Meter label="Negative" value={-5} />
          <Meter label="Over" value={250} max={100} />
          <UsageMeter label={LONG_PROJECT} used={HUGE} limit={HUGE * 1.5} unit="requests per month" />
          <UsageMeter label="Zero limit" used={0} limit={0} />
          <UsageMeter label="Used over limit" used={1_284_000} limit={1_000_000} unit="requests" />
          <UsageMeter label="NaN" used={Number.NaN} limit={100} />
          <UsageMeter label="Unlimited" used={HUGE} limit={null} unit="GB" />
          <UsageMeter label="Blocked" used={1e15} limit={1e15} blocked />
        </div>
      </Case>
      <Case name="MetricTile" width="100%">
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label={`Requests served by ${LONG_PROJECT}`}
            amount={HUGE}
            unit="req"
            delta={{ value: "1,284,000.5%", direction: "up", sentiment: "good" }}
            hint={LONG_URL}
          />
          <MetricTile
            label="Raw"
            value={"1234567890123456789.123456789"}
            unit="ms p50 over the trailing twenty-four hours"
            delta={{ value: "-99.999%", direction: "down", sentiment: "bad" }}
          />
          <MetricTile label="NaN" amount={Number.NaN} />
          <MetricTile label="Negative" amount={-HUGE} />
          <MetricTile label="Loading" loading />
          <MetricTile label={AR} noData emptyText={LONG_URL} />
          <MetricTile label="Spark" amount={0} sparkline={<Sparkline data={[0, 0, 0]} aria-label="x" />} />
          <MetricTile label="Value only" value={LONG_EMAIL} />
        </div>
      </Case>
      <Case name="PageHeader">
        <PageHeader
          breadcrumbs={<Breadcrumbs items={[{ label: LONG_NAME, href: "#a" }, { label: LONG_PROJECT }]} />}
          title={LONG_PROJECT}
          status={
            <Badge tone="success" dot live>
              Live
            </Badge>
          }
          description={`${LONG_URL} · ${LONG_EMAIL}`}
          actions={
            <>
              <Button>{"Open the production dashboard"}</Button>
              <Button variant="primary">{"Deploy a new version"}</Button>
            </>
          }
          tabs={
            <PageTabs>
              <PageTab current href="#a">
                Overview
              </PageTab>
              <PageTab href="#b">Deployments of the production environment</PageTab>
              <PageTab href="#c">{DE}</PageTab>
              <PageTab href="#d">Settings</PageTab>
            </PageTabs>
          }
        />
      </Case>
      <Case name="Tooltip / Popover / Dialog / Menu">
        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            <Tooltip content={`${LONG_URL} ${LONG_EMAIL}`} defaultOpen side="bottom">
              <Button>Hover me</Button>
            </Tooltip>
            <Popover>
              <PopoverTrigger render={<Button />}>Popover</PopoverTrigger>
              <PopoverContent>
                <PopoverTitle>{LONG_PROJECT}</PopoverTitle>
                <PopoverDescription>
                  {LONG_URL} {LONG_EMAIL}
                </PopoverDescription>
              </PopoverContent>
            </Popover>
            <Dialog>
              <DialogTrigger render={<Button />}>Dialog</DialogTrigger>
              <DialogContent>
                <DialogTitle>{`Delete ${LONG_PROJECT}?`}</DialogTitle>
                <DialogDescription>
                  {LONG_URL} {LONG_EMAIL}
                </DialogDescription>
                <DialogFooter>
                  <Button variant="danger">{`Delete ${LONG_PROJECT} permanently`}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button />}>Menu</DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{LONG_EMAIL}</DropdownMenuLabel>
                <DropdownMenuItem>{LONG_PROJECT}</DropdownMenuItem>
                <DropdownMenuItem>{JA}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TooltipProvider>
      </Case>
    </>
  );
}

function Forms() {
  const [seg, setSeg] = useState("a");
  const [sel, setSel] = useState(LONG_PROJECT);
  const opts = [
    { value: LONG_PROJECT, label: LONG_PROJECT },
    { value: "b", label: JA },
    { value: "c", label: LONG_EMAIL },
    { value: "d", label: "" },
  ];
  return (
    <>
      <Case name="Field + Input">
        <div className="flex flex-col gap-4">
          <Field
            label={`Webhook endpoint for ${LONG_PROJECT} deployments`}
            description={`${LONG_URL} ${LONG_EMAIL}`}
            error={`${LONG_URL} is not reachable from the ${LONG_PROJECT} network`}
            required
          >
            <Input defaultValue={LONG_URL} />
          </Field>
          <Field label={AR}>
            <Input defaultValue={AR} />
          </Field>
          <Field label="Textarea">
            <Textarea defaultValue={LONG_URL.repeat(4)} />
          </Field>
          <Field label="Sensitive">
            <SensitiveInput defaultValue={"sk_live_" + "x".repeat(80)} />
          </Field>
        </div>
      </Case>
      <Case name="Checkbox / Switch / Radio" width="100%">
        <div className="flex flex-col gap-3">
          <Checkbox
            label={`I confirm that I want to delete ${LONG_PROJECT}`}
            description={`${LONG_URL} ${LONG_EMAIL}`}
          />
          <Checkbox label={DE + DE} description="" />
          <Switch label={`Notify ${LONG_EMAIL} about failed deploys for ${LONG_PROJECT}`} />
          <Switch label={LONG_URL} />
          <RadioGroup
            legend={`Where should ${LONG_PROJECT} run`}
            defaultValue="a"
            options={[
              { value: "a", label: LONG_URL, description: LONG_EMAIL },
              { value: "b", label: JA },
              { value: "c", label: DE + DE },
            ]}
          />
          <RadioGroup
            aria-label="h"
            orientation="horizontal"
            options={[
              { value: "a", label: LONG_PROJECT },
              { value: "b", label: LONG_PROJECT + "-2" },
            ]}
          />
        </div>
      </Case>
      <Case name="Select" width="100%">
        <div className="flex flex-col gap-3">
          <Select aria-label="s" value={sel} onValueChange={(v) => setSel(v ?? "")} options={opts} />
          <Select aria-label="s2" placeholder={`Choose one of the ${LONG_PROJECT} regions`} options={opts} />
          <Select aria-label="open" defaultOpen value={sel} onValueChange={(v) => setSel(v ?? "")} options={opts} />
        </div>
      </Case>
      <Case name="SegmentedControl" width="100%">
        <div className="flex flex-col gap-3">
          <SegmentedControl
            aria-label="selected last"
            value="e"
            onValueChange={() => {}}
            options={[
              { value: "a", label: "Last 1 hour" },
              { value: "b", label: "Last 24 hours" },
              { value: "c", label: "Last 7 days" },
              { value: "d", label: "Last 30 days" },
              { value: "e", label: "Custom range" },
            ]}
          />
          <SegmentedControl
            aria-label="s"
            value={seg}
            onValueChange={setSeg}
            options={[
              { value: "a", label: "Last 1 hour" },
              { value: "b", label: "Last 24 hours" },
              { value: "c", label: "Last 7 days" },
              { value: "d", label: "Last 30 days" },
              { value: "e", label: LONG_PROJECT },
            ]}
          />
          <SegmentedControl
            aria-label="s"
            size="sm"
            value={seg}
            onValueChange={setSeg}
            options={[
              { value: "a", label: JA },
              { value: "b", label: DE },
            ]}
          />
        </div>
      </Case>
      <Case name="Tabs" width="100%">
        <Tabs defaultValue="a">
          <TabsList>
            {["a", "b", "c", "d", "e"].map((v, i) => (
              <TabsTab key={v} value={v}>
                {i === 2 ? LONG_PROJECT : `Tab number ${i + 1} with long label`}
              </TabsTab>
            ))}
          </TabsList>
          <TabsPanel value="a">{LONG_URL + LONG_URL}</TabsPanel>
        </Tabs>
      </Case>
    </>
  );
}

function Rows(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

function DataGroup() {
  const [page, setPage] = useState(1);
  return (
    <>
      <Case name="Table" width="100%">
        <Table label="stress" stickyHeader maxHeight="24rem">
          <TableHeader>
            <TableRow>
              <TableHead sortable sort="asc">
                {LONG_PROJECT}
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Rows(data === "empty" ? 0 : 6).map((i) => (
              <TableRow key={i}>
                <TableCell>{i % 2 ? LONG_NAME : "J"}</TableCell>
                <TableCell>{i % 2 ? LONG_EMAIL : "j@x.io"}</TableCell>
                <TableCell className="tabular-nums">{(i % 2 ? HUGE : 1) * (i + 1) * 1234}</TableCell>
                <TableCell>
                  <Badge tone="danger">{i % 2 ? "Failed to deploy: quota exceeded" : "OK"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Case>
      <Case name="Pagination" width="100%">
        <div className="flex flex-col gap-3">
          <Pagination page={page} pageCount={1_000_000} onPageChange={setPage} />
          <Pagination page={123456} pageCount={999999999} onPageChange={() => {}} siblings={2} />
          <Pagination page={123456} pageCount={999999999} onPageChange={() => {}} compact />
          <Pagination page={1} pageCount={0} onPageChange={() => {}} />
          <Pagination page={1} pageCount={1} onPageChange={() => {}} />
          <Pagination page={Number.NaN} pageCount={5} onPageChange={() => {}} />
        </div>
      </Case>
      <Case name="Toast">
        <Button
          onClick={() => {
            toast.add({
              tone: "danger",
              title: `Deploy of ${LONG_PROJECT} failed`,
              description: `${LONG_URL} ${LONG_EMAIL}`,
              actions: [{ label: "Retry the whole deployment again", onClick: () => {}, variant: "danger" }],
            });
            toast.add({ title: JA, description: AR });
          }}
        >
          Fire toasts
        </Button>
        <ToastAuto />
      </Case>
      <Case name="CommandPalette">
        <CommandPalette
          open={params.get("palette") === "1"}
          onOpenChange={() => {}}
          onSelect={() => {}}
          recents={[]}
          groups={[
            {
              id: "g",
              label: LONG_PROJECT,
              items: [
                { id: "1", label: LONG_PROJECT, hint: LONG_URL },
                { id: "2", label: JA, hint: LONG_EMAIL },
                { id: "3", label: DE + DE },
              ],
            },
          ]}
        />
        <span className="text-sb-sm text-fg-muted">open with ?palette=1</span>
      </Case>
    </>
  );
}

function ToastAuto() {
  if (params.get("toast") === "1")
    queueMicrotask(() =>
      toast.add({
        tone: "danger",
        title: `Deploy of ${LONG_PROJECT} failed`,
        description: `${LONG_URL} ${LONG_EMAIL}`,
        actions: [{ label: "Retry the whole deployment again", onClick: () => {}, variant: "danger" }],
      }),
    );
  return null;
}

function Nav() {
  return (
    <>
      <Case name="Sidebar (static, 240px)" width="100%">
        <div className="h-96 overflow-hidden rounded-lg border border-hairline">
          <Sidebar mode="static">
            <SidebarHeader>
              <Avatar name={LONG_PROJECT} />
              <span className="min-w-0 truncate font-semibold">{LONG_PROJECT}</span>
            </SidebarHeader>
            <SidebarNav>
              <SidebarItem href="#a" current trailing={<Badge>99999+</Badge>}>
                {LONG_PROJECT}
              </SidebarItem>
              <SidebarItem href="#b" trailing={<Badge tone="danger">{LONG_NAME}</Badge>}>
                {JA}
              </SidebarItem>
              <SidebarItem href="#c">{LONG_EMAIL}</SidebarItem>
            </SidebarNav>
            <SidebarFooter>
              <SidebarItem href="#d">{AR}</SidebarItem>
            </SidebarFooter>
          </Sidebar>
        </div>
      </Case>
      <Case name="Sidebar (rail) tooltip">
        <div className="h-48 overflow-hidden rounded-lg border border-hairline">
          <Sidebar mode="static" collapsed>
            <SidebarNav>
              <SidebarItem href="#a" icon={<span>◇</span>}>
                {LONG_PROJECT}
              </SidebarItem>
            </SidebarNav>
          </Sidebar>
        </div>
      </Case>
    </>
  );
}

const T0 = Date.UTC(2026, 10, 5);
function series(n: number, f: (i: number) => number) {
  return Array.from({ length: n }, (_, i) => ({ time: T0 + i * 3_600_000, value: f(i) }));
}

function Charts() {
  const worst = data === "worst";
  const spikes = series(24, (i) => (i === 12 ? HUGE : i % 3));
  return (
    <>
      <Case name="Sparkline" width="100%">
        <div className="flex flex-col gap-3">
          <Sparkline data={[]} aria-label="empty" />
          <Sparkline data={[5]} aria-label="one point" />
          <Sparkline data={[0, 0, 0, 0]} aria-label="flat zero" />
          <Sparkline data={[1, HUGE, 2, -HUGE, 3]} aria-label="extremes" />
          <Sparkline data={[1, Number.NaN, 3]} aria-label="nan" />
          <Sparkline data={Rows(5000).map((i) => Math.sin(i / 20) * 1e6)} aria-label="5000 points" />
        </div>
      </Case>
      <Case name="TimeseriesChart" width="100%">
        <div className="flex flex-col gap-4">
          <TimeseriesChart
            ariaLabel="worst"
            series={[
              { id: "a", label: LONG_PROJECT, data: worst ? spikes : series(24, (i) => i), area: true },
              { id: "b", label: LONG_NAME + " " + DE, data: series(24, (i) => -i * 1e9), dashed: true },
            ]}
            deploy={[
              { time: T0 + 5 * 3_600_000, label: `Deploy of ${LONG_PROJECT} v1284` },
              { time: T0 + 5.2 * 3_600_000, label: LONG_EMAIL },
            ]}
          />
          <TimeseriesChart ariaLabel="empty" series={[]} />
          <TimeseriesChart ariaLabel="one" series={[{ id: "a", label: "One", data: series(1, () => 5) }]} />
          <TimeseriesChart
            ariaLabel="zero"
            series={[{ id: "a", label: "Zero", data: series(10, () => 0) }]}
            emptyText={LONG_URL}
          />
          <TimeseriesChart
            ariaLabel="nan"
            series={[{ id: "a", label: "NaN", data: series(10, (i) => (i === 4 ? Number.NaN : i)) }]}
          />
        </div>
      </Case>
    </>
  );
}

function Blocks() {
  const sprouts = [
    {
      slug: "a",
      name: LONG_PROJECT,
      hostname: "my-very-long-application-name-for-the-eu-west-region-production.sproutboat.app",
      status: "live" as const,
      liveVersion: 1_284_000,
      lastDeploy: "12 minutes and 40 seconds ago",
      requests24h: 1e12,
      trigger: "queue-consumer-for-reconciliation",
    },
    { slug: "b", name: "J", hostname: "j.io", status: "deploy_failed" as const },
    { slug: "c", name: JA, hostname: LONG_EMAIL, status: "deploying" as const, trigger: "cron" },
  ];
  const projects = [
    { slug: "p1", name: LONG_NAME + " " + LONG_PROJECT, sprouts },
    { slug: "p2", name: "X", sprouts: [] },
  ];
  const empty = data === "empty";
  return (
    <>
      <Case name="MetricRow" width="100%">
        <MetricRow
          metrics={
            empty
              ? []
              : [
                  {
                    id: "1",
                    label: `Requests served by ${LONG_PROJECT}`,
                    value: "1,284,000,000,000",
                    unit: "req/min over the last day",
                    delta: { value: "99,999.99%", direction: "up" },
                    hint: LONG_URL,
                    trend: [1, HUGE, 3],
                  },
                  {
                    id: "2",
                    label: "Error rate",
                    value: "NaN",
                    unit: "%",
                    delta: { value: "-0.0001%", direction: "down", sentiment: "good" },
                  },
                  { id: "3", label: AR, value: LONG_EMAIL },
                  { id: "4", label: "Zero", value: "0", trend: [] },
                ]
          }
        />
      </Case>
      <Case name="UsageLine" width="100%">
        <UsageLine
          note={`Enterprise plan with extra long note · resets 00:00 UTC ${LONG_EMAIL}`}
          quotas={
            empty
              ? []
              : [
                  { id: "1", label: "Requests", used: 1e12, limit: 1e12, unit: "count" },
                  { id: "2", label: "Storage used for every database", used: 9.9e15, limit: 1e16, unit: "bytes" },
                  { id: "3", label: LONG_PROJECT, used: 99.999, limit: 100, unit: "percent" },
                  { id: "4", label: "Zero", used: 0, limit: 0, unit: "count" },
                ]
          }
        />
      </Case>
      <Case name="ProjectTray" width="100%">
        <ProjectTray projects={empty ? [] : projects} />
      </Case>
      <Case name="LogsPanel" width="100%">
        <LogsPanel
          next={null}
          title={LONG_PROJECT}
          lines={
            empty
              ? []
              : [
                  {
                    id: "1",
                    t: Date.now(),
                    level: "error",
                    source: "queue-consumer-for-reconciliation",
                    message: LONG_URL + " " + "x".repeat(300),
                    method: "DELETE",
                    path: "/api/v2/customers/" + "9".repeat(60),
                    status: 504,
                    durationMs: 1e9,
                  },
                  { id: "2", t: Date.now() - 1000, level: "info", source: "http", message: JA + AR },
                  { id: "3", t: Date.now() - 2000, level: "warn", source: "x", message: "" },
                ]
          }
        />
      </Case>
      <Case name="KvBrowser" width="100%">
        <KvBrowser
          namespace={LONG_PROJECT}
          prefixes={[LONG_PROJECT + ":", "j:"]}
          entries={
            empty
              ? []
              : [
                  {
                    key: "user:" + LONG_EMAIL + ":" + "9".repeat(60),
                    value: LONG_URL.repeat(10),
                    metadata: { name: LONG_NAME },
                    expiresIn: 1e9,
                    updatedAgo: 1e12,
                  },
                  { key: "k", value: "", updatedAgo: 0 },
                  { key: JA, value: AR, updatedAgo: 3, expiresIn: 0 },
                  { key: "nested", value: JSON.stringify({ a: { b: "x".repeat(400) } }), updatedAgo: 5 },
                ]
          }
        />
      </Case>
      <Case name="D1Console" width="100%">
        <D1Console
          database={LONG_PROJECT}
          initialQuery="SELECT * FROM customer_onboarding_billing_reconciliation_events_archive_2026"
          tables={
            empty
              ? []
              : [
                  {
                    name: "customer_onboarding_billing_reconciliation_events_archive_2026",
                    columns: [
                      { name: "id", type: "INTEGER", primaryKey: true },
                      { name: "extremely_long_column_name_for_the_customer_email_address", type: "TEXT" },
                      { name: "amount", type: "REAL" },
                    ],
                    rows: [
                      [1, LONG_EMAIL, 1e12],
                      [123456789012, LONG_URL.repeat(3), -0.000001],
                      [3, null, Number.MAX_SAFE_INTEGER],
                    ],
                  },
                  { name: "j", columns: [{ name: "a", type: "TEXT" }], rows: [] },
                ]
          }
        />
      </Case>
      <Case name="SettingsSection" width="100%">
        <SettingsSection
          defaultValues={{
            name: LONG_PROJECT + LONG_PROJECT,
            slug: LONG_PROJECT,
            region: "x",
            notifyFailedDeploys: true,
            weeklySummary: true,
            retentionDays: "3",
          }}
          regions={[
            { value: "x", label: `${LONG_PROJECT} (${DE}, ${LONG_URL})` },
            { value: "y", label: JA },
          ]}
        />
      </Case>
      <Case name="SignInCard" width="100%">
        <SignInCard
          note={`${LONG_URL} ${LONG_EMAIL}`}
          brand={<span className="block truncate font-bold">{LONG_PROJECT}</span>}
          useCases={[
            { value: "a", label: `${LONG_PROJECT} and also everything else under the sun` },
            { value: "b", label: JA },
          ]}
        />
      </Case>
      <Case name="ToastDeck" width="100%">
        <ToastDeck
          deployName={LONG_PROJECT + " v1284000"}
          tokens={
            empty
              ? []
              : [
                  {
                    id: "1",
                    name: LONG_PROJECT + " " + LONG_NAME,
                    hint: "sb_live_" + "x".repeat(60),
                    lastUsed: "12 minutes and forty seconds ago on a Tuesday",
                  },
                  { id: "2", name: "J", hint: "…a", lastUsed: "never" },
                ]
          }
        />
      </Case>
      <Case name="EmptyStates" width="100%">
        <EmptyStates />
      </Case>
      <Case name="TrafficChart" width="100%">
        <TrafficChart
          title={LONG_PROJECT + " " + LONG_NAME}
          data={() => ({
            requests: series(24, (i) => (i === 5 ? HUGE : i)),
            errors: series(24, (i) => i * 1e9),
            deploys: [{ time: T0 + 3 * 3_600_000, label: `Deploy ${LONG_PROJECT} ${LONG_EMAIL}` }],
          })}
        />
      </Case>
    </>
  );
}

const groups = { basic: Basic, forms: Forms, data: DataGroup, nav: Nav, charts: Charts, blocks: Blocks } as const;

export function Stress() {
  const G = groups[group as keyof typeof groups] ?? Basic;
  return (
    <TooltipProvider>
      <ToastProvider>
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-3 bg-canvas p-3 text-fg" data-group={group}>
          <h1 className="text-sm font-bold">
            stress / {group} / {data}
          </h1>
          <G />
        </main>
      </ToastProvider>
    </TooltipProvider>
  );
}
