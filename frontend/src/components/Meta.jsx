import React from "react";
import { Helmet } from "react-helmet-async";

function truncate(text, n = 160) {
  if (!text) return "";
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}

export default function Meta({ title, description, url, image }) {
  const siteName = "Duo Bro Mart";
  const fullTitle = title
    ? (title.endsWith(` — ${siteName}`) ? title : `${title} — ${siteName}`)
    : siteName;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={truncate(description, 160)} />}
      {url && <link rel="canonical" href={url} />}
      {/* Open Graph */}
      <meta property="og:site_name" content={siteName} />
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={truncate(description, 160)} />}
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}
      <meta property="og:type" content="website" />
      {/* Twitter */}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
    </Helmet>
  );
}
