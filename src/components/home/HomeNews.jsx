import React from 'react';
import { ArrowUpRight } from 'lucide-react';

const STORIES = [
  {
    date: 'July 20, 2026',
    title: 'Record back-to-school costs are putting family budgets to the test',
    url: 'https://www.nationaldebtrelief.com/news-media/record-back-to-school-costs-are-putting-family-budgets-to-the-test/',
    image: '/images/forbes.png',
    alt: 'Mother and young daughter shopping for backpacks together during back-to-school season',
  },
  {
    date: 'June 25, 2026',
    title: 'CNBC Select highlights Debt Solutions expertise on debt settlement costs',
    url: 'https://www.nationaldebtrelief.com/news-media/cnbc-select-highlights-national-debt-relief-expertise-on-debt-settlement-costs/',
    image: '/images/cnbc.png',
    alt: 'Older couple reviewing finances on a laptop with the CNBC Select logo overlaid',
  },
  {
    date: 'June 9, 2026',
    title: 'MundoNow highlights Hispanic debt and continued optimism',
    url: 'https://www.nationaldebtrelief.com/news-media/mundonow-highlights-hispanic-debt-and-continued-optimism/',
    image: '/images/mundonow.png',
    alt: 'Man working on a laptop with the MundoNow logo overlaid',
  },
  {
    date: 'June 9, 2026',
    title: 'El Diario highlights the growing credit card debt burden among Latinos',
    url: 'https://www.nationaldebtrelief.com/news-media/el-diario-highlights-the-growing-credit-card-debt-burden-among-latinos/',
    image: '/images/eldiario.png',
    alt: 'Person reviewing credit card statements and household finances',
  },
];

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
          {STORIES.map((story) => (
            <li key={story.url}>
              <a
                href={story.url}
                target="_blank"
                rel="noopener noreferrer"
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
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-home-muted-ink">Articles</p>
                  <h3 className="text-lg font-semibold leading-snug text-home-ink">{story.title}</h3>
                  <div className="mt-auto flex items-center justify-between border-t border-home-line pt-4 text-sm">
                    <time className="text-home-muted-ink">{story.date}</time>
                    <span className="flex items-center gap-1 font-semibold text-home-ink">
                      Read the story
                      <ArrowUpRight
                        className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}