# Deploy Headers for Cross-Origin Isolation

WP-0 requires deployed builds to return these headers on every route:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

They are the production equivalent of the Vite dev/preview `coopCoep()` plugin and keep `crossOriginIsolated === true` after the app leaves local preview.

## Static Hosts

### Netlify

Commit `public/_headers`. Vite copies it to `dist/_headers` during `npm run build`, and Netlify reads it from the publish directory.

```text
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### Cloudflare Pages

Commit the same `public/_headers` file. Cloudflare Pages also consumes `_headers` from the built output directory, so `dist/_headers` must be present after build.

```text
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

## nginx

Add the headers inside the `server` or relevant `location` block that serves the app:

```nginx
add_header Cross-Origin-Opener-Policy same-origin always;
add_header Cross-Origin-Embedder-Policy require-corp always;
```

Use `always` so error responses keep the same isolation policy.

## Express

Set the headers before static middleware:

```ts
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

app.use(express.static('dist'));
```

## COEP Restriction

`Cross-Origin-Embedder-Policy: require-corp` blocks cross-origin resources unless those resources send compatible CORS or CORP headers. WP-0 phase A uses same-origin assets only, so this is expected to be safe. Recheck this note before adding CDN scripts, fonts, images, audio, or model files.

## Verification

After a host is selected by D3 and deployed, verify the live URL:

```js
crossOriginIsolated
```

Expected result:

```text
true
```

Also verify the response headers:

```powershell
curl.exe -I https://example-host/
```

Expected headers:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Actual deployment is conditional until OQ-0.3 / D3 selects the production host.
