export function UpdateBanner({
  latestVersion,
  currentVersion,
  onOpenUpdate,
}) {
  return (
    <div className="popup-update-banner">
      <div className="popup-update-banner__title">
        发现新版本 {latestVersion}
      </div>
      <div className="popup-update-banner__text">
        需要手动下载安装，当前版本 {currentVersion}
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onOpenUpdate}
      >
        打开更新页面
      </button>
    </div>
  );
}