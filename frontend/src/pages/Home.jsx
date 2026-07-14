import { Link } from 'react-router-dom';
import homeBg from '../assets/backgrounds/HomePage.jpg';

const features = [
  ['User Registration', 'Register your account and personal details securely', '/register'],
  ['Car Registration', 'Add your vehicle information with multi-angle photos', '/car-registration'],
  ['Premium Payment', 'Pay insurance premium quickly and securely', '/payment'],
  ['Insurance Claim', 'Submit damage claims with AI-powered analysis', '/claim'],
];

const benefits = [
  ['AI-Powered Analysis', 'Advanced computer vision for accurate damage assessment'],
  ['Reliable Service', 'Transparent and secure transactions'],
  ['Instant Processing', 'Quick claim processing with automated validation'],
  ['24/7 Support', 'Round-the-clock customer support and assistance'],
];

export default function Home() {
  return (
    <div>
      <section
        className="relative flex min-h-[70vh] items-center justify-center text-center"
        style={{ backgroundImage: `url(${homeBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-white">
          <h1 className="text-4xl font-extrabold drop-shadow md:text-6xl">
            Claim Nova Insurance
          </h1>
          <p className="mt-3 text-lg font-medium text-white/90 md:text-2xl">
            Crypto Insurance &amp; Automotive Services
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-white/80">
            Secure your vehicle with blockchain-powered insurance and AI-driven
            damage detection.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/register" className="btn-brand">Get Started</Link>
            <Link to="/login" className="btn-outline border-white text-white hover:bg-white hover:text-navy">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-navy py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="bg-gradient-to-r from-sky-500 to-brand bg-clip-text text-center text-3xl font-bold text-transparent">
            How It Works
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(([title, desc, to]) => (
              <Link
                key={title}
                to={to}
                className="rounded-2xl bg-gradient-to-br from-sky-600 to-brand p-6 text-white shadow-lg transition hover:-translate-y-2"
              >
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-white/90">{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy pb-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="bg-gradient-to-r from-violet-500 to-pink-400 bg-clip-text text-center text-3xl font-bold text-transparent">
            Why Choose Claim Nova?
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(([title, desc]) => (
              <div
                key={title}
                className="rounded-2xl bg-gradient-to-br from-violet-600 to-pink-500 p-6 text-white shadow-lg transition hover:-translate-y-2"
              >
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-white/90">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
