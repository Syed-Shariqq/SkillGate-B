import { useCallback, useState } from "react";
export default function MCQQuestion({
  question,
  selectedAnswer,
  onAnswer,
  disabled,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const questionId = question?.id;
  const questionText = question?.question_text;
  const options = question?.options || [];
  const points = question?.points;
  const difficulty = question?.difficulty;
  const handleOptionAction = useCallback(
    (option, isSelected) => {
      if (disabled || !questionId) return;
      if (isSelected) {
        onAnswer(questionId, null);
      } else {
        onAnswer(questionId, option);
      }
    },
    [disabled, onAnswer, questionId],
  );
  if (!question) return null;
  const getDifficultyStyles = (diff) => {
    let colorVar = "var(--color-success)";
    if (diff === "medium") colorVar = "var(--color-warning)";
    if (diff === "hard") colorVar = "var(--color-error)";
    return {
      color: colorVar,
      backgroundColor: `color-mix(in srgb, ${colorVar} 15%, transparent)`,
    };
  };
  const optionLetters = ["A", "B", "C", "D"];
  return (
    <div
      style={{ fontFamily: "var(--font-sans)" }}
      className="w-full md:max-w-3xl mx-auto px-4 md:px-0"
    >
      {/* Badges (row, gap-2, mb-6) */}
      <div className="flex flex-row items-center flex-wrap gap-2 mb-6">
        <span
          style={getDifficultyStyles(difficulty)}
          className="font-mono text-xs uppercase px-3 py-1 rounded-full font-semibold"
        >
          {difficulty}
        </span>
        <span
          style={{
            backgroundColor: "var(--color-accent-soft)",
            color: "var(--color-accent)",
          }}
          className="font-mono text-xs px-3 py-1 rounded-full font-semibold"
        >
          {points} pts
        </span>
      </div>
      {/* Question Text */}
      <h2
        style={{ color: "var(--color-text-primary)" }}
        className="text-xl md:text-2xl font-bold leading-snug mb-8"
      >
        {questionText}
      </h2>
      {/* Options vertical stack, gap-2 md:gap-3 */}
      <div
        className="flex flex-col gap-2 md:gap-3"
        role="radiogroup"
        aria-label="Question options"
      >
        {options.map((option, index) => {
          const isSelected = selectedAnswer === option;
          const isHovered = hoveredIndex === index && !isSelected && !disabled;
          const letter = optionLetters[index] || "";
          // DEFAULT state and variable properties
          let optionStyle = {
            backgroundColor: "var(--color-secondary)",
            border: "1px solid var(--color-border-default)",
            color: "var(--color-text-primary)",
            transition: "all 0.2s ease",
          };
          // SELECTED state
          if (isSelected) {
            optionStyle.backgroundColor = "var(--color-accent-soft)";
            optionStyle.border = "2px solid var(--color-accent)";
          } else if (isHovered) {
            // HOVER state
            optionStyle.backgroundColor = "var(--color-tertiary)";
          }
          // DISABLED state
          if (disabled) {
            optionStyle.opacity = 0.6;
            optionStyle.cursor = "not-allowed";
            optionStyle.pointerEvents = "none";
          }
          let circleStyle = {
            width: "32px",
            height: "32px",
            backgroundColor: "var(--color-tertiary)",
            color: "var(--color-text-tertiary)",
            transition: "all 0.2s ease",
          };
          if (isSelected) {
            circleStyle.backgroundColor = "var(--color-accent)";
            circleStyle.color = "white";
          }
          const handleClick = () => {
            handleOptionAction(option, isSelected);
          };
          const handleKeyDown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOptionAction(option, isSelected);
            }
          };
          return (
            <div
              key={index}
              role="radio"
              aria-checked={isSelected}
              tabIndex={disabled ? -1 : 0}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              onMouseEnter={() => !disabled && setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={optionStyle}
              className="rounded-xl p-3 md:p-4 flex items-center gap-4 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {/* Option Letter Circle */}
              <div
                style={circleStyle}
                className="rounded-full flex items-center justify-center font-bold text-sm shrink-0"
              >
                {letter}
              </div>
              {/* Option Text */}
              <span
                style={{ color: "var(--color-text-primary)" }}
                className="text-sm md:text-base font-medium leading-relaxed"
              >
                {option}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
