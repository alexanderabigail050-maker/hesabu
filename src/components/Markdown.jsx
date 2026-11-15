import React from "react";
function inline(text, key = "") {
  const pattern = /(\[Source:[^\]\n]+\]|`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\$[^$\n]+\$)/g;
  const parts = [];
  let last = 0, match;
  while (match = pattern.exec(text)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const value = match[0], id = `${key}-${match.index}`;
    if (value.startsWith("[Source:")) parts.push(<span className="source-citation" key={id}>{value.slice(1, -1)}</span>);
    else if (value.startsWith("**")) parts.push(<strong key={id}>{value.slice(2, -2)}</strong>);
    else if (value.startsWith("`")) parts.push(<code key={id}>{value.slice(1, -1)}</code>);
    else if (value.startsWith("$")) parts.push(<span className="math-inline" key={id}>{value.slice(1, -1)}</span>);
    else {
      const split = value.indexOf("](");
      parts.push(<a key={id} href={value.slice(split + 2, -1)} target="_blank" rel="noreferrer noopener">{value.slice(1, split)}</a>);
    }
    last = match.index + value.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
function Markdown({ text = "" }) {
  const lines = text.split("\n"), blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<div className="code-block" key={i}>{language && <div>{language}</div>}<pre><code>{code.join("\n")}</code></pre></div>);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)/);
    if (heading) {
      const Tag = `h${Math.min(heading[1].length + 1, 5)}`;
      blocks.push(<Tag key={i}>{inline(heading[2], i)}</Tag>);
      i++;
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={i} />);
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const split = (s) => s.replace(/^\s*\||\|\s*$/g, "").split("|").map((x) => x.trim());
      const head = split(line), rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(split(lines[i++]));
      blocks.push(<div className="table-wrap" key={i}><table><thead><tr>{head.map((v, k) => <th key={k}>{inline(v, k)}</th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}>{row.map((v, k) => <td key={k}>{inline(v, k)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line), items = [], regex = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/;
      while (i < lines.length && regex.test(lines[i])) items.push(lines[i++].replace(regex, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(<Tag key={i}>{items.map((v, k) => <li key={k}>{inline(v, k)}</li>)}</Tag>);
      continue;
    }
    if (line.startsWith("> ")) {
      const quoted = [];
      while (i < lines.length && lines[i].startsWith("> ")) quoted.push(lines[i++].slice(2));
      blocks.push(<blockquote key={i}>{inline(quoted.join(" "), i)}</blockquote>);
      continue;
    }
    const paragraph = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>\s|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i]) && !(lines[i].includes("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || ""))) paragraph.push(lines[i++]);
    blocks.push(<p key={i}>{inline(paragraph.join("\n"), i)}</p>);
  }
  return <div className="markdown">{blocks}</div>;
}
export {
  Markdown as default
};
