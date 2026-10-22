import React from 'react';
import { ArrowUpRight } from 'lucide-react';

const STORIES = [
  {
    category: 'Articles',
    date: 'July 20, 2026',
    title: 'Record back-to-school costs are putting family budgets to the test',
    url: 'https://www.nationaldebtrelief.com/news-media/record-back-to-school-costs-are-putting-family-budgets-to-the-test/',
    image: 'https://www.nationaldebtrelief.com/wp-content/uploads/2026/08/FORBES-2-Back-to-School-480x308.png',
    alt: 'Mother and young daughter shopping for backpacks together during back-to-school season',
  },
  {
    category: 'Articles',
    date: 'June 25, 2026',
    title: 'CNBC Select highlights National Debt Relief expertise on debt settlement costs',
    url: 'https://www.nationaldebtrelief.com/news-media/cnbc-select-highlights-national-debt-relief-expertise-on-debt-settlement-costs/',
    image: 'https://www.nationaldebtrelief.com/wp-content/uploads/2026/08/CNBC-How-much-does-debt-settlement-cost-480x308.png',
    alt: 'Older couple reviewing finances on a laptop with the CNBC Select logo overlaid',
  },
  {
    category: 'Articles',
    date: 'June 9, 2026',
    title: 'MundoNow highlights Hispanic debt and continued optimism',
    url: 'https://www.nationaldebtrelief.com/news-media/mundonow-highlights-hispanic-debt-and-continued-optimism/',
    image: 'https://www.nationaldebtrelief.com/wp-content/uploads/2026/09/MUNDO-NOW-480x308.png',
    alt: 'Man working on a laptop with the MundoNow logo overlaid',
  },
  {
    category: 'Articles',
    date: 'June 9, 2026',
    title: 'El Diario highlights the growing credit card debt burden among Latinos',
    url: 'https://www.nationaldebtrelief.com/news-media/el-diario-highlights-the-growing-credit-card-debt-burden-among-latinos/',
    image: 'https://www.nationaldebtrelief.com/wp-content/uploads/2026/09/EL-DIARIO-480x308.png',
    alt: 'Person reviewing credit card statements and household finances',
  },
];

export default function HomeNews() {
  return (
    <section className="mt-12 w-full">
      <h2 style={{ color: '#003366', fontSize: '20px', fontWeight: 700, margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" }}>
        News &amp; Media
      </h2>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STORIES.map((story) => (
          <a
            key={story.url}
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col overflow-hidden rounded-2xl border border-[#d7e6f5] bg-white no-underline shadow-sm transition-shadow hover:shadow-md"
          >
            <img
              src={story.image}
              alt={story.alt}
              loading="lazy"
              className="aspect-[16/9] w-full object-cover"
            />
            <div className="flex flex-1 flex-col p-4">
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#2d8ebf]">{story.category}</span>
              <h3 className="mt-2 text-[15px] font-bold leading-snug text-[#003366]">{story.title}</h3>
              <span className="mt-auto pt-3 text-[12px] text-[#475569]">{story.date}</span>
            </div>
            <span className="flex items-center gap-1 border-t border-[#e8f1fa] px-4 py-3 text-[12px] font-semibold text-[#2d8ebf]">
              Read the story
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}