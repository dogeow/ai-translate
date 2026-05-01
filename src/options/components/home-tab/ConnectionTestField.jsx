export function ConnectionTestField({
  isMiniMax,
  isGitHub,
  isChromeAi,
  isMiniMaxKeyMissing,
  isGitHubTokenMissing,
  testConnectionClassName,
  testConnectionResult,
  settingsRef,
  updateConnectionStatus,
  setOriginsModalOpen,
}) {
  return (
    <div className="field">
      <div className="field-row" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={isMiniMaxKeyMissing || isGitHubTokenMissing}
          onClick={async () => {
            await updateConnectionStatus(settingsRef.current, {
              preserveTestMessage: false,
              updateBannerStatus: false,
              showTestPending: true,
            });
          }}
        >
          {isChromeAi ? "检查可用性" : "测试连接"}
        </button>
        <span className={testConnectionClassName}>{testConnectionResult.text}</span>
        {!isMiniMax && !isGitHub && !isChromeAi && testConnectionResult.showAction ? (
          <button
            type="button"
            className="btn btn-secondary test-result-action"
            onClick={() => setOriginsModalOpen(true)}
          >
            查看解决方法
          </button>
        ) : null}
      </div>
    </div>
  );
}