export function AboutTab({ currentVersion }) {
  return (
    <div className="card update-card">
      <h2>关于英语学习和AI翻译</h2>
      <div className="update-status-card">
        <div className="update-status-card__row">
          <span className="update-status-card__label">当前版本</span>
          <span className="update-status-card__value">{currentVersion}</span>
        </div>
        <div className="update-status-card__row">
          <span className="update-status-card__label">更新方式</span>
          <span className="update-status-card__value">
            Chrome Web Store 自动更新
          </span>
        </div>
      </div>
      <p className="update-card__hint">
        Chrome 会定期检查商店版本，并在扩展空闲时完成安装。
      </p>
    </div>
  );
}
