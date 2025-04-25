# Project TODOs

## Enable Chinese Character Support in PDF Reports

**Context:**
The PDF generation service (`backend/services/pdf/formatter.py`) has been updated to use a Unicode font (`NotoSansSC-Regular.ttf` by default) to support rendering non-Latin characters like Chinese. However, the font file itself is not included in the repository.

**Required Action:**
To ensure Chinese characters are displayed correctly in generated PDF reports, you need to:

1.  **Download a suitable font:** Obtain a `.ttf` font file that includes Chinese glyphs. A recommended open-source option is **Noto Sans SC (Simplified Chinese)**.
    *   Download link: [https://fonts.google.com/noto/specimen/Noto+Sans+SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC)
    *   Look for the `NotoSansSC-Regular.ttf` file within the downloaded package (or choose another weight like Bold if preferred, but update the filename in `backend/services/pdf/formatter.py` accordingly).
2.  **Create a font directory:** In the `backend` directory, create a new folder named `fonts`.
    *   The final path should be: `fluent-note-taker-ai/backend/fonts/`
3.  **Place the font file:** Copy the downloaded `NotoSansSC-Regular.ttf` file into the newly created `backend/fonts/` directory.

**Verification:**
Once the font is correctly placed, restart the backend service if it's running. Generate a PDF report containing Chinese text to confirm it renders correctly. If the font is missing, the service will print a warning during startup/PDF generation and fall back to a default font, likely resulting in incorrect rendering.
