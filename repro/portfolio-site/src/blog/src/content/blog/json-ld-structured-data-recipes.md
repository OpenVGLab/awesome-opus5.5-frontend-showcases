---
title: "JSON-LD Recipes: Structured Data That Actually Ships"
description: Copy-paste JSON-LD for Person, FAQ, Product, Review, Event and Breadcrumb markup — plus how to test it before search engines do.
pubDate: 2026-02-19
updatedDate: 2026-03-04
tags: [seo, json-ld, javascript]
cover: images/blog/json-ld-structured-data-recipes.webp
coverAlt: Curly braces connected by lines into a network of nodes on a dark background
keywords: JSON-LD, structured data, schema.org, rich results, technical SEO, FAQ schema
---

Structured data is the closest thing SEO has to an API contract. You describe what a page *is* — a person, a product, an event — and search engines can show richer results. JSON-LD keeps that description in a single script tag, separate from your markup. These are the recipes I use on client sites, including [this portfolio](/).

## Why JSON-LD

Microdata and RDFa sprinkle attributes throughout your HTML, which makes refactoring risky. JSON-LD lives in one `<script type="application/ld+json">` block and can be generated from the same data that renders the page, so it never drifts out of sync.

## Person and WebSite

Every portfolio should say who it belongs to. Link profiles with `sameAs` so search engines can connect them.

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Mara Ellison",
  "jobTitle": "Creative Frontend Developer",
  "url": "https://maraellison.dev/",
  "sameAs": ["https://github.com/maraellison", "https://www.linkedin.com/in/maraellison"]
}
```

## FAQPage

FAQ markup also helps voice assistants, which read answers aloud. Write questions the way people actually ask them.

```json
{
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "How long does a typical project take?",
    "acceptedAnswer": { "@type": "Answer", "text": "Usually four to eight weeks." }
  }]
}
```

## Product with reviews

If you sell something — a template, a course, a UI kit — mark it up with an offer and an aggregate rating. Only mark up reviews that are visible on the page.

```json
{
  "@type": "Product",
  "name": "Lumen UI",
  "offers": { "@type": "Offer", "price": "79.00", "priceCurrency": "EUR", "availability": "https://schema.org/InStock" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "320" }
}
```

## Events

Talks and workshops can appear in event search. Include the attendance mode, especially for online events.

```json
{
  "@type": "Event",
  "name": "Hands-on WebGL for Frontend Developers",
  "startDate": "2026-12-03T16:00:00+00:00",
  "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
  "location": { "@type": "VirtualLocation", "url": "https://maraellison.dev/#experience" }
}
```

## Breadcrumbs

Breadcrumb markup replaces the raw URL in results with a readable path. It should mirror the visible breadcrumb exactly — like the one at the top of this article.

```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://maraellison.dev/" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://maraellison.dev/blog/" }
  ]
}
```

> [!NOTE]
> Validate with the Schema Markup Validator and Google's Rich Results Test before shipping. Both catch missing required properties that silently disqualify rich results.

## Testing checklist

- Generate JSON-LD from the same data as the visible content.
- Use one `@graph` per page and give entities stable `@id` values.
- Keep dates in ISO 8601 with a timezone.
- Re-test after every content-model change.

Structured data is only one part of technical SEO; fast rendering matters just as much, as covered in the [Core Web Vitals playbook](/blog/core-web-vitals-for-creative-websites/).
