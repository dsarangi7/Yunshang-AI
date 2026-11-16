# Yunshang AI

Public marketing site for [Yunshang AI](https://github.com/dsarangi7/Yunshang-AI), a Shenzhen manufacturer of AI camera glasses and related wearables. The site is aimed at importers, retailers, and distributors. It is a static, four-language page (English, 中文, Español, हिन्दी).

This repository is the source of truth for the site. Production hosting is on Vercel, which deploys automatically from `main`.

## Local preview

From the repository root:

```bash
python3 -m http.server 8080
```

Then open http://127.0.0.1:8080/. Switch language with the control in the header, or with `?lang=zh`, `?lang=es`, or `?lang=hi`.

## Project layout

| Path | Role |
| --- | --- |
| `tools/index.template.html` | Page template. Edit this, not the generated `index.html`. |
| `translations.js` | All UI copy in all four languages. |
| `tools/build.py` | Builds `index.html`, `sitemap.xml`, and `robots.txt` from the template and the English dictionary. |
| `tools/i18n_check.py` | Confirms every language has the same keys. |
| `main.js`, `style.css` | Behavior and styles. |
| `assets/` | Product images and the logo. |
| `vercel.json` | Static hosting, caching, and security headers. |

## Making copy or structure changes

1. Edit `translations.js` and/or `tools/index.template.html`.
2. Keep all four languages in sync, then run:

   ```bash
   python3 tools/i18n_check.py translations.js
   ```

3. Rebuild from the repository root. Pass the real production origin when you know it (no trailing slash):

   ```bash
   python3 tools/build.py https://www.example.com
   ```

   If you omit the origin, the build keeps the placeholder `https://YOUR-DOMAIN.com`.

4. Preview locally before you open a pull request.

Do not edit `index.html`, `sitemap.xml`, or `robots.txt` by hand. They are generated.

## Continuous integration

Every push and pull request runs `.github/workflows/ci.yml`, which checks the translation dictionary and JavaScript syntax.

## Launch checklist

The public files still contain configuration placeholders. Fill these in before calling the site finished or sending traffic to production:

- [ ] Rebuild with the real production domain so canonical tags, Open Graph, JSON-LD, `robots.txt`, and the sitemap no longer say `https://YOUR-DOMAIN.com`.
- [ ] Replace `${WHATSAPP_NUMBER}` in `main.js`, the template footer, and the build script, then rebuild. The contact email is already `Szyskj22@163.com`.
- [ ] Give the quote form a real submission path (it currently only composes a `mailto:` / WhatsApp link).
- [ ] Add a privacy policy, terms, and the legal company name and address.
- [ ] Have the client sign off on strong claims (for example “best rate in the world,” “ChatGPT-class,” “139 languages,” “32MP photos” vs interpolated, and the CACY01 weight of 172g).
- [ ] Compress product images (WebP/AVIF with PNG fallback). The hero PNG is 513 KB.

## License

All rights reserved. See [LICENSE](LICENSE). This is a commercial site; do not reuse the copy or product assets without permission.
