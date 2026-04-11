export default function SectionCard({ title, children, right }) {
  return (
    <section className="glass fade-up rounded-2xl p-5 md:p-6 shadow-[0_20px_60px_rgba(2,6,23,0.45)]">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg md:text-xl font-semibold tracking-tight">{title}</h2>
        {right || null}
      </div>
      {children}
    </section>
  );
}
