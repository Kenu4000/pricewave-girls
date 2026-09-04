import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TRIGGER_LABELS: Record<string, string> = {
  manual: "手動",
  alarm: "自動",
  startup: "起動時補完",
  retry: "再試行",
  resume: "再開",
  unknown: "不明",
};

const STATUS_LABELS: Record<string, string> = {
  running: "実行中",
  completed: "完了",
  blocked: "停止",
  cancelled: "キャンセル",
  error: "エラー",
};

function formatDuration(startedAt: Date, finishedAt: Date | null) {
  if (!finishedAt) return "-";
  const seconds = Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}時間${minutes}分${rest}秒`;
  if (minutes > 0) return `${minutes}分${rest}秒`;
  return `${rest}秒`;
}

function viewerStatus(run: { viewerPublishStatus: string | null; viewerPublishedAt: Date | null }) {
  if (run.viewerPublishStatus === "success") {
    return run.viewerPublishedAt
      ? `公開済み ${run.viewerPublishedAt.toLocaleString("ja-JP")}`
      : "公開済み";
  }
  if (run.viewerPublishStatus === "error") return "公開失敗";
  return "未実行";
}

export default async function CrawlRunsPage() {
  const runs = await prisma.crawlRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  const latest = runs[0] ?? null;
  const completed = runs.filter((run) => run.status === "completed").length;

  return (
    <section>
      <div className="list-heading">
        <div>
          <h1>巡回履歴</h1>
          <p className="muted">直近{runs.length.toLocaleString("ja-JP")}回の実行記録</p>
        </div>
      </div>

      {latest ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <strong>最新: {STATUS_LABELS[latest.status] ?? latest.status}</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            {latest.startedAt.toLocaleString("ja-JP")} / 対象 {latest.total.toLocaleString("ja-JP")}件 / 成功 {latest.succeeded.toLocaleString("ja-JP")}件 / 失敗 {latest.failed.toLocaleString("ja-JP")}件
          </p>
        </div>
      ) : null}

      {runs.length > 0 ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>開始</th>
                <th>起動</th>
                <th>状態</th>
                <th>対象</th>
                <th>成功</th>
                <th>失敗</th>
                <th>所要時間</th>
                <th>Viewer</th>
                <th>メッセージ</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.startedAt.toLocaleString("ja-JP")}</td>
                  <td>{TRIGGER_LABELS[run.trigger] ?? run.trigger}</td>
                  <td>{STATUS_LABELS[run.status] ?? run.status}</td>
                  <td>{run.total.toLocaleString("ja-JP")}</td>
                  <td>{run.succeeded.toLocaleString("ja-JP")}</td>
                  <td>{run.failed.toLocaleString("ja-JP")}</td>
                  <td>{formatDuration(run.startedAt, run.finishedAt)}</td>
                  <td>{viewerStatus(run)}</td>
                  <td>{run.message ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <p>巡回実行履歴はまだありません。</p>
        </div>
      )}

      {runs.length > 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          完了 {completed.toLocaleString("ja-JP")} / 記録 {runs.length.toLocaleString("ja-JP")} 回
        </p>
      ) : null}
    </section>
  );
}
