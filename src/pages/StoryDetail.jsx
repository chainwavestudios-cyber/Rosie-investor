import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SiteHeader from '@/components/home/SiteHeader';
import SiteFooter from '@/components/home/SiteFooter';
import { getStory } from '@/lib/newsStories';

// One News & Media story, read in full on our own page — no outbound links.
export default function StoryDetail() {
  const { slug } = useParams();
  const story = getStory(slug);

  return (
    <div className="home-theme min-h-screen bg-home-canvas font-home-sans text-home-ink">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-5 py-16 md:px-8 lg:py-24">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-home-muted-ink no-underline transition-colors hover:text-home-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>

        {!story ? (
          <h1 className="mt-10 font-home-display text-4xl leading-tight tracking-tight text-home-ink sm:text-5xl">
            That story is no longer available.
          </h1>
        ) : (
          <article className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-home-muted-ink">
              {story.category} &middot; <time>{story.date}</time>
            </p>

            <h1 className="mt-4 font-home-display text-4xl leading-[1.05] tracking-tight text-home-ink sm:text-5xl">
              {story.title}
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-home-muted-ink">{story.dek}</p>

            <div className="mt-8 overflow-hidden rounded-2xl bg-home-muted">
              <img src={story.image} alt={story.alt} className="aspect-[480/308] w-full object-cover" />
            </div>

            <div className="mt-12 flex flex-col gap-10">
              {story.sections.map((section, index) => (
                <section key={index} className="flex flex-col gap-4">
                  {section.heading && (
                    <h2 className="font-home-display text-2xl leading-tight tracking-tight text-home-ink sm:text-3xl">
                      {section.heading}
                    </h2>
                  )}
                  {section.paragraphs.map((paragraph, pIndex) => (
                    <p key={pIndex} className="text-base leading-relaxed text-home-muted-ink">
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </article>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}