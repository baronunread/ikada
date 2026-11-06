import { useState } from "react";
import { Pagination } from "../../../src/components/pagination";
import type { Example, Playground, Preview } from "./types";

function Pages({ pageCount, ...props }: { pageCount: number; compact?: boolean; siblings?: number }) {
  const [page, setPage] = useState(1);
  return <Pagination page={page} pageCount={pageCount} onPageChange={setPage} {...props} />;
}

export const examples: Example[] = [
  {
    title: "Numbered",
    description: "The first and last page always show; pages past the current one's neighbours collapse into a gap.",
    render: () => <Pages pageCount={12} />,
    code: `const [page, setPage] = useState(1);

<Pagination page={page} pageCount={12} onPageChange={setPage} />`,
  },
  {
    title: "Compact",
    description: 'Previous, next and "Page 1 of 12". Use it on narrow screens.',
    render: () => <Pages pageCount={12} compact />,
    code: `const [page, setPage] = useState(1);

<Pagination compact page={page} pageCount={12} onPageChange={setPage} />`,
  },
  {
    title: "Siblings",
    description: "Show more pages either side of the current one.",
    render: () => <Pages pageCount={20} siblings={2} />,
    code: `const [page, setPage] = useState(1);

<Pagination siblings={2} page={page} pageCount={20} onPageChange={setPage} />`,
  },
];

/** The prop playground at the top of the page. */
export const playground: Playground = {
  component: "Pagination",
  controls: [
    { prop: "pageCount", kind: "number", min: 1, max: 40, step: 1 },
    { prop: "siblings", kind: "number", min: 0, max: 3, step: 1, default: 1 },
    { prop: "compact", kind: "boolean", default: false },
  ],
  initial: { pageCount: 12 },
  fixed: { page: "{page}", onPageChange: "{setPage}" },
  render: (v) => (
    <Pages
      key={`${v.pageCount}`}
      pageCount={Number(v.pageCount)}
      siblings={Number(v.siblings)}
      compact={Boolean(v.compact)}
    />
  ),
};

/** The compact render on the overview's component tile. */
export const preview: Preview = () => <Pagination compact page={3} pageCount={12} onPageChange={() => {}} />;
