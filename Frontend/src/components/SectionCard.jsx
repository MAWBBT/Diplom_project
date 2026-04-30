export default function SectionCard({ title, children, right }) {
  return (
    <section className="bg-slate-900/80 border border-slate-700/60 backdrop-blur-md rounded-2xl p-5 md:p-7 shadow-[0_20px_60px_rgba(2,6,23,0.45)]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-sky-50">{title}</h2>
        {right || null}
      </div>
      {children}
    </section>
  );
}
