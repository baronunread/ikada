import { Tabs, TabsList, TabsTab } from "../../../src/components/tabs";
import type { Preview } from "./types";

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
