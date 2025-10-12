import { cn } from 'fumadocs-ui/utils/cn';
import {
  Brain,
  ChevronRight,
  CircleCheck,
  CloudLightning,
  Github,
  LayoutTemplate,
  SquareTerminal,
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const features = [
    {
      title: 'Lightning Fast',
      description:
        'Translate entire apps in seconds with smart batching and concurrent processing',
      icon: CloudLightning,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBorderColor: 'border-blue-600 dark:border-blue-400',
    },
    {
      title: 'Smart Change Detection',
      description:
        'Only translates new or modified content, saving time and API costs',
      icon: CircleCheck,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      iconBorderColor: 'border-green-600 dark:border-green-400',
    },
    {
      title: 'Plugin Architecture',
      description:
        'Extensible system supporting JSON, MDX, and custom file formats',
      icon: LayoutTemplate,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBorderColor: 'border-purple-600 dark:border-purple-400',
    },
    {
      title: 'Format Preservation',
      description:
        'Maintains code syntax, HTML tags, JSX components, and template variables',
      icon: () => (
        <svg
          aria-hidden="true"
          className="h-6 w-6 text-orange-600 dark:text-orange-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <title>Format Preservation</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      ),
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      iconBorderColor: 'border-orange-600 dark:border-orange-400',
    },
    {
      title: 'Any AI Provider',
      description:
        'Works with OpenAI, Google AI, Anthropic, and any Vercel AI SDK provider',
      icon: Brain,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      iconBorderColor: 'border-red-600 dark:border-red-400',
    },
    {
      title: 'Simple CLI',
      description:
        'Easy-to-use command-line interface with debug and dry-run modes',
      icon: SquareTerminal,
      iconBg: 'bg-teal-100 dark:bg-teal-900/30',
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBorderColor: 'border-teal-600 dark:border-teal-400',
    },
  ];

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero Section */}
      <section className="container flex flex-col items-center justify-center gap-8 px-4 py-24 text-center md:py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border bg-fd-secondary/50 px-4 py-1.5 text-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-green-500"></span>
            </span>
            AI-powered translation for modern apps
          </div>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Translate your app in{' '}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              seconds
            </span>
          </h1>
          <p className="max-w-2xl text-lg text-fd-muted-foreground md:text-xl">
            Fast, scalable, and efficient translation system for React
            components and Markdown documents using AI. One command to translate
            everything.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-lg bg-fd-primary px-6 py-3 text-sm font-medium text-fd-primary-foreground shadow-lg transition-all hover:bg-fd-primary/90 hover:shadow-xl"
          >
            Get Started
            <ChevronRight className="ml-2" size={16} />
          </Link>
          <Link
            href="https://github.com/greatfrontend/langnostic"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border bg-fd-background px-6 py-3 text-sm font-medium shadow-sm transition-all hover:bg-fd-accent hover:shadow-md"
          >
            <Github className="mr-2 size-5" />
            View on GitHub
          </Link>
        </div>
        {/* Quick Install */}
        <div className="mt-8 w-full max-w-2xl">
          <div className="rounded-lg border bg-fd-secondary/30 p-4">
            <code className="text-sm">
              <span className="text-fd-muted-foreground">$</span>{' '}
              <span className="font-semibold">npm install langnostic</span>
            </code>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-fd-secondary/20 py-24">
        <div className="container px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Why Langnostic?
            </h2>
            <p className="text-lg text-fd-muted-foreground">
              Built for developers who need fast, reliable translations
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border bg-fd-background p-6 shadow-sm transition-all hover:shadow-md"
              >
                <div
                  className={cn(
                    'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg',
                    ['border', feature.iconBorderColor],
                    feature.iconBg,
                  )}
                >
                  <feature.icon
                    aria-hidden="true"
                    className={cn('size-6', feature.iconColor)}
                  />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-fd-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t py-24">
        <div className="container px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Ready to translate your app?
          </h2>
          <p className="mb-8 text-lg text-fd-muted-foreground">
            Get started with Langnostic in less than 5 minutes
          </p>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-lg bg-fd-primary px-8 py-4 text-base font-medium text-fd-primary-foreground shadow-lg transition-all hover:bg-fd-primary/90 hover:shadow-xl"
          >
            Read the Documentation
            <ChevronRight className="ml-2" size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
