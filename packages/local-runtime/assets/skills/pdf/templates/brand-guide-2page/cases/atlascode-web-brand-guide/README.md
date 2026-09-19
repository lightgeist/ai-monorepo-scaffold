# AtlasCode illustrative brand-guide template

This is a local, editable two-page HTML example derived from the supplied AtlasCode / Deep Intuition theme. It preserves the original example's two-page composition, not the former company's product claims or website branding. It does not fetch a website or require remote logos or fonts.

Use `source.html` as an example of layout and copy hierarchy. Replace example content with the current user's approved brand material before producing their document. Do not present this as a comprehensive corporate brand standard or a verified live website extraction.

From the installed PDF skill root, render with the existing helper:

```bash
bash scripts/make.sh render --in templates/brand-guide-2page/cases/atlascode-web-brand-guide/source.html --out /tmp/brand-guide.pdf --format A4 --wait 1200
```

After editing, verify the page count, margins, text extraction and both rendered pages. Two source sections alone do not prove correct PDF pagination. Generated PDF files are not committed with this example.
