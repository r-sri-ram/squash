export type Ticket = {
  title?: string;
  stepsToReproduce?: string[];
  expected?: string;
  actual?: string;
  environment?: string;
  severity?: string;
  area?: string;
  missing?: string[];
  confidence?: string;
};

export function ticketToMarkdown(t: Ticket): string {
  const steps = (t.stepsToReproduce ?? [])
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");
  const missing = (t.missing ?? []).length
    ? `\n**Still needed:** ${t.missing!.join(", ")}\n`
    : "";
  return `### ${t.title ?? "Bug report"}

**Area:** ${t.area ?? "Unknown"}  ·  **Severity:** ${t.severity ?? "medium"}  ·  **Confidence:** ${t.confidence ?? "medium"}

**Steps to reproduce**
${steps}

**Expected:** ${t.expected ?? "—"}
**Actual:** ${t.actual ?? "—"}
**Environment:** ${t.environment ?? "Not specified"}
${missing}
_Filed with Squash_`;
}

export function githubIssueUrl(t: Ticket): string | null {
  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;
  if (!repo) return null;
  const params = new URLSearchParams({
    title: t.title ?? "Bug report",
    body: ticketToMarkdown(t),
    labels: t.severity ? `severity:${t.severity}` : "",
  });
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}
