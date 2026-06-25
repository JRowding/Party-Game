"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  PublicPlayer,
  PublicRoom,
  ServerToClientEvents
} from "../lib/types";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const socket = io({
  autoConnect: false
}) as ClientSocket;

export default function Home() {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    socket.on("roomUpdate", setRoom);
    socket.on("roomError", setError);

    return () => {
      socket.off("roomUpdate", setRoom);
      socket.off("roomError", setError);
    };
  }, []);

  const me = room?.me ?? null;
  const judge = room?.players.find((player) => player.id === room.game.judgePlayerId) ?? null;
  const previousWinner =
    room?.players.find((player) => player.id === room.game.previousRoundWinnerPlayerId) ?? null;
  const finalWinner = room?.players.find((player) => player.id === room.game.winnerPlayerId) ?? null;
  const isHost = Boolean(me?.isHost);
  const isJudge = Boolean(me && room?.game.judgePlayerId === me.id);
  const connectedCount = room?.players.filter((player) => player.connected).length ?? 0;

  function ensureSocket() {
    if (!socket.connected) {
      socket.connect();
    }
  }

  function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    ensureSocket();
    socket.emit("createRoom", { nickname }, (result) => {
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    ensureSocket();
    socket.emit("joinRoom", { nickname, code: roomCode }, (result) => {
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  function startGame() {
    if (room && me) {
      socket.emit("startGame", { code: room.code, playerId: me.id });
    }
  }

  function playAgain() {
    if (room && me) {
      socket.emit("playAgain", { code: room.code, playerId: me.id });
    }
  }

  function returnToMainMenu() {
    if (room && me) {
      socket.emit("leaveRoom", { code: room.code, playerId: me.id });
    }

    setRoom(null);
    setRoomCode("");
    setError("");
  }

  function submitAnswer(cardId: string) {
    if (room && me) {
      socket.emit("submitAnswer", { code: room.code, playerId: me.id, cardId });
    }
  }

  function selectWinner(submissionId: string) {
    if (room && me) {
      socket.emit("selectWinner", {
        code: room.code,
        playerId: me.id,
        submissionId
      });
    }
  }

  if (!room) {
    return (
      <main className="app landing">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Private party game for adults</p>
            <h1>Party Card Game</h1>
            <p className="tagline">
              A fast, no-account card night for friends who want anonymous answers,
              rotating judges, and exactly zero faff.
            </p>
          </div>
          <div className="hero-note">
            <strong>No accounts required.</strong>
            <span>Rooms are temporary and vanish when the server restarts.</span>
          </div>
        </section>

        <div className="home-grid">
          <section className="panel action-panel dark">
            <div>
              <p className="eyebrow">Create game</p>
              <h2>Host a new room</h2>
              <p>Share the short room code with 3-8 players, then start from the lobby.</p>
            </div>
            <form className="stack" onSubmit={createRoom}>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Your nickname"
                maxLength={24}
              />
              <button disabled={busy}>Create room</button>
            </form>
          </section>

          <section className="panel action-panel">
            <div>
              <p className="eyebrow">Join game</p>
              <h2>Enter a room code</h2>
              <p className="muted">Use the same nickname to reclaim your seat after disconnecting.</p>
            </div>
            <form className="stack" onSubmit={joinRoom}>
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toLocaleUpperCase())}
                placeholder="Room code"
                maxLength={5}
              />
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Your nickname"
                maxLength={24}
              />
              <button disabled={busy}>Join room</button>
            </form>
          </section>
        </div>

        <section className="how-it-works">
          <h2>How it works</h2>
          <div className="steps">
            <div>
              <strong>1. Read the prompt</strong>
              <span>One player is judge each round.</span>
            </div>
            <div>
              <strong>2. Submit answers</strong>
              <span>Non-judges play one card anonymously.</span>
            </div>
            <div>
              <strong>3. Pick a winner</strong>
              <span>First to 8 points wins the room.</span>
            </div>
          </div>
        </section>

        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  if (room.game.phase === "lobby") {
    return (
      <Shell room={room} error={error} onReturnHome={returnToMainMenu}>
        <div className="split">
          <section className="panel lobby-panel">
            <p className="eyebrow">Lobby</p>
            <h1>Room <span className="code large">{room.code}</span></h1>
            <p className="muted">Waiting for 3-8 connected players. Seats stay reserved by nickname.</p>
            <PlayerList room={room} />
          </section>

          <section className="panel dark stack">
            <h2>Host controls</h2>
            <p>{connectedCount} players connected</p>
            {isHost ? (
              <button disabled={connectedCount < 3 || connectedCount > 8} onClick={startGame}>
                Start game
              </button>
            ) : (
              <p>Only the host can start the game.</p>
            )}
          </section>
        </div>
      </Shell>
    );
  }

  if (room.game.phase === "gameOver") {
    return (
      <Shell room={room} error={error} onReturnHome={returnToMainMenu}>
        <section className="game-over">
          <div className="panel dark victory-panel">
            <p className="eyebrow">Game over</p>
            <h1>{finalWinner ? `${finalWinner.nickname} wins` : "Winner decided"}</h1>
            <p>Final target: {room.game.targetScore} points</p>
            {room.game.previousRoundWinningCard && (
              <div className="card answer-preview final-card">
                <strong>Final winning card</strong>
                <p>{room.game.previousRoundWinningCard.text}</p>
              </div>
            )}
            <div className="button-row">
              {isHost ? (
                <button onClick={playAgain}>Play again</button>
              ) : (
                <span className="waiting-text">Waiting for the host to start another game.</span>
              )}
              <button className="secondary inverted" onClick={returnToMainMenu}>
                Return to main menu
              </button>
            </div>
          </div>
          <Scores room={room} title="Final scores" />
        </section>
      </Shell>
    );
  }

  return (
    <Shell room={room} error={error} onReturnHome={returnToMainMenu}>
      <div className="game-layout">
        <section className="stack">
          <RoundSummary
            room={room}
            judge={judge}
            previousWinner={previousWinner}
          />

          {isJudge ? (
            <JudgePanel room={room} onPick={selectWinner} />
          ) : (
            <PlayerHand room={room} onSubmit={submitAnswer} />
          )}
        </section>

        <aside className="stack">
          <Submissions room={room} />
          <Scores room={room} />
          <PlayerList room={room} compact />
        </aside>
      </div>
    </Shell>
  );
}

function Shell({
  room,
  error,
  onReturnHome,
  children
}: {
  room: PublicRoom;
  error: string;
  onReturnHome: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="app">
      <section className="topbar">
        <div>
          <div className="brand">Party Card Game</div>
          <div className="muted small">Private room for adults</div>
        </div>
        <div className="row">
          <span className="code">{room.code}</span>
          <span>{room.me?.nickname}</span>
          <button className="secondary compact" onClick={onReturnHome}>
            Leave
          </button>
        </div>
      </section>
      {children}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

function RoundSummary({
  room,
  judge,
  previousWinner
}: {
  room: PublicRoom;
  judge: PublicPlayer | null;
  previousWinner: PublicPlayer | null;
}) {
  return (
    <section className="stack">
      <div className="card dark prompt">{room.game.promptCard?.text}</div>
      <div className="round-strip">
        <span>Round {room.game.roundNumber}</span>
        <span>Judge: {judge?.nickname ?? "Unknown"}</span>
        <span>Target: {room.game.targetScore}</span>
      </div>
      <div className="panel previous-round">
        <h2>Previous round</h2>
        {previousWinner && room.game.previousRoundWinningCard ? (
          <p>
            {previousWinner.nickname} won with "{room.game.previousRoundWinningCard.text}"
          </p>
        ) : (
          <p className="muted">No previous winner yet.</p>
        )}
      </div>
    </section>
  );
}

function PlayerList({ room, compact = false }: { room: PublicRoom; compact?: boolean }) {
  return (
    <section className={compact ? "panel" : undefined}>
      {compact && <h2>Players</h2>}
      <ul className="player-list">
        {room.players.map((player) => (
          <li key={player.id}>
            <span>
              Seat {player.seat}: {player.nickname}
            </span>
            <span className="row">
              <span className="pill">{player.handCount} cards</span>
              {player.isHost && <span className="pill">Host</span>}
              <span className="pill">{player.connected ? "Online" : "Away"}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayerHand({
  room,
  onSubmit
}: {
  room: PublicRoom;
  onSubmit: (cardId: string) => void;
}) {
  const isSubmitted = room.meSubmittedThisRound;
  const handCount = room.me?.hand.length ?? 0;

  return (
    <section className="panel stack">
      <div className="section-head">
        <h2>Your hand</h2>
        <span className="pill">{handCount} cards remaining</span>
      </div>
      <p className="muted">{isSubmitted ? "Answer submitted. Waiting for the judge." : "Choose one answer card."}</p>
      <div className="card-grid">
        {room.me?.hand.map((card) => (
          <button
            className="answer-card"
            disabled={isSubmitted || room.game.phase !== "playing"}
            key={card.id}
            onClick={() => onSubmit(card.id)}
          >
            {card.text}
          </button>
        ))}
      </div>
    </section>
  );
}

function JudgePanel({
  room,
  onPick
}: {
  room: PublicRoom;
  onPick: (submissionId: string) => void;
}) {
  const canPick = room.game.phase === "judging";

  return (
    <section className="panel stack">
      <div className="section-head">
        <h2>Judge controls</h2>
        <span className="pill">{room.me?.hand.length ?? 0} cards in hand</span>
      </div>
      <p className="muted">
        {canPick ? "Pick the best anonymous answer." : "Read the prompt while players submit."}
      </p>
      <div className="card-grid">
        {room.game.submissions.map((submission, index) => (
          <button
            className="answer-card"
            disabled={!canPick || !submission.card}
            key={submission.id}
            onClick={() => onPick(submission.id)}
          >
            <strong>Submission {index + 1}</strong>
            <span>{submission.card?.text ?? "Hidden answer"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Submissions({ room }: { room: PublicRoom }) {
  const activeNonJudges = useMemo(
    () =>
      room.players.filter(
        (player) => player.connected && player.id !== room.game.judgePlayerId
      ).length,
    [room]
  );
  const visible = room.game.phase === "judging";

  return (
    <section className="panel">
      <h2>Submitted answers</h2>
      <p className="muted">
        {room.game.submissions.length} of {activeNonJudges}
      </p>
      <div className="stack">
        {room.game.submissions.length === 0 && <p className="muted">No answers submitted yet.</p>}
        {room.game.submissions.map((submission, index) => (
          <div className="card answer-preview" key={submission.id}>
            <strong>Submission {index + 1}</strong>
            <p>{visible ? submission.card?.text : "Answer hidden until all active players submit."}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Scores({ room, title = "Scores" }: { room: PublicRoom; title?: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <ul className="score-list">
        {[...room.players]
          .sort((first, second) => second.score - first.score || first.seat - second.seat)
          .map((player) => (
            <li key={player.id}>
              <span>{player.nickname}</span>
              <strong>{player.score}</strong>
            </li>
          ))}
      </ul>
    </section>
  );
}
