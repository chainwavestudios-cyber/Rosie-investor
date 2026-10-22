import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { NEWS_STORIES } from '@/lib/newsStories';

export default function HomeNews() {
  return (
    <section aria-labelledby="news-heading" className="border-t border-home-line bg-home-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-20 md:px-8 lg:py-28">
        <h2
          id="news-heading"
          className="font-home-display text-4xl leading-none tracking-tight text-home-ink sm:text-5xl md:text-6xl"
        >
          News <span className="italic">&amp;</span> Media
        </h2>

        <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {NEWS_STORIES.map((story) => (
            <li key={story.slug}>
              <Link
                to={`/stories/${story.slug}`}
                className="group flex h-full flex-col gap-5 no-underline"
              >
                <div className="overflow-hidden rounded-2xl bg-home-muted">
                  <img
                    src={story.image}
                    alt={story.alt}
                    loading="lazy"
                    className="aspect-[480/308] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-home-muted-ink">{story.category}</p>
                  <h3 className="text-lg font-semibold leading-snug text-home-ink">{story.title}</h3>
                  <div className="mt-auto flex items-center justify-between border-t border-home-line pt-4 text-sm">
                    <time className="text-home-muted-ink">{story.date}</time>
                    <span className="flex items-center gap-1 font-semibold text-home-ink">
                      Read the story
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}