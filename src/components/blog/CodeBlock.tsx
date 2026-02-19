import { useState } from 'react'

export function CodeBlock({
  code,
  language,
}: {
  code: string
  language?: string
}) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 900)
    } catch {
      // ignore
    }
  }

  return (
    <div className="blog-codeblock" data-lang={language ?? 'text'}>
      <button
        type="button"
        className="blog-codeblock__copy"
        onClick={onCopy}
        aria-label="Copy code to clipboard"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="blog-code-pre blog-code-pre--single" tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

