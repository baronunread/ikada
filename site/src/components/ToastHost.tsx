import { ToastProvider } from "../../../src/components/toast";

/**
 * The one toast deck for the whole site. Every demo (the hero's Toast part, the docs page, the blocks, the motion
 * page) only calls `toast.add`; this island, mounted once in the Shell, is what draws them. The viewport is portalled
 * to the body, so no section's stacking context can put it under the page.
 */
export default function ToastHost() {
  return <ToastProvider />;
}
