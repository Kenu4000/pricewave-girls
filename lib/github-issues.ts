const REPOSITORY = "Kenu4000/pricewave-girls";
const ISSUES_URL = `https://api.github.com/repos/${REPOSITORY}/issues?state=open&sort=created&direction=desc&per_page=100`;

type GitHubIssueApi = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  user: { login: string } | null;
  labels: Array<string | { name?: string | null; color?: string | null }>;
  pull_request?: unknown;
};

export type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
  author: string | null;
  labels: Array<{ name: string; color: string | null }>;
};

function normalizeLabel(label: GitHubIssueApi["labels"][number]) {
  if (typeof label === "string") return { name: label, color: null };
  const name = typeof label.name === "string" ? label.name.trim() : "";
  if (!name) return null;
  const color = typeof label.color === "string" && /^[0-9a-f]{6}$/iu.test(label.color)
    ? label.color.toLowerCase()
    : null;
  return { name, color };
}

export async function getOpenGitHubIssues(): Promise<GitHubIssue[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "pricewave-girls",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(ISSUES_URL, {
    cache: "no-store",
    headers,
  });
  if (!response.ok) {
    throw new Error(`GitHub APIがHTTP ${response.status}を返しました。`);
  }

  const source = (await response.json()) as GitHubIssueApi[];
  return source
    .filter((issue) => issue.pull_request === undefined)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      htmlUrl: issue.html_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      comments: issue.comments,
      author: issue.user?.login ?? null,
      labels: issue.labels
        .map(normalizeLabel)
        .filter((label): label is NonNullable<typeof label> => label !== null),
    }));
}
