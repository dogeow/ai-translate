import { useCallback, useEffect, useState } from "react";

async function send(action, payload = {}) {
  return chrome.runtime.sendMessage({ action, ...payload });
}

export function DogeowCloudSync() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [syncMeta, setSyncMeta] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await send("dogeowGetAuth");
      if (!result?.ok && result?.error) {
        setError(result.error);
      }
      setIsLoggedIn(!!result?.isLoggedIn);
      setUser(result?.user || null);
      setSyncMeta(result?.syncMeta || null);
    } catch (err) {
      setError(err?.message || "无法读取登录状态");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleLogin = async () => {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const result = await send("dogeowLogin");
      if (!result?.ok) {
        setError(result?.error || "登录失败");
        return;
      }
      setIsLoggedIn(true);
      setUser(result.user || result.auth?.user || null);
      if (result.sync?.error) {
        setStatus("已登录，但首次同步失败：" + result.sync.error);
      } else if (result.sync) {
        setStatus(
          `已登录并同步：学习中 ${result.sync.studyingCount} · 我会 ${result.sync.knownCount}`,
        );
        setSyncMeta({
          revision: result.sync.revision,
          syncedAt: result.sync.syncedAt,
          lastSyncAt: Date.now(),
        });
      } else {
        setStatus("已登录 DogeOW");
      }
      await refresh();
    } catch (err) {
      setError(err?.message || "登录失败");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError("");
    try {
      await send("dogeowLogout");
      setIsLoggedIn(false);
      setUser(null);
      setSyncMeta(null);
      setStatus("已退出 DogeOW 登录");
    } catch (err) {
      setError(err?.message || "退出失败");
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const result = await send("dogeowSyncWords");
      if (!result?.ok) {
        setError(result?.error || "同步失败");
        return;
      }
      setStatus(
        `同步完成：学习中 ${result.studyingCount} · 我会 ${result.knownCount}`,
      );
      setSyncMeta({
        revision: result.revision,
        syncedAt: result.syncedAt,
        lastSyncAt: Date.now(),
      });
    } catch (err) {
      setError(err?.message || "同步失败");
    } finally {
      setBusy(false);
    }
  };

  const lastSyncText = syncMeta?.lastSyncAt
    ? new Date(syncMeta.lastSyncAt).toLocaleString()
    : syncMeta?.syncedAt
      ? new Date(syncMeta.syncedAt).toLocaleString()
      : "尚未同步";

  return (
    <section className="word-learning-cloud" aria-labelledby="word-cloud-title">
      <div className="word-learning-cloud__heading">
        <div>
          <h3 id="word-cloud-title">DogeOW 云同步</h3>
          <p className="hint">
            使用 next.dogeow.com 账号登录后，生词本可在多设备间合并同步。
          </p>
        </div>
        <span
          className={`word-learning-cloud__badge ${isLoggedIn ? "word-learning-cloud__badge--ok" : ""}`.trim()}
        >
          {loading ? "检测中" : isLoggedIn ? "已登录" : "未登录"}
        </span>
      </div>

      {isLoggedIn ? (
        <div className="word-learning-cloud__user">
          <span>
            {user?.name || user?.email || "DogeOW 用户"}
            {user?.email && user?.name ? ` · ${user.email}` : ""}
          </span>
          <span className="hint">上次同步：{lastSyncText}</span>
        </div>
      ) : null}

      <div className="field-row word-learning-cloud__actions">
        {isLoggedIn ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void handleSync()}
            >
              {busy ? "同步中…" : "立即同步"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void handleLogout()}
            >
              退出登录
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || loading}
            onClick={() => void handleLogin()}
          >
            {busy ? "登录中…" : "DogeOW 登录"}
          </button>
        )}
      </div>

      {status ? <div className="word-learning-cloud__status">{status}</div> : null}
      {error ? (
        <div className="word-learning-cloud__status word-learning-cloud__status--error">
          {error}
        </div>
      ) : null}
    </section>
  );
}
