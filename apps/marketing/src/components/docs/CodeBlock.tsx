"use client";

import { useCallback, useState, type ReactElement, type ReactNode } from "react";

type CodeBlockProps = {
  children?: ReactNode;
  className?: string;
};

function getCodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getCodeText).join("");
  }

  if (node && typeof node === "object" && "props" in node) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    return getCodeText(element.props.children);
  }

  return "";
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeText = getCodeText(children).replace(/\n$/, "");

  const handleCopy = useCallback(async () => {
    if (codeText.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [codeText]);

  return (
    <div className="docs-code-block">
      <button
        type="button"
        className="docs-code-copy"
        onClick={() => {
          void handleCopy();
        }}
        aria-label={copied ? "Copied" : "Copy code"}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className={className}>{children}</pre>
    </div>
  );
}
