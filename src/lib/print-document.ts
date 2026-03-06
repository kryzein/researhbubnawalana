import { PAGE_SIZES, type PageSize, type PageMargins } from "@/components/editor/EditorToolbar";

export function printDocument(
  html: string,
  title: string,
  pageSize: PageSize,
  pageMargins: PageMargins
) {
  const dims = PAGE_SIZES[pageSize];
  const widthIn = dims.width / 96;
  const heightIn = dims.height / 96;

  const toIn = (px: string) => `${parseInt(px) / 96}in`;
  const marginTop = toIn(pageMargins.top);
  const marginBottom = toIn(pageMargins.bottom);
  const marginLeft = toIn(pageMargins.left);
  const marginRight = toIn(pageMargins.right);

  const printContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @page {
      size: ${widthIn}in ${heightIn}in;
      margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft};
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: ${widthIn}in;
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
    }
    h1 { font-size: 24pt; margin: 0.5em 0; }
    h2 { font-size: 18pt; margin: 0.5em 0; }
    h3 { font-size: 14pt; margin: 0.5em 0; }
    p { margin: 0 0 0.5em 0; }
    ul, ol { padding-left: 2em; margin: 0.5em 0; }
    blockquote {
      border-left: 3px solid #ccc;
      margin: 0.5em 0;
      padding-left: 1em;
      color: #555;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.5em 0;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 4pt 8pt;
      text-align: left;
    }
    th { background: #f0f0f0; font-weight: bold; }
    img { max-width: 100%; height: auto; }
    code {
      font-family: 'Courier New', Courier, monospace;
      background: #f5f5f5;
      padding: 0 2pt;
      border-radius: 2pt;
    }
    pre {
      font-family: 'Courier New', Courier, monospace;
      background: #f5f5f5;
      padding: 8pt;
      border-radius: 4pt;
      overflow: auto;
    }
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 1em 0;
      page-break-after: always;
    }
    .task-list-item { list-style: none; }
    .task-list-item input[type="checkbox"] { margin-right: 6pt; }
    mark { background: #ffff00; }
    u { text-decoration: underline; }
    s { text-decoration: line-through; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${html}</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();

  printWindow.onload = () => {
    printWindow.print();
  };
}
