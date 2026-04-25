# MyBooks

A small client-side flipbook app for reading local PDFs in the browser.

This repository uses well-known open-source projects to render and flip PDF pages.

---

## Attributions & Licenses

- **PDF.js** — Mozilla PDF renderer (used to display PDFs in-browser).
  - License: Apache License 2.0
  - Website: https://mozilla.github.io/pdf.js/

- **StPageFlip / page-flip** — page-flip animations and helpers (used for book UI in some versions).
  - License: MIT
  - Repository: https://github.com/stephane-monnot/page-flip

- **Inter** — font used via Google Fonts.
  - Provided by Google Fonts (free for web use).
  - https://fonts.google.com/specimen/Inter

These dependencies are included for developer convenience and are permissively licensed for personal and commercial use as long as you follow each project's license terms (e.g., keeping copyright and license notices where required).

---

## Content & Privacy Notes (Important)

- This app reads PDFs from the user's device using the browser's File API and `FileReader`. By default, **PDF files are processed locally in the user's browser** and are not uploaded to any server by the app.

- If you modify the app to upload or share files to a server (or if you deploy server-side components), you become responsible for the hosted content. Hosting copyrighted material without permission may lead to takedown notices (for example, Netlify responds to DMCA complaints by removing content when required).

- If you are distributing a packaged build that includes third-party modules, keep the modules' `LICENSE` or `NOTICE` files available somewhere in your distribution or documentation to satisfy attribution obligations.

---

## Attribution Suggestion

A small footer with "Built with PDF.js and StPageFlip" is a nice courtesy and helps satisfy attribution expectations. Example copy used in this project:

> Built with PDF.js and StPageFlip. Fonts: Inter (Google Fonts).

If you prefer not to display attribution, you can remove or edit the footer in `index.html`.

---

## Quick Dev Notes

- To update dependencies or check their licenses, inspect `package.json` and the `node_modules` folders in your development environment.
- When distributing a compiled/bundled site, ensure any required license text is present in your distribution artifacts if you are including the upstream files directly.

---

If you want, I can also add a short `LICENSE` file for this project (e.g., MIT) — tell me which license you'd like to apply and I will create it. ✨
