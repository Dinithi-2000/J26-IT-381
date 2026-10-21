# Local typefaces

- **Inter**, variable weights 400–700: Latin and Greek WOFF2 subsets from the [Google Fonts distribution](https://fonts.google.com/specimen/Inter). Greek supports sensor units such as Ω. See `Inter-OFL.txt` for the full SIL Open Font License and copyright notices.
- **Plus Jakarta Sans**, variable weights 600–800: Latin WOFF2 subset from the [Google Fonts distribution](https://fonts.google.com/specimen/Plus+Jakarta+Sans). See `PlusJakartaSans-OFL.txt` for the full SIL Open Font License and copyright notices.

Files are served locally through `client/src/styles/typography.css`, with `font-display: swap` and system fallback fonts. No font-service request or new npm dependency is required at runtime. Fonts are unmodified font subsets supplied by Google Fonts.
