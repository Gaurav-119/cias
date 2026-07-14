export default function Footer() {
  const year = new Date().getFullYear();
  const features = [
    ['Secure', 'Blockchain-powered security'],
    ['Fast', 'Instant claim processing'],
    ['Reliable', 'Trusted and verified service'],
    ['24/7 Support', 'Round-the-clock customer support'],
  ];
  return (
    <footer className="no-print mt-12 bg-gradient-to-br from-slate-800 to-slate-700 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h3 className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-2xl font-extrabold text-transparent">
              Claim Nova
            </h3>
            <p className="mt-3 text-sm text-white/70">
              Leading the future of automotive insurance with blockchain technology
              and AI-powered damage detection.
            </p>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-sky-300">Services</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>Car Insurance</li><li>Damage Claims</li>
              <li>Crypto Payments</li><li>AI Analysis</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-sky-300">Company</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>About Us</li><li>Our Mission</li><li>Team</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-sky-300">Contact</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>gaurav.shingote@dypic.in</li>
              <li>9307098712</li>
              <li>ADYPSOE, Charholi, Pune, 410105</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(([t, d]) => (
            <div key={t} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-white/60">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-white/20 pt-6 text-center text-sm text-white/60">
          © {year} Claim Nova Insurance. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
