import { ChoiceCard } from "./ChoiceCard.jsx";

export function ChoiceGrid({
  options,
  value,
  onChange,
  isCompact = false,
  ariaLabel,
}) {
  const className = `popup-choice-grid${
    isCompact ? " popup-choice-grid--compact" : ""
  }`;
  const activeIndex = options.findIndex((option) => option.value === value);

  function focusAndSelect(nextIndex, button) {
    const nextOption = options[nextIndex];
    if (!nextOption) return;

    onChange(nextOption.value);
    const group = button.parentElement;
    const radios = group?.querySelectorAll('[role="radio"]');
    radios?.[nextIndex]?.focus();
  }

  function handleKeyDown(index) {
    return (event) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          focusAndSelect((index + 1) % options.length, event.currentTarget);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          focusAndSelect(
            (index - 1 + options.length) % options.length,
            event.currentTarget,
          );
          break;
        case "Home":
          event.preventDefault();
          focusAndSelect(0, event.currentTarget);
          break;
        case "End":
          event.preventDefault();
          focusAndSelect(options.length - 1, event.currentTarget);
          break;
        default:
          break;
      }
    };
  }

  return (
    <div className={className} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option, index) => (
        <ChoiceCard
          key={option.value}
          value={option.value}
          title={option.title}
          hint={option.hint}
          isActive={value === option.value}
          isCompact={isCompact}
          onClick={onChange}
          onKeyDown={handleKeyDown(index)}
          tabIndex={
            index === activeIndex || (activeIndex === -1 && index === 0)
              ? 0
              : -1
          }
        />
      ))}
    </div>
  );
}