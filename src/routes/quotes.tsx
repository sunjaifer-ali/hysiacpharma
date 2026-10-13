import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/quotes")({
  component: () => <Outlet />,
});
