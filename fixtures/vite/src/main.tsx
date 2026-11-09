import { createRoot } from "react-dom/client";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Input,
  ToastProvider,
  toast,
} from "@sproutboat/ikada";
import { TimeseriesChart } from "@sproutboat/ikada/charts";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <Button variant="primary" onClick={() => toast.add({ title: "Saved" })}>
      Save
    </Button>
    <Badge tone="success">Live</Badge>
    <Input aria-label="Name" />
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Hello</DialogTitle>
      </DialogContent>
    </Dialog>
    <TimeseriesChart ariaLabel="Requests" series={[{ id: "r", label: "Requests", data: [{ time: 0, value: 1 }] }]} />
  </ToastProvider>,
);
