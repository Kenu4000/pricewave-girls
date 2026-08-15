import { getOpenGitHubIssues, type GitHubIssue } from "@/lib/github-issues";
import styles from "./requests.module.css";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP");
}

function labelBorderColor(color: string | null) {
  return color ? `#${color}` : undefined;
}

export default async function RequestsPage() {
  let issues: GitHubIssue[] = [];
  let errorMessage: string | null = null;

  try {
    issues = await getOpenGitHubIssues();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "GitHub Issueの取得に失敗しました。";
  }

  return (
    <section className={styles.page}>
      <div className="list-heading">
        <div>
          <h1>リクエスト</h1>
          <p className="muted">
            Kenu4000/pricewave-girls の未処理Issue
            {errorMessage === null ? ` ${issues.length.toLocaleString("ja-JP")}件` : ""}
          </p>
        </div>
        <a
          className="button secondary"
          href="https://github.com/Kenu4000/pricewave-girls/issues"
          rel="noreferrer"
          target="_blank"
        >
          GitHubのIssue一覧
        </a>
      </div>

      {errorMessage !== null ? (
        <div className={`card ${styles.messageCard}`}>
          <h2>Issueを取得できませんでした</h2>
          <p>{errorMessage}</p>
          <p className="muted">
            GitHub APIの利用制限に達した場合は、環境変数 GITHUB_TOKEN を設定すると取得上限を増やせます。
          </p>
        </div>
      ) : issues.length === 0 ? (
        <div className={`card ${styles.messageCard}`}>
          <h2>未処理リクエストはありません</h2>
          <p className="muted">Open Issueが作成されるとここに表示されます。</p>
        </div>
      ) : (
        <div className={styles.issueList}>
          {issues.map((issue) => (
            <article className={`card ${styles.issueCard}`} key={issue.number}>
              <div className={styles.issueHeader}>
                <div className={styles.issueTitleBlock}>
                  <span className={styles.issueNumber}>#{issue.number}</span>
                  <h2>{issue.title}</h2>
                </div>
                <a
                  className="button secondary"
                  href={issue.htmlUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  GitHubで開く
                </a>
              </div>

              {issue.labels.length > 0 ? (
                <div className={styles.labels} aria-label="Issueラベル">
                  {issue.labels.map((label) => (
                    <span
                      className={styles.label}
                      key={label.name}
                      style={{ borderColor: labelBorderColor(label.color) }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className={styles.issueBody}>
                {issue.body?.trim() ? issue.body : <span className="muted">本文なし</span>}
              </div>

              <div className={styles.meta}>
                <span>作成: {formatDate(issue.createdAt)}</span>
                <span>更新: {formatDate(issue.updatedAt)}</span>
                <span>作成者: {issue.author ?? "不明"}</span>
                <span>コメント: {issue.comments.toLocaleString("ja-JP")}件</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
