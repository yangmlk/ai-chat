import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const isInline = !className;

          if (isInline) {
            return (
              <code
                className="bg-[#2a2a2a] px-1.5 py-0.5 rounded text-sm text-[#e8e4d9] font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <div className="my-3 rounded-lg overflow-hidden">
              <div className="bg-[#1e1e1e] px-4 py-2 text-xs text-gray-400 flex justify-between items-center">
                <span>{language || 'code'}</span>
              </div>
              <SyntaxHighlighter
                language={language || 'text'}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  background: '#1a1a1a',
                  fontSize: '0.875rem',
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          );
        },
        p({ children }) {
          return <p className="mb-3 leading-relaxed">{children}</p>;
        },
        h1({ children }) {
          return <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-[#4a9eff] pl-4 my-3 text-gray-300 italic">
              {children}
            </blockquote>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse border border-[#333]">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-[#1a1a1a]">{children}</thead>;
        },
        th({ children }) {
          return (
            <th className="border border-[#333] px-3 py-2 text-left font-semibold">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-[#333] px-3 py-2">{children}</td>
          );
        },
        hr() {
          return <hr className="my-4 border-[#333]" />;
        },
        a({ children, href }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4a9eff] hover:underline"
            >
              {children}
            </a>
          );
        },
        strong({ children }) {
          return <strong className="font-bold text-[#4a9eff]">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic text-[#4a9eff]/80">{children}</em>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
