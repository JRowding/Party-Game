type GameTitleProps = {
  compact?: boolean;
};

const words = [
  { initial: "C", rest: "ards" },
  { initial: "U", rest: "nder" },
  { initial: "N", rest: "o" },
  { initial: "T", rest: "olerance" }
];

export function GameTitle({ compact = false }: GameTitleProps) {
  return (
    <span className={compact ? "game-title compact-title" : "game-title"}>
      {words.map((word) => (
        <span className="title-word" key={word.initial}>
          <span className="title-initial">{word.initial}</span>
          <span>{word.rest}</span>
        </span>
      ))}
    </span>
  );
}
