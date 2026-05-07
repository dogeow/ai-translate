import { useEffect, useState, useCallback } from "react";
import { UI_REWRITE_ORIGINAL_VERSION } from "../../shared/ui-rewrites.js";

function sendBg(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function formatDate(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export function UiRewriteTab() {
  const [rewrites, setRewrites] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await sendBg({ action: "getUiRewrites" });
    setRewrites(res?.rewrites || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    function onChanged(changes, area) {
      if (area === "local" && "uiRewrites" in changes) void reload();
    }
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [reload]);

  async function setActive(ruleId, versionId) {
    await sendBg({ action: "setUiRewriteActiveVersion", ruleId, versionId });
    await reload();
  }

  async function deleteVersion(ruleId, versionId) {
    if (!window.confirm("删除该版本？此操作不可撤销。")) return;
    await sendBg({ action: "deleteUiRewriteVersion", ruleId, versionId });
    await reload();
  }

  async function deleteRule(ruleId) {
    if (!window.confirm("删除整条改造规则及其所有版本？")) return;
    await sendBg({ action: "deleteUiRewriteRule", ruleId });
    await reload();
  }

  async function updatePattern(ruleId, urlPattern) {
    await sendBg({
      action: "updateUiRewriteRule",
      ruleId,
      patch: { urlPattern },
    });
    await reload();
  }

  async function updateLabel(ruleId, label) {
    await sendBg({ action: "updateUiRewriteRule", ruleId, patch: { label } });
    await reload();
  }

  return (
    <div className="card">
      <h2>AI 页面改造</h2>
      <p className="hint">
        在浏览网页时，从扩展弹窗或右键菜单选择「AI 改造这个页面」即可生成 CSS。这里管理所有已保存的改造规则与历史版本，下次访问匹配的网页会自动应用激活的版本。
      </p>

      <div style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={reload}>
          刷新
        </button>
      </div>

      {loading ? (
        <div className="hint" style={{ marginTop: 12 }}>
          加载中…
        </div>
      ) : null}
      {!loading && rewrites.length === 0 ? (
        <div className="hint" style={{ marginTop: 12 }}>
          暂无改造规则。在网页上使用 popup 或右键菜单触发即可。
        </div>
      ) : null}

      <div className="ui-rewrite-list" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {rewrites.map((rule) => (
          <details
            key={rule.id}
            open
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: 12,
              background: "var(--bg-elevated)",
            }}
          >
            <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {rule.label || rule.urlPattern}
              </span>
              <span className="hint" style={{ fontSize: 12 }}>
                共 {rule.versions?.length || 0} 个版本，更新于 {formatDate(rule.updatedAt)}
              </span>
            </summary>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <label className="field" style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>名称</span>
                <input
                  type="text"
                  defaultValue={rule.label}
                  onBlur={(e) => {
                    if (e.target.value !== rule.label) {
                      void updateLabel(rule.id, e.target.value);
                    }
                  }}
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    padding: "6px 10px",
                  }}
                />
              </label>
              <label className="field" style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  URL 匹配（支持 * 通配符）
                </span>
                <input
                  type="text"
                  defaultValue={rule.urlPattern}
                  onBlur={(e) => {
                    if (e.target.value !== rule.urlPattern) {
                      void updatePattern(rule.id, e.target.value);
                    }
                  }}
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    padding: "6px 10px",
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    fontSize: 12,
                  }}
                />
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                  <input
                    type="radio"
                    name={`ver-${rule.id}`}
                    checked={
                      !rule.activeVersionId ||
                      rule.activeVersionId === UI_REWRITE_ORIGINAL_VERSION
                    }
                    onChange={() => setActive(rule.id, UI_REWRITE_ORIGINAL_VERSION)}
                  />
                  <span>原版（不应用 CSS）</span>
                </label>
                {(rule.versions || []).map((v) => (
                  <div
                    key={v.id}
                    style={{
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      padding: 8,
                    }}
                  >
                    <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-primary)", fontSize: 13 }}>
                      <input
                        type="radio"
                        name={`ver-${rule.id}`}
                        checked={rule.activeVersionId === v.id}
                        onChange={() => setActive(rule.id, v.id)}
                      />
                      <span style={{ fontWeight: 600 }}>{v.label}</span>
                      <span className="hint" style={{ fontSize: 11, marginLeft: "auto" }}>
                        {formatDate(v.createdAt)}{v.model ? ` · ${v.model}` : ""}
                      </span>
                    </label>
                    {v.prompt ? (
                      <div className="hint" style={{ marginTop: 4, fontSize: 12 }}>
                        提示词：{v.prompt}
                      </div>
                    ) : null}
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 12 }}>
                        查看 CSS（{(v.css || "").length} 字符）
                      </summary>
                      <pre style={{
                        marginTop: 4,
                        maxHeight: 200,
                        overflow: "auto",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 6,
                        padding: 8,
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        whiteSpace: "pre-wrap",
                      }}>{v.css}</pre>
                    </details>
                    <div style={{ marginTop: 6, textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={() => deleteVersion(rule.id, v.id)}
                      >
                        删除版本
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 8, textAlign: "right" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => deleteRule(rule.id)}
                  style={{ color: "var(--error-text)" }}
                >
                  删除整条规则
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
