type DashboardNotesProps = {
  notes?: string | null;
};

export default function DashboardNotes({ notes }: DashboardNotesProps) {
  if (!notes || !notes.trim()) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200 shadow-lg sm:p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Notes</p>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-100">{notes}</p>
    </section>
  );
}
