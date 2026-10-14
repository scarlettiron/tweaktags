# Site theme

Everything that gives the TweakTags site its look lives in this folder, so it can be
copied into another repository as is. The pages only link to these files. They hold
no styles of their own.

| File       | What it is                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| `site.css` | Shared by every page: color tokens, base type, top bar, footer, pills, buttons, code blocks, tables, callouts |
| `docs.css` | The documentation page: sidebar layout, section headings, the static previews of the editor UI                |
| `demo.css` | The live demo page: steps, notes, and the pretend customer site                                               |
| `site.js`  | Copy buttons on code blocks, and highlighting the sidebar link for the section in view                        |
| `logo/`    | The logo set (see below)                                                                                      |

## Using it in another repository

1. Copy this whole folder next to your page, for example to `theme/`.
2. Link `site.css` first, then any page stylesheet on top of it.
3. Paste the top bar and footer markup below, and change the links.

To change the colors, edit the custom properties at the top of `site.css`. Every
rule reads from them.

```html
<head>
  <link rel="icon" type="image/png" sizes="32x32" href="./theme/logo/favicon-32.png" />
  <link rel="apple-touch-icon" href="./theme/logo/apple-touch-icon.png" />
  <link rel="stylesheet" href="./theme/site.css" />
</head>
<body>
  <header class="site">
    <a class="brand" href="./">
      <img src="./theme/logo/wordmark-header.png" alt="TweakTags" width="416" height="102" />
    </a>
    <span class="links">
      <a href="./demo/">Live demo</a>
      <!--hide-sm links are hidden on phones to keep the bar on one line.-->
      <a class="hide-sm" href="#install">Install</a>
      <a href="https://github.com/scarlettiron/tweaktags">GitHub</a>
    </span>
  </header>

  <!--page content-->

  <footer>
    Footer text and links.
    <!--Author signature, always the last thing on the page.-->
    <a class="made-by" href="https://codescarlett.com" rel="author">
      <img src="./theme/logo/codescarlett-dragonfly.svg" alt="" width="46" height="31" />
      <span><strong>Scarlett A. Scott</strong><span class="handle">codescarlett</span></span>
    </a>
  </footer>
  <script src="./theme/site.js"></script>
</body>
```

### Components

```html
<p class="callout"><strong>Heads up.</strong> A highlighted note.</p>

<div class="pill-row">
  <span class="pill">A short label</span>
</div>

<a class="cta" href="#install">Get started</a>

<div class="code">
  <div class="bar"><span>terminal</span><button class="copy">Copy</button></div>
  <pre>npm install tweaktags</pre>
</div>
```

Inside a code block, wrap tokens in `tok-c` (comment), `tok-k` (keyword), `tok-s`
(string), or `tok-f` (function or type) spans to color them.

## Logo

| File                             | Use it for                                                          |
| -------------------------------- | ------------------------------------------------------------------- |
| `tweaktags-wordmark.png`         | Full size wordmark with dark text, for light backgrounds            |
| `tweaktags-wordmark-on-dark.png` | Full size wordmark with light text, for dark backgrounds            |
| `tweaktags-icon.png`             | Full size icon with a dark pencil, for light backgrounds            |
| `tweaktags-icon-on-dark.png`     | Full size icon with a light pencil, for dark backgrounds            |
| `wordmark-header.png`            | The light text wordmark at 3x the size the top bar shows it         |
| `favicon-32.png`                 | Browser tab icon                                                    |
| `apple-touch-icon.png`           | iOS home screen icon, on white because iOS fills transparency black |
| `codescarlett-dragonfly.svg`     | The author's dragonfly mark, used in the footer signature           |

The full size files are the masters. Make any new size from them rather than
from one of the small ones.
