/**
 * ProgressiveContent - Contenido progresivo con streaming
 *
 * Muestra contenido que se actualiza en tiempo real con soporte para markdown
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProgressiveContentProps {
  content: string;
  isStreaming?: boolean;
  language?: string;
  className?: string;
  onCopy?: () => void;
  copied?: boolean;
}

export function ProgressiveContent({
  content,
  isStreaming = false,
  language,
  className,
  onCopy,
  copied
}: ProgressiveContentProps) {
  // Detectar si el contenido es código
  const isCode = useMemo(() => {
    const trimmed = content.trim();
    return trimmed.startsWith('```') || language !== undefined;
  }, [content, language]);

  // Extraer lenguaje de código
  const codeLanguage = useMemo(() => {
    if (language) return language;

    const match = content.match(/```(\w+)?/);
    return match?.[1] || 'text';
  }, [content, language]);

  // Extraer contenido sin markdown de código
  const codeContent = useMemo(() => {
    return content.replace(/```(\w+)?\n?/g, '').replace(/```$/g, '');
  }, [content]);

  // Contenido markdown para renderizado
  const markdownContent = useMemo(() => {
    if (isCode) return content;

    // Procesar contenido para mostrarlo como markdown
    return content;
  }, [content, isCode]);

  if (isCode) {
    return (
      <div className={cn('relative group', className)}>
        <div className="flex items-center justify-between px-4 py-2 bg-muted rounded-t-lg border">
          <span className="text-sm font-medium">{codeLanguage}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                Copiar
              </>
            )}
          </Button>
        </div>

        <SyntaxHighlighter
          language={codeLanguage}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            maxHeight: '400px',
          }}
          showLineNumbers
        >
          {codeContent}
        </SyntaxHighlighter>

        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
        )}
      </div>
    );
  }

  // Contenido normal con markdown
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        components={{
          code(props: any) {
            const { node, inline, className, children } = props;
            const match = /language-(\w+)/.exec(className || '');

            return !inline && match ? (
              <div className="relative group">
                <SyntaxHighlighter
                  language={match[1] || 'text'}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: '1em 0',
                    borderRadius: '0.5rem',
                    maxHeight: '400px',
                  }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code className={className}>
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2">{children}</ol>;
          },
          li({ children }) {
            return <li className="mb-1">{children}</li>;
          },
        }}
      >
        {markdownContent}
      </ReactMarkdown>

      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
      )}
    </div>
  );
}

interface StreamingContentProps {
  chunks: Array<{
    content: string;
    timestamp: Date;
    isComplete: boolean;
  }>;
  className?: string;
}

export function StreamingContent({ chunks, className }: StreamingContentProps) {
  // Combinar todos los chunks
  const fullContent = useMemo(() => {
    return chunks.map(c => c.content).join('');
  }, [chunks]);

  // Verificar si el último chunk está completo
  const isStreaming = useMemo(() => {
    const lastChunk = chunks[chunks.length - 1];
    return lastChunk ? !lastChunk.isComplete : false;
  }, [chunks]);

  return (
    <ProgressiveContent
      content={fullContent}
      isStreaming={isStreaming}
      className={className}
    />
  );
}
