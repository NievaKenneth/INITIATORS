
export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-5 md:px-12">
        <h1 className="text-xl font-bold tracking-wide">
          HOPE<span className="text-emerald-400"> INC.</span>
        </h1>

        <a
          href="#about"
          className="rounded-lg border border-white/20 px-4 py-2 text-sm transition hover:bg-white/10"
        >
          About Us
        </a>
      </nav>

      <section className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
          Welcome to Hope Inc.
        </p>

        <h2 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          Building a better future, together.
        </h2>

        <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 md:text-lg">
          A place to connect, share ideas, and make a positive difference
          in our community.
        </p>

        <a
          href="#about"
          className="mt-8 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          Learn More
        </a>
      </section>

      <section
        id="about"
        className="border-t border-white/10 px-6 py-16 text-center"
      >
        <h3 className="text-2xl font-bold">About Hope Inc.</h3>

        <p className="mx-auto mt-4 max-w-2xl leading-7 text-zinc-400">
          Hope Inc. aims to bring people together through shared goals,
          useful tools, and a commitment to positive change.
        </p>
      </section>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} Hope Inc. All rights reserved.
      </footer>
    </main>
  );
}
