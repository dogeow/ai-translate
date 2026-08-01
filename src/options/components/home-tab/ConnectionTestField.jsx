export function ConnectionTestField({
  isMiniMax,
  isGitHub,
  isChatGpt,
  isChromeAi,
  isMiniMaxKeyMissing,
  isGitHubTokenMissing,
  isModelMissing,
  testConnectionClassName,
  testConnectionResult,
  settingsRef,
  connectionSettings = null,
  updateConnectionStatus,
  setOriginsModalOpen,
}) {
  return (
    <div className="field provider-connection-test">
      <div className="field-row">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={
            isMiniMaxKeyMissing ||
            isGitHubTokenMissing ||
            isModelMissing
          }
          onClick={async () => {
            await updateConnectionStatus(
              connectionSettings || settingsRef.current,
              {
                preserveTestMessage: false,
                updateBannerStatus: false,
                showTestPending: true,
              },
            );
          }}
        >
          {isChromeAi ? "检查可用性" : "测试连接"}
        </button>
        <span className={testConnectionClassName}>{testConnectionResult.text}</span>
        {!isMiniMax && !isGitHub && !isChatGpt && !isChromeAi && testConnectionResult.showAction ? (
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
