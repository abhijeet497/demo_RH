import { Badge } from "@/components/ui/badge";

export const BedrockStatusBadge = ({ status }: { status?: string }) => {
  if (!status) return <span className="text-muted-foreground">-</span>;
  const failed = status.includes("FAILED");
  const pending =
    status.includes("PENDING") || status.includes("CREATING") || status.includes("UPDATING");
  return (
    <Badge variant={failed ? "destructive" : pending ? "outline" : "secondary"}>{status}</Badge>
  );
};
