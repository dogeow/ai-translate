import { useLayoutEffect, useRef, useState } from "react";
import { formatModelSize } from "../lib/utils.js";

const LIST_MAX_HEIGHT = 240;
const LIST_GAP = 4;

export function ModelDropdown({
  models,
  selectedValue,
  disabled,
  isOpen,
  onToggle,
  onSelect,
  dropdownRef,
}) {
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const [listStyle, setListStyle] = useState(null);
  const selectedModel = models.find((item) => item.name === selectedValue);
  let triggerName =
    models.length === 0 ? "请先点击「测试连接」获取模型列表" : "请选择模型";
  let triggerSize = "";

  if (selectedModel) {
    triggerName = selectedModel.name;
    triggerSize = formatModelSize(selectedModel.size);
  } else if (!disabled && models.length === 0) {
    triggerName = "连接成功，但未找到已拉取的模型";
  }

  const setRefs = (node) => {
    rootRef.current = node;
    if (typeof dropdownRef === "function") {
      dropdownRef(node);
    } else if (dropdownRef) {
      dropdownRef.current = node;
    }
  };

  useLayoutEffect(() => {
    if (!isOpen || disabled) {
      setListStyle(null);
      return undefined;
    }

    function updatePosition() {
      const trigger = rootRef.current?.querySelector(".model-dropdown-trigger");
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportHeight - rect.bottom - LIST_GAP;
      const spaceAbove = rect.top - LIST_GAP;
      const openUpward =
        spaceBelow < Math.min(LIST_MAX_HEIGHT, 160) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        120,
        Math.min(LIST_MAX_HEIGHT, openUpward ? spaceAbove : spaceBelow),
      );

      const style = {
        position: "fixed",
        left: `${Math.max(8, rect.left)}px`,
        width: `${Math.max(120, rect.width)}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 10050,
      };

      if (openUpward) {
        style.bottom = `${viewportHeight - rect.top + LIST_GAP}px`;
        style.top = "auto";
      } else {
        style.top = `${rect.bottom + LIST_GAP}px`;
        style.bottom = "auto";
      }

      setListStyle(style);
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    // 捕获滚动，包含弹窗内部滚动
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, disabled, models.length]);

  return (
    <div
      ref={setRefs}
      className={`model-dropdown ${disabled ? "model-dropdown--disabled" : ""} ${isOpen ? "model-dropdown--open" : ""}`.trim()}
    >
      <button
        type="button"
        className="model-dropdown-trigger"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="model-dropdown-name">{triggerName}</span>
        <span className="model-dropdown-size">{triggerSize}</span>
      </button>
      {!disabled && isOpen ? (
        <div
          ref={listRef}
          className="model-dropdown-list model-dropdown-list--fixed"
          style={listStyle || { visibility: "hidden" }}
          role="listbox"
        >
          {models.map((model) => (
            <div
              key={model.name}
              className="model-dropdown-item"
              role="option"
              aria-selected={model.name === selectedValue}
              onClick={() => onSelect(model.name)}
            >
              <span className="model-name">{model.name}</span>
              <span className="model-size">{formatModelSize(model.size)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
