export function QuoteQuestAbout() {
  return (
    <section id="about" className="relative scroll-mt-20 bg-[#001F54] py-24">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
        <div className="mb-12 text-center">
          <h2
            className="mb-6 text-[#E6F0FF]"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              letterSpacing: '-0.02em',
            }}
          >
            O nama
          </h2>
        </div>

        <div className="mx-auto max-w-3xl">
          <div
            className="rounded-xl border border-[#00D1FF]/20 bg-[#0A0A0A]/40 p-8 md:p-12"
            style={{ boxShadow: 'inset 0 1px 0 0 rgba(0, 209, 255, 0.1)' }}
          >
            <p className="mb-6 text-lg leading-relaxed text-[#E6F0FF]/80">
              QuoteQuest je AI koji čita i razumije knjige.
              <br />
              Učitajte PDF, postavite pitanje i pronađite tačne citate, stranice i analizu direktno iz
              teksta.
            </p>

            <p className="mb-6 text-lg leading-relaxed text-[#E6F0FF]/80">
              Lektire nikada nisu bile jednostavnije.
              <br />
              Umjesto beskrajnih pretraga i sažetaka, QuoteQuest pronalazi ono što je zaista
              napisano.
              <br />
              Pomaže vam da brzo razumijete sadržaj, pronađete ključne dijelove i učite pametnije,
              bez gubljenja vremena.
            </p>

            <p className="mb-6 text-lg leading-relaxed text-[#E6F0FF]/80">
              QuoteQuest ne zamjenjuje čitanje knjiga, već samo ubrzava obradu, skraćuje potragu za
              informacijama i uklanja sate listanja po stranicama.
            </p>

            <p className="text-lg text-[#00D1FF]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              QuoteQuest ne nagađa — on čita.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
