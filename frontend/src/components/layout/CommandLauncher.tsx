import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

export type CommandLauncherItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  keywords?: string[];
  disabled?: boolean;
  disabledReason?: string;
  onRun: () => void;
};

type CommandLauncherProps = {
  open: boolean;
  commands: CommandLauncherItem[];
  onClose: () => void;
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

function CommandLauncher({ open, commands, onClose }: CommandLauncherProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) return commands;

    return commands.filter((command) => {
      const searchableText = [
        command.title,
        command.description,
        command.category,
        ...(command.keywords || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const groups: Array<{ category: string; commands: CommandLauncherItem[] }> = [];

    filteredCommands.forEach((command) => {
      const group = groups.find((currentGroup) => currentGroup.category === command.category);
      if (group) {
        group.commands.push(command);
      } else {
        groups.push({ category: command.category, commands: [command] });
      }
    });

    return groups;
  }, [filteredCommands]);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setActiveIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(filteredCommands.length - 1, 0)),
    );
  }, [filteredCommands.length]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const runCommand = (command: CommandLauncherItem) => {
    if (command.disabled) return;

    command.onRun();
    onClose();
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        filteredCommands.length === 0
          ? 0
          : Math.min(currentIndex + 1, filteredCommands.length - 1),
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const command = filteredCommands[activeIndex];
      if (command) runCommand(command);
    }
  };

  let commandIndex = -1;

  return (
    <div className="command-launcher-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="command-launcher"
        role="dialog"
        aria-modal="true"
        aria-label="Command launcher"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-launcher-search">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search workflows, pages, and actions"
            aria-label="Search commands"
          />
          <kbd>Esc</kbd>
        </div>

        <div className="command-launcher-body">
          {groupedCommands.length === 0 ? (
            <div className="command-launcher-empty">
              <strong>No matching workflows</strong>
              <span>Try Data, SQL, preview, export, or drafts.</span>
            </div>
          ) : (
            groupedCommands.map((group) => (
              <section className="command-group" key={group.category}>
                <p>{group.category}</p>
                <div>
                  {group.commands.map((command) => {
                    commandIndex += 1;
                    const currentIndex = commandIndex;
                    const isActive = currentIndex === activeIndex;

                    return (
                      <button
                        type="button"
                        key={command.id}
                        className={[
                          "command-item",
                          isActive ? "is-active" : "",
                          command.disabled ? "is-disabled" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onClick={() => runCommand(command)}
                        disabled={command.disabled}
                      >
                        <span>
                          <strong>{command.title}</strong>
                          <small>{command.description}</small>
                        </span>
                        {command.disabled && <em>{command.disabledReason || "Unavailable"}</em>}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
        <div className="command-launcher-footer" aria-hidden="true">
          <span>↑↓ navigate</span>
          <span>Enter select</span>
          <span>Esc close</span>
        </div>
      </section>
    </div>
  );
}

export default CommandLauncher;
