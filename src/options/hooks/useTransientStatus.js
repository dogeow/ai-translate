import { useCallback, useEffect, useRef, useState } from "react";

export function useTransientStatus(timeoutMs = 1800) {
  const [status, setStatus] = useState({ text: "", isError: false });
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
    };
  }, []);

  const showStatus = useCallback((text, isError = false) => {
    setStatus({ text, isError });
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setStatus({ text: "", isError: false });
    }, timeoutMs);
  }, [timeoutMs]);

  return { status, setStatus, showStatus };
}
