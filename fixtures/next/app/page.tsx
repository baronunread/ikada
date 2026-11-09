// A Server Component: no "use client" here. Every ikada piece below is rendered on the server,
// with only serializable props. CopyId and Tabs are the ones that failed in 0.1.0.
import {
  Avatar,
  Badge,
  Banner,
  Breadcrumbs,
  CloseIcon,
  Button,
  Checkbox,
  CodeBlock,
  CopyId,
  DescriptionList,
  EmptyState,
  Field,
  IconButton,
  Input,
  Kbd,
  Label,
  Link,
  Meter,
  MetricTile,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
  StatusDot,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Textarea,
} from "@sproutboat/ikada";
import { Button as SubpathButton } from "@sproutboat/ikada/button";
import { Chart } from "./chart";

export default function Page() {
  return (
    <main className="space-y-4 p-6">
      <PageHeader title="Server rendered" />
      <Button variant="primary">Save</Button>
      <SubpathButton>Subpath import</SubpathButton>
      <IconButton label="Close">
        <CloseIcon />
      </IconButton>
      <Badge tone="success">Live</Badge>
      <Banner tone="info" title="Heads up" />
      <Kbd>K</Kbd>
      <Label>Name</Label>
      <Field label="Email">
        <Input defaultValue="a@b.c" />
      </Field>
      <Textarea defaultValue="x" />
      <Checkbox aria-label="Agree" />
      <Switch aria-label="On" />
      <Select aria-label="Region" options={[{ value: "eu", label: "EU" }]} defaultValue="eu" />
      <Avatar name="Ada Lovelace" />
      <StatusDot status="success" label="Live" />
      <Skeleton />
      <Spinner />
      <Meter aria-label="Usage" value={40} label="Usage" />
      <MetricTile label="Requests" value="1.2k" />
      <CopyId value="dep_123" />
      <CodeBlock code="bun add @sproutboat/ikada" label="Install" />
      <DescriptionList items={[{ id: "r", term: "Region", details: "eu" }]} />
      <EmptyState title="Nothing yet" />
      <Breadcrumbs items={[{ label: "Home", href: "/" }]} />

      <Link href="/">Home</Link>
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTab value="a">A</TabsTab>
        </TabsList>
        <TabsPanel value="a">Panel</TabsPanel>
      </Tabs>
      <Table label="Servers">
        <TableHead>
          <TableRow>
            <TableHeader>Name</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Chart />
    </main>
  );
}
