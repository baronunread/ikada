import { Tabs, TabsList, TabsPanel, TabsTab } from "../../../src/components/tabs";
import type { Example, Preview } from "./types";

export const examples: Example[] = [
  {
    title: "With panels",
    description: "Switches between views of one subject in place. A raised pebble slides to the active tab.",
    render: () => (
      <Tabs defaultValue="logs" className="w-full max-w-md">
        <TabsList>
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="logs">Logs</TabsTab>
          <TabsTab value="settings">Settings</TabsTab>
        </TabsList>
        <TabsPanel value="overview">robin is live in eu-west.</TabsPanel>
        <TabsPanel value="logs">No errors in the last hour.</TabsPanel>
        <TabsPanel value="settings">Region, domain and environment variables.</TabsPanel>
      </Tabs>
    ),
    code: `<Tabs defaultValue="logs">
  <TabsList>
    <TabsTab value="overview">Overview</TabsTab>
    <TabsTab value="logs">Logs</TabsTab>
    <TabsTab value="settings">Settings</TabsTab>
  </TabsList>
  <TabsPanel value="overview">robin is live in eu-west.</TabsPanel>
  <TabsPanel value="logs">No errors in the last hour.</TabsPanel>
  <TabsPanel value="settings">Region, domain and environment variables.</TabsPanel>
</Tabs>`,
  },
  {
    title: "Disabled tab",
    render: () => (
      <Tabs defaultValue="overview" className="w-full max-w-md">
        <TabsList>
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="logs">Logs</TabsTab>
          <TabsTab value="metrics" disabled>
            Metrics
          </TabsTab>
        </TabsList>
        <TabsPanel value="overview">wren is live in us-east.</TabsPanel>
        <TabsPanel value="logs">No errors in the last hour.</TabsPanel>
      </Tabs>
    ),
    code: `<Tabs defaultValue="overview">
  <TabsList>
    <TabsTab value="overview">Overview</TabsTab>
    <TabsTab value="logs">Logs</TabsTab>
    <TabsTab value="metrics" disabled>
      Metrics
    </TabsTab>
  </TabsList>
  <TabsPanel value="overview">wren is live in us-east.</TabsPanel>
  <TabsPanel value="logs">No errors in the last hour.</TabsPanel>
</Tabs>`,
  },
];

/** The compact render on the overview's component tile. */
export const preview: Preview = () => (
  <Tabs defaultValue="logs">
    <TabsList>
      <TabsTab value="overview">Overview</TabsTab>
      <TabsTab value="logs">Logs</TabsTab>
      <TabsTab value="settings">Settings</TabsTab>
    </TabsList>
  </Tabs>
);
