# 💬 Giscussions

A comments system powered by GitHub Discussions, maintained as a fork of giscus.

This is **Giscussions**, a fork focused on maintaining upstream compatibility while adding selective fork-specific behavior.

> ⚠️ This is not the official giscus repository.
> For upstream, see: https://github.com/giscus/giscus

---

## ✨ Highlights

- Built on top of giscus (GitHub Discussions-powered)
- No tracking, no ads, always free
- No database required, all data lives in GitHub Discussions
- Supports custom themes and multiple languages
- Extensively configurable
- Automatically fetches new comments and edits from GitHub
- Can be self-hosted

### Fork-specific additions currently implemented

- Configurable branding visibility via `data-show-branding` / `showBranding`
- Author labels prefer display names when available, with username fallback
- Reactions are shown inline in the comment header metadata row
- Logged-out users can open existing mapped threads via a **View on GitHub** button

---

## 🆕 Recent fork changes

### 2026-04-06

**Added**

- Show a **View on GitHub** action beside **Sign in with GitHub** for logged-out users when the mapped discussion already exists

**Changed**

- Prefer comment and reply author display names in the UI, with username fallback and secondary handle display when applicable
- Move discussion reactions into the comment metadata header, next to comment/reply counts
- Refine header link/typography hierarchy and tighten header-to-content spacing across thread states

**Fixed**

- Query author display names through schema-safe GraphQL actor fragments for `User` and `Organization` to avoid runtime errors on `Actor` fields

### 2026-04-05

**Added**

- Configurable branding toggle through `data-show-branding` and `showBranding`

---

## ⚙️ How it works

When giscus loads, the GitHub Discussions search API is used to find the discussion associated with the page based on a chosen mapping (URL, `pathname`, `<title>`, and others).

If no matching discussion is found, a discussion can be created the first time someone comments or reacts.

To comment, visitors authorize the giscus app using GitHub OAuth. When visitors are not signed in and a mapped discussion already exists, giscus shows a **View on GitHub** button next to **Sign in with GitHub** so they can open the discussion directly. Alternatively, visitors can comment directly on GitHub.

---

## 🔗 Relationship to upstream

- Fork repository: https://github.com/marc-santos/giscus
- Based on: https://github.com/giscus/giscus
- Keeps core behavior and compatibility
- Adds selective, fork-specific features
- May diverge from upstream over time

<!-- configuration -->

---

## 🚀 Getting started

Use this fork similarly to giscus, but point to your own deployed script endpoint:

```html
<script src="https://your-fork-url/client.js"
	data-repo="OWNER/REPO"
	data-repo-id="REPO_ID"
	data-category="General"
	data-category-id="CATEGORY_ID"
	data-term=""
	data-mapping="pathname"
	data-strict="0"
	data-reactions-enabled="1"
	data-show-branding="1"
	data-emit-metadata="0"
	data-input-position="bottom"
	data-theme="light"
	data-lang="en"
	data-loading="lazy"
	crossorigin="anonymous"
	async>
</script>
```

For full configuration details, see:

- Repository docs: [ADVANCED-USAGE.md](ADVANCED-USAGE.md)
- Repository self-hosting: [SELF-HOSTING.md](SELF-HOSTING.md)

## 🤝 Contributing

Contributions are welcome, especially for:

- UX and accessibility improvements
- Reliability and performance improvements
- Fork-specific documentation clarity

For upstream-core issues, also consider opening an issue at https://github.com/giscus/giscus.

---

## 📌 Notes

- Fork features are documented conservatively to match implemented behavior
- Upstream changes may be merged selectively

---

Giscussions - enhanced for better conversations.

<!-- end -->
