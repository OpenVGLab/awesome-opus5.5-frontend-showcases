import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(200),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).min(1),
    cover: z.string(),
    coverAlt: z.string(),
    featured: z.boolean().default(false),
    keywords: z.string().optional(),
    author: z.string().default('Mara Ellison'),
    video: z
      .object({
        title: z.string(),
        description: z.string(),
        webm: z.string(),
        mp4: z.string(),
        poster: z.string(),
        captions: z.string(),
        chapters: z.string(),
        duration: z.string(),
        uploadDate: z.coerce.date(),
      })
      .optional(),
  }),
});

export const collections = { blog };
