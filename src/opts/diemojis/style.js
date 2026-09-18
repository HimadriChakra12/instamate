    // ---------------------------------------------------------------------
    // Instamate diemojis: popup styling. Rendered inside its own shadow
    // root (same isolation approach as core/ui.js's settings panel) so
    // Instagram's own CSS can't bleed in, and vice versa. Fixed dark theme
    // -- matches the reference look this feature was modeled on, rather
    // than following Instagram's light/dark toggle.
    // ---------------------------------------------------------------------

    const IM_DIEMOJIS_CSS = `
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

        .imej-popup {
            position: fixed;
            background: #1e1f22;
            color: #dbdee1;
            border: 1px solid #2b2d31;
            border-radius: 8px;
            box-shadow: 0 8px 28px rgba(0,0,0,.5);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 320px;
            z-index: 2147483000;
        }
        .imej-hidden { display: none !important; }

        .imej-header {
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 600;
            color: #949ba4;
            border-bottom: 1px solid #2b2d31;
            flex: none;
        }

        .imej-list {
            overflow-y: auto;
            padding: 4px;
        }

        .imej-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .imej-row:hover, .imej-row.imej-active {
            background: #2b2d31;
        }
        .imej-row-glyph {
            font-size: 20px;
            line-height: 1;
            width: 24px;
            text-align: center;
            flex: none;
        }
        .imej-row-code {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .imej-row-source {
            font-size: 11px;
            color: #6d7176;
            flex: none;
        }

        .imej-empty {
            padding: 14px 12px;
            font-size: 13px;
            color: #6d7176;
        }
    `;
