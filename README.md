# University Meta Explorer

Select a university, submit, then select its page to read columns A–D from the Google Sheet. Data is fetched live on selection and with Refresh data. Empty cells are explicitly shown as “Not added yet”.

The sheet must remain shared as “Anyone with the link → Viewer”. No API key or Google sign-in is required. The frontend uses Google's Visualization JSONP endpoint to avoid cross-origin fetch restrictions and renders sheet content as plain text.

Run `node preview.mjs` and open http://127.0.0.1:4175. A server is required for the live university directory and editor; opening the HTML directly or using a static-only host will not work.

Editing, adding universities, adding pages, and adding fields are supported through the included Google Apps Script writer. Complete the one-time instructions in `EDITOR-SETUP.md` to enable saves. The public Viewer link continues to support read-only viewing. Write access has not been connected or verified against the real spreadsheet yet.

The university dropdown reads the current tab names from the Google Sheet on every page load. New, renamed, and removed university tabs are detected automatically when the website is opened or reloaded. Cell and page-row changes also require no website edit. Keep each university's columns as A: Page, B: Meta Title, C: Meta Description, D: Meta keywords.

The `/api/universities` endpoint reads Google's public sheet page on the server to avoid browser cross-origin restrictions. It does not use a fixed university list and does not cache the results. Google changes to the public page structure may require updating the tab parser. Build a Cloudflare-compatible Worker with `node build.mjs`; its entrypoint is `dist/server/index.js`.

Source spreadsheet: https://docs.google.com/spreadsheets/d/1aTyJN0KQRLuGt96aPSGGGV8I8-KVqQmhut07MVEvook/edit

