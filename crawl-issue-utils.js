(() => {
  const REPOSITORY = 'Kenu4000/pricewave-girls';
  const ISSUES_API = `https://api.github.com/repos/${REPOSITORY}/issues`;
  const REQUEST_MARKER = /<!--\s*pricewave-crawl-interval-request\s+product:(\d+)\s+interval:(1|3|7|14|off)\s*-->/u;

  let cachedAllRequests = null;
  let loadingAllRequests = null;

  async function fetchAllRequests({ force = false } = {}) {
    if (!force && cachedAllRequests) return cachedAllRequests;
    if (loadingAllRequests) {
      await loadingAllRequests;
      if (!force && cachedAllRequests) return cachedAllRequests;
    }

    loadingAllRequests = (async () => {
      const requests = [];
      for (let page = 1; page <= 10; page += 1) {
        const response = await fetch(`${ISSUES_API}?state=all&sort=created&direction=desc&per_page=100&page=${page}`, {
          cache: 'no-store',
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!response.ok) throw new Error(`GitHub API: HTTP ${response.status}`);
        const issues = await response.json();
        if (!Array.isArray(issues)) break;

        for (const issue of issues) {
          if (issue?.pull_request || typeof issue?.body !== 'string') continue;
          const match = issue.body.match(REQUEST_MARKER);
          if (!match) continue;
          requests.push({
            productId: Number(match[1]),
            interval: match[2],
            state: issue.state,
            url: issue.html_url,
            createdAt: issue.created_at,
            updatedAt: issue.updated_at,
            closedAt: issue.closed_at,
          });
        }
        if (issues.length < 100) break;
      }
      cachedAllRequests = requests;
      return requests;
    })();

    try {
      return await loadingAllRequests;
    } finally {
      loadingAllRequests = null;
    }
  }

  async function findOpenRequest(productId, { force = false } = {}) {
    const requests = await fetchAllRequests({ force });
    return requests.find((request) => request.productId === Number(productId) && request.state === 'open') || null;
  }

  function hasRequestNewerThanSnapshot(productId, generatedAt, requests) {
    const snapshotTime = generatedAt ? new Date(generatedAt).getTime() : Number.NaN;
    if (!Number.isFinite(snapshotTime)) return false;
    return requests.some((request) => {
      if (request.productId !== Number(productId)) return false;
      const latest = new Date(request.closedAt || request.updatedAt || request.createdAt || 0).getTime();
      return Number.isFinite(latest) && latest > snapshotTime;
    });
  }

  function openPlaceholder() {
    const popup = window.open('about:blank', '_blank');
    if (popup) {
      try { popup.opener = null; } catch {}
      try { popup.document.title = 'GitHub Issueを確認中…'; } catch {}
    }
    return popup;
  }

  function navigate(popup, url) {
    if (popup && !popup.closed) {
      popup.location.replace(url);
      return;
    }
    window.location.href = url;
  }

  globalThis.PricewaveCrawlIssue = {
    fetchAllRequests,
    findOpenRequest,
    hasRequestNewerThanSnapshot,
    openPlaceholder,
    navigate,
  };
})();
